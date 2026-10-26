const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('../frontend/node_modules/playwright');
const { buildBookingReceiptPdf } = require('../backend/utils/bookingReceiptPdf');
const { generateBookingInvoicePdf } = require('../backend/utils/customerMessages');
const legacyPdf = require('../backend/utils/bookingReceiptPdf.legacy');

const ARTIFACT_DIR = 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09';

// 5 Authoritative Synthetic Fixtures
const fixtures = [
  {
    scenarioId: 1,
    name: 'Dharamshala Booking',
    slug: 'scenario_1_dharamshala',
    booking: {
      bookingId: 'VVS-DR-20261024-118201',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Radha Rani Sewa Trust - AC Deluxe 201',
      propertyName: 'Shri Radha Rani Sewa Trust (Govardhan)',
      partnerName: 'Shri Radha Rani Sewa Trust',
      partnerPhone: '9927600017',
      customerFullName: 'Shri Gopal Das Agrawal',
      customerMobile: '9876543210',
      customerEmail: 'gopal.das@example.com',
      customerCity: 'Vrindavan',
      customerState: 'Uttar Pradesh',
      checkIn: '2026-10-26T00:00:00.000Z',
      checkOut: '2026-10-28T00:00:00.000Z',
      checkInTime: '12:00 PM',
      checkOutTime: '11:00 AM',
      guests: 2,
      roomQuantity: 1,
      roomNumber: '201',
      totalAdults: 2,
      totalChildren: 0,
      totalAmount: 2198,
      dharamshalaAmount: 2000,
      baseAmount: 2000,
      vrindavanSarthiServiceFee: 198,
      amountPaidOnline: 198,
      amountPayableAtProperty: 2000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_Dhrm198OnlineOk',
      paidAt: '2026-10-24T06:30:00.000Z',
      createdAt: '2026-10-24T06:25:00.000Z',
      propertyLocation: 'Near Parikrama Marg, Govardhan, Mathura, UP 281502',
      propertyAddress: 'Near Parikrama Marg, Govardhan, Mathura, UP 281502',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    },
    expected: {
      docTitle: 'BOOKING CONFIRMATION &',
      totalStr: 'INR 2,198',
      paidStr: 'INR 198',
      balanceStr: 'INR 2,000',
      tariffLabel: 'Dharamshala Tariff',
      tariffStr: 'INR 2,000',
      feeLabel: 'Platform Facilitation Fee',
      feeStr: 'INR 198',
      mode: 'Platform Fee Paid Online; Balance Due at Property',
      paymentBoxLabel: 'Paid Online (Platform Fee)',
      balBoxLabel: 'Balance Payable at Property',
    }
  },
  {
    scenarioId: 2,
    name: 'Commercial Hotel 100% Online Payment',
    slug: 'scenario_2_hotel_full',
    booking: {
      bookingId: 'VVS-HT-20261024-918802',
      bookingType: 'room_type',
      service_billing_model: 'hotel_commission',
      itemName: 'Hotel Brij View - Superior Suite',
      propertyName: 'Hotel Brij View (Vrindavan)',
      partnerName: 'Hotel Brij View',
      partnerPhone: '9837012345',
      customerFullName: 'Shrimati Meera Devi Sharma',
      customerMobile: '9811223344',
      customerEmail: 'meera.sharma@example.com',
      customerCity: 'New Delhi',
      customerState: 'Delhi',
      checkIn: '2026-11-01T00:00:00.000Z',
      checkOut: '2026-11-03T00:00:00.000Z',
      checkInTime: '02:00 PM',
      checkOutTime: '12:00 PM',
      guests: 3,
      roomQuantity: 1,
      roomNumber: 'Suite 302',
      totalAdults: 3,
      totalChildren: 0,
      totalAmount: 5900,
      baseAmount: 5000,
      taxAmount: 900,
      hotel_gstin: '09AAACH7409R1ZZ',
      amountPaidOnline: 5900,
      amountPayableAtProperty: 0,
      paymentOption: 'full',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_FullHotelOnline5900',
      paidAt: '2026-10-24T06:31:00.000Z',
      createdAt: '2026-10-24T06:26:00.000Z',
      propertyLocation: 'Near Prem Mandir, Chattikara Road, Vrindavan, UP 281121',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    },
    expected: {
      docTitle: 'BOOKING CONFIRMATION &',
      totalStr: 'INR 5,900',
      paidStr: 'INR 5,900',
      balanceStr: 'INR 0',
      tariffLabel: 'Room Amount',
      tariffStr: 'INR 5,000',
      feeLabel: 'Hotel GST / Hotel Taxes',
      feeStr: 'INR 900',
      mode: 'Fully Paid Online',
      paymentBoxLabel: 'Paid Online (Verified)',
      balBoxLabel: 'Balance Settled (Full Paid)',
    }
  },
  {
    scenarioId: 3,
    name: 'Commercial Hotel 30% Advance Split',
    slug: 'scenario_3_hotel_30_advance',
    booking: {
      bookingId: 'VVS-HT-20261024-307712',
      bookingType: 'room_type',
      service_billing_model: 'hotel_commission',
      itemName: 'Shri Radha Krishna Dham Hotel - Executive AC Room',
      propertyName: 'Shri Radha Krishna Dham Hotel',
      partnerName: 'Shri Radha Krishna Dham Hotel',
      partnerPhone: '9719001122',
      customerFullName: 'Shri Rajesh Khandelwal',
      customerMobile: '9765432109',
      customerEmail: 'rajesh.khandelwal@example.com',
      customerCity: 'Jaipur',
      customerState: 'Rajasthan',
      checkIn: '2026-11-10T00:00:00.000Z',
      checkOut: '2026-11-12T00:00:00.000Z',
      checkInTime: '01:00 PM',
      checkOutTime: '11:00 AM',
      guests: 2,
      roomQuantity: 1,
      roomNumber: 'Room 114',
      totalAmount: 10000,
      baseAmount: 8500,
      taxAmount: 1500,
      hotel_gstin: '09AABCS8899K1Z5',
      paymentOption: 'advance_30',
      advanceAmount: 3000,
      amountPaidOnline: 3000,
      balanceAmount: 7000,
      amountPayableAtProperty: 7000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_AdvHotel3000Part',
      paidAt: '2026-10-24T06:32:00.000Z',
      createdAt: '2026-10-24T06:27:00.000Z',
      propertyLocation: 'Raman Reti Road, Vrindavan, UP 281121',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    },
    expected: {
      docTitle: 'BOOKING CONFIRMATION &',
      totalStr: 'INR 10,000',
      paidStr: 'INR 3,000',
      balanceStr: 'INR 7,000',
      tariffLabel: 'Room Amount',
      tariffStr: 'INR 8,500',
      feeLabel: 'Hotel GST / Hotel Taxes',
      feeStr: 'INR 1,500',
      mode: '30% Advance Paid Online - 70% Balance at Check-in',
      paymentBoxLabel: 'Paid Online (30% Advance)',
      balBoxLabel: 'Balance Payable at Property',
    }
  },
  {
    scenarioId: 4,
    name: 'Dedicated Cab Booking',
    slug: 'scenario_4_cab',
    booking: {
      bookingId: 'VVS-CB-20261024-440911',
      bookingType: 'cab',
      service_billing_model: 'taxi_direct',
      itemName: 'Dedicated AC Sedan (Dzire / Etios)',
      cabType: 'sedan',
      pickupAddress: 'Mathura Junction Railway Station (Platform 1)',
      dropAddress: 'Prem Mandir, Bhaktivedanta Swami Marg, Vrindavan',
      partnerName: 'Vrindavan Sarthi Official Cab Fleet',
      partnerPhone: '8679820256',
      customerFullName: 'Shri Mukund Lal Joshi',
      customerMobile: '9988776655',
      customerEmail: 'mukund.joshi@example.com',
      checkIn: '2026-10-28T00:00:00.000Z',
      checkInTime: '08:30 AM',
      pickupTime: '08:30 AM',
      totalAmount: 1450,
      baseAmount: 1450,
      amountPaidOnline: 1450,
      amountPayableAtProperty: 0,
      paymentOption: 'full',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_CabOnline1450Ok',
      paidAt: '2026-10-24T06:33:00.000Z',
      createdAt: '2026-10-24T06:28:00.000Z',
    },
    expected: {
      docTitle: 'CAB BOOKING CONFIRMATION',
      totalStr: 'INR 1,450',
      paidStr: 'INR 1,450',
      balanceStr: 'INR 0',
      tariffLabel: 'Cab Fare',
      tariffStr: 'INR 1,450',
      mode: 'Fully Paid Online',
      paymentBoxLabel: 'Paid Online (Verified)',
      balBoxLabel: 'Balance Settled (Full Paid)',
    }
  },
  {
    scenarioId: 5,
    name: 'Pilgrimage Tour Booking',
    slug: 'scenario_5_tour',
    booking: {
      bookingId: 'VVS-TR-20261024-770834',
      bookingType: 'tour',
      service_billing_model: 'tour_direct',
      itemName: 'Braj 84 Kos Yatra - 3 Days Guided Parikrama Tour',
      packageName: 'Braj 84 Kos Yatra (Guided)',
      inclusions: 'AC Transport, Guided Darshan, Prasad & Assistance',
      partnerName: 'Vrindavan Sarthi Yatra Team',
      partnerPhone: '8679820256',
      customerFullName: 'Shri Kishori Sharan Das',
      customerMobile: '9412398765',
      customerEmail: 'kishori.sharan@example.com',
      checkIn: '2026-11-05T00:00:00.000Z',
      checkInTime: '06:00 AM',
      totalAmount: 8500,
      baseAmount: 8500,
      amountPaidOnline: 8500,
      amountPayableAtProperty: 0,
      paymentOption: 'full',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_TourOnline8500Ok',
      paidAt: '2026-10-24T06:34:00.000Z',
      createdAt: '2026-10-24T06:29:00.000Z',
    },
    expected: {
      docTitle: 'PILGRIMAGE TOUR CONFIRMATION',
      totalStr: 'INR 8,500',
      paidStr: 'INR 8,500',
      balanceStr: 'INR 0',
      tariffLabel: 'Tour Package Fare',
      tariffStr: 'INR 8,500',
      mode: 'Fully Paid Online',
      paymentBoxLabel: 'Paid Online (Verified)',
      balBoxLabel: 'Balance Settled (Full Paid)',
    }
  }
];

