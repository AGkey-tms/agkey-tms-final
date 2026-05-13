const { spawn } = require("child_process");
const path = require("path");
const { pathToFileURL } = require("url");
const axios = require("axios");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const { MongoMemoryServer } = require("mongodb-memory-server");
const DeliveryOrder = require("./src/models/DeliveryOrder");

const TRACKING_ID = "AGK-T-6EBKJ8";
const PORT = "3000";
const SERVER_READY_TEXT = "listening on port 3000";

let mongoServer;
let backendProcess;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileUrl(filename) {
  return pathToFileURL(path.join(process.cwd(), filename)).href;
}

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptName], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[${scriptName}] ${chunk.toString()}`);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[${scriptName}:error] ${chunk.toString()}`);
    });

    child.on("error", reject);

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${scriptName} exited with code ${code} and signal ${signal}`));
    });
  });
}

async function seedDemoOrder(mongoUri) {
  await mongoose.connect(mongoUri);

  await DeliveryOrder.findOneAndUpdate(
    { trackingId: TRACKING_ID },
    {
      $set: {
        shopifyOrderId: "perfect-demo-shopify-order",
        trackingId: TRACKING_ID,
        customerName: "Taylor Nguyen",
        phoneNumber: "+61400123456",
        email: "customer@example.com",
        deliveryAddress: {
          street: "18 Market Lane, Apartment 4",
          suburb: "Richmond",
          state: "VIC",
          postcode: "3121"
        },
        deliveryInstructions: "Please leave the order near the front door.",
        lineItems: [
          {
            itemName: "Organic Pantry Box",
            quantity: 1
          },
          {
            itemName: "Cold Pressed Juice Pack",
            quantity: 2
          }
        ],
        status: "Processing",
        podImageUrl: ""
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await mongoose.disconnect();
  console.log(`Seeded demo order ${TRACKING_ID} with status Processing.`);
}

function startBackend(mongoUri) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    backendProcess = spawn(process.execPath, ["src/server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT,
        MONGODB_URI: mongoUri,
        TRACKING_BASE_URL: `http://localhost:${PORT}`,
        LOCAL_DELIVERY_KEYWORDS: "local delivery,local_delivery,local-delivery"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("Backend readiness fallback reached after 3 seconds.");
        resolve();
      }
    }, 3000);

    backendProcess.stdout.on("data", (chunk) => {
      const output = chunk.toString();
      process.stdout.write(`[backend] ${output}`);

      if (!resolved && output.toLowerCase().includes(SERVER_READY_TEXT)) {
        clearTimeout(fallbackTimer);
        resolved = true;
        resolve();
      }
    });

    backendProcess.stderr.on("data", (chunk) => {
      process.stderr.write(`[backend:error] ${chunk.toString()}`);
    });

    backendProcess.on("error", (error) => {
      clearTimeout(fallbackTimer);

      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });

    backendProcess.on("exit", (code, signal) => {
      if (!resolved) {
        clearTimeout(fallbackTimer);
        resolved = true;
        reject(new Error(`Backend exited early with code ${code} and signal ${signal}`));
      }
    });
  });
}

async function runVisualWalkthrough() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100
  });

  try {
    const driverPage = await browser.newPage();
    await driverPage.setViewport({
      width: 430,
      height: 900,
      isMobile: true
    });

    driverPage.on("dialog", async (dialog) => {
      console.log(`[driver dialog] ${dialog.message()}`);
      await dialog.accept();
    });

    console.log("Opening Agkey Driver Portal...");
    await driverPage.goto(fileUrl("driver.html"), {
      waitUntil: "domcontentloaded"
    });

    await driverPage.waitForSelector("#searchInput", { visible: true });
    await driverPage.type("#searchInput", TRACKING_ID);
    await driverPage.click('button[onclick="searchOrder()"]');

    await driverPage.waitForSelector("#viewAction:not(.hidden)", {
      visible: true
    });
    console.log(`Driver Portal found order ${TRACKING_ID}.`);

    await driverPage.click('button[onclick="updateStatus(\'Out for Delivery\')"]');
    await driverPage.waitForFunction(
      () => document.getElementById("currentStatusHeader")?.innerText === "Out for Delivery",
      { timeout: 10000 }
    );
    console.log("Driver Portal updated status to Out for Delivery.");

    const backendOrder = await axios.get(
      `http://localhost:${PORT}/api/orders/${encodeURIComponent(TRACKING_ID)}`
    );
    console.log(`Backend confirms status: ${backendOrder.data.order.status}`);

    const trackingPage = await browser.newPage();
    await trackingPage.setViewport({
      width: 430,
      height: 900,
      isMobile: true
    });

    console.log("Opening customer tracking page with Agkey Tech Blue branding...");
    await trackingPage.goto(`${fileUrl("tracking.html")}?id=${TRACKING_ID}`, {
      waitUntil: "domcontentloaded"
    });

    await trackingPage.waitForSelector("#timeline", { visible: true });
    await trackingPage.waitForFunction(
      () => document.body.innerText.includes("Organic Pantry Box"),
      { timeout: 10000 }
    );

    const trackingStatus = await trackingPage.evaluate(() => {
      const currentStatusLabel = [...document.querySelectorAll("#timeline div")]
        .map((element) => element.innerText)
        .find((text) => text.includes("Out for Delivery") && text.includes("Current status"));

      return currentStatusLabel || document.body.innerText;
    });

    console.log("Tracking page is displaying the live backend order.");
    console.log(`Tracking page current status block: ${trackingStatus}`);

    await trackingPage.evaluate(() => {
      window.scrollBy({
        top: 240,
        behavior: "smooth"
      });
    });

    console.log("Holding browser open for 8 seconds for visual confirmation.");
    await wait(8000);
  } finally {
    await browser.close();
  }
}

async function stopBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  await new Promise((resolve) => {
    const forceKillTimer = setTimeout(() => {
      if (!backendProcess.killed) {
        backendProcess.kill("SIGKILL");
      }
      resolve();
    }, 3000);

    backendProcess.once("exit", () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    backendProcess.kill("SIGTERM");
  });

  console.log("Backend server stopped.");
}

async function cleanup() {
  await stopBackend();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    console.log("In-memory MongoDB stopped.");
  }
}

async function runPerfectDemo() {
  try {
    console.log("Regenerating Agkey-branded frontend files...");
    await runNodeScript("setup-frontend.js");

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log("In-memory MongoDB started.");

    await seedDemoOrder(mongoUri);
    await startBackend(mongoUri);
    console.log("Backend server is ready.");

    await wait(500);
    await runVisualWalkthrough();
    console.log("Final Agkey TMS UI demo completed successfully.");
  } catch (error) {
    console.error("Perfect demo failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

runPerfectDemo();
