const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } });

  const nodePdfImg = fs.readFileSync(path.resolve(__dirname, 'single_page_receipt.png')).toString('base64');

  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <canvas id="c"></canvas>
      <script>
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById('c');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // analyze non-background pixels from bottom
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const data = imgData.data;
          
          let lastNonBgY = 0;
          let firstNonBgY = c.height;

          // background is ivory: around 254, 253, 250
          for (let y = 0; y < c.height; y++) {
            let rowHasContent = false;
            for (let x = 0; x < c.width; x++) {
              const idx = (y * c.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              // if significantly different from ivory background
              if (Math.abs(r - 254) > 15 || Math.abs(g - 253) > 15 || Math.abs(b - 250) > 15) {
                rowHasContent = true;
                break;
              }
            }
            if (rowHasContent) {
              if (firstNonBgY === c.height) firstNonBgY = y;
              lastNonBgY = y;
            }
          }

          window.analysis = {
            totalHeight: c.height,
            totalWidth: c.width,
            firstNonBgY,
            lastNonBgY,
            coveragePercent: ((lastNonBgY - firstNonBgY) / c.height * 100).toFixed(2),
            bottomSpace: c.height - lastNonBgY
          };
          window.done = true;
        };
        img.src = 'data:image/png;base64,${nodePdfImg}';
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.done);
  const result = await page.evaluate(() => window.analysis);
  console.log('Vertical content distribution analysis:');
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch(console.error);
