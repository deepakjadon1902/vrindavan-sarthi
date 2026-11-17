const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const testSuiteContent = fs.readFileSync('prototype-receipt-a4/test_suite.cjs', 'utf8');
const match = testSuiteContent.match(/const testCases = (\[[\s\S]*?\]);/);
const testCases = eval(match[1]);

(async () => {
  const { buildRefinedReceiptHtml } = require('./test_scale_refinement.cjs');
  const buildRefined = buildRefinedReceiptHtml;

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });

  const viewerPage = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const viewerPath = 'file:///' + path.resolve('scratch/pdf_viewer.html').replace(/\\/g, '/');

  console.log('Testing refined layout against ALL 7 scenarios...\n');
  let allPass = true;

  for (const tc of testCases) {
    const html = await buildRefined(tc.data);
    const renderPage = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2
    });

    await renderPage.setContent(html, { waitUntil: 'networkidle' });

    const metrics = await renderPage.evaluate(() => {
      const container = document.querySelector('.page-container');
      return {
        containerHeight: container.offsetHeight,
        containerScrollHeight: container.scrollHeight,
        isOverflowing: container.scrollHeight > container.offsetHeight
      };
    });

    const pdfBuffer = await renderPage.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    await renderPage.close();

    // Verify in PDF.js
    await viewerPage.goto(viewerPath);
    await viewerPage.evaluate((b64) => {
      window.renderPdf(b64);
    }, pdfBuffer.toString('base64'));

    await viewerPage.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });
    const pageCount = await viewerPage.evaluate(() => window.__PAGE_COUNT__);
    const qrResult = await viewerPage.evaluate(() => window.__QR_RESULT__);

    const isOnePage = pageCount === 1;
    const isQrValid = typeof qrResult === 'string' && qrResult.includes(tc.data.bookingId);
    const pass = isOnePage && !metrics.isOverflowing && isQrValid;

    if (!pass) allPass = false;

    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.id}:`);
    console.log(`       PageCount=${pageCount}, ScrollH=${metrics.containerScrollHeight}, OffsetH=${metrics.containerHeight}, QR=${isQrValid}`);
  }

  console.log('\nOverall All Pass:', allPass);
  await browser.close();
})();
