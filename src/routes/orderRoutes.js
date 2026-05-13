const express = require("express");
const { createDeliveryOrder } = require("../controllers/orderCreationController");
const { fulfillDeliveryOrder } = require("../controllers/orderFulfillmentController");
const { updateDeliveryOrderStatus } = require("../controllers/orderStatusController");
const { getDeliveryOrder } = require("../controllers/orderTrackingController");
const { podImageUpload } = require("../middleware/podUpload");

const router = express.Router();

// Full path: POST /api/orders
// Local/demo creation endpoint for testing the TMS without a Shopify webhook.
router.post("/", createDeliveryOrder);

// Full path: GET /api/orders/:trackingId
router.get("/:trackingId", getDeliveryOrder);

// Full path: POST /api/orders/:trackingId/fulfill
router.post("/:trackingId/fulfill", fulfillDeliveryOrder);

// Full path: PATCH /api/orders/:trackingId/status
// Expects multipart/form-data when a POD photo is included.
// File field name from the driver app: podImage
router.patch(
  "/:trackingId/status",
  podImageUpload.single("podImage"),
  updateDeliveryOrderStatus
);

module.exports = router;
