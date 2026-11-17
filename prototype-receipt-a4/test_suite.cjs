const fs = require('fs');
const path = require('path');
const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const { renderReceiptToFiles } = require('./generate.cjs');

const testCases = [
  {
    id: 'case_1_dharamshala_reference',
    name: 'Dharamshala Lodging (Reference - Shri Giriraj Sewa Sadan)',
    data: {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'dharamshala',
      service_billing_model: 'dharamshala_booking',
      propertyName: 'Shri Giriraj Sewa Sadan',
      partnerName: 'Shri Giriraj Sewa Sadan',
      propertyId: 'VVS-P-1023',
      partnerId: 'VVS-P-1023',
      roomType: 'Double Bed',
      roomNumber: '203',
      propertyAddress: 'Keshav Dham Road, Opposite Prem Mandir, Vrindavan',
      nearestTemple: 'Near Prem Mandir',
      checkIn: '2026-10-26T00:00:00.000Z',
      checkOut: '2026-10-27T00:00:00.000Z',
      checkInTime: '12:00 PM',
      checkOutTime: '11:00 AM',
      nights: 1,
      guests: '1 Guest(s)',
      rooms: 1,
      customerFullName: 'Vrindavan Sarthi',
      guestId: 'VVS-G-191395',
      customerMobile: '6396147954',
      customerEmail: 'vrindavansarthi108@gmail.com',
      customerCity: 'Vrindavan',
      customerDistrict: 'Mathura',
      customerState: 'Uttar Pradesh',
      dharamshalaAmount: 1200,
      baseAmount: 1200,
      vrindavanSarthiServiceFee: 99,
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
      paidAt: '2026-10-23T13:48:43.596Z',
      createdAt: '2026-10-23T13:43:28.185Z',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      partnerPhone: '+91 9927600017',
      verificationUrl: 'https://www.vrindavansarthi.in/verify-booking?ref=VVS-DR-20261023-191395'
    }
  },
  {
    id: 'case_2_hotel_fully_paid',
    name: 'Commercial Hotel Booking (100% Fully Paid Online)',
    data: {
      bookingId: 'VVS-HT-20261023-99312',
      bookingType: 'room_type',
      service_billing_model: 'hotel_marketplace',
      itemName: 'MVT Guesthouse - Deluxe AC Room',
      partnerName: 'MVT Guesthouse & Restaurant',
      propertyId: 'VVS-P-2041',
      roomType: 'Deluxe AC Room',
      roomNumber: '305',
      propertyAddress: 'Bhaktivedanta Swami Marg, Raman Reti, Vrindavan',
      nearestTemple: 'ISKCON Temple (approx 150m)',
      checkIn: '2026-11-05T00:00:00.000Z',
      checkOut: '2026-11-07T00:00:00.000Z',
      checkInTime: '01:00 PM',
      checkOutTime: '11:00 AM',
      nights: 2,
      guests: '2 Guest(s)',
      rooms: 1,
      customerFullName: 'Gaurav Sharma',
      guestId: 'VVS-G-99312',
      customerMobile: '+91 9811223344',
      customerEmail: 'gaurav.sharma@example.com',
      customerCity: 'New Delhi',
      customerDistrict: 'South Delhi',
      customerState: 'Delhi',
      baseAmount: 3600,
      taxAmount: 432,
      totalAmount: 4032,
      amountPaidOnline: 4032,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_FullHotelPay789',
      paidAt: '2026-10-23T14:15:00.000Z',
      createdAt: '2026-10-23T14:10:00.000Z',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      partnerPhone: '+91 9876543210'
    }
  },
  {
    id: 'case_3_hotel_advance_30',
    name: 'Commercial Hotel Booking (30% Advance Online + 70% at Check-in)',
    data: {
      bookingId: 'VVS-HT-20261023-88214',
      bookingType: 'hotel',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Hotel Anukampa - Executive Suite',
      partnerName: 'Hotel Anukampa',
      propertyId: 'VVS-P-3088',
      roomType: 'Executive Suite',
      roomNumber: '101',
      propertyAddress: 'Near Chhatikara Road, Vrindavan, Mathura',
      nearestTemple: 'Vaishno Devi Mandir (approx 500m)',
      checkIn: '2026-11-01T00:00:00.000Z',
      checkOut: '2026-11-03T00:00:00.000Z',
      checkInTime: '12:00 PM',
      checkOutTime: '11:00 AM',
      nights: 2,
      guests: '2 Guest(s)',
      rooms: 1,
      customerFullName: 'Radhe Shyam Gupta',
      guestId: 'VVS-G-88214',
      customerMobile: '+91 9123456780',
      customerEmail: 'radhe.shyam@example.com',
      customerCity: 'Jaipur',
      customerDistrict: 'Jaipur',
      customerState: 'Rajasthan',
      baseAmount: 4000,
      taxAmount: 400,
      totalAmount: 4400,
      paymentOption: 'advance_30',
      amountPaidOnline: 1320,
      amountPayableAtProperty: 3080,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_HotelAdv30Pay456',
      paidAt: '2026-10-23T15:00:00.000Z',
      createdAt: '2026-10-23T14:55:00.000Z',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      partnerPhone: '+91 9988776655'
    }
  },
  {
    id: 'case_4_cab_booking',
    name: 'Dedicated Cab Booking (Advance Paid + Balance to Driver)',
    data: {
      bookingId: 'VVS-CB-20261023-55123',
      bookingType: 'cab',
      itemName: 'Delhi Airport to Vrindavan Dedicated Cab',
      vehicleType: 'Maruti Ertiga (AC, 6 Seater)',
      pickupAddress: 'Terminal 3 Arrivals, IGI Airport, New Delhi',
      dropAddress: 'Prem Mandir, Raman Reti, Vrindavan',
      travelDate: '2026-10-30T00:00:00.000Z',
      pickupTime: '09:00 AM',
      passengers: 4,
      guests: '4 Passenger(s)',
      customerFullName: 'Amitabh Verma',
      guestId: 'VVS-G-55123',
      customerMobile: '+91 9822334455',
      customerEmail: 'amitabh.verma@example.com',
      customerCity: 'Gurugram',
      customerDistrict: 'Gurugram',
      customerState: 'Haryana',
      totalAmount: 3800,
      baseAmount: 3800,
      amountPaidOnline: 1000,
      amountPayableAtProperty: 2800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_CabAdvance999',
      paidAt: '2026-10-23T16:20:00.000Z',
      createdAt: '2026-10-23T16:15:00.000Z',
      partnerPhone: '+91 86798 20256'
    }
  },
  {
    id: 'case_5_tour_booking',
    name: 'Pilgrimage Guided Tour Booking (100% Fully Paid Online)',
    data: {
      bookingId: 'VVS-TR-20261023-77112',
      bookingType: 'tour',
      itemName: 'Braj 84 Kos Yatra - 1 Day Sacred Darshan Tour',
      packageName: 'Mathura, Vrindavan, Govardhan & Barsana Guided Tour',
      inclusions: 'AC Innova Crysta, Temple VIP Passes, Satvik Prasad & Experienced Brajwasi Guide',
      tourDate: '2026-11-02T00:00:00.000Z',
      guests: '3 Devotee(s)',
      customerFullName: 'Suresh Chandra Agarwal',
      guestId: 'VVS-G-77112',
      customerMobile: '+91 9411223344',
      customerEmail: 'suresh.agarwal@example.com',
      customerCity: 'Lucknow',
      customerDistrict: 'Lucknow',
      customerState: 'Uttar Pradesh',
      totalAmount: 5500,
      baseAmount: 5500,
      amountPaidOnline: 5500,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_TourFull112',
      paidAt: '2026-10-23T17:00:00.000Z',
      createdAt: '2026-10-23T16:50:00.000Z',
      partnerPhone: '+91 86798 20256'
    }
  },
  {
    id: 'case_6_stress_long_names',
    name: 'Layout Stress Test — Very Long Property, Guest Names & Addresses',
    data: {
      bookingId: 'VVS-DR-20261023-STRESS-LONG-REF-999999',
      bookingType: 'dharamshala',
      service_billing_model: 'dharamshala_booking',
      propertyName: 'Shri Radharani Bhakt Niwas & International Devotee Spiritual Guest House and Ashram Trust',
      partnerName: 'Shri Radharani Bhakt Niwas & International Devotee Spiritual Guest House and Ashram Trust',
      propertyId: 'VVS-P-LONG-ID-9999',
      roomType: 'Super Deluxe Heritage Multi-Bed Family Suite (Air Conditioned with Geyser)',
      roomNumber: 'Suite-404-B',
      propertyAddress: 'Plot 104-108, Raman Reti Road, Opposite Krishna Balaram Mandir Complex, Near Bankey Bihari Temple Parikrama Marg, Vrindavan, Mathura District, Uttar Pradesh 281121',
      nearestTemple: 'Near Prem Mandir and Bankey Bihari Ji Mandir (approx 250m walking distance via VIP gate)',
      checkIn: '2026-11-10T00:00:00.000Z',
      checkOut: '2026-11-14T00:00:00.000Z',
      checkInTime: '12:00 PM',
      checkOutTime: '11:00 AM',
      nights: 4,
      guests: '6 Devotees (Family)',
      rooms: 2,
      customerFullName: 'His Grace Sri Radhavallabh Das Mahanta Ji Maharaj (Devotee of Radha Rani and Krishna)',
      guestId: 'VVS-G-LONG-GUEST-ID-8888',
      customerMobile: '+91 9876543210',
      customerEmail: 'extraordinarily.long.pilgrim.email.address.for.testing.overflow.safety@vrindavansarthi-devotee-portal.org',
      customerCity: 'Thiruvananthapuram',
      customerDistrict: 'Thiruvananthapuram',
      customerState: 'Kerala',
      dharamshalaAmount: 4800,
      baseAmount: 4800,
      vrindavanSarthiServiceFee: 99,
      totalAmount: 4899,
      amountPaidOnline: 99,
      amountPayableAtProperty: 4800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: 'online',
      razorpayPaymentId: 'pay_LongPaymentId_TrN6Yaaj3wvpLk_99999',
      paidAt: '2026-10-23T18:00:00.000Z',
      createdAt: '2026-10-23T17:50:00.000Z',
      partnerPhone: '+91 9927600017'
    }
  },
  {
    id: 'case_7_minimal_missing_fields',
    name: 'Graceful Degradation Test — Minimal Booking with Missing Optional Fields',
    data: {
      bookingId: 'VVS-MIN-001',
      totalAmount: 1000,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid'
    }
  }
];

