const axios = require("axios");

const WEBHOOK_URL = "http://localhost:3000/api/webhooks/shopify/order-paid";

const mockShopifyOrder = {
  id: `test-order-${Date.now()}`,
  name: "#TEST-LOCAL-DELIVERY",
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

async function testWebhook() {
  try {
    const response = await axios.post(WEBHOOK_URL, mockShopifyOrder, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log("Webhook response:");
    console.log(response.data);
  } catch (error) {
    console.error("Webhook test failed:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", error.response.data);
      return;
    }

    console.error(error.message);
  }
}

testWebhook();
