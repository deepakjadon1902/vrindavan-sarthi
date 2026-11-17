const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  
  const htmlPath = 'file:///' + path.join(__dirname, 'pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);
  
  const pdfBuffer = fs.readFileSync(path.join(__dirname, 'baseline_receipt.pdf'));
  const base64Data = pdfBuffer.toString('base64');

  await page.evaluate((b64) => {
    window.renderPdf(b64);
  }, base64Data);

  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const imgPath = path.join(__dirname, 'baseline_receipt.png');
  const canvas = await page.$('canvas');
  if (canvas) {
    await canvas.screenshot({ path: imgPath });
    console.log('Successfully saved baseline_receipt.png from canvas!');
  } else {
    await page.screenshot({ path: imgPath });
    console.log('Saved full page screenshot.');
  }

  await browser.close();
})().catch(console.error);
