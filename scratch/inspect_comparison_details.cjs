const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });

  // Let's create an HTML that displays the refined prototype at 100% scale with rulers and bounding boxes
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('scratch/refined_preview.png').toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; padding: 20px; background: #0f172a; display: flex; justify-content: center; }
        .wrapper { position: relative; width: 794px; height: 1123px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .wrapper img { width: 100%; height: 100%; display: block; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <img src="${protoB64}">
      </div>
    </body>
    </html>
  `);

  await page.screenshot({ path: 'scratch/refined_inspect_full.png', fullPage: true });
  console.log('Saved scratch/refined_inspect_full.png');
  await browser.close();
})();
