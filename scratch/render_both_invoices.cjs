const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

async function renderPdfFile(browser, pdfFilePath, outputPngPath) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const htmlPath = 'file:///' + path.join(__dirname, 'pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const pdfBuffer = fs.readFileSync(pdfFilePath);
  const base64Data = pdfBuffer.toString('base64');

  await page.evaluate((b64) => {
    window.renderPdf(b64);
  }, base64Data);

  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });
  await page.waitForTimeout(600);

  const canvas = await page.$('#the-canvas');
  if (canvas) {
    await canvas.screenshot({ path: outputPngPath });
  } else {
    await page.screenshot({ path: outputPngPath });
  }
  await page.close();
  console.log(`Rendered ${pdfFilePath} -> ${outputPngPath}`);
}

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  await renderPdfFile(browser, path.join(__dirname, 'invoice_with_category_id.pdf'), path.join(__dirname, 'invoice_with_category_id.png'));
  await renderPdfFile(browser, path.join(__dirname, 'invoice_without_category_id.pdf'), path.join(__dirname, 'invoice_without_category_id.png'));

  await browser.close();
  console.log('Both invoice sample images successfully created.');
})().catch(console.error);
