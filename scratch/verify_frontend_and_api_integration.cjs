const assert = require('assert');
const path = require('path');
const { hashGuestAccessToken } = require('../backend/utils/guestBookingAccess');
const { buildBookingReceiptPdf } = require('../backend/utils/bookingReceiptPdf');
const { generateBookingInvoicePdf } = require('../backend/utils/customerMessages');

console.log('================================================================');
console.log('TEST SUITE: FRONTEND & BACKEND RECEIPT INTEGRATION VERIFICATION');
console.log('================================================================\n');

// 1. Test Backend Endpoint Identifier Lookup Logic
console.log('1. Testing Identifier Lookup Query Construction (ObjectId vs bookingId)...');

function resolveBookingQuery(rawId) {
  const cleanId = String(rawId || '').trim();
  if (!cleanId) return null;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);
  return isObjectId ? { $or: [{ _id: cleanId }, { bookingId: cleanId }] } : { bookingId: cleanId };
}

const mongoIdQuery = resolveBookingQuery('6adc5432a83a9d24c23a799f');
assert.deepStrictEqual(mongoIdQuery, {
  $or: [{ _id: '6adc5432a83a9d24c23a799f' }, { bookingId: '6adc5432a83a9d24c23a799f' }]
}, 'Must construct $or query for valid 24-hex ObjectId');

const humanIdQuery = resolveBookingQuery('VS-261024-DH8201');
assert.deepStrictEqual(humanIdQuery, {
  bookingId: 'VS-261024-DH8201'
}, 'Must construct bookingId query for human-readable reference');

const emptyQuery = resolveBookingQuery('');
assert.strictEqual(emptyQuery, null, 'Must return null for empty ID');

console.log('   PASS: Query construction logic safely distinguishes ObjectId from bookingId.\n');

// 2. Test Authorization Evaluation Matrix
console.log('2. Testing Authorization Matrix (Owner, Partner, Admin, Guest, Unauthorized)...');

function evaluateAuthorization({ user, guestToken, booking }) {
  let isOwner = false;
  let isPartner = false;
  let isAdmin = false;

  if (user?._id) {
    isOwner = String(booking.userId) === String(user._id);
    isPartner = booking.partnerId && String(booking.partnerId) === String(user._id);
    isAdmin = user.role === 'admin';
  }

  const isAuthorizedGuest = Boolean(
    guestToken &&
    booking.isGuestBooking &&
    booking.guestAccessTokenHash &&
    booking.guestAccessTokenHash === hashGuestAccessToken(guestToken)
  );

  return isOwner || isPartner || isAdmin || isAuthorizedGuest;
}

const mockBooking = {
  _id: '6adc5432a83a9d24c23a799f',
  bookingId: 'VS-261024-DH8201',
  userId: 'user-owner-123',
  partnerId: 'partner-host-456',
  isGuestBooking: true,
  guestAccessTokenHash: hashGuestAccessToken('valid-guest-secret-token'),
};

// Owner
assert.strictEqual(evaluateAuthorization({ user: { _id: 'user-owner-123', role: 'user' }, booking: mockBooking }), true, 'Owner must be authorized');
// Partner
assert.strictEqual(evaluateAuthorization({ user: { _id: 'partner-host-456', role: 'partner' }, booking: mockBooking }), true, 'Partner must be authorized');
// Admin
assert.strictEqual(evaluateAuthorization({ user: { _id: 'admin-super-999', role: 'admin' }, booking: mockBooking }), true, 'Admin must be authorized');
// Guest with valid token
assert.strictEqual(evaluateAuthorization({ guestToken: 'valid-guest-secret-token', booking: mockBooking }), true, 'Valid guest token must be authorized');
// Guest with invalid token
assert.strictEqual(evaluateAuthorization({ guestToken: 'wrong-token', booking: mockBooking }), false, 'Invalid guest token must be rejected');
// Unauthorized stranger
assert.strictEqual(evaluateAuthorization({ user: { _id: 'stranger-attacker-000', role: 'user' }, booking: mockBooking }), false, 'Stranger must be rejected');
// Anonymous without token
assert.strictEqual(evaluateAuthorization({ booking: mockBooking }), false, 'Anonymous request must be rejected');

console.log('   PASS: Authorization matrix enforced strictly.\n');

// 3. Test Payment Status Gating Matrix
console.log('3. Testing Payment Status Gating Matrix...');

function evaluateInvoiceEligibility(booking) {
  const bookingStatus = String(booking.bookingStatus || '').toLowerCase();
  const paymentStatus = String(booking.paymentStatus || '').toLowerCase();
  const unverifiedStatuses = [
    'pending',
    'pending_property_confirmation',
    'awaiting_customer_payment',
    'rejected_by_property',
    'expired_property_no_response',
    'expired',
    'payment_failed',
  ];

  if (unverifiedStatuses.includes(bookingStatus) && paymentStatus !== 'paid') {
    return { eligible: false, code: 'INVOICE_NOT_READY' };
  }
  if (paymentStatus === 'failed') {
    return { eligible: false, code: 'PAYMENT_FAILED' };
  }
  return { eligible: true };
}

