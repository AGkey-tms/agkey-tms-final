const express = require("express");
const {
  handleShopifyOrderPaid
} = require("../controllers/shopifyWebhookController");

const router = express.Router();

// Full path: POST /api/webhooks/shopify/order-paid
router.post("/order-paid", handleShopifyOrderPaid);

module.exports = router;
