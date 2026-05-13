const fs = require("fs/promises");
const DeliveryOrder = require("../models/DeliveryOrder");
const { buildTrackingUrl } = require("../utils/trackingUrl");

let cloudinary;

try {
  cloudinary = require("cloudinary").v2;
} catch (error) {
  cloudinary = null;
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function configureCloudinary() {
  if (!cloudinary || !hasCloudinaryConfig()) {
    return false;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  return true;
}

function buildLocalPodImageUrl(file) {
  if (!file || !file.filename) {
    return "";
  }

  return `/uploads/${file.filename}`;
}

async function removeLocalUpload(file) {
  if (!file || !file.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Unable to remove temporary POD upload: ${file.path}`);
    }
  }
}

function uploadBufferToCloudinary(file, trackingId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "agkey-tms/pod",
        public_id: `${trackingId}-${Date.now()}`,
        resource_type: "image",
        overwrite: false
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
}

async function uploadPodImageToCloudinary(file, trackingId) {
  if (!file) {
    return "";
  }

  if (!cloudinary) {
    const error = new Error(
      "Cloudinary SDK is not installed. Run npm install cloudinary before deploying."
    );
    error.statusCode = 500;
    throw error;
  }

  configureCloudinary();

  try {
    const uploadOptions = {
      folder: "agkey-tms/pod",
      public_id: `${trackingId}-${Date.now()}`,
      resource_type: "image",
      overwrite: false
    };

    const result = file.path
      ? await cloudinary.uploader.upload(file.path, uploadOptions)
      : await uploadBufferToCloudinary(file, trackingId);

    if (!result || !result.secure_url) {
      const error = new Error("Cloudinary upload did not return a secure_url");
      error.statusCode = 502;
      throw error;
    }

    return result.secure_url;
  } finally {
    await removeLocalUpload(file);
  }
}

async function resolvePodImageUrl(file, trackingId) {
  if (!file) {
    return "";
  }

  if (hasCloudinaryConfig()) {
    return uploadPodImageToCloudinary(file, trackingId);
  }

  if (process.env.NODE_ENV === "production") {
    const error = new Error("Cloudinary environment variables are required in production");
    error.statusCode = 500;
    throw error;
  }

  console.warn(
    "Cloudinary environment variables are missing. Using local /uploads fallback for POD image."
  );

  return buildLocalPodImageUrl(file);
}

async function updateDeliveryOrderStatus(req, res, next) {
  try {
    const { trackingId } = req.params;
    const status = String(req.body.status || "").trim();

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const isDelivered = status.toLowerCase() === "delivered";
    const isOutForDelivery = status.toLowerCase() === "out for delivery";

    if (isDelivered && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Proof of delivery photo is required"
      });
    }

    const updates = {
      status
    };

    if (req.file) {
      updates.podImageUrl = await resolvePodImageUrl(req.file, trackingId);
    }

    const deliveryOrder = await DeliveryOrder.findOneAndUpdate(
      { trackingId },
      { $set: updates },
      { new: true }
    );

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery order not found"
      });
    }

    if (isOutForDelivery) {
      const trackingUrl = buildTrackingUrl(deliveryOrder.trackingId);
      const customerName = deliveryOrder.customerName || "there";

      console.log(
        `[SMS to Customer]: Hey ${customerName}, your Agkey order is in the van! Track it here: ${trackingUrl}`
      );
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
  updateDeliveryOrderStatus,
  buildLocalPodImageUrl,
  uploadPodImageToCloudinary,
  resolvePodImageUrl
};
