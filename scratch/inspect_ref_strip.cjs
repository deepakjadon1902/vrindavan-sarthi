const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  // Crop the bottom contact strip of original_reference.png (very bottom 60px)
  const b64 = fs.readFileSync('scratch/original_reference.png').toString('base64');
  await page.setContent(`<img id="img" src="data:image/png;base64,${b64}" />`);
  const dims = await page.evaluate(() => {
    const el = document.getElementById('img');
    return { w: el.naturalWidth, h: el.naturalHeight };
  });

  await page.setViewportSize({ width: dims.w, height: dims.h });
  
  // Bottom 7% where the contact row is
  await page.screenshot({
    path: 'scratch/ref_bottom_strip.png',
    clip: {
      x: 0,
      y: Math.round(dims.h * 0.93),
      width: dims.w,
      height: Math.round(dims.h * 0.07)
    }
  });
  console.log('Saved scratch/ref_bottom_strip.png');
  await browser.close();
})();
