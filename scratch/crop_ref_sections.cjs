const fs = require('fs');
const { chromium } = require('../frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('scratch/original_reference.png').toString('base64');
  await page.setContent(`<img id="img" src="data:image/png;base64,${b64}" />`);
  const dims = await page.evaluate(() => {
    const el = document.getElementById('img');
    return { w: el.naturalWidth, h: el.naturalHeight };
  });
  console.log('original_reference dims:', dims);

  // Resize page to match img dims
  await page.setViewportSize({ width: dims.w, height: dims.h });

  // Crop header (top 18%)
  await page.screenshot({ path: 'scratch/ref_header_zoomed.png', clip: { x: 0, y: 0, width: dims.w, height: Math.round(dims.h * 0.18) } });
  
  // Crop policies (around 70% to 83%)
  await page.screenshot({ path: 'scratch/ref_policies_zoomed.png', clip: { x: 0, y: Math.round(dims.h * 0.65), width: dims.w, height: Math.round(dims.h * 0.18) } });

  // Crop footer (bottom 15%)
  await page.screenshot({ path: 'scratch/ref_footer_zoomed.png', clip: { x: 0, y: Math.round(dims.h * 0.85), width: dims.w, height: Math.round(dims.h * 0.15) } });

  console.log('Successfully cropped header, policies, and footer!');
  await browser.close();
})();