(async () => {
  console.log('================================================================');
  console.log('Vrindavan Sarthi — Receipt Prototype Test Suite');
  console.log('================================================================\n');

  const outDir = path.join(__dirname, 'test_outputs');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const viewerPage = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const viewerPath = 'file:///' + path.resolve('scratch/pdf_viewer.html').replace(/\\/g, '/');

  const results = [];

  for (const tc of testCases) {
    console.log(`Testing Case: "${tc.name}"...`);
    const htmlPath = path.join(outDir, `${tc.id}.html`);
    const pdfPath = path.join(outDir, `${tc.id}.pdf`);
    const pngPath = path.join(outDir, `${tc.id}.png`);

    // 1. Render files
    const renderRes = await renderReceiptToFiles(tc.data, htmlPath, pdfPath, pngPath);

    // 2. Load into PDF.js viewer
    await viewerPage.goto(viewerPath);
    const pdfBuf = fs.readFileSync(pdfPath);
    await viewerPage.evaluate((b64) => {
      window.renderPdf(b64);
    }, pdfBuf.toString('base64'));

    await viewerPage.waitForFunction(() => window.__PDF_RENDERED__ === true, { timeout: 15000 });

    const pageCount = await viewerPage.evaluate(() => window.__PAGE_COUNT__);
    const qrResult = await viewerPage.evaluate(() => window.__QR_RESULT__);

    // 3. Financial Reconciliation
    const total = Number(tc.data.totalAmount || 0);
    const paid = Number(tc.data.amountPaidOnline ?? tc.data.advanceAmount ?? (tc.data.paymentStatus === 'paid' && Number(tc.data.amountPayableAtProperty ?? 0) === 0 ? total : 0));
    const balance = Number(tc.data.amountPayableAtProperty ?? tc.data.balanceAmount ?? Math.max(0, total - paid));
    const mathReconciled = (paid + balance) === total;

    // 4. Clickable Links Verification
    const pdfStr = pdfBuf.toString('binary');
    const uriMatches = [];
    const uriRegex = /\/URI\s*\(([^)]+)\)/g;
    let uMatch;
    while ((uMatch = uriRegex.exec(pdfStr)) !== null) {
      uriMatches.push(uMatch[1]);
    }
    const hasValidLinks = uriMatches.length >= 3;

    // Checks
    const isOnePage = pageCount === 1;
    const isQrValid = typeof qrResult === 'string' && qrResult.includes(tc.data.bookingId);

    const testItem = {
      id: tc.id,
      name: tc.name,
      bookingRef: tc.data.bookingId,
      pageCount,
      isOnePage,
      totalAmount: total,
      paidOnline: paid,
      balancePayable: balance,
      mathReconciled,
      qrDecoded: qrResult,
      isQrValid,
      linksCount: uriMatches.length,
      hasValidLinks,
      links: uriMatches,
      pdfSizeBytes: renderRes.pdfSize,
      pngSizeBytes: renderRes.pngSize,
      passed: isOnePage && mathReconciled && isQrValid && hasValidLinks
    };

    results.push(testItem);

    console.log(`  -> Page Count: ${pageCount} [${isOnePage ? 'PASS' : 'FAIL'}]`);
    console.log(`  -> Financial: Total ₹${total} = Paid ₹${paid} + Balance ₹${balance} [${mathReconciled ? 'PASS' : 'FAIL'}]`);
    console.log(`  -> QR Verification: ${qrResult} [${isQrValid ? 'PASS' : 'FAIL'}]`);
    console.log(`  -> Clickable Links: ${uriMatches.length} links verified [${hasValidLinks ? 'PASS' : 'FAIL'}]`);
    console.log(`  -> Result: ${testItem.passed ? 'ALL CHECKS PASSED' : 'FAILED'}\n`);
  }

  await browser.close();

  // Write results JSON
  const jsonPath = path.join(__dirname, 'test_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Saved comprehensive test results to: ${jsonPath}`);

  const allPassed = results.every(r => r.passed);
  console.log(`\n================================================================`);
  console.log(`FINAL RESULT: ${allPassed ? '100% TESTS PASSED' : 'SOME TESTS FAILED'} (${results.filter(r => r.passed).length}/${results.length})`);
  console.log(`================================================================`);

  if (!allPassed) {
    process.exit(1);
  }
})().catch(err => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
