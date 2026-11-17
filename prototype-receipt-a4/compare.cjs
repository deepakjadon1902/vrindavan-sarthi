const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

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
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');

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
        .header-title {
          text-align: center;
          margin-bottom: 20px;
        }
        .header-title h1 {
          font-size: 24px;
          margin: 0 0 6px 0;
          color: #f1f5f9;
        }
        .header-title p {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }
        .comparison-container {
          display: flex;
          justify-content: center;
          gap: 24px;
        }
        .comparison-panel {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .panel-badge {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 10px;
        }
        .badge-ref {
          background: #3b82f6;
          color: white;
        }
        .badge-proto {
          background: #10b981;
          color: white;
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
        .legend-row {
          margin-top: 10px;
          font-size: 11px;
          color: #cbd5e1;
          display: flex;
          gap: 16px;
        }
      </style>
    </head>
    <body>
      <div class="header-title">
        <h1>Vrindavan Sarthi — Premium Single-Page Booking Receipt Comparison</h1>
        <p>Direct Side-by-Side Fidelity Comparison: Original Target Reference vs HTML/CSS Playwright Prototype</p>
      </div>

      <div class="comparison-container">
        <!-- Target Reference -->
        <div class="comparison-panel">
          <div class="panel-badge badge-ref">1. Target Reference Image (User Supplied)</div>
          <div class="receipt-frame">
            <img src="${refB64}" alt="Reference">
          </div>
          <div class="legend-row">
            <span>Dimensions: 733 × 1024 px</span>
            <span>Target: 1-Page A4 Portrait</span>
          </div>
        </div>

        <!-- Rendered Prototype -->
        <div class="comparison-panel">
          <div class="panel-badge badge-proto">2. Generated HTML/CSS Playwright Prototype</div>
          <div class="receipt-frame">
            <img src="${protoB64}" alt="Prototype">
          </div>
          <div class="legend-row">
            <span>Dimensions: 1588 × 2246 px (2x High-Res)</span>
            <span>PDF: Strictly 1 Page (0 Overflow)</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  const tempComparison = path.resolve('prototype-receipt-a4/visual_comparison_temp.png');
  const outComparison = path.resolve('prototype-receipt-a4/visual_comparison.png');
  await page.screenshot({ path: tempComparison, fullPage: true });
  await browser.close();

  try {
    if (fs.existsSync(outComparison)) fs.unlinkSync(outComparison);
  } catch (e) {}
  fs.copyFileSync(tempComparison, outComparison);
  try {
    fs.unlinkSync(tempComparison);
  } catch (e) {}
  console.log('Saved visual comparison to:', outComparison);
})().catch(console.error);
