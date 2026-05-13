const DeliveryOrder = require("../models/DeliveryOrder");
const { fulfillShopifyOrder, ShopifyApiError } = require("../services/shopifyAdminClient");
const { buildTrackingUrl } = require("../utils/trackingUrl");

function formatDeliveryAddress(deliveryAddress = {}) {
  const suburbStatePostcode = [
    deliveryAddress.suburb,
    deliveryAddress.state,
    deliveryAddress.postcode
  ]
    .filter(Boolean)
    .join(" ");

  return [deliveryAddress.street, suburbStatePostcode]
    .filter(Boolean)
    .join(", ");
}

function buildLabelData(deliveryOrder, trackingUrl) {
  return {
    customerName: deliveryOrder.customerName,
    formattedDeliveryAddress: formatDeliveryAddress(deliveryOrder.deliveryAddress),
    phoneNumber: deliveryOrder.phoneNumber,
    trackingId: deliveryOrder.trackingId,
    trackingUrl,
    items: deliveryOrder.lineItems.map((item) => ({
      itemName: item.itemName,
      quantity: item.quantity
    }))
  };
}

async function fulfillDeliveryOrder(req, res, next) {
  try {
    const { trackingId } = req.params;

    const deliveryOrder = await DeliveryOrder.findOneAndUpdate(
      { trackingId },
      { $set: { status: "Processing" } },
      { new: true }
    );

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery order not found"
      });
    }

    const trackingUrl = buildTrackingUrl(deliveryOrder.trackingId);

    try {
      const shopifyResult = await fulfillShopifyOrder({
        shopifyOrderId: deliveryOrder.shopifyOrderId,
        trackingId: deliveryOrder.trackingId,
        trackingUrl
      });

      return res.status(200).json({
        success: true,
        order: deliveryOrder,
        labelData: buildLabelData(deliveryOrder, trackingUrl),
        shopify: {
          fulfillmentOrderId: shopifyResult.fulfillmentOrder.id,
          fulfillmentId: shopifyResult.fulfillment?.id || null,
          status: shopifyResult.fulfillment?.status || null,
          tracking_company: shopifyResult.fulfillment?.tracking_company || null,
          tracking_number: shopifyResult.fulfillment?.tracking_number || null,
          tracking_urls: shopifyResult.fulfillment?.tracking_urls || []
        }
      });
    } catch (error) {
      if (error instanceof ShopifyApiError) {
        console.error("Shopify fulfillment sync failed", {
          statusCode: error.statusCode,
          endpoint: error.endpoint,
          details: error.details
        });

        return res.status(502).json({
          success: false,
          message:
            "Order was moved to Processing locally, but Shopify fulfillment sync failed",
          order: deliveryOrder,
          labelData: buildLabelData(deliveryOrder, trackingUrl),
          shopifyError: {
            statusCode: error.statusCode,
            endpoint: error.endpoint,
            details: error.details
          }
        });
      }

      throw error;
    }
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  fulfillDeliveryOrder,
  buildLabelData,
  formatDeliveryAddress
};
