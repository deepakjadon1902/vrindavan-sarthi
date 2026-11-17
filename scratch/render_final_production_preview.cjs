const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');
const { buildBookingReceiptPdf } = require('../backend/utils/bookingReceiptPdf');

async function main() {
  const referenceBooking = {
    bookingId: 'VVS-DR-20261023-191395',
    displayBookingId: '67400933',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
    propertyName: 'Shri Giriraj Sewa Sadan',
    propertyId: '815466',
    partnerName: 'Shri Giriraj Sewa Sadan',
    partnerPhone: '9927600017',
    customerFullName: 'Vrindavan Sarthi',
    customerMobile: '6396147954',
    customerEmail: 'vrindavansarthi108@gmail.com',
    customerCity: 'Govardhan',
    customerState: 'Uttar Pradesh',
    userId: '618792',
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    guests: 1,
    roomQuantity: 1,
    roomId: '10440',
    totalAdults: 1,
    totalChildren: 0,
    totalAmount: 1299,
    dharamshalaAmount: 1200,
    baseAmount: 1200,
    vrindavanSarthiServiceFee: 99,
    amountPaidOnline: 99,
    amountPayableAtProperty: 1200,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    paymentMethod: 'online',
    razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
    paidAt: '2026-10-23T13:48:43.596Z',
    createdAt: '2026-10-23T13:43:28.185Z',
    propertyLocation: 'Near Prem Mandir, Vrindavan, UP- 281121',
    propertyAddress: 'Keshav Dham Road Opposite prem Mandir',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    nearestTemple: 'Prem Mandir, Vrindavan, UP- 281121',
  };

  console.log('Rendering reference booking from backend/utils/bookingReceiptPdf.js...');
  const { buffer, filename } = buildBookingReceiptPdf(referenceBooking);
  const pdfPath = path.resolve(__dirname, 'production_single_page.pdf');
  fs.writeFileSync(pdfPath, buffer);
  console.log(`Saved PDF to: ${pdfPath}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });

  const pdfBase64 = buffer.toString('base64');
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #fff; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="pdf-render"></canvas>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        loadingTask.promise.then(async function(pdf) {
          window.pdfPageCount = pdf.numPages;
          const page = await pdf.getPage(1);
          const scale = 2.0;
          const viewport = page.getViewport({ scale: scale });
          const canvas = document.getElementById('pdf-render');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: context, viewport: viewport };
          await page.render(renderContext).promise;
          window.renderDone = true;
        }).catch(err => {
          window.renderError = err.message;
        });
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  await page.waitForFunction(() => window.renderDone || window.renderError, { timeout: 30000 });

  const canvasEl = await page.$('#pdf-render');
  const pngPath = path.resolve(__dirname, 'production_single_page.png');
  await canvasEl.screenshot({ path: pngPath });
  console.log(`Saved rendered PNG preview to: ${pngPath}`);

  // Also update side-by-side comparison with original reference
  const refPdf = 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792955333039_65556779.pdf';
  const refPng = path.resolve(__dirname, 'original_reference.png');

  const refB64 = fs.readFileSync(refPng).toString('base64');
  const curB64 = fs.readFileSync(pngPath).toString('base64');

  const sideBySideHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 24px; background: #0f172a; font-family: sans-serif; color: white; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 22px; margin: 0 0 6px 0; color: #f8fafc; }
        .header p { font-size: 13px; margin: 0; color: #94a3b8; }
        .row { display: flex; gap: 24px; justify-content: center; }
        .col { display: flex; flex-direction: column; align-items: center; width: 1100px; }
        .badge { font-size: 14px; font-weight: bold; padding: 8px 20px; border-radius: 6px; margin-bottom: 12px; }
        .badge-ref { background: #b91c1c; color: white; }
        .badge-cur { background: #16a34a; color: white; }
        img { width: 100%; height: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>VRINDAVAN SARTHI — REFERENCE PDF vs GENERATED PDF COMPARISON</h1>
        <p>Rendered at Identical Resolution (Scale 2.0) | Direct Section-by-Section Visual Verification</p>
      </div>
      <div class="row">
        <div class="col">
          <div class="badge badge-ref">1. ORIGINAL REFERENCE PDF (DESIGN AUTHORITY)</div>
          <img src="data:image/png;base64,${refB64}" />
        </div>
        <div class="col">
          <div class="badge badge-cur">2. FAITHFULLY MATCHED GENERATED PDF (backend/utils/bookingReceiptPdf.js)</div>
          <img src="data:image/png;base64,${curB64}" />
        </div>
      </div>
    </body>
    </html>
  `;

  const compPage = await browser.newPage({ viewport: { width: 2500, height: 1800 } });
  await compPage.setContent(sideBySideHtml);
  const compPng = path.resolve(__dirname, 'side_by_side_reference_vs_current.png');
  await compPage.screenshot({ path: compPng, fullPage: true });
  console.log(`Saved side-by-side comparison to ${compPng}`);

  await browser.close();
  console.log('Complete!');
}

main().catch(console.error);
