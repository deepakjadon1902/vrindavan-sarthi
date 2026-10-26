const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

const targetPdf = process.argv[2] || 'scratch/production_single_page.pdf';
console.log('Extracting from:', targetPdf);

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  const pdfBytes = fs.readFileSync(targetPdf);
  const b64 = pdfBytes.toString('base64');
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    </head>
    <body>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${b64}');
        pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
          const page1 = await pdf.getPage(1);
          const textContent = await page1.getTextContent();
          window.items = textContent.items.map(it => ({
            str: it.str,
            x: Math.round(it.transform[4]),
            y: Math.round(it.transform[5]),
            scaleY: Math.round(it.transform[3] * 10) / 10
          }));
          window.numPages = pdf.numPages;
          window.done = true;
        }).catch(err => {
          window.error = err.message;
        });
      </script>
    </body>
    </html>
  `);

  await page.waitForFunction(() => window.done || window.error);
  const numPages = await page.evaluate(() => window.numPages);
  const items = await page.evaluate(() => window.items);
  console.log('Number of pages:', numPages);
  console.log('Total items:', items.length);

  const cleanItems = items.filter(it => it.str.trim()).sort((a,b) => b.y - a.y || a.x - b.x);
  cleanItems.forEach(it => {
    console.log(`[Y=${it.y}, X=${it.x}] sz=${it.scaleY}: '${it.str}'`);
  });

  await browser.close();
})();
