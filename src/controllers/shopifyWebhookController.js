const DeliveryOrder = require("../models/DeliveryOrder");
const { generateTrackingId } = require("../utils/trackingId");
const { buildTrackingUrl } = require("../utils/trackingUrl");

const DEFAULT_LOCAL_DELIVERY_KEYWORDS = [
  "local delivery",
  "local_delivery",
  "local-delivery"
];

function getLocalDeliveryKeywords() {
  const configuredKeywords = process.env.LOCAL_DELIVERY_KEYWORDS;

  if (!configuredKeywords) {
    return DEFAULT_LOCAL_DELIVERY_KEYWORDS;
  }

  return configuredKeywords
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeShippingLine(shippingLine) {
  return [
    shippingLine.title,
    shippingLine.code,
    shippingLine.source,
    shippingLine.delivery_category,
    shippingLine.carrier_identifier
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isLocalDeliveryOrder(shopifyOrder) {
  // Shopify source: req.body.shipping_lines[]
  // Common useful fields are shipping_lines[].title and shipping_lines[].code.
  const shippingLines = Array.isArray(shopifyOrder.shipping_lines)
    ? shopifyOrder.shipping_lines
    : [];

  const localDeliveryKeywords = getLocalDeliveryKeywords();

  return shippingLines.some((shippingLine) => {
    const searchableShippingText = normalizeShippingLine(shippingLine);

    return localDeliveryKeywords.some((keyword) =>
      searchableShippingText.includes(keyword)
    );
  });
}

function getShopifyOrderId(shopifyOrder) {
  // Shopify source: req.body.id is the numeric REST order ID.
  // Fallbacks are included only to make tests and manual payloads easier.
  return String(
    shopifyOrder.id ||
      shopifyOrder.admin_graphql_api_id ||
      shopifyOrder.order_number ||
      ""
  ).trim();
}

function buildCustomerName(shopifyOrder) {
  // Shopify source: req.body.shipping_address.name, with customer fallback from req.body.customer.
  const shippingAddress = shopifyOrder.shipping_address || {};
  const customer = shopifyOrder.customer || {};
  const customerFullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ");

  return shippingAddress.name || customerFullName || shopifyOrder.name || "Unknown Customer";
}

function mapLineItems(shopifyOrder) {
  // Shopify source: req.body.line_items[]
  return Array.isArray(shopifyOrder.line_items)
    ? shopifyOrder.line_items.map((item) => ({
        itemName: item.title || item.name || item.sku || "Unknown item",
        quantity: Number(item.quantity || 0)
      }))
    : [];
}

function mapDeliveryAddress(shopifyOrder) {
  // Shopify source: req.body.shipping_address
  const shippingAddress = shopifyOrder.shipping_address || {};
  const street = [shippingAddress.address1, shippingAddress.address2]
    .filter(Boolean)
    .join(", ");

  return {
    street,
    suburb: shippingAddress.city || "",
    state: shippingAddress.province_code || shippingAddress.province || "",
    postcode: shippingAddress.zip || ""
  };
}

function mapDeliveryOrderPayload(shopifyOrder, trackingId) {
  const shippingAddress = shopifyOrder.shipping_address || {};
  const customer = shopifyOrder.customer || {};

  return {
    shopifyOrderId: getShopifyOrderId(shopifyOrder),
    trackingId,
    customerName: buildCustomerName(shopifyOrder),
    // Shopify sources: req.body.shipping_address.phone, req.body.phone, req.body.customer.phone
    phoneNumber: shippingAddress.phone || shopifyOrder.phone || customer.phone || "",
    // Shopify sources: req.body.email, req.body.customer.email
    email: shopifyOrder.email || customer.email || "",
    deliveryAddress: mapDeliveryAddress(shopifyOrder),
    // Shopify source: req.body.note
    deliveryInstructions: shopifyOrder.note || "",
    lineItems: mapLineItems(shopifyOrder)
  };
}

async function generateUniqueTrackingId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trackingId = generateTrackingId();
    const alreadyExists = await DeliveryOrder.exists({ trackingId });

    if (!alreadyExists) {
      return trackingId;
    }
  }

  throw new Error("Unable to generate a unique tracking ID");
}

async function handleShopifyOrderPaid(req, res, next) {
  try {
    // Step 1: Receive & Verify.
    // HMAC verification is intentionally skipped/mocked for this first stage.
    // In production, verify the raw request body against x-shopify-hmac-sha256.
    const shopifyOrder = req.body;

    if (!shopifyOrder || typeof shopifyOrder !== "object") {
      return res.status(400).json({
        received: false,
        message: "Invalid Shopify webhook payload"
      });
    }

    // Step 2: Filter for Local Delivery using req.body.shipping_lines[].
    if (!isLocalDeliveryOrder(shopifyOrder)) {
      return res.status(200).json({
        received: true,
        processed: false,
        reason: "Order is not a local delivery order"
      });
    }

    const shopifyOrderId = getShopifyOrderId(shopifyOrder);

    if (!shopifyOrderId) {
      return res.status(400).json({
        received: false,
        message: "Shopify order ID is missing"
      });
    }

    const existingDeliveryOrder = await DeliveryOrder.findOne({ shopifyOrderId });

    if (existingDeliveryOrder) {
      const trackingUrl = buildTrackingUrl(existingDeliveryOrder.trackingId);
      console.log(`Tracking URL for existing order: ${trackingUrl}`);

      return res.status(200).json({
        received: true,
        processed: true,
        duplicate: true,
        trackingId: existingDeliveryOrder.trackingId
      });
    }

    // Steps 3 and 4: Extract data from the Shopify JSON and create the MongoDB record.
    const trackingId = await generateUniqueTrackingId();
    const deliveryOrderPayload = mapDeliveryOrderPayload(shopifyOrder, trackingId);
    const deliveryOrder = await DeliveryOrder.create(deliveryOrderPayload);

    // Step 5: Generate tracking link for later SMS/email/customer use.
    const trackingUrl = buildTrackingUrl(deliveryOrder.trackingId);
    console.log(`Tracking URL for new local delivery order: ${trackingUrl}`);

    // Step 6: Acknowledge Shopify's webhook.
    return res.status(200).json({
      received: true,
      processed: true,
      trackingId: deliveryOrder.trackingId
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  handleShopifyOrderPaid,
  isLocalDeliveryOrder,
  mapDeliveryOrderPayload
};
