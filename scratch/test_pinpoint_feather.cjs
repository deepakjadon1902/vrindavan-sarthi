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

  const featherData = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    // Let's pinpoint the feather eye and plumage:
    // x: 400 to 920, y: 50 to 800
    // Actually the feather is curved:
    // Eye center is at approx x: 790, y: 400 in 1024x1024
    // Top tip is at x: 420, y: 70
    // Bottom stem reaches down to x: 500, y: 750
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 450, 50, 400, 700, 0, 0, 400, 700);
    return canvas.toDataURL('image/png');
  }, b64);

  fs.writeFileSync('scratch/feather_region.png', Buffer.from(featherData.split(',')[1], 'base64'));
  console.log('Saved feather_region.png');
  await browser.close();
})().catch(console.error);
