const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64 = 'data:image/jpeg;base64,' + fs.readFileSync('frontend/public/vrindavan_sarthi_official_logo.jpg').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const info = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);
    // Logo is 1024x1024. Feather eye is around x: 700 to 900, y: 150 to 500
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 650, 100, 300, 450, 0, 0, 300, 450);

    return canvas.toDataURL('image/png');
  }, b64);

  fs.writeFileSync('scratch/feather_from_logo.png', Buffer.from(info.split(',')[1], 'base64'));
  console.log('Saved feather_from_logo.png');
  await browser.close();
})().catch(console.error);
