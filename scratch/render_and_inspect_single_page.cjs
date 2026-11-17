const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend/node_modules/playwright');
const { buildBookingReceiptPdf } = require('./test_single_page_builder.cjs');

async function main() {
  const referenceBooking = {
    bookingId: 'VVS-DR-20261023-191395',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Shri Giriraj Sewa Sadan - Double Bed Room 104',
    propertyName: 'Shri Giriraj Sewa Sadan (Govardhan)',
    partnerName: 'Shri Giriraj Sewa Sadan',
    partnerPhone: '9927600017',
    customerFullName: 'Vrindavan Sarthi Devotee',
    customerMobile: '6396147954',
    customerEmail: 'vrindavansarthi108@gmail.com',
    customerCity: 'Govardhan',
    customerState: 'Uttar Pradesh',
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    guests: 2,
    roomQuantity: 1,
    roomNumber: '104',
    totalAdults: 2,
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
    propertyLocation: 'Near Danghati Mandir, Govardhan, Mathura, UP 281502',
    propertyAddress: 'Near Danghati Mandir, Govardhan, Mathura, UP 281502',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    nearestTemple: 'Danghati Mandir (approx 150m)',
  };

  console.log('Generating single-page PDF with pure Node.js builder...');
  const { buffer, filename, documentTitle } = buildBookingReceiptPdf(referenceBooking);
  console.log(`Generated filename: ${filename}, buffer length: ${buffer.length} bytes`);

  const pdfPath = path.resolve(__dirname, 'single_page_receipt.pdf');
  fs.writeFileSync(pdfPath, buffer);
  console.log(`Saved PDF to: ${pdfPath}`);

  const pdfStr = buffer.toString('utf8');
  const countMatch = pdfStr.match(/\/Count\s+(\d+)/);
  const pageCount = countMatch ? parseInt(countMatch[1], 10) : null;
  console.log(`Detected PDF Page Count: ${pageCount}`);

  // Now render to PNG using Playwright and PDF.js viewer
  console.log('Rendering PDF to high-res PNG preview...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });

  // Use pdf.js in browser or data URL viewer
  const pdfBase64 = buffer.toString('base64');
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; padding: 20px; background: #525659; display: flex; justify-content: center; }
        #canvas-container { box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <div id="canvas-container">
        <canvas id="pdf-render"></canvas>
      </div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob('${pdfBase64}');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        loadingTask.promise.then(async function(pdf) {
          window.pdfPageCount = pdf.numPages;
          const page = await pdf.getPage(1);
          const scale = 2.0; // High resolution render
          const viewport = page.getViewport({ scale: scale });
          const canvas = document.getElementById('pdf-render');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: context, viewport: viewport };
          await page.render(renderContext).promise;
          window.renderDone = true;
        }).catch(err => {
          console.error(err);
          window.renderError = err.message;
        });
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  await page.waitForFunction(() => window.renderDone || window.renderError, { timeout: 30000 });

  const renderError = await page.evaluate(() => window.renderError);
  if (renderError) {
    throw new Error('PDF render error: ' + renderError);
  }

  const renderedNumPages = await page.evaluate(() => window.pdfPageCount);
  console.log(`PDF.js rendered total pages: ${renderedNumPages}`);

  const canvasEl = await page.$('#pdf-render');
  const pngPath = path.resolve(__dirname, 'single_page_receipt.png');
  await canvasEl.screenshot({ path: pngPath });
  console.log(`Saved rendered PNG preview to: ${pngPath}`);

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('ERROR in main:', err);
  process.exit(1);
});
