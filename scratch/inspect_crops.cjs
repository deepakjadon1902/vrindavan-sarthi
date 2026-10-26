const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');

  await page.setContent(`
    <style>
      body { margin: 0; padding: 20px; background: #222; color: #fff; font-family: sans-serif; }
      .row { display: flex; gap: 20px; margin-bottom: 20px; }
      .box { border: 2px solid #555; background: #fff; overflow: hidden; }
      .title { color: yellow; font-size: 14px; margin-bottom: 6px; }
    </style>
    <div>
      <div class="title">1. Reference Image Footer (Bottom 120px)</div>
      <div class="box" style="width: 733px; height: 120px;">
        <img src="${refB64}" style="width: 733px; margin-top: -904px; display: block;" />
      </div>
      
      <div class="title" style="margin-top: 20px;">2. Prototype Footer (Bottom 240px rendered at 2x)</div>
      <div class="box" style="width: 794px; height: 150px;">
        <img src="${protoB64}" style="width: 794px; margin-top: -973px; display: block;" />
      </div>
    </div>
  `);

  await page.screenshot({ path: 'scratch/footer_crop_inspection.png', fullPage: true });
  console.log('Saved scratch/footer_crop_inspection.png');

  // Let's also inspect the header crop
  await page.setContent(`
    <style>
      body { margin: 0; padding: 20px; background: #222; color: #fff; font-family: sans-serif; }
      .box { border: 2px solid #555; background: #fff; overflow: hidden; }
      .title { color: yellow; font-size: 14px; margin-bottom: 6px; }
    </style>
    <div>
      <div class="title">1. Reference Image Header (Top 220px)</div>
      <div class="box" style="width: 733px; height: 220px;">
        <img src="${refB64}" style="width: 733px; display: block;" />
      </div>
      
      <div class="title" style="margin-top: 20px;">2. Prototype Header & Status (Top 250px)</div>
      <div class="box" style="width: 794px; height: 250px;">
        <img src="${protoB64}" style="width: 794px; display: block;" />
      </div>
    </div>
  `);

  await page.screenshot({ path: 'scratch/header_crop_inspection.png', fullPage: true });
  console.log('Saved scratch/header_crop_inspection.png');

  await browser.close();
})();
