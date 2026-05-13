const axios = require("axios");

const DEFAULT_SHOPIFY_API_VERSION = "2026-01";
const TRACKING_COMPANY = "Agkey Local Delivery";

class ShopifyApiError extends Error {
  constructor(message, { statusCode = 500, endpoint = "", details = null } = {}) {
    super(message);
    this.name = "ShopifyApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.details = details;
  }
}

function normalizeShopifyStoreUrl(storeUrl) {
  if (!storeUrl) {
    return "";
  }

  const urlWithProtocol = /^https?:\/\//i.test(storeUrl)
    ? storeUrl
    : `https://${storeUrl}`;

  return urlWithProtocol.replace(/\/+$/, "");
}

function getShopifyConfig() {
  const storeUrl = normalizeShopifyStoreUrl(process.env.SHOPIFY_STORE_URL);
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion =
    process.env.SHOPIFY_API_VERSION || DEFAULT_SHOPIFY_API_VERSION;

  if (!storeUrl || !accessToken) {
    throw new ShopifyApiError("Shopify Admin API credentials are missing", {
      statusCode: 500,
      details: {
        requiredEnvVars: ["SHOPIFY_STORE_URL", "SHOPIFY_ACCESS_TOKEN"]
      }
    });
  }

  return {
    storeUrl,
    accessToken,
    apiVersion
  };
}

function buildAdminApiUrl(path) {
  const { storeUrl, apiVersion } = getShopifyConfig();

  return `${storeUrl}/admin/api/${apiVersion}${path}`;
}

async function shopifyRequest(method, path, body) {
  const { accessToken } = getShopifyConfig();
  const endpoint = buildAdminApiUrl(path);

  try {
    const response = await axios({
      method,
      url: endpoint,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      data: body
    });

    return response.data;
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const responseBody = error.response?.data || error.message;

    throw new ShopifyApiError(`Shopify Admin API request failed`, {
      statusCode,
      endpoint: path,
      details: responseBody
    });
  }
}

async function getFulfillmentOrdersForOrder(shopifyOrderId) {
  // Shopify transition point:
  // We start with our stored Shopify Order ID, then ask Shopify for the
  // FulfillmentOrder records that are now required when creating fulfillments.
  // GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json
  const responseBody = await shopifyRequest(
    "GET",
    `/orders/${encodeURIComponent(shopifyOrderId)}/fulfillment_orders.json`
  );

  return Array.isArray(responseBody?.fulfillment_orders)
    ? responseBody.fulfillment_orders
    : [];
}

function hasFulfillableItems(fulfillmentOrder) {
  return Array.isArray(fulfillmentOrder.line_items)
    ? fulfillmentOrder.line_items.some((item) => {
        const fulfillableQuantity = Number(
          item.fulfillable_quantity ?? item.quantity ?? 0
        );

        return fulfillableQuantity > 0;
      })
    : false;
}

function canCreateFulfillment(fulfillmentOrder) {
  const supportedActions = Array.isArray(fulfillmentOrder.supported_actions)
    ? fulfillmentOrder.supported_actions
    : [];

  return (
    supportedActions.includes("create_fulfillment") ||
    (fulfillmentOrder.status === "open" && hasFulfillableItems(fulfillmentOrder))
  );
}

function selectFulfillmentOrder(fulfillmentOrders) {
  return fulfillmentOrders.find(canCreateFulfillment);
}

async function createFulfillment({ fulfillmentOrderId, trackingId, trackingUrl }) {
  // Shopify requires a FulfillmentOrder ID here, not the original Order ID.
  // POST /admin/api/{version}/fulfillments.json
  const payload = {
    fulfillment: {
      notify_customer: true,
      line_items_by_fulfillment_order: [
        {
          fulfillment_order_id: fulfillmentOrderId
        }
      ],
      tracking_info: {
        // Maps to Shopify response field: tracking_company
        company: TRACKING_COMPANY,
        // Maps to Shopify response field: tracking_number
        number: trackingId,
        // REST accepts one URL here; Shopify returns it as tracking_urls[0].
        url: trackingUrl
      }
    }
  };

  const responseBody = await shopifyRequest("POST", "/fulfillments.json", payload);

  return responseBody?.fulfillment;
}

async function fulfillShopifyOrder({ shopifyOrderId, trackingId, trackingUrl }) {
  const fulfillmentOrders = await getFulfillmentOrdersForOrder(shopifyOrderId);
  const fulfillmentOrder = selectFulfillmentOrder(fulfillmentOrders);

  if (!fulfillmentOrder) {
    throw new ShopifyApiError("No fulfillable Shopify FulfillmentOrder found", {
      statusCode: 409,
      endpoint: `/orders/${shopifyOrderId}/fulfillment_orders.json`,
      details: {
        fulfillmentOrderCount: fulfillmentOrders.length,
        statuses: fulfillmentOrders.map((order) => ({
          id: order.id,
          status: order.status,
          supported_actions: order.supported_actions
        }))
      }
    });
  }

  const fulfillment = await createFulfillment({
    fulfillmentOrderId: fulfillmentOrder.id,
    trackingId,
    trackingUrl
  });

  return {
    fulfillmentOrder,
    fulfillment
  };
}

module.exports = {
  ShopifyApiError,
  fulfillShopifyOrder,
  getFulfillmentOrdersForOrder
};