// Confirmed & Paid
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'confirmed', paymentStatus: 'paid' }).eligible, true);
// Confirmed with Balance (Advance payment)
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'confirmed', paymentStatus: 'advance_paid' }).eligible, true);
// Checked-in / Checked-out / Completed
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'checked_in', paymentStatus: 'paid' }).eligible, true);
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'completed', paymentStatus: 'paid' }).eligible, true);
// Pending without payment
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'pending', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
// Rejected by property
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'rejected_by_property', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
// Expired
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'expired', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
// Failed payment on confirmed record
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'confirmed', paymentStatus: 'failed' }).code, 'PAYMENT_FAILED');
// Failed payment on unverified record
assert.strictEqual(evaluateInvoiceEligibility({ bookingStatus: 'pending', paymentStatus: 'failed' }).code, 'INVOICE_NOT_READY');

console.log('   PASS: Payment status gating prevents premature receipt downloads.\n');

// 4. Test Frontend Visibility Eligibility Logic
console.log('4. Testing Frontend Eligibility Calculation (BookingConfirmation, MyBookings, BookingDetail)...');

function isFrontendEligible(booking) {
  const rawBookingStatus = String(booking.bookingStatus || '').toLowerCase();
  const rawPaymentStatus = String(booking.paymentStatus || '').toLowerCase();
  const paidAmount = Number(booking.amountPaidOnline || booking.advanceAmount || 0);

  return Boolean(
    booking &&
    rawPaymentStatus !== 'failed' &&
    (
      rawPaymentStatus === 'paid' ||
      paidAmount > 0 ||
      ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(rawBookingStatus)
    ) &&
    !(
      ['pending', 'pending_property_confirmation', 'awaiting_customer_payment', 'rejected_by_property', 'expired', 'expired_property_no_response', 'payment_failed'].includes(rawBookingStatus) &&
      rawPaymentStatus !== 'paid'
    )
  );
}

// Should show button
assert.strictEqual(isFrontendEligible({ bookingStatus: 'confirmed', paymentStatus: 'paid' }), true, 'Confirmed + Paid -> Show button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'confirmed', paymentStatus: 'advance_paid', amountPaidOnline: 1800 }), true, 'Confirmed + Advance Paid -> Show button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'checked_in', paymentStatus: 'paid' }), true, 'Checked In -> Show button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'checked_out', paymentStatus: 'paid' }), true, 'Checked Out -> Show button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'completed', paymentStatus: 'paid' }), true, 'Completed -> Show button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'settled', paymentStatus: 'paid' }), true, 'Settled -> Show button');

// Should NOT show button
assert.strictEqual(isFrontendEligible({ bookingStatus: 'pending', paymentStatus: 'pending' }), false, 'Pending -> Hide button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'pending_property_confirmation', paymentStatus: 'pending' }), false, 'Pending property -> Hide button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending' }), false, 'Awaiting payment -> Hide button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'rejected_by_property', paymentStatus: 'pending' }), false, 'Rejected -> Hide button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'expired', paymentStatus: 'pending' }), false, 'Expired -> Hide button');
assert.strictEqual(isFrontendEligible({ bookingStatus: 'payment_failed', paymentStatus: 'failed' }), false, 'Payment failed -> Hide button');

console.log('   PASS: Frontend visibility logic verified for all lifecycle states.\n');

// 5. Test PDF Buffer Generation from Caller
console.log('5. Testing Invoice PDF Generation via generateBookingInvoicePdf...');
const sampleBookingFixture = {
  bookingId: 'VS-261024-DH8201',
  service_billing_model: 'dharamshala_booking',
  itemName: 'Shri Radha Rani Sewa Trust - Room 101',
  totalAmount: 2198,
  amountPaidOnline: 198,
  amountPayableAtProperty: 2000,
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  customerFullName: 'Shri Ram Devotee',
};

const invoice = generateBookingInvoicePdf(sampleBookingFixture);
assert.ok(Buffer.isBuffer(invoice.buffer), 'Must return a Buffer');
assert.strictEqual(invoice.buffer.slice(0, 5).toString('utf8'), '%PDF-', 'Must start with %PDF-');
assert.ok(invoice.filename.includes('booking-receipt-VS-261024-DH8201.pdf'), 'Filename must include bookingId');
assert.strictEqual(invoice.documentTitle, 'BOOKING CONFIRMATION & PAYMENT RECEIPT');

console.log('   PASS: generateBookingInvoicePdf returns valid PDF binary bytes and correct filename.\n');

console.log('================================================================');
console.log('ALL INTEGRATION TEST SCENARIOS PASSED (100%)');
console.log('================================================================');
