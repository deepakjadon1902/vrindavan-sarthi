const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });

  const refProtoImg = fs.readFileSync(path.resolve(__dirname, '../prototype-receipt-a4/reference_booking.png')).toString('base64');
  const nodePdfImg = fs.readFileSync(path.resolve(__dirname, 'single_page_receipt.png')).toString('base64');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 24px; background: #1e293b; font-family: sans-serif; color: white; }
        h1 { text-align: center; margin-bottom: 20px; font-size: 22px; }
        .comparison-container { display: flex; gap: 24px; justify-content: center; }
        .column { display: flex; flex-direction: column; align-items: center; }
        .label { font-size: 16px; font-weight: bold; margin-bottom: 12px; padding: 6px 16px; border-radius: 4px; }
        .label-proto { background: #0284c7; }
        .label-node { background: #16a34a; }
        img { width: 560px; height: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>SINGLE-PAGE A4 RECEIPT: APPROVED PROTOTYPE vs NEW PURE NODE.JS PDF BUILDER</h1>
      <div class="comparison-container">
        <div class="column">
          <div class="label label-proto">Approved Visual Baseline (prototype-receipt-a4)</div>
          <img src="data:image/png;base64,${refProtoImg}" />
        </div>
        <div class="column">
          <div class="label label-node">Pure Node.js PDF Builder (backend/utils/bookingReceiptPdf.js)</div>
          <img src="data:image/png;base64,${nodePdfImg}" />
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html);
  const compPath = path.resolve(__dirname, 'single_page_comparison.png');
  await page.screenshot({ path: compPath, fullPage: true });
  console.log(`Saved comparison screenshot to: ${compPath}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
