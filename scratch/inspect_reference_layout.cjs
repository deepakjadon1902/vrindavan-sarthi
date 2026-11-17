const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 20px; background: #222; color: #fff; font-family: sans-serif; }
        .row { display: flex; gap: 20px; }
        .col { position: relative; width: 733px; height: 1024px; border: 2px solid #555; }
        .col img { width: 733px; height: 1024px; display: block; }
        .grid-line {
          position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(255, 0, 0, 0.7);
          font-size: 11px; color: yellow; background: rgba(0,0,0,0.6); padding-left: 5px;
        }
      </style>
    </head>
    <body>
      <div class="row">
        <div class="col" id="ref-col">
          <img src="${refB64}">
        </div>
        <div class="col" id="proto-col">
          <img src="${protoB64}">
        </div>
      </div>
    </body>
    </html>
  `);

  await page.evaluate(() => {
    const refCol = document.getElementById('ref-col');
    const protoCol = document.getElementById('proto-col');
    for (let pct = 10; pct < 100; pct += 10) {
      const topPx = (1024 * pct) / 100;
      const l1 = document.createElement('div');
      l1.className = 'grid-line';
      l1.style.top = topPx + 'px';
      l1.textContent = pct + '% (' + Math.round(topPx) + 'px)';
      refCol.appendChild(l1);

      const l2 = document.createElement('div');
      l2.className = 'grid-line';
      l2.style.top = topPx + 'px';
      l2.textContent = pct + '% (' + Math.round(topPx) + 'px)';
      protoCol.appendChild(l2);
    }
  });

  await page.screenshot({ path: 'scratch/grid_comparison.png', fullPage: true });
  console.log('Saved scratch/grid_comparison.png');
  await browser.close();
})();
