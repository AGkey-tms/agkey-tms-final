const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const { MongoMemoryServer } = require("mongodb-memory-server");
const DeliveryOrder = require("./src/models/DeliveryOrder");

const PORT = "3000";
const SERVER_READY_TEXT = "listening on port 3000";
const DEMO_ORDERS = [
  {
    shopifyOrderId: "demo-shopify-desk",
    trackingId: "AGK-T-DESK",
    customerName: "Taylor Desk",
    phoneNumber: "+61400111111",
    email: "desk.customer@example.com",
    deliveryAddress: {
      street: "18 Market Lane",
      suburb: "Richmond",
      state: "VIC",
      postcode: "3121"
    },
    deliveryInstructions: "Please buzz apartment 4 on arrival.",
    lineItems: [
      {
        itemName: "Black Electric Standing Desk",
        quantity: 1
      }
    ],
    status: "Out for Delivery",
    podImageUrl: ""
  },
  {
    shopifyOrderId: "demo-shopify-chair",
    trackingId: "AGK-T-CHAIR",
    customerName: "Casey Chair",
    phoneNumber: "+61400222222",
    email: "chair.customer@example.com",
    deliveryAddress: {
      street: "44 Collins Street",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000"
    },
    deliveryInstructions: "Leave with reception if unavailable.",
    lineItems: [
      {
        itemName: "Ergonomic Mesh Office Chair",
        quantity: 1
      }
    ],
    status: "Processing",
    podImageUrl: ""
  },
  {
    shopifyOrderId: "demo-shopify-accessory",
    trackingId: "AGK-T-ACC",
    customerName: "Morgan Accessory",
    phoneNumber: "+61400333333",
    email: "accessory.customer@example.com",
    deliveryAddress: {
      street: "8 Docklands Drive",
      suburb: "Docklands",
      state: "VIC",
      postcode: "3008"
    },
    deliveryInstructions: "Delivered to front desk.",
    lineItems: [
      {
        itemName: "Monitor Arm",
        quantity: 1
      },
      {
        itemName: "Cable Tray",
        quantity: 1
      }
    ],
    status: "Delivered",
    podImageUrl: "/uploads/demo-pod.jpg"
  }
];

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

function createDemoPodImage() {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const demoPodPath = path.join(uploadsDir, "demo-pod.jpg");
  const onePixelJpegBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(demoPodPath, Buffer.from(onePixelJpegBase64, "base64"));
  console.log("Demo POD image ready at uploads/demo-pod.jpg");
}

async function seedOrders(mongoUri) {
  await mongoose.connect(mongoUri);
  await DeliveryOrder.deleteMany({});
  await DeliveryOrder.insertMany(DEMO_ORDERS);
  await mongoose.disconnect();

  console.log("Seeded 3 scenario orders:");
  DEMO_ORDERS.forEach((order) => {
    console.log(`- ${order.trackingId}: ${order.lineItems.map((item) => item.itemName).join(", ")} (${order.status})`);
  });
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

async function openScenarioTab(browser, scenario) {
  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(`[${scenario.trackingId}:pageerror] ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[${scenario.trackingId}:console] ${message.text()}`);
    }
  });

  await page.setViewport({
    width: 430,
    height: 900,
    isMobile: true
  });

  console.log(`Opening ${scenario.label}: ${scenario.trackingId}`);
  await page.goto(`${fileUrl("tracking.html")}?id=${scenario.trackingId}`, {
    waitUntil: "domcontentloaded"
  });

  await page.waitForSelector("#prepGuide", { visible: true });
  await page.waitForFunction(
    () => !document.getElementById("orderInfo")?.classList.contains("hidden"),
    { timeout: 10000 }
  );

  try {
    await page.waitForFunction(
      (expectedText) =>
        document.body.innerText.toLowerCase().includes(expectedText.toLowerCase()),
      { timeout: 10000 },
      scenario.expectedText
    );
  } catch (error) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.error(`[${scenario.trackingId}] Page text while waiting for "${scenario.expectedText}":`);
    console.error(bodyText);
    throw error;
  }

  if (scenario.scroll) {
    await page.evaluate(() => {
      window.scrollBy({
        top: 360,
        behavior: "smooth"
      });
    });
  }

  const proof = await page.evaluate(() => ({
    prepTitle: document.getElementById("prepTitle")?.innerText,
    badgeTitle: document.getElementById("prepBadgeTitle")?.innerText,
    bodyHasEnf: document.body.innerText
      .toLowerCase()
      .includes("enf grade eco-safety badge"),
    podVisible: !document.getElementById("podSection")?.classList.contains("hidden")
  }));

  console.log(`${scenario.trackingId} proof:`, proof);
  await wait(5000);

  return page;
}

async function openDriverPortal(browser) {
  const page = await browser.newPage();

  await page.setViewport({
    width: 430,
    height: 900,
    isMobile: true
  });

  console.log("Opening Driver Portal for AGK-T-DESK...");
  await page.goto(fileUrl("driver.html"), {
    waitUntil: "domcontentloaded"
  });

  await page.waitForSelector("#searchInput", { visible: true });
  await page.type("#searchInput", "AGK-T-DESK");
  await page.click('button[onclick="searchOrder()"]');
  await page.waitForSelector("#viewAction:not(.hidden)", {
    visible: true
  });

  const driverProof = await page.evaluate(() => ({
    trackingId: document.getElementById("d_trackingId")?.innerText,
    hasFindOrderBlue: Boolean(document.querySelector(".bg-agkey-blue")),
    statusButtons: [...document.querySelectorAll("button")]
      .map((button) => button.innerText)
      .filter((text) => text.includes("Set:"))
  }));

  console.log("Driver Portal proof:", driverProof);
  await wait(5000);
}

async function runBrowserTour() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100
  });

  try {
    await openScenarioTab(browser, {
      label: "Desk scenario with ENF board badge",
      trackingId: "AGK-T-DESK",
      expectedText: "ENF Grade Eco-Safety Badge",
      scroll: true
    });

    await openScenarioTab(browser, {
      label: "Chair scenario with comfort prep",
      trackingId: "AGK-T-CHAIR",
      expectedText: "Soft Assembly Area (Rug/Carpet)",
      scroll: true
    });

    await openScenarioTab(browser, {
      label: "Accessory scenario with aesthetic tips and POD",
      trackingId: "AGK-T-ACC",
      expectedText: "Desktop Aesthetic Tip",
      scroll: true
    });

    await openDriverPortal(browser);
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

async function runGrandFinale() {
  try {
    console.log("Regenerating latest Agkey frontend...");
    await runNodeScript("setup-frontend.js");
    createDemoPodImage();

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log("In-memory MongoDB started.");

    await seedOrders(mongoUri);
    await startBackend(mongoUri);
    console.log("Backend server is ready.");

    await wait(500);
    await runBrowserTour();
    console.log("Grand Finale demo completed successfully.");
  } catch (error) {
    console.error("Grand Finale demo failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

runGrandFinale();
