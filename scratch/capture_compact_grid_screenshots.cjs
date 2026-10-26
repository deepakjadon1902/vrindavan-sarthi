const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:8081';

const targets = [
  { route: '/cabs', name: 'cabs' },
  { route: '/tours', name: 'tours' },
  { route: '/hotels', name: 'hotels' },
  { route: '/rooms', name: 'rooms' },
];

async function capture() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const target of targets) {
    // 1. Mobile (412px - Pixel standard)
    {
      const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${target.route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // Wait for images & render
      const screenshotPath = path.resolve(__dirname, `grid_refined_${target.name}_mobile_412.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Captured Mobile (412px): ${screenshotPath}`);
      await context.close();
    }

    // 2. Desktop (1440px)
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1.5,
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${target.route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const screenshotPath = path.resolve(__dirname, `grid_refined_${target.name}_desktop_1440.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Captured Desktop (1440px): ${screenshotPath}`);
      await context.close();
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
