const fs = require('fs');
const path = require('path');

const testPath = path.resolve(__dirname, '../backend/tests/post-payment-remediation.test.js');
let content = fs.readFileSync(testPath, 'utf8');

const additionalTests = `
  await t.test('8. Redesigned Premium PDF: Audited Dharamshala receipt verification', () => {
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      partnerName: 'Shri Giriraj Sewa Sadan',
      partnerPhone: '9927600017',
      customerFullName: 'Vrindavan Sarthi Devotee',
      customerMobile: '6396147954',
      customerEmail: 'vrindavansarthi108@gmail.com',
      checkIn: '2026-10-26T00:00:00.000Z',
      checkOut: '2026-10-27T00:00:00.000Z',
      checkInTime: '12:00 PM',
      guests: 1,
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
      propertyLocation: 'Keshav Dham Road Opposite prem Mandir',
      propertyAddress: 'Keshav Dham Road Opposite prem Mandir, Vrindavan',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      nearestTemple: 'Prem Mandir (approx 200m)',
    };

    const { buffer, filename, documentTitle } = generateBookingInvoicePdf(booking);
    assert.ok(buffer && buffer.length > 5000, 'Executive PDF must be generated with logo and structure');
    assert.equal(filename, 'booking-receipt-VVS-DR-20261023-191395.pdf');
    assert.equal(documentTitle, 'BOOKING CONFIRMATION & PAYMENT RECEIPT');

    const pdfStr = buffer.toString('utf8');
    // Header & Brand
    assert.ok(pdfStr.includes('VRINDAVAN SARTHI'), 'Must contain platform brand title');
    assert.ok(pdfStr.includes('86798 20256'), 'Must contain 24/7 helpline');

    // Financial breakdown
    assert.ok(pdfStr.includes('Platform Facilitation Fee'), 'Must label fee as Platform Facilitation Fee');
    assert.ok(pdfStr.includes('INR 1,200'), 'Must include Dharamshala Tariff INR 1,200');
    assert.ok(pdfStr.includes('INR 99'), 'Must include Facilitation Fee INR 99');
    assert.ok(pdfStr.includes('INR 1,299'), 'Must include Total Payable INR 1,299');
    assert.ok(pdfStr.includes('Paid Online'), 'Must show Paid Online section');
    assert.ok(pdfStr.includes('Payable at Property'), 'Must show balance Payable at Property');
    assert.ok(pdfStr.includes('Platform fee online / Balance at property'), 'Must display accurate payment mode');

    // Razorpay ID & Initiation text check
    assert.ok(pdfStr.includes('pay_TrN6Yaaj3wvpLk'), 'Must include verified Razorpay payment ID');
    assert.equal(pdfStr.includes('initiated'), false, 'Must not include stale checkout initiation text');

    // Contact separation
    assert.ok(pdfStr.includes('9927600017'), 'Must show property reception contact');
    assert.ok(pdfStr.includes('Property Reception:'), 'Must label property reception clearly');

    // Interactive Google Maps Link Annotation
    assert.ok(pdfStr.includes('/Subtype /Link'), 'Must include PDF link annotation');
    assert.ok(pdfStr.includes('maps.app.goo.gl/xU2hPPUnLcnnVMyk6'), 'Must link to verified Google Maps URL');
  });

  await t.test('9. Redesigned Premium PDF: Commercial Hotel 30% advance booking', () => {
    const booking = {
      bookingId: 'VVS-HT-20261023-ADV30',
      bookingType: 'hotel',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Hotel Anukampa - Deluxe Room',
      partnerName: 'Hotel Anukampa',
      partnerPhone: '9876543210',
      customerFullName: 'Ramesh Patel',
      customerMobile: '9876501234',
      totalAmount: 3500,
      baseAmount: 3000,
      convenienceFeeAmount: 150,
      taxAmount: 350,
      amountPaidOnline: 1050,
      amountPayableAtProperty: 2450,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      checkIn: '2026-11-10T00:00:00.000Z',
      checkOut: '2026-11-12T00:00:00.000Z',
    };

    const { buffer } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    assert.ok(pdfStr.includes('Platform Convenience Fee'), 'Must label commercial fee as Platform Convenience Fee');
    assert.ok(pdfStr.includes('INR 3,000'), 'Must show base room amount');
    assert.ok(pdfStr.includes('INR 150'), 'Must show convenience fee');
    assert.ok(pdfStr.includes('INR 350'), 'Must show tax amount');
    assert.ok(pdfStr.includes('INR 3,500'), 'Must show total payable');
    assert.ok(pdfStr.includes('INR 1,050'), 'Must show 30% advance paid online');
    assert.ok(pdfStr.includes('INR 2,450'), 'Must show 70% payable at property');
    assert.ok(pdfStr.includes('Advance online / Balance at check-in'), 'Must show accurate split payment mode');
  });

  await t.test('10. Redesigned Premium PDF: Fully Paid Hotel (100% online)', () => {
    const booking = {
      bookingId: 'VVS-HT-20261023-FULL',
      bookingType: 'hotel',
      service_billing_model: 'hotel_marketplace',
      itemName: 'MVT Guesthouse - Suite',
      totalAmount: 4000,
      baseAmount: 4000,
      amountPaidOnline: 4000,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      checkIn: '2026-11-15T00:00:00.000Z',
      checkOut: '2026-11-16T00:00:00.000Z',
    };

    const { buffer } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    assert.ok(pdfStr.includes('Full Online Payment'), 'Must show Full Online Payment mode');
    assert.ok(pdfStr.includes('Balance Settled'), 'Must indicate balance settled');
    assert.ok(pdfStr.includes('Balance Cleared: No further stay charges are due'), 'Guidelines must state balance cleared');
  });

  await t.test('11. Redesigned Premium PDF: Dedicated Cab Booking', () => {
    const booking = {
      bookingId: 'VVS-CB-20261023-01',
      bookingType: 'cab',
      itemName: 'Delhi to Vrindavan Transfer',
      vehicleType: 'Maruti Ertiga (AC, 6 Seater)',
      pickupAddress: 'Terminal 3, New Delhi Airport',
      dropAddress: 'Prem Mandir, Vrindavan',
      travelDate: '2026-10-31T00:00:00.000Z',
      pickupTime: '08:00 AM',
      passengers: 4,
      totalAmount: 3500,
      baseAmount: 3500,
      amountPaidOnline: 1000,
      amountPayableAtProperty: 2500,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer, documentTitle } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    assert.ok(documentTitle.includes('CAB BOOKING') || pdfStr.includes('CAB BOOKING'), 'Must designate cab document type');
    assert.ok(pdfStr.includes('VEHICLE & JOURNEY DETAILS'), 'Must render cab journey block');
    assert.ok(pdfStr.includes('Payable to Driver'), 'Balance must be labeled Payable to Driver');
    assert.ok(pdfStr.includes('Cab Fare'), 'Tariff must be labeled Cab Fare');
  });

  await t.test('12. Redesigned Premium PDF: Pilgrimage Tour Booking', () => {
    const booking = {
      bookingId: 'VVS-TR-20261023-01',
      bookingType: 'tour',
      itemName: 'Braj 84 Kos Yatra',
      packageName: 'Mathura Vrindavan Guided Darshan',
      inclusions: 'VIP Darshan, AC Transport, Satvik Meals',
      tourDate: '2026-11-05T00:00:00.000Z',
      guests: 2,
      totalAmount: 6000,
      baseAmount: 6000,
      amountPaidOnline: 6000,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer, documentTitle } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    assert.ok(documentTitle.includes('TOUR') || pdfStr.includes('TOUR'), 'Must designate tour document type');
    assert.ok(pdfStr.includes('PILGRIMAGE TOUR DETAILS'), 'Must render tour details block');
    assert.ok(pdfStr.includes('Tour Package Fare'), 'Tariff must be labeled Tour Package Fare');
    assert.ok(pdfStr.includes('Experienced Guide'), 'Must include tour guide mention');
  });

  await t.test('13. Redesigned Premium PDF: Missing fields fallback resilience', () => {
    const minimalBooking = {
      bookingId: 'VVS-MIN-001',
      totalAmount: 1500,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer } = generateBookingInvoicePdf(minimalBooking);
    assert.ok(buffer && buffer.length > 5000, 'Must produce valid PDF even with minimal input');
    const pdfStr = buffer.toString('utf8');
    assert.ok(pdfStr.includes('Guest Devotee'), 'Must fallback to Guest Devotee');
    assert.ok(pdfStr.includes('VVS-MIN-001'), 'Must include booking id');
    assert.ok(pdfStr.includes('INR 1,500'), 'Must include total amount');
  });
`;

// Insert before the last `});`
const lastClosing = /\n\}\);\s*$/;
if (lastClosing.test(content)) {
  content = content.replace(lastClosing, additionalTests + '\n});\n');
  fs.writeFileSync(testPath, content, 'utf8');
  console.log('Successfully added Phase 5 tests to backend/tests/post-payment-remediation.test.js!');
} else {
  console.error('Could not find last closing }); in test file');
}
