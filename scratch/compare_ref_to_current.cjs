const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

async function renderPdfToPng(pdfPath, outPngPath, scale = 2.0) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 } });

  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>body { margin: 0; padding: 0; background: #fff; }</style>
    </head>
    <body>
      <canvas id="pdf-canvas"></canvas>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: ${scale} });
          const canvas = document.getElementById('pdf-canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          window.renderDone = true;
        }).catch(e => { window.renderError = e.message; });
      </script>
    </body>
    </html>
  `;
  await page.setContent(html);
  await page.waitForFunction(() => window.renderDone || window.renderError, { timeout: 30000 });
  const canvasEl = await page.$('#pdf-canvas');
  await canvasEl.screenshot({ path: outPngPath });
  await browser.close();
  console.log(`Rendered ${pdfPath} -> ${outPngPath}`);
}

async function main() {
  const refPdf = 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792955333039_65556779.pdf';
  const curPdf = path.resolve(__dirname, 'production_single_page.pdf');

  const refPng = path.resolve(__dirname, 'original_reference.png');
  const curPng = path.resolve(__dirname, 'current_generated.png');

  console.log('Rendering original reference PDF...');
  await renderPdfToPng(refPdf, refPng, 2.0);

  console.log('Rendering current generated PDF...');
  await renderPdfToPng(curPdf, curPng, 2.0);

  // Create side-by-side image
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 2500, height: 1800 } });
  
  const refB64 = fs.readFileSync(refPng).toString('base64');
  const curB64 = fs.readFileSync(curPng).toString('base64');

  const sideBySideHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 20px; background: #1e293b; font-family: sans-serif; color: white; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin: 0 0 6px 0; color: #f8fafc; }
        .header p { font-size: 14px; margin: 0; color: #94a3b8; }
        .row { display: flex; gap: 30px; justify-content: center; }
        .col { display: flex; flex-direction: column; align-items: center; width: 1100px; }
        .badge { font-size: 15px; font-weight: bold; padding: 8px 20px; border-radius: 6px; margin-bottom: 12px; }
        .badge-ref { background: #b91c1c; color: white; }
        .badge-cur { background: #2563eb; color: white; }
        img { width: 100%; height: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>VRINDAVAN SARTHI — ORIGINAL REFERENCE PDF vs CURRENT GENERATED PDF</h1>
        <p>Rendered at Identical Resolution (Scale 2.0) | Direct Section-by-Section Comparison</p>
      </div>
      <div class="row">
        <div class="col">
          <div class="badge badge-ref">1. ORIGINAL REFERENCE PDF (DESIGN AUTHORITY)</div>
          <img src="data:image/png;base64,${refB64}" />
        </div>
        <div class="col">
          <div class="badge badge-cur">2. CURRENT GENERATED PDF (BEFORE FIXES)</div>
          <img src="data:image/png;base64,${curB64}" />
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(sideBySideHtml);
  const compPng = path.resolve(__dirname, 'side_by_side_reference_vs_current.png');
  await page.screenshot({ path: compPng, fullPage: true });
  console.log(`Saved side-by-side comparison to ${compPng}`);
  await browser.close();
}

main().catch(console.error);
