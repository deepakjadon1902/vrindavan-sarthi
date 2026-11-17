const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  
  const htmlPath = 'file:///' + path.resolve('scratch/pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);
  
  const pdfBuffer = fs.readFileSync(path.resolve('prototype-receipt-a4/reference_booking.pdf'));
  const base64Data = pdfBuffer.toString('base64');

  await page.evaluate((b64) => {
    window.renderPdf(b64);
  }, base64Data);

  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });

  const pageCount = await page.evaluate(() => window.__PAGE_COUNT__);
  const qrDecoded = await page.evaluate(() => window.__QR_RESULT__);

  console.log('PDF Page Count:', pageCount);
  console.log('Decoded QR Code:', qrDecoded);

  await browser.close();
})().catch(console.error);
