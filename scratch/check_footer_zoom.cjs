const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2
  });

  const htmlPath = 'file:///' + path.resolve('prototype-receipt-a4/reference_booking.html').replace(/\\/g, '/');
  await page.goto(htmlPath, { waitUntil: 'networkidle' });

  // Screenshot just the footer
  const footerEl = await page.$('.footer');
  await footerEl.screenshot({ path: 'scratch/footer_isolated.png' });
  console.log('Saved scratch/footer_isolated.png');

  // Screenshot the entire bottom 150px of page-container including feathers
  await page.screenshot({
    path: 'scratch/page_bottom_with_feathers.png',
    clip: { x: 0, y: 970, width: 794, height: 153 }
  });
  console.log('Saved scratch/page_bottom_with_feathers.png');

  await browser.close();
})();
