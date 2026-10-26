const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage();

  const pdfBase64 = fs.readFileSync('C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792958011766_fd735b5e.pdf').toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    </head>
    <body>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          window.items = textContent.items.map(it => ({
            str: it.str,
            x: it.transform[4],
            y: it.transform[5],
            fontName: it.fontName,
            width: it.width,
            height: it.height
          }));
          window.done = true;
        }).catch(e => { window.error = e.message; });
      </script>
    </body>
    </html>
  `;
  await page.setContent(html);
  await page.waitForFunction(() => window.done || window.error, { timeout: 30000 });
  const items = await page.evaluate(() => window.items);
  console.log('Total items in Canva PDF:', items.length);

  // Filter items in the bottom 150 pt
  const bottomItems = items.filter(it => it.y < 150);
  bottomItems.sort((a,b) => b.y - a.y || a.x - b.x);
  console.log('\n--- Bottom items in Canva reference (y < 150) ---');
  for (const it of bottomItems) {
    console.log(`y=${it.y.toFixed(1)}, x=${it.x.toFixed(1)}: "${it.str}"`);
  }
  await browser.close();
})();
