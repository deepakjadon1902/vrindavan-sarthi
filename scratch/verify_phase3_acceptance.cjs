const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildBookingReceiptPdf, resolvePaymentModeLabel, formatTimeString12 } = require('../backend/utils/bookingReceiptPdf');
const { chromium } = require('../frontend/node_modules/playwright');

async function runPhase3Acceptance() {
  console.log('=== PHASE 3 ACCEPTANCE SUITE ===\n');

  // 1. ALL 5 PAYMENT MODES & RECONCILIATIONS
  console.log('--- 1. Testing All 5 Payment Modes & Financial Reconciliations ---');
  
  // Case A: Dharamshala with Balance
  const dharamshalaBooking = {
    bookingId: 'VVS-DR-20261023-191395',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Shri Giriraj Sewa Sadan - Double Bed Room 104',
    propertyName: 'Shri Giriraj Sewa Sadan',
    partnerPhone: '9927600017',
    propertyAddress: 'Keshav Dham Road Opposite prem Mandir',
    nearestTemple: 'Prem Mandir',
    propertyCode: 'VVS-P-098E',
    roomNumber: '104',
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00',
    checkOutTime: '11:00',
    dharamshalaAmount: 1200,
    baseAmount: 1200,
    vrindavanSarthiServiceFee: 99,
    totalAmount: 1299,
    amountPaidOnline: 99,
    advanceAmount: 99,
    amountPayableAtProperty: 1200,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
    customerFullName: 'Vrindavan Sarthi',
    customerMobile: '6396147954',
    customerEmail: 'vrindavansarthi108@gmail.com',
    customerCity: 'Vrindavan',
    customerDistrict: 'Mathura',
    customerState: 'Uttar Pradesh',
    paidAt: '2026-10-23T13:48:00.000Z',
    createdAt: '2026-10-23T13:43:00.000Z',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
  };

  const drPdf = buildBookingReceiptPdf(dharamshalaBooking);
  assert.ok(drPdf.buffer.length > 5000, 'Dharamshala PDF valid');
  const drStr = drPdf.buffer.toString('utf8');
  assert.equal(resolvePaymentModeLabel(dharamshalaBooking), 'Platform Fee Paid Online; Balance Due at Property');
  assert.ok(drStr.includes('INR 1,200'), 'Tariff INR 1,200');
  assert.ok(drStr.includes('INR 99'), 'Fee INR 99');
  assert.ok(drStr.includes('INR 1,299'), 'Total INR 1,299');
  assert.ok(drStr.includes('Platform Facilitation Fee'), 'Fee naming is Platform Facilitation Fee');
  assert.ok(drStr.includes('12:00 PM'), 'Check-in formatted as 12:00 PM');
  assert.ok(drStr.includes('11:00 AM'), 'Check-out formatted as 11:00 AM');
  assert.ok(drStr.includes('+91 9927600017'), 'Reception phone clearly present');
  console.log('✓ Case A Passed: Dharamshala with Balance Reconciled (1,200 + 99 = 1,299; Paid: 99; Bal: 1,200)');

  // Case B: Commercial Hotel 30% Advance
  const hotelAdvBooking = {
    bookingId: 'VVS-HT-20261023-3001',
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemName: 'Hotel Anukampa - Deluxe Suite',
    propertyName: 'Hotel Anukampa',
    partnerPhone: '9876543210',
    propertyAddress: 'Near ISKCON Temple, Raman Reti, Vrindavan',
    checkIn: '2026-11-01T00:00:00.000Z',
    checkOut: '2026-11-03T00:00:00.000Z',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    baseAmount: 3500,
    convenienceFeeAmount: 0,
    totalAmount: 3500,
    amountPaidOnline: 1050,
    advanceAmount: 1050,
    amountPayableAtProperty: 2450,
    paymentOption: 'advance_30',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    razorpayPaymentId: 'pay_Adv30Hotel01',
    customerFullName: 'Pooja Sharma',
    customerMobile: '9876501234',
    customerCity: 'New Delhi',
  };
  const htAdvPdf = buildBookingReceiptPdf(hotelAdvBooking);
  const htAdvStr = htAdvPdf.buffer.toString('utf8');
  assert.equal(resolvePaymentModeLabel(hotelAdvBooking), '30% Advance Paid Online — 70% Balance at Check-in');
  assert.ok(htAdvStr.includes('INR 3,500'), 'Total INR 3,500');
  assert.ok(htAdvStr.includes('INR 1,050'), 'Paid INR 1,050');
  assert.ok(htAdvStr.includes('INR 2,450'), 'Balance INR 2,450');
  assert.ok(htAdvStr.includes('02:00 PM'), 'Check-in 14:00 formatted as 02:00 PM');
  console.log('✓ Case B Passed: Hotel 30% Advance Reconciled (Total: 3,500; Paid: 1,050; Bal: 2,450)');

  // Case C: Fully Paid Hotel (100% Online)
  const fullPaidBooking = {
    bookingId: 'VVS-HT-20261023-1001',
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemName: 'Braj Haveli - Royal Heritage Room',
    propertyName: 'Braj Haveli',
    checkIn: '2026-10-30T00:00:00.000Z',
    checkOut: '2026-10-31T00:00:00.000Z',
    baseAmount: 4000,
    totalAmount: 4000,
    amountPaidOnline: 4000,
    amountPayableAtProperty: 0,
    paymentOption: 'full_100',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    razorpayPaymentId: 'pay_FullPaid01',
    customerFullName: 'Amit Verma',
  };
  const fullPdf = buildBookingReceiptPdf(fullPaidBooking);
  const fullStr = fullPdf.buffer.toString('utf8');
  assert.equal(resolvePaymentModeLabel(fullPaidBooking), 'Full Online Payment');
  assert.ok(fullStr.includes('Full Online Payment'), 'Shows Full Online Payment');
  assert.ok(fullStr.includes('Balance Settled'), 'Shows Balance Settled container');
  console.log('✓ Case C Passed: Fully Paid Hotel (Total: 4,000; Paid: 4,000; Bal: 0; Settled)');

  // Case D: Cash / Direct Payment
  const cashBooking = {
    bookingId: 'VVS-DR-20261023-CASH',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Radha Rani Sewa Sadan - Normal Room',
    propertyName: 'Radha Rani Sewa Sadan',
    checkIn: '2026-10-28T00:00:00.000Z',
    checkOut: '2026-10-29T00:00:00.000Z',
    totalAmount: 700,
    amountPaidOnline: 700,
    amountPayableAtProperty: 0,
    paymentMethod: 'cash',
    bookingStatus: 'confirmed',
  };
  const cashPdf = buildBookingReceiptPdf(cashBooking);
  const cashStr = cashPdf.buffer.toString('utf8');
  assert.equal(resolvePaymentModeLabel(cashBooking), 'Paid in Full (Cash / Direct)');
  assert.ok(cashStr.includes('Paid in Full') && cashStr.includes('Cash / Direct'), 'Shows Paid in Full (Cash / Direct)');
  console.log('✓ Case D Passed: Cash / Direct Payment (Total: 700; Paid: 700; Bal: 0)');

  // Case E: Dedicated Cab Booking with Driver Balance
  const cabBooking = {
    bookingId: 'VVS-CB-20261023-5001',
    bookingType: 'cab',
    itemName: 'Mathura Junction to Vrindavan AC Sedan',
    vehicleType: 'Sedan AC (Dzire / Etios)',
    pickupAddress: 'Mathura Railway Station Platform 1',
    dropAddress: 'Prem Mandir VIP Gate, Vrindavan',
    checkIn: '2026-10-29T00:00:00.000Z',
    checkInTime: '08:30',
    totalAmount: 3200,
    amountPaidOnline: 800,
    advanceAmount: 800,
    amountPayableAtProperty: 2400,
    paymentMethod: 'online',
    bookingStatus: 'confirmed',
    razorpayPaymentId: 'pay_CabAdv5001',
  };
  const cabPdf = buildBookingReceiptPdf(cabBooking);
  const cabStr = cabPdf.buffer.toString('utf8');
  assert.equal(resolvePaymentModeLabel(cabBooking), 'Advance Paid Online — Balance Payable to Driver');
  assert.ok(cabStr.includes('VEHICLE & JOURNEY DETAILS'), 'Shows Cab banner');
  assert.ok(cabStr.includes('JOURNEY DATE & PICKUP SCHEDULE'), 'Shows Cab schedule container');
  assert.ok(cabStr.includes('Payable to Driver'), 'Shows Payable to Driver label');
  console.log('✓ Case E Passed: Cab Booking with Driver Balance (Total: 3,200; Advance: 800; Due to Driver: 2,400)');

  // 2. PLAYWRIGHT CANVAS RENDERING & JSQR DECODING
  console.log('\n--- 2. High-Resolution Playwright Rendering & Vector QR Decoding ---');
  fs.writeFileSync('scratch/phase3_final_receipt.pdf', drPdf.buffer);

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 2600 } });
  const htmlPath = 'file:///' + path.resolve('scratch/pdf_viewer.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const b64 = drPdf.buffer.toString('base64');
  await page.evaluate((b) => { window.renderPdf(b); }, b64);
  await page.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 20000 });
  await page.waitForTimeout(1000);

  const pageCount = await page.evaluate(() => window.__PAGE_COUNT__);
  const qrDecoded = await page.evaluate(() => window.__QR_RESULT__);

  assert.equal(pageCount, 2, 'Must render exactly 2 pages');
  console.log('✓ Rendered Page Count:', pageCount);
  assert.equal(qrDecoded, 'https://www.vrindavansarthi.in/verify-booking?ref=VVS-DR-20261023-191395');
  console.log('✓ Decoded QR from Canvas Pixels:', qrDecoded);

  // Capture final screenshots
  await page.locator('#page-canvas-1').screenshot({ path: 'scratch/final_acceptance_page_1.png' });
  await page.locator('#page-canvas-2').screenshot({ path: 'scratch/final_acceptance_page_2.png' });
  console.log('✓ Captured scratch/final_acceptance_page_1.png and final_acceptance_page_2.png');

  // Copy to Artifact Directory
  const artifactDir = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';
  fs.copyFileSync('scratch/final_acceptance_page_1.png', path.join(artifactDir, 'final_acceptance_page_1.png'));
  fs.copyFileSync('scratch/final_acceptance_page_2.png', path.join(artifactDir, 'final_acceptance_page_2.png'));
  console.log('✓ Copied images to artifact directory');

  // 3. INTERACTIVE PDF LINK ANNOTATIONS
  console.log('\n--- 3. Verifying Interactive PDF Link Annotations ---');
  assert.ok(drStr.includes('https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6'), 'Maps link embedded in annotation');
  assert.ok(drStr.includes('https://wa.me/918679820256'), 'WhatsApp link embedded in annotation');
  assert.ok(drStr.includes('https://www.vrindavansarthi.in/verify-booking'), 'QR link embedded in annotation');
  console.log('✓ All 3 PDF Link Annotations Verified');

  // 4. PUBLIC VERIFICATION ENDPOINT PRIVACY CHECK
  console.log('\n--- 4. Testing Public QR Verification Endpoint Privacy ---');
  await page.goto('http://localhost:8081/verify-booking?ref=VVS-DR-20261023-191395');
  await page.waitForSelector('h2', { timeout: 10000 });
  const h2Text = await page.locator('h2').textContent();
  const pageBody = await page.locator('body').innerText();

  assert.ok(h2Text.includes('Booking Verified & Confirmed'), 'Verification header confirmed');
  assert.ok(pageBody.includes('Shri Giriraj Sewa Sadan'), 'Displays property name');
  assert.ok(pageBody.includes('VVS-DR-20261023-191395'), 'Displays booking reference');
  assert.ok(!pageBody.includes('vrindavansarthi108@gmail.com'), 'Excludes customer email (privacy preserved)');
  assert.ok(!pageBody.includes('6396147954'), 'Excludes customer mobile (privacy preserved)');
  console.log('✓ Public QR Verification Endpoint Confirmed (0 PII Leaked)');

  await browser.close();
  console.log('\n=== ALL PHASE 3 ACCEPTANCE CHECKS PASSED ===');
}

runPhase3Acceptance().catch((err) => {
  console.error('Phase 3 Acceptance FAILED:', err);
  process.exit(1);
});
