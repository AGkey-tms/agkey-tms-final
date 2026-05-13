const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const axios = require("axios");
const puppeteer = require("puppeteer");
const { MongoMemoryServer } = require("mongodb-memory-server");

const PORT = "3000";
const API_BASE_URL = `http://localhost:${PORT}/api`;
const SERVER_READY_TEXT = "listening on port 3000";
const DEMO_POD_PATH = path.join(process.cwd(), "uploads", "demo-pod.jpg");

let mongoServer;
let backendProcess;
let browser;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function act(title) {
  console.log("");
  console.log(`================ ${title} ================`);
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

function ensureDemoPodImage() {
  if (fs.existsSync(DEMO_POD_PATH)) {
    return;
  }

  const onePixelJpegBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";

  fs.mkdirSync(path.dirname(DEMO_POD_PATH), { recursive: true });
  fs.writeFileSync(DEMO_POD_PATH, Buffer.from(onePixelJpegBase64, "base64"));
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

async function createOrder(payload) {
  const response = await axios.post(`${API_BASE_URL}/orders`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return response.data.order;
}

async function fetchOrder(trackingId) {
  const response = await axios.get(
    `${API_BASE_URL}/orders/${encodeURIComponent(trackingId)}`
  );

  return response.data.order;
}

async function waitForBackendStatus(trackingId, expectedStatus, timeoutMs = 12000) {
  const startedAt = Date.now();
  let latestOrder;

  while (Date.now() - startedAt < timeoutMs) {
    latestOrder = await fetchOrder(trackingId);

    if (latestOrder.status === expectedStatus) {
      return latestOrder;
    }

    await wait(400);
  }

  throw new Error(
    `Timed out waiting for ${trackingId} to become ${expectedStatus}. Latest status: ${latestOrder?.status}`
  );
}

function buildDeskOrderPayload() {
  return {
    shopifyOrderId: `tour-desk-${Date.now()}`,
    customerName: "Alex Tan",
    phoneNumber: "+61 400 111 222",
    email: "alex.tan@example.com",
    deliveryAddress: {
      street: "42 Carbon Circuit",
      suburb: "Richmond",
      state: "VIC",
      postcode: "3121"
    },
    deliveryInstructions: "Use the loading bay and call on arrival.",
    lineItems: [
      {
        itemName: "Carbon Fiber Electric Gaming Desk",
        quantity: 1
      }
    ],
    status: "Processing"
  };
}

function buildChairOrderPayload() {
  return {
    shopifyOrderId: `tour-chair-${Date.now()}`,
    customerName: "Jamie Lee",
    phoneNumber: "+61 400 333 444",
    email: "jamie.lee@example.com",
    deliveryAddress: {
      street: "7 Apex Avenue",
      suburb: "Southbank",
      state: "VIC",
      postcode: "3006"
    },
    deliveryInstructions: "Leave with concierge if unavailable.",
    lineItems: [
      {
        itemName: "Ergonomic Mesh Office Chair",
        quantity: 1
      }
    ],
    status: "Processing"
  };
}

function buildAccessoryOrderPayload() {
  return {
    shopifyOrderId: `tour-accessory-${Date.now()}`,
    customerName: "Morgan Park",
    phoneNumber: "+61 400 555 666",
    email: "morgan.park@example.com",
    deliveryAddress: {
      street: "19 Neon Lane",
      suburb: "Docklands",
      state: "VIC",
      postcode: "3008"
    },
    deliveryInstructions: "Front desk accepts parcels.",
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
    status: "Processing"
  };
}

async function openDriverDashboard(deskOrder) {
  const page = await browser.newPage();

  page.on("dialog", async (dialog) => {
    console.log(`[driver dialog] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  page.on("pageerror", (error) => {
    console.error(`[driver pageerror] ${error.message}`);
  });

  await page.setViewport({
    width: 430,
    height: 900,
    isMobile: true
  });

  await page.goto(fileUrl("driver.html"), {
    waitUntil: "domcontentloaded"
  });

  await page.waitForSelector("#searchInput", { visible: true });

  const styleProof = await page.evaluate(() => {
    const button = document.querySelector('button[onclick="searchOrder()"]');
    const panel = document.querySelector(".dashboard-panel");
    const buttonStyle = window.getComputedStyle(button);
    const panelStyle = window.getComputedStyle(panel);
    const rootStyle = window.getComputedStyle(document.documentElement);

    return {
      racingRedVariable: rootStyle.getPropertyValue("--racing-red").trim(),
      findButtonBackground: buttonStyle.backgroundImage || buttonStyle.backgroundColor,
      carbonPanelBackground: panelStyle.backgroundImage,
      carbonPanelBorder: panelStyle.borderColor,
      angularRadius: panelStyle.borderRadius
    };
  });

  console.log("Module Check: Driver visual system");
  console.log(JSON.stringify(styleProof, null, 2));

  await page.type("#searchInput", deskOrder.trackingId);
  await page.click('button[onclick="searchOrder()"]');
  await page.waitForSelector("#viewAction:not(.hidden)", { visible: true });
  await page.waitForFunction(
    (customerName) => document.body.innerText.includes(customerName),
    { timeout: 10000 },
    deskOrder.customerName
  );

  console.log(`Action: Driver searched live order ${deskOrder.trackingId}.`);

  await page.click('button[onclick="updateStatus(\'Out for Delivery\')"]');
  await page.waitForFunction(
    () =>
      document
        .getElementById("currentStatusHeader")
        ?.innerText
        .toLowerCase()
        .includes("out for delivery"),
    { timeout: 10000 }
  );

  const updatedOrder = await waitForBackendStatus(deskOrder.trackingId, "Out for Delivery");
  console.log("Backend confirmation after driver action:");
  console.log(JSON.stringify({
    trackingId: updatedOrder.trackingId,
    status: updatedOrder.status,
    customerName: updatedOrder.customerName
  }, null, 2));

  await wait(1500);
  return page;
}

async function openTrackingTab(trackingId, expectedText) {
  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(`[tracking pageerror] ${error.message}`);
  });

  await page.setViewport({
    width: 430,
    height: 900,
    isMobile: true
  });

  await page.goto(`${fileUrl("tracking.html")}?id=${encodeURIComponent(trackingId)}`, {
    waitUntil: "domcontentloaded"
  });

  await page.waitForFunction(
    () => !document.getElementById("orderInfo")?.classList.contains("hidden"),
    { timeout: 10000 }
  );

  if (expectedText) {
    await page.waitForFunction(
      (text) => document.body.innerText.toLowerCase().includes(text.toLowerCase()),
      { timeout: 10000 },
      expectedText
    );
  }

  return page;
}

async function inspectDeskExperience(page) {
  const proof = await page.evaluate(() => {
    const activeNode = document.querySelector("#timeline .red-glow");
    const timelineLine = document.querySelector(".timeline-line");

    return {
      greeting: document.getElementById("personalGreeting")?.innerText,
      prepTitle: document.getElementById("prepTitle")?.innerText,
      badgeTitle: document.getElementById("prepBadgeTitle")?.innerText,
      hasDeskChecklist: document.body.innerText.includes("2x2m Space Required") &&
        document.body.innerText.includes("ENF Grade Certified Board"),
      activeNodeGlow: activeNode ? window.getComputedStyle(activeNode).boxShadow : "",
      timelineLineStyle: timelineLine ? window.getComputedStyle(timelineLine).backgroundImage : ""
    };
  });

  console.log("Module Check: Desk tracking experience");
  console.log(JSON.stringify(proof, null, 2));

  await page.evaluate(() => {
    window.scrollBy({
      top: 340,
      behavior: "smooth"
    });
  });
  await wait(3000);
}

async function completeDeliveryWithPod(driverPage, trackingPage, trackingId) {
  await driverPage.bringToFront();

  const deliveredButtonProof = await driverPage.evaluate(() => {
    const deliveredButton = [...document.querySelectorAll("button")]
      .find((button) => button.innerText.toLowerCase().includes("delivered") &&
        button.innerText.toLowerCase().includes("photo"));
    const style = deliveredButton ? window.getComputedStyle(deliveredButton) : null;

    return {
      buttonText: deliveredButton?.innerText,
      neonEffect: style?.boxShadow || "",
      background: style?.backgroundColor || ""
    };
  });

  console.log("Module Check: Delivered neon action");
  console.log(JSON.stringify(deliveredButtonProof, null, 2));

  const podInput = await driverPage.$("#podInput");

  if (!podInput) {
    throw new Error("POD input was not found in the driver dashboard.");
  }

  await podInput.uploadFile(DEMO_POD_PATH);
  const deliveredOrder = await waitForBackendStatus(trackingId, "Delivered");

  if (!deliveredOrder.podImageUrl) {
    throw new Error("Delivered order does not include a POD image URL.");
  }

  console.log("Backend confirmation after POD upload:");
  console.log(JSON.stringify({
    trackingId: deliveredOrder.trackingId,
    status: deliveredOrder.status,
    podImageUrl: deliveredOrder.podImageUrl
  }, null, 2));

  await trackingPage.bringToFront();
  await trackingPage.reload({ waitUntil: "domcontentloaded" });
  await trackingPage.waitForFunction(
    () =>
      document.body.innerText.includes("Delivered") &&
      !document.getElementById("podSection")?.classList.contains("hidden"),
    { timeout: 10000 }
  );

  const podProof = await trackingPage.evaluate(() => ({
    podVisible: !document.getElementById("podSection")?.classList.contains("hidden"),
    podImageSrc: document.getElementById("podImage")?.getAttribute("src"),
    currentTimelineText: [...document.querySelectorAll("#timeline .relative")]
      .map((node) => node.innerText)
      .find((text) => text.includes("Delivered"))
  }));

  console.log("Tracking page after delivery handover:");
  console.log(JSON.stringify(podProof, null, 2));
  await wait(3000);
}

async function inspectSmartLogic(chairOrder, accessoryOrder) {
  const chairPage = await openTrackingTab(chairOrder.trackingId, "Chair cockpit prep");
  const accessoryPage = await openTrackingTab(accessoryOrder.trackingId, "Peripheral loadout prep");

  const chairProof = await chairPage.evaluate(() => ({
    trackingId: document.getElementById("orderId")?.innerText,
    prepTitle: document.getElementById("prepTitle")?.innerText,
    badgeTitle: document.getElementById("prepBadgeTitle")?.innerText,
    hasEnfCertificate: document.body.innerText.includes("Performance Certificate"),
    checklistText: document.getElementById("prepChecklist")?.innerText
  }));

  const accessoryProof = await accessoryPage.evaluate(() => ({
    trackingId: document.getElementById("orderId")?.innerText,
    prepTitle: document.getElementById("prepTitle")?.innerText,
    badgeTitle: document.getElementById("prepBadgeTitle")?.innerText,
    hasAestheticTip: document.body.innerText.includes("Desktop Aesthetic Tip"),
    checklistText: document.getElementById("prepChecklist")?.innerText
  }));

  console.log("Module Check: Chair logic branch");
  console.log(JSON.stringify(chairProof, null, 2));
  console.log("Module Check: Accessory logic branch");
  console.log(JSON.stringify(accessoryProof, null, 2));

  await chairPage.bringToFront();
  await wait(2500);
  await accessoryPage.bringToFront();
  await wait(5000);
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
  if (browser) {
    await browser.close();
  }

  await stopBackend();

  if (mongoServer) {
    await mongoServer.stop();
    console.log("In-memory MongoDB stopped.");
  }
}

async function runTour() {
  try {
    ensureDemoPodImage();
    await runNodeScript("setup-frontend.js");

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log("In-memory MongoDB started.");

    await startBackend(mongoUri);
    console.log("Backend server is ready.");

    act("Act 1: The Backend Engine (Order Creation)");
    const deskOrder = await createOrder(buildDeskOrderPayload());
    const chairOrder = await createOrder(buildChairOrderPayload());
    const accessoryOrder = await createOrder(buildAccessoryOrderPayload());

    console.log("Created desk order through POST /api/orders:");
    console.log(JSON.stringify(deskOrder, null, 2));
    console.log("Scenario orders ready:");
    console.log(JSON.stringify({
      desk: deskOrder.trackingId,
      chair: chairOrder.trackingId,
      accessory: accessoryOrder.trackingId
    }, null, 2));

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100
    });

    act("Act 2: The Driver Dashboard (Logistics Hub)");
    const driverPage = await openDriverDashboard(deskOrder);

    act("Act 3: The Desk Experience (Premium Branding)");
    const deskTrackingPage = await openTrackingTab(deskOrder.trackingId, "Performance Certificate");
    await inspectDeskExperience(deskTrackingPage);

    act("Act 4: The Delivery Handover (POD & Closure)");
    await completeDeliveryWithPod(driverPage, deskTrackingPage, deskOrder.trackingId);

    act("Act 5: The Smart Logic (Chair & Accessory Swap)");
    await inspectSmartLogic(chairOrder, accessoryOrder);

    console.log("");
    console.log("Total System Tour completed successfully.");
  } catch (error) {
    console.error("");
    console.error("Total System Tour failed:");

    if (error.response) {
      console.error("HTTP status:", error.response.status);
      console.error("HTTP response:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

runTour();
