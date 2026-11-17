const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const viewports = [
    { name: 'mobile_412', width: 412, height: 915, isMobile: true },
    { name: 'desktop_1440', width: 1440, height: 900, isMobile: false },
  ];

  const routes = [
    { name: 'cabs', url: 'http://localhost:8081/cabs' },
    { name: 'tours', url: 'http://localhost:8081/tours' },
    { name: 'hotels', url: 'http://localhost:8081/hotels' },
    { name: 'rooms', url: 'http://localhost:8081/rooms' },
    { name: 'room_type_detail', url: 'http://localhost:8081/room-types/6a92ea5e4cd3e4e13e47ff96?checkIn=2026-10-24&checkOut=2026-10-25' },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const route of routes) {
      console.log(`Navigating to ${route.name} at ${vp.name}...`);
      await page.goto(route.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // allow layout & images to settle

      const outPath = path.resolve(__dirname, `refined_${route.name}_${vp.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${outPath} (errors: ${errors.length})`);
    }

    await context.close();
  }

  await browser.close();
  console.log('Capture finished successfully!');
}

main().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
