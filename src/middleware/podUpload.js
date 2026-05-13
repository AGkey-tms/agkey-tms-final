const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename(req, file, cb) {
    const safeTrackingId = String(req.params.trackingId || "unknown")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .slice(0, 32);
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(null, `${safeTrackingId}-pod-${uniqueSuffix}${extension}`);
  }
});

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    const error = new Error("Only image uploads are allowed");
    error.statusCode = 400;

    return cb(error);
  }

  return cb(null, true);
}

const podImageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  }
});

// MVP local upload middleware. Later, replace this file with S3/Cloudinary
// upload logic and keep the route/controller contract the same.
module.exports = {
  podImageUpload,
  UPLOADS_DIR
};
