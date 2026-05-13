const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const API_BASE_URL = "http://localhost:3000/api";
const HEALTH_URL = "http://localhost:3000/health";
const dummyPhotoPath = path.join(__dirname, "dummy-photo.jpg");

let startedServer = null;
let memoryMongo = null;

async function isBackendAlreadyRunning() {
  try {
    await axios.get(HEALTH_URL, { timeout: 1000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function startLocalBackendIfNeeded() {
  if (await isBackendAlreadyRunning()) {
    console.log("Using existing backend at http://localhost:3000");
    return;
  }

  memoryMongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryMongo.getUri();
  process.env.TRACKING_BASE_URL = process.env.TRACKING_BASE_URL || "http://localhost:3000";

  const app = require("./src/app");
  await mongoose.connect(process.env.MONGODB_URI);

  await new Promise((resolve) => {
    startedServer = app.listen(3000, resolve);
  });

  console.log("Started local backend at http://localhost:3000 with in-memory MongoDB");
}

async function stopLocalBackendIfStarted() {
  if (startedServer) {
    await new Promise((resolve, reject) => {
      startedServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (memoryMongo) {
    await memoryMongo.stop();
  }
}

function buildMockShopifyOrder() {
  const uniqueOrderId = `test-order-${Date.now()}`;

  return {
    id: uniqueOrderId,
    name: `#${uniqueOrderId}`,
    email: "customer@example.com",
    phone: "+61400123456",
    note: "Please leave the order near the front door.",
    customer: {
      first_name: "Taylor",
      last_name: "Nguyen",
      email: "customer@example.com",
      phone: "+61400123456"
    },
    shipping_address: {
      name: "Taylor Nguyen",
      phone: "+61400123456",
      address1: "18 Market Lane",
      address2: "Apartment 4",
      city: "Richmond",
      province: "Victoria",
      province_code: "VIC",
      zip: "3121",
      country: "Australia"
    },
    shipping_lines: [
      {
        title: "Local Delivery",
        code: "Local Delivery"
      }
    ],
    line_items: [
      {
        title: "Organic Pantry Box",
        name: "Organic Pantry Box",
        sku: "PANTRY-BOX-001",
        quantity: 1
      },
      {
        title: "Cold Pressed Juice Pack",
        name: "Cold Pressed Juice Pack",
        sku: "JUICE-PACK-006",
        quantity: 2
      }
    ]
  };
}

async function postWebhook() {
  const response = await axios.post(
    `${API_BASE_URL}/webhooks/shopify/order-paid`,
    buildMockShopifyOrder(),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  const trackingId = response.data.trackingId;

  if (!trackingId) {
    throw new Error("Webhook response did not include a trackingId");
  }

  console.log("1. Webhook created order:", trackingId);
  return trackingId;
}

async function updateOutForDelivery(trackingId) {
  const response = await axios.patch(
    `${API_BASE_URL}/orders/${encodeURIComponent(trackingId)}/status`,
    {
      status: "Out for Delivery"
    },
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  console.log("2. Driver status update:", response.data.order.status);
}

async function uploadProofOfDelivery(trackingId) {
  fs.writeFileSync(dummyPhotoPath, "dummy proof of delivery photo content");

  const formData = new FormData();
  formData.append("status", "Delivered");
  formData.append("podImage", fs.createReadStream(dummyPhotoPath), {
    filename: "dummy-photo.jpg",
    contentType: "image/jpeg"
  });

  const response = await axios.patch(
    `${API_BASE_URL}/orders/${encodeURIComponent(trackingId)}/status`,
    formData,
    {
      headers: formData.getHeaders()
    }
  );

  console.log("3. POD upload status:", response.data.order.status);
  console.log("   POD image URL:", response.data.order.podImageUrl);
}

async function fetchFinalOrder(trackingId) {
  const response = await axios.get(
    `${API_BASE_URL}/orders/${encodeURIComponent(trackingId)}`
  );

  console.log("4. Final fetched order:");
  console.log(JSON.stringify(response.data.order, null, 2));

  return response.data.order;
}

async function runE2E() {
  try {
    await startLocalBackendIfNeeded();

    const trackingId = await postWebhook();
    await updateOutForDelivery(trackingId);
    await uploadProofOfDelivery(trackingId);
    const finalOrder = await fetchFinalOrder(trackingId);

    if (finalOrder.status !== "Delivered" || !finalOrder.podImageUrl) {
      throw new Error("Final order did not reach Delivered state with a POD image URL");
    }

    console.log("E2E test passed.");
  } catch (error) {
    console.error("E2E test failed.");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", error.response.data);
      return;
    }

    console.error(error.message);
  } finally {
    await stopLocalBackendIfStarted();
  }
}

runE2E();
