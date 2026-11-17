const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/assets/feather_bl.png').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const res = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    const w = img.width, h = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        // Remove light blue rectangle (r: 235-255, g: 240-255, b: 250-255 and b > r)
        if (b > r + 5 && r > 210 && y < 50) {
          d[idx+3] = 0;
        }
        // Also fade out right edge gently
        if (x > 36) {
          const fade = 1 - (x - 36) / (w - 36);
          d[idx+3] = Math.round(d[idx+3] * fade);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Create mirrored version for BR
    const brCanvas = document.createElement('canvas');
    brCanvas.width = w;
    brCanvas.height = h;
    const brCtx = brCanvas.getContext('2d');
    brCtx.translate(w, 0);
    brCtx.scale(-1, 1);
    brCtx.drawImage(canvas, 0, 0);

    return {
      bl: canvas.toDataURL('image/png'),
      br: brCanvas.toDataURL('image/png')
    };
  }, b64);

  fs.writeFileSync('prototype-receipt-a4/assets/feather_bl.png', Buffer.from(res.bl.split(',')[1], 'base64'));
  fs.writeFileSync('prototype-receipt-a4/assets/feather_br.png', Buffer.from(res.br.split(',')[1], 'base64'));
  console.log('Cleaned feather_bl and created clean feather_br!');
  await browser.close();
})().catch(console.error);
