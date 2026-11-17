const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64 = 'data:image/jpeg;base64,' + fs.readFileSync('frontend/public/vrindasarthi logo.jpeg').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const info = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    // In 672x573:
    // Feather is at x: 420 to 650, y: 50 to 450
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 420, 40, 250, 420, 0, 0, 250, 420);

    // Remove pure white background
    const imgData = ctx.getImageData(0, 0, 250, 420);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      if (r > 240 && g > 240 && b > 235) {
        d[i+3] = 0;
      } else if (r > 220 && g > 220 && b > 210) {
        const diff = Math.min(r - 220, g - 220, b - 210);
        d[i+3] = Math.max(0, 255 - diff * 12);
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return canvas.toDataURL('image/png');
  }, b64);

  fs.writeFileSync('scratch/feather_transparent.png', Buffer.from(info.split(',')[1], 'base64'));
  console.log('Saved feather_transparent.png');
  await browser.close();
})().catch(console.error);
