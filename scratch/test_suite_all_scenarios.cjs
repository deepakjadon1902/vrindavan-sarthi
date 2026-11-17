const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SinglePagePdfBuilder, buildBookingReceiptPdf } = require('./test_single_page_builder.cjs');

async function runTestSuite() {
  console.log('================================================================');
  console.log('RUNNING COMPREHENSIVE TEST SUITE FOR SINGLE-PAGE PDF BUILDER');
  console.log('================================================================\n');

  // Case 1: Audited Dharamshala Reference Case
  console.log('Test 1: Audited Dharamshala Reference Booking...');
  const dharamshalaBooking = {
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
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    guests: 2,
    roomQuantity: 1,
    roomNumber: '104',
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

  const res1 = buildBookingReceiptPdf(dharamshalaBooking);
  const pdfStr1 = res1.buffer.toString('utf8');

  // Verify single page constraint
  assert.ok(pdfStr1.includes('/Count 1'), 'Test 1 FAIL: Must be exactly ONE page (/Count 1)');
  assert.ok(!pdfStr1.includes('/Count 2'), 'Test 1 FAIL: Must not be 2 pages');
  assert.ok(pdfStr1.includes('Page 1 of 1'), 'Test 1 FAIL: Must show Page 1 of 1');

  // Verify financial values
  assert.ok(pdfStr1.includes('Platform Facilitation Fee'), 'Test 1 FAIL: Must label fee');
  assert.ok(pdfStr1.includes('INR 1,200'), 'Test 1 FAIL: Base tariff INR 1,200');
  assert.ok(pdfStr1.includes('INR 99'), 'Test 1 FAIL: Fee INR 99');
  assert.ok(pdfStr1.includes('INR 1,299'), 'Test 1 FAIL: Total INR 1,299');
  assert.ok(pdfStr1.includes('Paid Online'), 'Test 1 FAIL: Paid online section');
  assert.ok(pdfStr1.includes('Payable at Property'), 'Test 1 FAIL: Payable at property section');

  // Verify Razorpay ID and payment mode
  assert.ok(pdfStr1.includes('pay_TrN6Yaaj3wvpLk'), 'Test 1 FAIL: Razorpay ID');
  assert.ok(pdfStr1.includes('Platform Fee Paid Online') && pdfStr1.includes('Balance Payable at Property'), 'Test 1 FAIL: Payment mode label');
  assert.ok(pdfStr1.includes('maps.app.goo.gl/xU2hPPUnLcnnVMyk6'), 'Test 1 FAIL: Google maps link');
  assert.ok(pdfStr1.includes('wa.me/918679820256'), 'Test 1 FAIL: WhatsApp link');
  console.log('  PASS: Audited Dharamshala Case verified.\n');

  // Case 2: Commercial Hotel 100% Online Payment
  console.log('Test 2: Commercial Hotel 100% Online Payment...');
  const hotelFullBooking = {
    bookingId: 'VVS-HT-FULL-01',
    bookingType: 'hotel',
    service_billing_model: 'hotel_marketplace',
    itemName: 'Hotel Radhe Krishna - Executive Suite',
    propertyName: 'Hotel Radhe Krishna',
    partnerPhone: '9876543210',
    customerFullName: 'Sunil Sharma',
    customerMobile: '9876501234',
    customerEmail: 'sunil@example.com',
    totalAmount: 3683,
    baseAmount: 3200,
    taxAmount: 384,
    convenienceFeeAmount: 99,
    amountPaidOnline: 3683,
    amountPayableAtProperty: 0,
    paymentOption: 'full_100',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  const res2 = buildBookingReceiptPdf(hotelFullBooking);
  const pdfStr2 = res2.buffer.toString('utf8');
  assert.ok(pdfStr2.includes('/Count 1'), 'Test 2 FAIL: Must be exactly ONE page');
  assert.ok(pdfStr2.includes('Full Online Payment'), 'Test 2 FAIL: Payment mode must be Full Online');
  assert.ok(pdfStr2.includes('INR 3,683'), 'Test 2 FAIL: Total must be 3,683');
  assert.ok(pdfStr2.includes('Balance Settled'), 'Test 2 FAIL: Balance must be cleared');
  assert.ok(pdfStr2.includes('Hotel GST / Taxes'), 'Test 2 FAIL: Tax label');
  assert.ok(pdfStr2.includes('INR 384'), 'Test 2 FAIL: Tax amount');
  console.log('  PASS: Hotel 100% Online Payment verified.\n');

  // Case 3: Commercial Hotel 30% Advance Split
  console.log('Test 3: Commercial Hotel 30% Advance Split...');
  const hotel30Booking = {
    bookingId: 'VVS-HT-ADV30-01',
    bookingType: 'hotel',
    service_billing_model: 'hotel_marketplace',
    itemName: 'Braj Heritage Resort - Superior AC',
    propertyName: 'Braj Heritage Resort',
    partnerPhone: '9876543210',
    customerFullName: 'Amit Verma',
    customerMobile: '9876509876',
    totalAmount: 5000,
    baseAmount: 5000,
    amountPaidOnline: 1500,
    amountPayableAtProperty: 3500,
    paymentOption: 'advance_30',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  const res3 = buildBookingReceiptPdf(hotel30Booking);
  const pdfStr3 = res3.buffer.toString('utf8');
  assert.ok(pdfStr3.includes('/Count 1'), 'Test 3 FAIL: Must be exactly ONE page');
  assert.ok(pdfStr3.includes('30% Advance Paid Online') && pdfStr3.includes('Balance at Check-in'), 'Test 3 FAIL: 30% advance split');
  assert.ok(pdfStr3.includes('INR 5,000'), 'Test 3 FAIL: Total 5,000');
  assert.ok(pdfStr3.includes('INR 1,500'), 'Test 3 FAIL: Paid 1,500');
  assert.ok(pdfStr3.includes('INR 3,500'), 'Test 3 FAIL: Balance 3,500');
  console.log('  PASS: Hotel 30% Advance Split verified.\n');

  // Case 4: Dedicated Cab Booking
  console.log('Test 4: Dedicated Cab Booking...');
  const cabBooking = {
    bookingId: 'VVS-CAB-20261023-01',
    bookingType: 'cab',
    service_billing_model: 'taxi_direct',
    itemName: 'Mathura to Govardhan AC Sedan Transfer',
    vehicleType: 'Swift Dzire AC',
    pickupAddress: 'Mathura Junction Railway Station',
    dropAddress: 'Govardhan Parikrama Marg',
    checkInTime: '07:30 AM',
    totalAmount: 1800,
    baseAmount: 1800,
    amountPaidOnline: 500,
    amountPayableAtProperty: 1300,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    customerFullName: 'Pooja Agarwal',
    customerMobile: '9812345678',
    createdAt: new Date().toISOString(),
  };

  const res4 = buildBookingReceiptPdf(cabBooking);
  const pdfStr4 = res4.buffer.toString('utf8');
  assert.ok(pdfStr4.includes('/Count 1'), 'Test 4 FAIL: Must be exactly ONE page');
  assert.ok(pdfStr4.includes('CAB BOOKING CONFIRMATION'), 'Test 4 FAIL: Title');
  assert.ok(pdfStr4.includes('VEHICLE & JOURNEY DETAILS'), 'Test 4 FAIL: Section title');
  assert.ok(pdfStr4.includes('Swift Dzire AC'), 'Test 4 FAIL: Vehicle type');
  assert.ok(pdfStr4.includes('Mathura Junction'), 'Test 4 FAIL: Pickup');
  assert.ok(pdfStr4.includes('Payable to Driver'), 'Test 4 FAIL: Payable to Driver');
  assert.ok(pdfStr4.includes('INR 1,300'), 'Test 4 FAIL: Driver amount');
  console.log('  PASS: Dedicated Cab Booking verified.\n');

  // Case 5: Pilgrimage Tour Booking
  console.log('Test 5: Pilgrimage Tour Booking...');
  const tourBooking = {
    bookingId: 'VVS-TOUR-20261023-01',
    bookingType: 'tour',
    service_billing_model: 'tour_direct',
    itemName: '84 Kos Braj Parikrama & Darshan Tour',
    packageName: '84 Kos Braj Parikrama Special Package',
    inclusions: 'AC Tempo Traveller, Certified Devotee Guide, Prasad',
    totalAmount: 6500,
    baseAmount: 6500,
    amountPaidOnline: 6500,
    amountPayableAtProperty: 0,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    customerFullName: 'Radhika Krishna Dasi',
    customerMobile: '9899887766',
    createdAt: new Date().toISOString(),
  };

  const res5 = buildBookingReceiptPdf(tourBooking);
  const pdfStr5 = res5.buffer.toString('utf8');
  assert.ok(pdfStr5.includes('/Count 1'), 'Test 5 FAIL: Must be exactly ONE page');
  assert.ok(pdfStr5.includes('PILGRIMAGE TOUR CONFIRMATION'), 'Test 5 FAIL: Tour title');
  assert.ok(pdfStr5.includes('PILGRIMAGE TOUR DETAILS'), 'Test 5 FAIL: Section title');
  assert.ok(pdfStr5.includes('84 Kos Braj Parikrama'), 'Test 5 FAIL: Package name');
  assert.ok(pdfStr5.includes('INR 6,500'), 'Test 5 FAIL: Package total');
  assert.ok(pdfStr5.includes('Balance Settled'), 'Test 5 FAIL: Balance settled');
  console.log('  PASS: Pilgrimage Tour Booking verified.\n');

  // Case 6: Long Names and Missing Optional Fields Stress Test
  console.log('Test 6: Long Names & Missing Optional Fields Stress Test...');
  const stressBooking = {
    bookingId: 'VVS-STRESS-LONG-01',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    propertyName: 'Shri Radha Vallabh Temple Devotee Charitable Trust International Pilgrimage Guest Sadan Complex',
    itemName: 'Ultra Luxury Royal Maharaja Family AC Suite with Balcony and Temple View',
    customerFullName: 'Param Pujya Maharaj Shri Braj Bhushan Sharan Ji Maharaj Brahmachari',
    customerMobile: '+91 99999 88888',
    customerEmail: 'devotee.pilgrimage.assistance.services.vrindavan@charitabletrustdomain.org',
    customerCity: 'Shri Govardhan Ji Maharaj Dham Mathura',
    customerState: 'Uttar Pradesh Braj Mandal',
    totalAmount: 2599,
    dharamshalaAmount: 2500,
    vrindavanSarthiServiceFee: 99,
    amountPaidOnline: 99,
    amountPayableAtProperty: 2500,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    // Missing optional fields:
    roomNumber: undefined,
    nearestTemple: undefined,
    partnerPhone: undefined,
    googleMapLink: undefined,
    razorpayPaymentId: undefined,
    createdAt: new Date().toISOString(),
  };

  const res6 = buildBookingReceiptPdf(stressBooking);
  const pdfStr6 = res6.buffer.toString('utf8');
  assert.ok(pdfStr6.includes('/Count 1'), 'Test 6 FAIL: Must strictly remain ONE page under long text stress');
  assert.ok(pdfStr6.includes('Param Pujya Maharaj'), 'Test 6 FAIL: Long customer name');
  assert.ok(pdfStr6.includes('INR 2,599'), 'Test 6 FAIL: Total 2,599');
  assert.ok(pdfStr6.includes('+91 86798 20256'), 'Test 6 FAIL: Official helpline fallback when partner phone is missing');
  assert.ok(!pdfStr6.includes('undefined'), 'Test 6 FAIL: Must not contain literal undefined strings');
  console.log('  PASS: Long Names & Missing Fields Stress Test verified.\n');

  // Case 7: Clean ASCII Encoding (No raw Unicode em-dash or bullet)
  console.log('Test 7: ASCII Safety & PDF Type 1 Stream Encoding...');
  assert.ok(!pdfStr1.includes('\u2014'), 'Test 7 FAIL: Must not contain raw em-dash in stream');
  assert.ok(!pdfStr1.includes('\u2022'), 'Test 7 FAIL: Must not contain raw bullet in stream');
  console.log('  PASS: ASCII Safety verified.\n');

  console.log('================================================================');
  console.log('ALL 7 AUTOMATED ACCEPTANCE TESTS PASSED (100%)');
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('TEST SUITE ERROR:', err);
  process.exit(1);
});
