function buildTrackingUrl(trackingId) {
  const baseUrl = process.env.TRACKING_BASE_URL || "https://tms.yourdomain.com";

  return `${baseUrl.replace(/\/+$/, "")}/track/${encodeURIComponent(trackingId)}`;
}

module.exports = {
  buildTrackingUrl
};
