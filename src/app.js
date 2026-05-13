const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const orderRoutes = require("./routes/orderRoutes");
const shopifyWebhookRoutes = require("./routes/shopifyWebhookRoutes");

const app = express();

app.use(cors());

// For this first stage, JSON parsing is enough.
// Production Shopify HMAC verification should use the raw request body.
app.use(express.json({ type: "application/json" }));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/webhooks/shopify", shopifyWebhookRoutes);
app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError || err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  return res.status(500).json({
    success: false,
    message: "Request processing failed"
  });
});

module.exports = app;
