require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const orderRoutes = require("./routes/orderRoutes");
const shopifyWebhookRoutes = require("./routes/shopifyWebhookRoutes");

const app = express();
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1 style="color: #d32f2f;">Agkey Pro - TMS</h1>
      <p>专业办公家具交付系统已上线</p>
      <p style="color: #666;">核心背书：ENF 级环保标准 (≤ 0.025 mg/m³)</p>
      <hr style="width: 200px; margin: 20px auto;">
      <p>请输入具体的订单追踪号访问配送状态。</p>
    </div>
  `);
});
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json({ type: "application/json" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "agkey-pro-tms"
  });
});

// Local fallback for MVP POD images. In production, Cloudinary secure_url values
// are stored in MongoDB and served directly from Cloudinary.
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

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Request processing failed"
  });
});

async function startServer() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  app.listen(port, () => {
    console.log(`TMS backend listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}

module.exports = app;
