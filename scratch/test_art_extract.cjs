const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const assets = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    // 1. Top background strip (from y: 0 to y: 65, full width or middle width)
    const topCanvas = document.createElement('canvas');
    topCanvas.width = img.width;
    topCanvas.height = 70;
    const topCtx = topCanvas.getContext('2d');
    topCtx.drawImage(img, 0, 0, img.width, 70, 0, 0, img.width, 70);

    // 2. Corner top-right feather
    const trCanvas = document.createElement('canvas');
    trCanvas.width = 140;
    trCanvas.height = 75;
    const trCtx = trCanvas.getContext('2d');
    trCtx.drawImage(img, img.width - 140, 0, 140, 75, 0, 0, 140, 75);

    // 3. Corner bottom-left feather motif
    const blCanvas = document.createElement('canvas');
    blCanvas.width = 110;
    blCanvas.height = 120;
    const blCtx = blCanvas.getContext('2d');
    blCtx.drawImage(img, 0, img.height - 120, 110, 120, 0, 0, 110, 120);

    // 4. Corner bottom-right feather motif
    const brCanvas = document.createElement('canvas');
    brCanvas.width = 110;
    brCanvas.height = 120;
    const brCtx = brCanvas.getContext('2d');
    brCtx.drawImage(img, img.width - 110, img.height - 120, 110, 120, 0, 0, 110, 120);

    return {
      topBanner: topCanvas.toDataURL('image/png'),
      tr: trCanvas.toDataURL('image/png'),
      bl: blCanvas.toDataURL('image/png'),
      br: brCanvas.toDataURL('image/png')
    };
  }, b64);

  fs.writeFileSync('scratch/art_top_banner.png', Buffer.from(assets.topBanner.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/art_corner_tr.png', Buffer.from(assets.tr.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/art_corner_bl.png', Buffer.from(assets.bl.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/art_corner_br.png', Buffer.from(assets.br.split(',')[1], 'base64'));
  console.log('Saved art pieces successfully');
  await browser.close();
})().catch(console.error);
