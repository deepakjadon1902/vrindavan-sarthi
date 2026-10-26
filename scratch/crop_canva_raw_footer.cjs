const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });

  // Load the Canva reference PDF directly and screenshot the exact bottom 80 pt
  const pdfBase64 = fs.readFileSync('C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792958011766_fd735b5e.pdf').toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>body { margin: 0; background: #fff; }</style>
    </head>
    <body>
      <canvas id="c"></canvas>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
          const p = await pdf.getPage(1);
          const vp = p.getViewport({ scale: 2.5 });
          const c = document.getElementById('c');
          c.width = vp.width;
          c.height = vp.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          window.done = true;
        });
      </script>
    </body>
    </html>
  `;
  await page.setContent(html);
  await page.waitForFunction(() => window.done, { timeout: 30000 });
  
  const canvasEl = await page.$('#c');
  const clipBox = await page.evaluate(() => {
    const c = document.getElementById('c');
    return {
      x: 0,
      y: c.height - 160,
      width: c.width,
      height: 160
    };
  });
  await page.setViewportSize({ width: Math.ceil(clipBox.width), height: Math.ceil(clipBox.y + clipBox.height) });
  await page.screenshot({
    path: 'scratch/canva_reference_raw_footer.png',
    clip: clipBox
  });
  console.log('Saved scratch/canva_reference_raw_footer.png');
  await browser.close();
})();
