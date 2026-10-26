const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:8081';

const pagesToCapture = [
  { name: 'cabs', path: '/cabs' },
  { name: 'tours', path: '/tours' },
  { name: 'hotels', path: '/hotels' },
  { name: 'rooms', path: '/rooms' },
];

async function capture() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const pageInfo of pagesToCapture) {
    // 1. Mobile (412px - Pixel 9)
    const mobileContext = await browser.newContext({
      viewport: { width: 412, height: 924 },
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.resolve(__dirname, `before_${pageInfo.name}_mobile_412.png`),
      fullPage: false, // capture viewport height to see what is above the fold
    });
    await mobileContext.close();

    // 2. Desktop (1440px)
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({
      path: path.resolve(__dirname, `before_${pageInfo.name}_desktop_1440.png`),
      fullPage: false,
    });
    await desktopContext.close();

    console.log(`Captured ${pageInfo.name} at 412px and 1440px`);
  }

  await browser.close();
  console.log('All baseline captures complete.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
