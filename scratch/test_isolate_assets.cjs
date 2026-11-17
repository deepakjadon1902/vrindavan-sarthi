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

  const assets = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    // 1. Isolate the peacock feather
    // In 1024x1024 logo, feather bounding box:
    // x: 670 to 920, y: 35 to 550
    const fw = 250, fh = 520;
    const fCanvas = document.createElement('canvas');
    fCanvas.width = fw;
    fCanvas.height = fh;
    const fCtx = fCanvas.getContext('2d');
    fCtx.drawImage(img, 670, 35, fw, fh, 0, 0, fw, fh);
    
    // Make background transparent: the background is ivory/white (r > 235, g > 230, b > 220)
    // or black border outside the circle
    const fData = fCtx.getImageData(0, 0, fw, fh);
    const d = fData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      // black border outside ring
      if (r < 30 && g < 30 && b < 30) {
        d[i+3] = 0;
      }
      // light background outside feather
      // feather has vibrant greens (g > 70, g > r), golds, blues
      // the background is pale ivory (r > 220, g > 215, b > 200)
      if (r > 215 && g > 210 && b > 195) {
        // fade out
        const diff = Math.min(r - 215, g - 210);
        d[i+3] = Math.max(0, 255 - diff * 8);
      }
    }
    fCtx.putImageData(fData, 0, 0);

    // 2. Temple skyline from logo: x: 480 to 720, y: 130 to 360
    const tw = 250, th = 240;
    const tCanvas = document.createElement('canvas');
    tCanvas.width = tw;
    tCanvas.height = th;
    const tCtx = tCanvas.getContext('2d');
    tCtx.drawImage(img, 480, 130, tw, th, 0, 0, tw, th);

    return {
      feather: fCanvas.toDataURL('image/png'),
      temple: tCanvas.toDataURL('image/png')
    };
  }, b64);

  fs.writeFileSync('scratch/isolated_feather.png', Buffer.from(assets.feather.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/isolated_temple.png', Buffer.from(assets.temple.split(',')[1], 'base64'));
  console.log('Saved isolated assets');
  await browser.close();
})().catch(console.error);
