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
        await page1.getOperatorList();
        const commonObjs = page1.commonObjs;
        const objs = page1.objs;
        window.extracted = {};
        
        const names = ['img_p0_1', 'img_p0_2', 'img_p0_3', 'img_p0_4', 'img_p0_5'];
        for (const name of names) {
          try {
            objs.get(name, (imgData) => {
              if (!imgData) return;
              const canvas = document.createElement('canvas');
              canvas.width = imgData.width;
              canvas.height = imgData.height;
              const ctx = canvas.getContext('2d');
              const imgDataObj = ctx.createImageData(imgData.width, imgData.height);
              // Check if rgba or rgb
              if (imgData.data.length === imgData.width * imgData.height * 4) {
                imgDataObj.data.set(imgData.data);
              } else if (imgData.data.length === imgData.width * imgData.height * 3) {
                let s = 0, d = 0;
                while (s < imgData.data.length) {
                  imgDataObj.data[d] = imgData.data[s];
                  imgDataObj.data[d+1] = imgData.data[s+1];
                  imgDataObj.data[d+2] = imgData.data[s+2];
                  imgDataObj.data[d+3] = 255;
                  s += 3; d += 4;
                }
              }
              ctx.putImageData(imgDataObj, 0, 0);
              window.extracted[name] = {
                width: imgData.width,
                height: imgData.height,
                url: canvas.toDataURL('image/png')
              };
            });
          } catch (e) {
            console.error('Error getting ' + name, e);
          }
        }
        setTimeout(() => { window.done = true; }, 1000);
      });
    </script>
  `);

  await page.waitForFunction(() => window.done, { timeout: 15000 });
  const extracted = await page.evaluate(() => window.extracted);
  console.log('Extracted images count:', Object.keys(extracted).length);
  for (const [name, info] of Object.entries(extracted)) {
    console.log(`Image ${name}: ${info.width}x${info.height}`);
    const pngData = Buffer.from(info.url.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(`scratch/${name}.png`, pngData);
  }
  await browser.close();
})();
