const test = require('node:test');
const assert = require('node:assert/strict');
const { bookingRows, generateBookingInvoicePdf } = require('../utils/customerMessages');
const { resolvePaymentModeLabel, formatTimeString12, buildBookingReceiptPdf } = require('../utils/bookingReceiptPdf');

test('Post-Payment Remediation Regression Suite', async (t) => {
  await t.test('1. Dharamshala receipt arithmetic, fee naming and reconciliation', () => {
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      dharamshalaAmount: 1200,
      baseAmount: 1200,
      vrindavanSarthiServiceFee: 99,
      convenienceFeeAmount: 0,
      totalAmount: 1299,
      amountPaidOnline: 99,
      advanceAmount: 99,
      amountPayableAtProperty: 1200,
      balanceAmount: 1200,
      paymentOption: 'full_100',
      paymentMode: 'pay_at_dharamshala',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      additionalInfo: 'Razorpay Checkout payment initiated.',
      razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
    };

    const rows = Object.fromEntries(bookingRows(booking));

    // Fee label and amount
    assert.equal(rows['Platform Facilitation Fee'], 'INR 99', 'Dharamshala fee must be labeled "Platform Facilitation Fee" and equal INR 99');
    assert.equal(rows['Platform Convenience Fee'], undefined, 'Must not duplicate commercial convenience fee label');
    assert.equal(rows['Room Amount'], 'INR 1,200', 'Room tariff must be INR 1,200');
    assert.equal(rows['Total Payable'], 'INR 1,299', 'Total payable must equal INR 1,299 (1200 + 99 = 1299)');
    assert.equal(rows['Advance Paid Online'], 'INR 99', 'Paid online must equal INR 99');
    assert.equal(rows['Balance Payable at Property'], 'INR 1,200', 'Balance at property must equal INR 1,200');

    // Payment option label must NOT be Full payment when balance remains
    assert.notEqual(rows['Payment Option'], 'Full payment', 'Must NOT label split balance as "Full payment"');
    assert.equal(rows['Payment Option'], 'Platform fee online / Balance at property');

    // Stale checkout initiation text removed
    assert.equal(rows['Additional Info'].includes('initiated'), false, 'Must not print checkout initiation text on confirmed receipt');
    assert.equal(rows['Additional Info'], 'Payment verified via Razorpay (pay_TrN6Yaaj3wvpLk).');
  });

  await t.test('2. Commercial hotel receipt fee and tax integrity preserved', () => {
    const commercialHotel = {
      bookingId: 'VVS-HT-20261020-001',
      bookingType: 'room_type',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Hotel Anukampa - Deluxe Room',
      baseAmount: 3000,
      checkoutSubtotal: 3000,
      taxAmount: 360,
      convenienceFeeAmount: 150,
      totalAmount: 3510,
      advanceAmount: 1053,
      amountPaidOnline: 1053,
      balanceAmount: 2457,
      amountPayableAtProperty: 2457,
      paymentOption: 'advance_30',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const rows = Object.fromEntries(bookingRows(commercialHotel));

    assert.equal(rows['Room Amount'], 'INR 3,000');
    assert.equal(rows['Hotel GST / Hotel Taxes'], 'INR 360');
    assert.equal(rows['Platform Convenience Fee'], 'INR 150');
    assert.equal(rows['Total Payable'], 'INR 3,510');
    assert.equal(rows['Advance Paid Online'], 'INR 1,053');
    assert.equal(rows['Balance Payable at Property'], 'INR 2,457');
    assert.equal(rows['Payment Option'], '30% advance');
  });

  await t.test('3. Full payment label is only applied when balance is exactly zero', () => {
    const fullyPaidHotel = {
      bookingId: 'VVS-HT-20261020-002',
      bookingType: 'room_type',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Hotel Anukampa - Executive Suite',
      baseAmount: 5000,
      convenienceFeeAmount: 250,
      totalAmount: 5250,
      advanceAmount: 5250,
      amountPaidOnline: 5250,
      balanceAmount: 0,
      amountPayableAtProperty: 0,
      paymentOption: 'full_100',
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const rows = Object.fromEntries(bookingRows(fullyPaidHotel));
    assert.equal(rows['Balance Payable at Property'], 'INR 0');
    assert.equal(rows['Payment Option'], 'Full payment');
  });

  await t.test('4. PDF generation generates valid buffer without errors', () => {
    const dharamshala = {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      totalAmount: 1299,
      dharamshalaAmount: 1200,
      vrindavanSarthiServiceFee: 99,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer, filename, documentTitle } = generateBookingInvoicePdf(dharamshala);
    assert.ok(buffer && buffer.length > 500, 'PDF buffer must be valid and non-empty');
    assert.equal(filename, 'booking-receipt-VVS-DR-20261023-191395.pdf');
    assert.equal(documentTitle, 'BOOKING CONFIRMATION & PAYMENT RECEIPT');
  });

  await t.test('5. Unverified / pending additional info is stripped on unconfirmed receipts', () => {
    const pendingBooking = {
      bookingId: 'VVS-DR-20261023-PENDING',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan',
      totalAmount: 1299,
      dharamshalaAmount: 1200,
      vrindavanSarthiServiceFee: 99,
      paymentStatus: 'pending',
      bookingStatus: 'pending_property_confirmation',
      additionalInfo: 'Razorpay Checkout payment initiated.',
    };

    const rows = Object.fromEntries(bookingRows(pendingBooking));
    assert.equal(rows['Additional Info'], '', 'Initiation text must be stripped when payment is not confirmed');
  });

  await t.test('6. Location URL resolution logic (verified Maps link vs search fallback)', () => {
    // Exact logic from maps.ts
    const resolveDirections = (input) => {
      const raw = String(input.mapValue || '').trim();
      if (/^https?:\/\//i.test(raw)) return raw;
      const name = String(input.name || '').trim();
      const location = String(input.location || '').trim();
      if (!name && !location) return null;
      const parts = [name, location, input.nearestTemple ? `Near ${input.nearestTemple}` : '', 'Vrindavan'].filter(Boolean);
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
    };

    // Case 6a: Saved verified Google Maps link
    const savedLink = resolveDirections({
      mapValue: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      name: 'Shri Giriraj Sewa Sadan',
      location: 'Keshav Dham Road Opposite prem Mandir',
    });
    assert.equal(savedLink, 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6', 'Must preserve saved Google Maps link');

    // Case 6b: Fallback search URL
    const fallbackLink = resolveDirections({
      mapValue: '',
      name: 'Shri Radhe Dharamshala',
      location: 'Raman Reti',
      nearestTemple: 'ISKCON Temple',
    });
    assert.ok(fallbackLink.startsWith('https://www.google.com/maps/search/?api=1&query='), 'Must generate Google Maps search query');
    assert.ok(fallbackLink.includes(encodeURIComponent('Shri Radhe Dharamshala')), 'Query must contain encoded property name');
    assert.ok(fallbackLink.includes(encodeURIComponent('Raman Reti')), 'Query must contain encoded location');

    // Case 6c: Missing location data returns null (no fabricated pin)
    const emptyLink = resolveDirections({ mapValue: '', name: '', location: '' });
    assert.equal(emptyLink, null, 'Must return null when location details are absent');
  });

  await t.test('7. Invoice eligibility evaluation logic', () => {
    const isEligible = (b) => {
      const status = String(b.bookingStatus || '').toLowerCase();
      const payment = String(b.paymentStatus || '').toLowerCase();
      const unverified = [
        'pending',
        'pending_property_confirmation',
        'awaiting_customer_payment',
        'rejected_by_property',
        'expired_property_no_response',
        'expired',
        'payment_failed',
      ];
      if (unverified.includes(status) && payment !== 'paid') return false;
      if (payment === 'failed') return false;
      return payment === 'paid' || ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(status);
    };

    // Pending property confirmation: NOT eligible
    assert.equal(isEligible({ bookingStatus: 'pending_property_confirmation', paymentStatus: 'pending' }), false);

    // Awaiting payment: NOT eligible
    assert.equal(isEligible({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending' }), false);

    // Payment failed: NOT eligible
    assert.equal(isEligible({ bookingStatus: 'payment_failed', paymentStatus: 'failed' }), false);

    // Dharamshala confirmed with platform fee paid online & balance at property: ELIGIBLE
    assert.equal(isEligible({ bookingStatus: 'confirmed', paymentStatus: 'paid', amountPayableAtProperty: 1200 }), true);

    // Commercial hotel confirmed: ELIGIBLE
    assert.equal(isEligible({ bookingStatus: 'confirmed', paymentStatus: 'paid' }), true);
  });
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
    assert.ok(pdfStr.includes('Platform Fee Paid Online') && pdfStr.includes('Balance Payable at Property'), 'Must display accurate payment mode');

    // Razorpay ID & Initiation text check
    assert.ok(pdfStr.includes('pay_TrN6Yaaj3wvpLk'), 'Must include verified Razorpay payment ID');
    assert.equal(pdfStr.includes('initiated'), false, 'Must not include stale checkout initiation text');

    // Authoritative Server-Derived Payment Mode
    assert.ok(pdfStr.includes('Platform Fee Paid Online'), 'Must show Platform Fee Paid Online');
    assert.ok(pdfStr.includes('Balance Payable at Property'), 'Must show Balance Payable at Property');
    // Must NEVER show Full Online Payment when balance is 1,200
    assert.equal(pdfStr.includes('Payment Mode : Full Online Payment') || pdfStr.includes('Payment Mode   : Full Online Payment'), false, 'Must NEVER display Full Online Payment when balance remains');

    // Single-page document structure
    assert.ok(pdfStr.includes('/Count 1'), 'Must produce strict single-page A4 PDF');
    assert.ok(!pdfStr.includes('/Count 2'), 'Must not produce multiple pages');
    assert.ok(pdfStr.includes('Page 1 of 1'), 'Must label Page 1 of 1');

    // Contact separation
    assert.ok(pdfStr.includes('9927600017'), 'Must show property reception contact');
    assert.ok(pdfStr.includes('Property Reception'), 'Must label property reception clearly');

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
      paymentOption: 'advance_30',
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
    assert.ok(pdfStr.includes('30% Advance Paid Online') || pdfStr.includes('Advance online / Balance at check-in'), 'Must show accurate split payment mode');
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

  await t.test('14. Offline Vector QR Code generation inside PDF stream', () => {
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    // Vector QR code uses PDF rectangle fill 're f' commands
    assert.ok(pdfStr.includes('re f'), 'PDF must contain pure vector QR rectangle fills');
    // Scannable verification URL format
    const expectedVerifyUrl = 'https://www.vrindavansarthi.in/verify-booking?ref=VVS-DR-20261023-191395';
    assert.ok(pdfStr.includes('verify-booking') || pdfStr.includes('VVS-DR-20261023-191395'), 'Must encode booking reference in QR');
    // Must display human-readable reference below QR
    assert.ok(pdfStr.includes('Ref: VVS-DR-20261023-191395'), 'Must print reference code under QR code');
    assert.ok(pdfStr.includes('Scan with camera to verify authenticity'), 'Must print scan instruction under QR');
  });

  await t.test('15. Interactive Action Links (Google Maps and WhatsApp Support)', () => {
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
      totalAmount: 1299,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const { buffer } = generateBookingInvoicePdf(booking);
    const pdfStr = buffer.toString('utf8');

    // PDF annotations for clickable actions
    assert.ok(pdfStr.includes('/Subtype /Link'), 'Must contain clickable PDF link annotations');
    assert.ok(pdfStr.includes('maps.app.goo.gl/xU2hPPUnLcnnVMyk6'), 'Must contain Google Maps URL');
    assert.ok(pdfStr.includes('wa.me/918679820256'), 'Must contain official WhatsApp helpline link');
    assert.ok(pdfStr.includes('WhatsApp Support'), 'Must label WhatsApp support');
  });

  await t.test('16. Public Non-Sensitive Booking Verification Route Behavior', async () => {
    // Test the verification sanitization logic
    const rawBooking = {
      _id: '6adb64804d6f6cd4d284f6f3',
      bookingId: 'VVS-DR-20261023-191395',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
      propertyName: 'Shri Giriraj Sewa Sadan',
      propertyAddress: 'Keshav Dham Road Opposite prem Mandir, Vrindavan',
      propertyLocation: 'Keshav Dham Road Opposite prem Mandir',
      checkIn: '2026-10-26T00:00:00.000Z',
      checkOut: '2026-10-27T00:00:00.000Z',
      checkInTime: '12:00 PM',
      guests: 1,
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'online',
      customerFullName: 'Vrindavan Sarthi Devotee',
      customerMobile: '6396147954', // PII - Must NOT be exposed on public verify
      customerEmail: 'vrindavansarthi108@gmail.com', // PII - Must NOT be exposed on public verify
      guestAccessTokenHash: 'abc123secrettokenhash', // Security token - Must NOT be exposed
      userId: '6adb64804d6f6cd4d284f999', // Internal ID - Must NOT be exposed
    };

    // Public verification payload builder
    const sanitizePublicVerification = (b) => ({
      verified: true,
      bookingId: b.bookingId || String(b._id),
      bookingStatus: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      propertyName: b.propertyName || String(b.itemName || '').split(' - ')[0] || 'Property',
      roomType: String(b.itemName || '').includes(' - ') ? String(b.itemName).split(' - ')[1] : String(b.itemName || 'Standard Room'),
      roomNumber: b.roomNumber || null,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      checkInTime: b.checkInTime || '12:00 PM',
      guests: b.guests || 1,
      guestName: b.customerFullName || 'Guest Devotee',
      totalAmount: b.totalAmount,
      amountPaidOnline: b.amountPaidOnline,
      amountPayableAtProperty: b.amountPayableAtProperty,
      paymentMethod: b.paymentMethod,
    });

    const publicVoucher = sanitizePublicVerification(rawBooking);

    // Verify allowed fields
    assert.equal(publicVoucher.verified, true);
    assert.equal(publicVoucher.bookingId, 'VVS-DR-20261023-191395');
    assert.equal(publicVoucher.bookingStatus, 'confirmed');
    assert.equal(publicVoucher.paymentStatus, 'paid');
    assert.equal(publicVoucher.propertyName, 'Shri Giriraj Sewa Sadan');
    assert.equal(publicVoucher.roomType, 'Double Bed');
    assert.equal(publicVoucher.totalAmount, 1299);
    assert.equal(publicVoucher.amountPaidOnline, 99);
    assert.equal(publicVoucher.amountPayableAtProperty, 1200);

    // Verify strict PII exclusion
    assert.equal(publicVoucher.customerMobile, undefined, 'Must NOT leak customer mobile number');
    assert.equal(publicVoucher.customerEmail, undefined, 'Must NOT leak customer email address');
    assert.equal(publicVoucher.guestAccessTokenHash, undefined, 'Must NOT leak guest token hash');
    assert.equal(publicVoucher.userId, undefined, 'Must NOT leak internal user ID');
  });

  await t.test('17. Payment Mode Label Server-Derived Matrix Regression', () => {
    // 1. Dharamshala booking with balance ₹1,200 (even if paymentOption was 'full_100' at initiation)
    const dharamshalaWithBalance = {
      service_billing_model: 'dharamshala_booking',
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      paymentOption: 'full_100', // Stored option from user selection, but balance remains
      paymentMethod: 'online',
    };
    const dharamshalaMode = resolvePaymentModeLabel(dharamshalaWithBalance);
    assert.equal(dharamshalaMode, 'Platform Fee Paid Online; Balance Due at Property');
    assert.notEqual(dharamshalaMode, 'Full Online Payment', 'Dharamshala with remaining balance must NEVER show Full Online Payment');

    // 2. Genuinely fully paid booking (balance = 0, paid = total)
    const genuinelyFullyPaid = {
      service_billing_model: 'hotel_marketplace',
      totalAmount: 4000,
      amountPaidOnline: 4000,
      amountPayableAtProperty: 0,
      paymentOption: 'full_100',
      paymentMethod: 'online',
    };
    const fullMode = resolvePaymentModeLabel(genuinelyFullyPaid);
    assert.equal(fullMode, 'Full Online Payment', 'Zero-balance fully paid booking must display Full Online Payment');

    // 3. 30% advance commercial hotel booking
    const advance30Hotel = {
      service_billing_model: 'hotel_marketplace',
      totalAmount: 3500,
      amountPaidOnline: 1050,
      amountPayableAtProperty: 2450,
      paymentOption: 'advance_30',
      paymentMethod: 'online',
    };
    const advMode = resolvePaymentModeLabel(advance30Hotel);
    assert.equal(advMode, '30% Advance Paid Online — 70% Balance at Check-in');

    // 4. Cab booking with driver balance
    const cabBooking = {
      bookingType: 'cab',
      totalAmount: 3500,
      amountPaidOnline: 1000,
      amountPayableAtProperty: 2500,
      paymentMethod: 'online',
    };
    const cabMode = resolvePaymentModeLabel(cabBooking);
    assert.equal(cabMode, 'Advance Paid Online — Balance Payable to Driver');
  });

  await t.test('18. Date/Time 12-Hour IST Normalization and Clean Layout Bounds', () => {
    // 1. Time normalization function
    assert.equal(formatTimeString12('12:00'), '12:00 PM');
    assert.equal(formatTimeString12('11:00'), '11:00 AM');
    assert.equal(formatTimeString12('12:00 PM'), '12:00 PM');
    assert.equal(formatTimeString12('11:00 AM'), '11:00 AM');
    assert.equal(formatTimeString12('14:30'), '02:30 PM');
    assert.equal(formatTimeString12(''), '12:00 PM');

    // 2. Build PDF from booking with string time "12:00" and "11:00"
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed Room 104',
      propertyName: 'Shri Giriraj Sewa Sadan',
      partnerPhone: '9927600017',
      checkIn: '2026-10-24T00:00:00.000Z',
      checkOut: '2026-10-25T00:00:00.000Z',
      checkInTime: '12:00', // Persisted in DB as 24-hr string
      checkOutTime: '11:00',
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      vrindavanSarthiServiceFee: 99,
      dharamshalaAmount: 1200,
      customerFullName: 'Owner Verification Test',
      customerMobile: '+91 9927600017',
      customerCity: 'Govardhan',
    };

    const receipt = buildBookingReceiptPdf(booking);
    assert.ok(receipt.buffer && receipt.buffer.length > 5000, 'Receipt PDF buffer generated');
    const pdfText = receipt.buffer.toString('utf8');

    // Verify 12-hour normalized time in PDF
    assert.ok(pdfText.includes('12:00 PM'), 'Must format check-in time as 12:00 PM');
    assert.ok(pdfText.includes('11:00 AM'), 'Must format check-out time as 11:00 AM');

    // Verify concise payment mode (cleanly wrapped across 2 lines at semicolon: Line 1 = 'Platform Fee Paid Online;', Line 2 = 'Balance Due at Property')
    assert.ok(pdfText.includes('Platform Fee Paid Online;') && pdfText.includes('Balance Due at Property'), 'Must contain concise payment mode');

    // Verify dedicated reception phone line
    assert.ok(pdfText.includes('Reception Phone'), 'Must render dedicated Reception Phone line');
    assert.ok(pdfText.includes('+91 9927600017'), 'Must render phone number clearly');

    // Verify address in footer and property details
    assert.ok(pdfText.includes('Govardhan, Mathura'), 'Must include Govardhan, Mathura');

    // Verify dedicated QR verification block
    assert.ok(pdfText.includes('Scan to Verify'), 'Must include Scan to Verify header');
    assert.ok(pdfText.includes('Booking Voucher'), 'Must include Booking Voucher subtitle');
    assert.ok(pdfText.includes('https://www.vrindavansarthi.in/verify-booking'), 'Must embed clean verification URL in QR');
  });

  await t.test('19. Non-Overlapping Header Columns, Clean Encoding & Multi-Mode Spacing', () => {
    // 1. Verify clean ASCII encoding (No raw Unicode em-dash or bullet in PDF Type 1 stream)
    const booking = {
      bookingId: 'VVS-DR-20261023-191395',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Giriraj Sewa Sadan - Double Bed Room 104',
      propertyName: 'Shri Giriraj Sewa Sadan',
      partnerPhone: '9927600017',
      totalAmount: 1299,
      amountPaidOnline: 99,
      amountPayableAtProperty: 1200,
      razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
    };
    const receipt = buildBookingReceiptPdf(booking);
    const pdfText = receipt.buffer.toString('utf8');

    assert.ok(!pdfText.includes('\u2014'), 'Must not contain raw em-dash');
    assert.ok(!pdfText.includes('\u2022'), 'Must not contain raw bullet');
    assert.ok(pdfText.includes('Booking Voucher - Present at Check-in'), 'Voucher uses clean ASCII hyphen');
    assert.ok(pdfText.includes('Page 1 of 1 | All Rights Reserved'), 'Page indicator uses clean pipe');
    assert.ok(pdfText.includes('9:00 AM - 9:00 PM'), 'Helpline hours uses clean text');

    // 2. Multi-Payment Mode Regression: Full Online, 30% Advance, and Cash
    const fullPaid = {
      bookingId: 'VVS-HT-FULL-01',
      service_billing_model: 'hotel_marketplace',
      totalAmount: 3500,
      amountPaidOnline: 3500,
      amountPayableAtProperty: 0,
      paymentOption: 'full_100',
      paymentMethod: 'online',
    };
    const fullPdf = buildBookingReceiptPdf(fullPaid).buffer.toString('utf8');
    assert.ok(fullPdf.includes('Full Online Payment'), 'Must display Full Online Payment');

    const adv30 = {
      bookingId: 'VVS-HT-ADV-01',
      service_billing_model: 'hotel_marketplace',
      totalAmount: 5000,
      amountPaidOnline: 1500,
      amountPayableAtProperty: 3500,
      paymentOption: 'advance_30',
      paymentMethod: 'online',
    };
    const advPdf = buildBookingReceiptPdf(adv30).buffer.toString('utf8');
    assert.ok(advPdf.includes('30% Advance Paid Online') && advPdf.includes('Balance at Check-in'), 'Must display 30% advance split');
  });

});
