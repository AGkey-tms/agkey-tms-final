const crypto = require("crypto");

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomAlphanumeric(length) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += ALPHANUMERIC[crypto.randomInt(0, ALPHANUMERIC.length)];
  }

  return value;
}

function generateTrackingId() {
  return `AGK-T-${randomAlphanumeric(6)}`;
}

module.exports = {
  generateTrackingId
};
