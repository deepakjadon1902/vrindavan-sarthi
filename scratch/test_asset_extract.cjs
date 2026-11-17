const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const info = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.getElementById('c');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Let's crop top-right feather
    // in 733x1024, top right is approx x: 610 to 733, y: 0 to 120
    const trCanvas = document.createElement('canvas');
    trCanvas.width = 160;
    trCanvas.height = 140;
    const trCtx = trCanvas.getContext('2d');
    trCtx.drawImage(img, img.width - 160, 0, 160, 140, 0, 0, 160, 140);

    // Bottom-left feather: x: 0 to 120, y: 880 to 1024
    const blCanvas = document.createElement('canvas');
    blCanvas.width = 150;
    blCanvas.height = 144;
    const blCtx = blCanvas.getContext('2d');
    blCtx.drawImage(img, 0, img.height - 144, 150, 144, 0, 0, 150, 144);

    // Bottom-right feather: x: img.width - 150 to img.width, y: 880 to 1024
    const brCanvas = document.createElement('canvas');
    brCanvas.width = 150;
    brCanvas.height = 144;
    const brCtx = brCanvas.getContext('2d');
    brCtx.drawImage(img, img.width - 150, img.height - 144, 150, 144, 0, 0, 150, 144);

    // Top background temple: x: 180 to 540, y: 0 to 110
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 360;
    bgCanvas.height = 110;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.drawImage(img, 185, 0, 360, 110, 0, 0, 360, 110);

    return {
      w: img.width,
      h: img.height,
      trFeather: trCanvas.toDataURL('image/png'),
      blFeather: blCanvas.toDataURL('image/png'),
      brFeather: brCanvas.toDataURL('image/png'),
      templeBg: bgCanvas.toDataURL('image/png')
    };
  }, b64);

  console.log('Reference dimensions:', info.w, info.h);
  fs.writeFileSync('scratch/crop_tr_feather.png', Buffer.from(info.trFeather.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/crop_bl_feather.png', Buffer.from(info.blFeather.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/crop_br_feather.png', Buffer.from(info.brFeather.split(',')[1], 'base64'));
  fs.writeFileSync('scratch/crop_temple_bg.png', Buffer.from(info.templeBg.split(',')[1], 'base64'));
  console.log('Successfully saved crops');
  await browser.close();
})().catch(console.error);
