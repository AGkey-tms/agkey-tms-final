const DeliveryOrder = require("../models/DeliveryOrder");
const { generateTrackingId } = require("../utils/trackingId");

function normalizeLineItems(lineItems) {
  if (!Array.isArray(lineItems)) {
    return [];
  }

  return lineItems.map((item) => ({
    itemName: String(item.itemName || item.title || item.name || "Agkey item").trim(),
    quantity: Number(item.quantity || 1)
  }));
}

function normalizeDeliveryAddress(deliveryAddress = {}) {
  return {
    street: String(deliveryAddress.street || "").trim(),
    suburb: String(deliveryAddress.suburb || "").trim(),
    state: String(deliveryAddress.state || "").trim(),
    postcode: String(deliveryAddress.postcode || "").trim()
  };
}

async function generateUniqueTrackingId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trackingId = generateTrackingId();
    const existingOrder = await DeliveryOrder.exists({ trackingId });

    if (!existingOrder) {
      return trackingId;
    }
  }

  throw new Error("Unable to generate a unique tracking ID");
}

async function createDeliveryOrder(req, res, next) {
  try {
    const requestedTrackingId = String(req.body.trackingId || "")
      .trim()
      .toUpperCase();
    const trackingId = requestedTrackingId || (await generateUniqueTrackingId());
    const shopifyOrderId =
      String(req.body.shopifyOrderId || "").trim() || `manual-${Date.now()}-${trackingId}`;
    const customerName = String(req.body.customerName || "").trim();

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "customerName is required"
      });
    }

    const deliveryOrder = await DeliveryOrder.create({
      shopifyOrderId,
      trackingId,
      customerName,
      phoneNumber: String(req.body.phoneNumber || "").trim(),
      email: String(req.body.email || "").trim(),
      deliveryAddress: normalizeDeliveryAddress(req.body.deliveryAddress),
      deliveryInstructions: String(req.body.deliveryInstructions || "").trim(),
      lineItems: normalizeLineItems(req.body.lineItems),
      status: String(req.body.status || "Order Confirmed").trim(),
      podImageUrl: String(req.body.podImageUrl || "").trim()
    });

    return res.status(201).json({
      success: true,
      order: deliveryOrder
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Delivery order already exists",
        keyPattern: error.keyPattern
      });
    }

    return next(error);
  }
}

module.exports = {
  createDeliveryOrder
};
