const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 2600 } });
  
  const htmlPath = 'file:///' + path.resolve(__dirname, 'pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);
  
  const pdfBuffer = fs.readFileSync(path.resolve(__dirname, 'live_downloaded_receipt.pdf'));
  const base64Data = pdfBuffer.toString('base64');

  await page.evaluate((b64) => {
    window.renderPdf(b64);
  }, base64Data);

  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 20000 });
  await page.waitForTimeout(1500);

  const pageCount = await page.evaluate(() => window.__PAGE_COUNT__);
  const qrResult = await page.evaluate(() => window.__QR_RESULT__);

  console.log('PDF Page Count:', pageCount);
  console.log('Decoded QR Result from Canvas:', qrResult);

  // Capture Page 1 Canvas
  const canvas1 = page.locator('#page-canvas-1');
  const img1Path = path.resolve(__dirname, 'receipt_page_1.png');
  await canvas1.screenshot({ path: img1Path });
  console.log('Saved scratch/receipt_page_1.png!');

  // Capture Page 2 Canvas
  const canvas2 = page.locator('#page-canvas-2');
  const img2Path = path.resolve(__dirname, 'receipt_page_2.png');
  await canvas2.screenshot({ path: img2Path });
  console.log('Saved scratch/receipt_page_2.png!');

  // Copy to Artifact Directory
  const artifactDir = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';
  fs.copyFileSync(img1Path, path.join(artifactDir, 'receipt_page_1.png'));
  fs.copyFileSync(img2Path, path.join(artifactDir, 'receipt_page_2.png'));
  console.log('Copied receipt_page_1.png and receipt_page_2.png to artifact directory!');

  await browser.close();
})().catch(console.error);
