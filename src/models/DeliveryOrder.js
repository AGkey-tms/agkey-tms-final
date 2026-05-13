const mongoose = require("mongoose");

const DeliveryAddressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      trim: true,
      default: ""
    },
    suburb: {
      type: String,
      trim: true,
      default: ""
    },
    state: {
      type: String,
      trim: true,
      default: ""
    },
    postcode: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const LineItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const DeliveryOrderSchema = new mongoose.Schema(
  {
    shopifyOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    trackingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    deliveryAddress: {
      type: DeliveryAddressSchema,
      required: true
    },
    deliveryInstructions: {
      type: String,
      trim: true,
      default: ""
    },
    lineItems: {
      type: [LineItemSchema],
      default: []
    },
    status: {
      type: String,
      default: "Order Confirmed",
      trim: true
    },
    podImageUrl: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DeliveryOrder", DeliveryOrderSchema);
