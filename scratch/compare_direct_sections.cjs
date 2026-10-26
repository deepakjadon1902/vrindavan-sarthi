const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

  // Let's create an HTML comparing just the footer of ref and proto with gridlines
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 20px; background: #1e293b; color: white; font-family: monospace; }
        .row { display: flex; gap: 30px; margin-top: 15px; }
        .card { background: white; position: relative; overflow: hidden; border: 2px solid #94a3b8; }
        .title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="row">
        <div>
          <div class="title">Reference Image (Bottom 120px, 733px wide)</div>
          <div class="card" style="width: 733px; height: 120px;">
            <img src="${refB64}" style="width: 733px; margin-top: -904px; display: block;" />
          </div>
        </div>
      </div>

      <div class="row">
        <div>
          <div class="title">Prototype (Bottom 150px, 794px wide)</div>
          <div class="card" style="width: 794px; height: 150px;">
            <img src="${protoB64}" style="width: 794px; margin-top: -973px; display: block;" />
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.screenshot({ path: 'scratch/direct_footer_compare.png', fullPage: true });
  console.log('Saved scratch/direct_footer_compare.png');

  // Let's also compare the middle sections (cards):
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 20px; background: #1e293b; color: white; font-family: monospace; }
        .row { display: flex; gap: 20px; margin-top: 15px; }
        .card { background: white; position: relative; overflow: hidden; border: 2px solid #94a3b8; }
        .title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="row">
        <div>
          <div class="title">Reference Middle Cards (y=200 to y=650)</div>
          <div class="card" style="width: 733px; height: 450px;">
            <img src="${refB64}" style="width: 733px; margin-top: -200px; display: block;" />
          </div>
        </div>
        <div>
          <div class="title">Prototype Middle Cards (y=230 to y=720)</div>
          <div class="card" style="width: 794px; height: 490px;">
            <img src="${protoB64}" style="width: 794px; margin-top: -230px; display: block;" />
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.screenshot({ path: 'scratch/direct_cards_compare.png', fullPage: true });
  console.log('Saved scratch/direct_cards_compare.png');

  await browser.close();
})();
