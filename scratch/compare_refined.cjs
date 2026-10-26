const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1700, height: 1200 },
    deviceScaleFactor: 1.5
  });

  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('scratch/refined_preview.png').toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Visual Comparison</title>
      <style>
        body {
          margin: 0;
          padding: 24px;
          background: #0f172a;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .comparison-container {
          display: flex;
          justify-content: center;
          gap: 24px;
        }
        .receipt-frame {
          width: 580px;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          background: white;
        }
        .receipt-frame img {
          width: 100%;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="comparison-container">
        <div class="receipt-frame"><img src="${refB64}"></div>
        <div class="receipt-frame"><img src="${protoB64}"></div>
      </div>
    </body>
    </html>
  `);

  await page.screenshot({ path: 'scratch/refined_compare.png', fullPage: true });
  console.log('Saved scratch/refined_compare.png');
  await browser.close();
})();
