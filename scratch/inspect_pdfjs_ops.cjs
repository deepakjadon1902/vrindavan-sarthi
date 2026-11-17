const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage();
  const pdfBytes = fs.readFileSync('C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792955333039_65556779.pdf');
  const b64 = pdfBytes.toString('base64');

  await page.setContent(`
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdfData = atob('${b64}');
      pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
        const page1 = await pdf.getPage(1);
        const opList = await page1.getOperatorList();
        const fns = opList.fnArray;
        const args = opList.argsArray;
        const imageOps = [];
        for (let i = 0; i < fns.length; i++) {
          if (fns[i] === pdfjsLib.OPS.paintImageXObject || fns[i] === pdfjsLib.OPS.paintInlineImageXObject) {
            imageOps.push({ fn: fns[i], name: args[i][0] });
          }
        }
        window.imageOps = imageOps;
        window.done = true;
      });
    </script>
  `);

  await page.waitForFunction(() => window.done);
  const imageOps = await page.evaluate(() => window.imageOps);
  console.log('Image operators on page 1:', imageOps);
  await browser.close();
})();
