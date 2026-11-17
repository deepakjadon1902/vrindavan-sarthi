const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('scratch/original_reference.png').toString('base64');
  await page.setContent(`<canvas id="c"></canvas>`);

  const colors = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await new Promise(r => img.onload = r);
    const c = document.getElementById('c');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const getHex = (x, y) => {
      const p = ctx.getImageData(x, y, 1, 1).data;
      return '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    };

    return {
      pageBg: getHex(10, 10),
      headerBg: getHex(50, 50),
      cardHeaderAccommodation: getHex(200, 480),
      cardBodyAccommodation: getHex(200, 550),
      cardHeaderPayment: getHex(800, 480),
      totalBox: getHex(800, 680),
      paidBox: getHex(800, 750),
      balanceBox: getHex(800, 830),
      policyHeader: getHex(200, 1100),
      policyBody: getHex(200, 1200),
      disclaimerHeader: getHex(200, 1370),
      disclaimerBody: getHex(200, 1450),
    };
  }, 'data:image/png;base64,' + b64);

  console.log('Sampled colors from original Canva reference:', colors);
  await browser.close();
})();
