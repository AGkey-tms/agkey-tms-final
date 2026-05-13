const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require("puppeteer");

const TRACKING_ID = "AGK-T-6EBKJ8";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileUrl(filename) {
  return pathToFileURL(path.join(process.cwd(), filename)).href;
}

async function runDemo() {
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
      console.log(`Driver portal dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await driverPage.goto(fileUrl("driver.html"), {
      waitUntil: "domcontentloaded"
    });

    await driverPage.waitForSelector("#searchInput", { visible: true });
    await driverPage.type("#searchInput", TRACKING_ID);
    await driverPage.click('button[onclick="searchOrder()"]');

    await driverPage.waitForSelector("#viewAction:not(.hidden)", {
      visible: true
    });

    await driverPage.click('button[onclick="updateStatus(\'Out for Delivery\')"]');
    await wait(2000);

    const trackingPage = await browser.newPage();
    await trackingPage.setViewport({
      width: 430,
      height: 900,
      isMobile: true
    });

    await trackingPage.goto(`${fileUrl("tracking.html")}?id=${TRACKING_ID}`, {
      waitUntil: "domcontentloaded"
    });

    await trackingPage.waitForSelector("#timeline", { visible: true });
    await trackingPage.evaluate(() => {
      window.scrollBy({
        top: 220,
        behavior: "smooth"
      });
    });

    await wait(5000);
  } finally {
    await browser.close();
  }
}

runDemo().catch((error) => {
  console.error("UI demo failed:");
  console.error(error);
  process.exit(1);
});
