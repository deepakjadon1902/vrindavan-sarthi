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
          
          // scan horizontal slices of 50px
          const slices = [];
          for (let y = 0; y < c.height; y += 50) {
            const h = Math.min(50, c.height - y);
            const imgData = ctx.getImageData(0, y, c.width, h);
            const d = imgData.data;
            let darkCount = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] < 240 || d[i+1] < 240 || d[i+2] < 240) {
                darkCount++;
              }
            }
            slices.push({ y, h, darkPixels: darkCount, percentDark: (darkCount / (c.width * h) * 100).toFixed(1) });
          }
          window.slices = slices;
          window.done = true;
        };
        img.src = 'data:image/png;base64,${nodePdfImg}';
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.done);
  const slices = await page.evaluate(() => window.slices);
  console.log('Horizontal density scan (from top canvas Y = 0 to bottom Y = 1683):');
  slices.forEach(s => {
    console.log(`Canvas Y: ${String(s.y).padStart(4, ' ')} - ${String(s.y + s.h).padStart(4, ' ')} | Dark Pixels: ${String(s.darkPixels).padStart(6, ' ')} (${s.percentDark}%)`);
  });

  await browser.close();
}

main().catch(console.error);
