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
    <!DOCTYPE html><html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script></head><body><script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument({ data: atob('${pdfBase64}') }).promise.then(async (pdf) => {
        const p = await pdf.getPage(1);
        const tc = await p.getTextContent();
        window.items = tc.items.filter(it => it.transform[5] < 50);
        window.done = true;
      });
    </script></body></html>
  `;
  await page.setContent(html);
  await page.waitForFunction(() => window.done);
  const items = await page.evaluate(() => window.items);
  console.log('Items y < 50 in Canva reference PDF:');
  items.forEach(it => {
    console.log(`x=${it.transform[4].toFixed(2)}, str="${it.str}"`);
  });
  await browser.close();
})();
