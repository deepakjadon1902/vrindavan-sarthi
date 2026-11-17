const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const b64Ref = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`);

  const assets = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);

    // 1. Top Skyline banner: x: 150 to 580, y: 0 to 50
    const wTop = 430, hTop = 48;
    const cTop = document.createElement('canvas');
    cTop.width = wTop;
    cTop.height = hTop;
    const ctxTop = cTop.getContext('2d');
    ctxTop.drawImage(img, 150, 0, wTop, hTop, 0, 0, wTop, hTop);
    // Soft fade at bottom
    const imgDataTop = ctxTop.getImageData(0, 0, wTop, hTop);
    const dTop = imgDataTop.data;
    for (let y = 0; y < hTop; y++) {
      for (let x = 0; x < wTop; x++) {
        const idx = (y * wTop + x) * 4;
        if (y > 32) {
          const fade = 1 - (y - 32) / (hTop - 32);
          dTop[idx + 3] = Math.round(dTop[idx + 3] * fade);
        }
      }
    }
    ctxTop.putImageData(imgDataTop, 0, 0);

    // 2. Top-Right Peacock Feather: x: 615 to 733, y: 0 to 55
    const wTR = 118, hTR = 55;
    const cTR = document.createElement('canvas');
    cTR.width = wTR;
    cTR.height = hTR;
    const ctxTR = cTR.getContext('2d');
    ctxTR.drawImage(img, img.width - wTR, 0, wTR, hTR, 0, 0, wTR, hTR);
    // Fade bottom & left
    const imgDataTR = ctxTR.getImageData(0, 0, wTR, hTR);
    const dTR = imgDataTR.data;
    for (let y = 0; y < hTR; y++) {
      for (let x = 0; x < wTR; x++) {
        const idx = (y * wTR + x) * 4;
        let fade = 1;
        if (y > 35) fade *= (1 - (y - 35) / (hTR - 35));
        if (x < 15) fade *= (x / 15);
        dTR[idx + 3] = Math.round(dTR[idx + 3] * fade);
      }
    }
    ctxTR.putImageData(imgDataTR, 0, 0);

    // 3. Bottom-Left Feather & Leaves: x: 0 to 52, y: 900 to 1024
    const wBL = 52, hBL = 124;
    const cBL = document.createElement('canvas');
    cBL.width = wBL;
    cBL.height = hBL;
    const ctxBL = cBL.getContext('2d');
    ctxBL.drawImage(img, 0, img.height - hBL, wBL, hBL, 0, 0, wBL, hBL);
    // Fade right
    const imgDataBL = ctxBL.getImageData(0, 0, wBL, hBL);
    const dBL = imgDataBL.data;
    for (let y = 0; y < hBL; y++) {
      for (let x = 0; x < wBL; x++) {
        const idx = (y * wBL + x) * 4;
        if (x > 38) {
          const fade = 1 - (x - 38) / (wBL - 38);
          dBL[idx + 3] = Math.round(dBL[idx + 3] * fade);
        }
      }
    }
    ctxBL.putImageData(imgDataBL, 0, 0);

    // 4. Bottom-Right Feather: x: 680 to 733, y: 900 to 1024
    const wBR = 53, hBR = 124;
    const cBR = document.createElement('canvas');
    cBR.width = wBR;
    cBR.height = hBR;
    const ctxBR = cBR.getContext('2d');
    ctxBR.drawImage(img, img.width - wBR, img.height - hBR, wBR, hBR, 0, 0, wBR, hBR);
    // Fade left
    const imgDataBR = ctxBR.getImageData(0, 0, wBR, hBR);
    const dBR = imgDataBR.data;
    for (let y = 0; y < hBR; y++) {
      for (let x = 0; x < wBR; x++) {
        const idx = (y * wBR + x) * 4;
        if (x < 15) {
          const fade = x / 15;
          dBR[idx + 3] = Math.round(dBR[idx + 3] * fade);
        }
      }
    }
    ctxBR.putImageData(imgDataBR, 0, 0);

    return {
      skyline: cTop.toDataURL('image/png'),
      featherTR: cTR.toDataURL('image/png'),
      featherBL: cBL.toDataURL('image/png'),
      featherBR: cBR.toDataURL('image/png')
    };
  }, b64Ref);

  fs.mkdirSync('prototype-receipt-a4/assets', { recursive: true });
  fs.writeFileSync('prototype-receipt-a4/assets/skyline.png', Buffer.from(assets.skyline.split(',')[1], 'base64'));
  fs.writeFileSync('prototype-receipt-a4/assets/feather_tr.png', Buffer.from(assets.featherTR.split(',')[1], 'base64'));
  fs.writeFileSync('prototype-receipt-a4/assets/feather_bl.png', Buffer.from(assets.featherBL.split(',')[1], 'base64'));
  fs.writeFileSync('prototype-receipt-a4/assets/feather_br.png', Buffer.from(assets.featherBR.split(',')[1], 'base64'));

  console.log('Clean art assets extracted successfully!');
  await browser.close();
})().catch(console.error);
