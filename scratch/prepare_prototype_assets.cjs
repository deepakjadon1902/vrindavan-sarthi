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

    // 1. Top Skyline banner: x: 140 to 600, y: 0 to 52
    const wTop = 460, hTop = 52;
    const cTop = document.createElement('canvas');
    cTop.width = wTop;
    cTop.height = hTop;
    const ctxTop = cTop.getContext('2d');
    ctxTop.drawImage(img, 140, 0, wTop, hTop, 0, 0, wTop, hTop);
    // Soft fade at bottom of skyline
    const imgDataTop = ctxTop.getImageData(0, 0, wTop, hTop);
    const dTop = imgDataTop.data;
    for (let y = 0; y < hTop; y++) {
      for (let x = 0; x < wTop; x++) {
        const idx = (y * wTop + x) * 4;
        if (y > 38) {
          const fade = 1 - (y - 38) / (hTop - 38);
          dTop[idx + 3] = Math.round(dTop[idx + 3] * fade);
        }
      }
    }
    ctxTop.putImageData(imgDataTop, 0, 0);

    // 2. Top-Right Peacock Feather: x: 580 to 733, y: 0 to 60
    const wTR = 153, hTR = 60;
    const cTR = document.createElement('canvas');
    cTR.width = wTR;
    cTR.height = hTR;
    const ctxTR = cTR.getContext('2d');
    ctxTR.drawImage(img, img.width - wTR, 0, wTR, hTR, 0, 0, wTR, hTR);
    // Fade bottom
    const imgDataTR = ctxTR.getImageData(0, 0, wTR, hTR);
    const dTR = imgDataTR.data;
    for (let y = 0; y < hTR; y++) {
      for (let x = 0; x < wTR; x++) {
        const idx = (y * wTR + x) * 4;
        if (y > 42) {
          const fade = 1 - (y - 42) / (hTR - 42);
          dTR[idx + 3] = Math.round(dTR[idx + 3] * fade);
        }
      }
    }
    ctxTR.putImageData(imgDataTR, 0, 0);

    // 3. Bottom-Left Feather & Leaves: x: 0 to 65, y: 880 to 1024
    const wBL = 70, hBL = 144;
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
        if (x > 45) {
          const fade = 1 - (x - 45) / (wBL - 45);
          dBL[idx + 3] = Math.round(dBL[idx + 3] * fade);
        }
      }
    }
    ctxBL.putImageData(imgDataBL, 0, 0);

    // 4. Bottom-Right Feather: x: 670 to 733, y: 880 to 1024
    const wBR = 65, hBR = 144;
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
        if (x < 18) {
          const fade = x / 18;
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
  
  // Also copy the official logo to assets
  fs.copyFileSync('frontend/public/vrindasarthi logo.jpeg', 'prototype-receipt-a4/assets/vrindasarthi_logo.jpeg');
  fs.copyFileSync('frontend/public/vrindavan_sarthi_official_logo.jpg', 'prototype-receipt-a4/assets/vrindavan_sarthi_official_logo.jpg');

  console.log('Successfully prepared prototype assets!');
  await browser.close();
})().catch(console.error);
