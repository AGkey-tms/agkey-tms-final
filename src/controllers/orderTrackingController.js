const DeliveryOrder = require("../models/DeliveryOrder");

async function getDeliveryOrder(req, res, next) {
  try {
    const { trackingId } = req.params;
    const deliveryOrder = await DeliveryOrder.findOne({ trackingId });

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery order not found"
      });
    }

    return res.status(200).json({
      success: true,
      order: deliveryOrder
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDeliveryOrder
};