async function main() {
  console.log('================================================================');
  console.log('PHASE 1 POST-COMMIT ACCEPTANCE VERIFICATION FOR COMMIT a2928d5');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });

  const results = [];

  for (const item of fixtures) {
    console.log(`[Scenario ${item.scenarioId}] Testing ${item.name} (${item.slug})...`);
    
    // 1. Generate PDF using committed production generator
    const receipt = buildBookingReceiptPdf(item.booking);
    assert.ok(Buffer.isBuffer(receipt.buffer), `Scenario ${item.scenarioId}: Must return buffer`);
    assert.ok(receipt.buffer.length > 50000, `Scenario ${item.scenarioId}: Buffer must be non-empty valid PDF`);
    
    const pdfPath = path.resolve(__dirname, `${item.slug}.pdf`);
    fs.writeFileSync(pdfPath, receipt.buffer);

    // Also copy to artifact dir
    const artifactPdfPath = path.resolve(ARTIFACT_DIR, `${item.slug}.pdf`);
    fs.copyFileSync(pdfPath, artifactPdfPath);

    const pdfStr = receipt.buffer.toString('utf8');

    // 2. Verify Page Count Constraint
    const pageCountMatch = pdfStr.match(/\/Count\s+(\d+)/);
    const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : null;
    assert.strictEqual(pageCount, 1, `Scenario ${item.scenarioId}: Page count must be exactly 1`);
    assert.ok(pdfStr.includes('Page 1 of 1'), `Scenario ${item.scenarioId}: Must show 'Page 1 of 1'`);

    // 3. Verify Financial Integrity
    assert.ok(pdfStr.includes(item.expected.totalStr), `Scenario ${item.scenarioId}: Total must be ${item.expected.totalStr}`);
    assert.ok(pdfStr.includes(item.expected.paidStr), `Scenario ${item.scenarioId}: Paid online must be ${item.expected.paidStr}`);
    assert.ok(pdfStr.includes(item.expected.balanceStr), `Scenario ${item.scenarioId}: Balance must be ${item.expected.balanceStr}`);
    assert.ok(pdfStr.includes(item.expected.tariffStr), `Scenario ${item.scenarioId}: Tariff must be ${item.expected.tariffStr}`);

    // 4. Verify QR and Link Annotations
    assert.ok(pdfStr.includes('/Subtype /Link'), `Scenario ${item.scenarioId}: Must include active PDF link annotations`);
    assert.ok(pdfStr.includes('https://www.vrindavansarthi.in/verify-booking?ref=' + item.booking.bookingId), 
      `Scenario ${item.scenarioId}: QR URL must match canonical verification route`);

    // 5. Render to High-Resolution PNG via Playwright & PDF.js
    const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
    const pdfBase64 = receipt.buffer.toString('base64');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 20px; background: #525659; display: flex; justify-content: center; }
          canvas { display: block; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        </style>
      </head>
      <body>
        <canvas id="pdf-render"></canvas>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const pdfData = atob('${pdfBase64}');
          const loadingTask = pdfjsLib.getDocument({ data: pdfData });
          loadingTask.promise.then(async function(pdf) {
            window.renderedPages = pdf.numPages;
            const page = await pdf.getPage(1);
            const scale = 2.0; // High resolution 2x
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.getElementById('pdf-render');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
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
    const renderErr = await page.evaluate(() => window.renderError);
    if (renderErr) throw new Error(`Render error in ${item.slug}: ` + renderErr);

    const renderedPages = await page.evaluate(() => window.renderedPages);
    assert.strictEqual(renderedPages, 1, `Scenario ${item.scenarioId}: PDF.js confirmed page count must be 1`);

    const canvasEl = await page.$('#pdf-render');
    const pngPath = path.resolve(__dirname, `${item.slug}.png`);
    await canvasEl.screenshot({ path: pngPath });

    const artifactPngPath = path.resolve(ARTIFACT_DIR, `${item.slug}.png`);
    fs.copyFileSync(pngPath, artifactPngPath);

    await page.close();

    console.log(`  -> Generated PDF: ${pdfPath}`);
    console.log(`  -> Rendered PNG:  ${pngPath}`);
    console.log(`  -> Status: PASS (Page Count: 1, Buffer: ${receipt.buffer.length} bytes)\n`);

    results.push({
      scenarioId: item.scenarioId,
      name: item.name,
      slug: item.slug,
      pageCount: 1,
      total: item.expected.totalStr,
      paid: item.expected.paidStr,
      balance: item.expected.balanceStr,
      status: 'PASS'
    });
  }

  await browser.close();

  // 6. Test Email Attachment Buffer Compatibility
  console.log('Testing Email Attachment & Invoice Callers...');
  const sampleBooking = fixtures[0].booking;
  const directReceipt = buildBookingReceiptPdf(sampleBooking);
  assert.ok(Buffer.isBuffer(directReceipt.buffer), 'Direct receipt buffer must be a Buffer');
  assert.strictEqual(directReceipt.buffer.slice(0, 5).toString('utf8'), '%PDF-', 'Must start with %PDF-');

  const invoiceExport = generateBookingInvoicePdf(sampleBooking);
  assert.ok(Buffer.isBuffer(invoiceExport.buffer), 'generateBookingInvoicePdf must return buffer');
  assert.strictEqual(invoiceExport.buffer.slice(0, 5).toString('utf8'), '%PDF-', 'Must start with %PDF-');
  assert.ok(invoiceExport.filename.endsWith('.pdf'), 'Filename must end with .pdf');
  console.log('  PASS: Email attachment bytes and invoice caller contracts verified.\n');

  // 7. Verify Legacy Generator Recoverability
  console.log('Testing Legacy Generator Recoverability (bookingReceiptPdf.legacy.js)...');
  assert.ok(typeof legacyPdf.buildBookingReceiptPdf === 'function', 'Legacy builder must export buildBookingReceiptPdf');
  const legacyResult = legacyPdf.buildBookingReceiptPdf(sampleBooking);
  assert.ok(Buffer.isBuffer(legacyResult.buffer), 'Legacy generator must produce valid buffer');
  assert.strictEqual(legacyResult.buffer.slice(0, 5).toString('utf8'), '%PDF-', 'Legacy buffer must be valid PDF');
  console.log(`  PASS: Legacy generator verified recoverable (${legacyResult.buffer.length} bytes output).\n`);

  console.log('================================================================');
  console.log('ALL 5 POST-COMMIT SCENARIOS AND CALLERS VERIFIED 100% PASS');
  console.log('================================================================');
  
  return results;
}

main().catch(err => {
  console.error('\n*** POST-COMMIT ACCEPTANCE VERIFICATION FAILED ***');
  console.error(err);
  process.exit(1);
});
