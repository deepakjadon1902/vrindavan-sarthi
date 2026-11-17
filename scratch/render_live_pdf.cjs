const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
  
  const htmlPath = 'file:///' + path.resolve(__dirname, 'pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);
  
  const pdfBuffer = fs.readFileSync(path.resolve(__dirname, 'live_downloaded_receipt.pdf'));
  const base64Data = pdfBuffer.toString('base64');

  await page.evaluate((b64) => {
    window.renderPdf(b64);
  }, base64Data);

  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const imgPath = path.resolve(__dirname, 'reference_matched_receipt.png');
  const canvas = await page.$('canvas');
  if (canvas) {
    await canvas.screenshot({ path: imgPath });
    console.log('Successfully saved reference_matched_receipt.png from canvas!');
  } else {
    await page.screenshot({ path: imgPath });
    console.log('Saved full page screenshot.');
  }

  const artifactDir = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';
  const artifactPath = path.join(artifactDir, 'reference_matched_receipt.png');
  fs.copyFileSync(imgPath, artifactPath);
  console.log('Successfully updated reference_matched_receipt.png in artifact directory:', artifactPath);

  const refJpg = path.resolve(__dirname, 'reference_receipt.jpg');
  const artifactRefJpg = path.join(artifactDir, 'reference_receipt.jpg');
  if (fs.existsSync(refJpg)) {
    fs.copyFileSync(refJpg, artifactRefJpg);
    console.log('Successfully copied reference_receipt.jpg to artifact directory:', artifactRefJpg);
  }

  await browser.close();
})().catch(console.error);
