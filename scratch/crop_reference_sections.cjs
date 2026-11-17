const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });

  const refPng = path.resolve(__dirname, 'original_reference.png');
  const b64 = fs.readFileSync(refPng).toString('base64');

  await page.setContent(`
    <img id="img" src="data:image/png;base64,${b64}" style="width: 1190px;" />
  `);

  // Crop footer region (bottom 250px)
  const clip = { x: 0, y: 1400, width: 1190, height: 300 };
  await page.screenshot({ path: 'scratch/ref_footer_zoomed.png', clip });
  console.log('Saved scratch/ref_footer_zoomed.png');

  // Also crop guidelines/policies region
  const clipPolicies = { x: 0, y: 1050, width: 1190, height: 260 };
  await page.screenshot({ path: 'scratch/ref_policies_zoomed.png', clip: clipPolicies });
  console.log('Saved scratch/ref_policies_zoomed.png');

  // Also crop header region
  const clipHeader = { x: 0, y: 0, width: 1190, height: 260 };
  await page.screenshot({ path: 'scratch/ref_header_zoomed.png', clip: clipHeader });
  console.log('Saved scratch/ref_header_zoomed.png');

  await browser.close();
})();
