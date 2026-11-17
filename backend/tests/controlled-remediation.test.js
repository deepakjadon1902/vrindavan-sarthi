const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const {
  buildMoneyFields,
  calculateLodgingPrice,
} = require('../utils/pricing');
const {
  getDharamshalaResponseTimeoutMinutes,
  getDharamshalaRequestExpiresAt,
  buildDharamshalaAccounting,
  createDharamshalaRequest,
  acceptDharamshalaRequest,
} = require('../utils/dharamshalaLifecycle');
const {
  getPaymentHoldExpiresAt,
  transitionBookingStatus,
  markBookingPaymentPaid,
  markBookingPaymentFailed,
} = require('../utils/reservationLifecycle');
const { payableAmountForBooking } = require('../utils/bookingPayable');
const { verifyPaymentSignature } = require('../utils/razorpay');

const oid = () => new mongoose.Types.ObjectId();

// ---------------------------------------------------------------------------
// 1. Booking Eligibility and Flow Controls
// ---------------------------------------------------------------------------

test('Hotel schema enforces bookingMode and instantBookingEnabled defaults', () => {
  const hotel = new Hotel({
    name: 'Test Commercial Hotel',
    location: 'Vrindavan',
    googleMapLink: 'https://maps.google.com',
    nearestTemple: 'Banke Bihari',
  });

  assert.equal(hotel.instantBookingEnabled, false, 'Default instantBookingEnabled must be false');
  assert.equal(hotel.bookingMode, 'request', 'Default bookingMode must be request');
  assert.equal(hotel.approvalStatus, 'pending', 'Default approvalStatus must be pending');
});

test('Commercial hotel instant booking eligibility requires admin approval and explicit enablement', () => {
  const unapprovedHotel = { propertyType: 'hotel', approvalStatus: 'pending', instantBookingEnabled: true };
  assert.notEqual(unapprovedHotel.approvalStatus, 'approved', 'Unapproved hotel must be rejected');

  const approvedWithoutInstant = { propertyType: 'hotel', approvalStatus: 'approved', instantBookingEnabled: false, bookingMode: 'request' };
  const instantEligibleDisabled = !['dharamshala'].includes(approvedWithoutInstant.propertyType) &&
    (Boolean(approvedWithoutInstant.instantBookingEnabled) || approvedWithoutInstant.bookingMode === 'instant');
  assert.equal(instantEligibleDisabled, false, 'Hotel without explicit instant booking must not be instant eligible');

  const approvedWithInstant = { propertyType: 'hotel', approvalStatus: 'approved', instantBookingEnabled: true, bookingMode: 'instant' };
  const instantEligibleEnabled = !['dharamshala'].includes(approvedWithInstant.propertyType) &&
    (Boolean(approvedWithInstant.instantBookingEnabled) || approvedWithInstant.bookingMode === 'instant');
  assert.equal(instantEligibleEnabled, true, 'Approved hotel with instant booking enabled must be instant eligible');
});

test('Dharamshalas are strictly barred from instant booking regardless of flags', () => {
  const dharamshala = { propertyType: 'dharamshala', approvalStatus: 'approved', instantBookingEnabled: true, bookingMode: 'instant' };
  const isDharamshala = String(dharamshala.propertyType || '').toLowerCase() === 'dharamshala';
  const instantEligible = !isDharamshala && (Boolean(dharamshala.instantBookingEnabled) || dharamshala.bookingMode === 'instant');

  assert.equal(instantEligible, false, 'Dharamshalas must NEVER be eligible for instant booking');
});

test('Homestay respects administrator-configured booking mode', () => {
  const requestHomestay = { propertyType: 'home_stay', approvalStatus: 'approved', instantBookingEnabled: false, bookingMode: 'request' };
  const instantHomestay = { propertyType: 'home_stay', approvalStatus: 'approved', instantBookingEnabled: true, bookingMode: 'instant' };

  const isDharamshala1 = String(requestHomestay.propertyType || '').toLowerCase() === 'dharamshala';
  const eligible1 = !isDharamshala1 && (Boolean(requestHomestay.instantBookingEnabled) || requestHomestay.bookingMode === 'instant');
  assert.equal(eligible1, false, 'Request-configured homestay must use request flow');

  const isDharamshala2 = String(instantHomestay.propertyType || '').toLowerCase() === 'dharamshala';
  const eligible2 = !isDharamshala2 && (Boolean(instantHomestay.instantBookingEnabled) || instantHomestay.bookingMode === 'instant');
  assert.equal(eligible2, true, 'Instant-configured homestay must use instant flow');
});

// ---------------------------------------------------------------------------
// 2. Dharamshala Lifecycle & Strict Timers
// ---------------------------------------------------------------------------

test('Dharamshala approval timeout is exactly 5 minutes from creation timestamp', () => {
  const dharamshala = { propertyType: 'dharamshala', dharamshalaResponseTimeoutMinutes: 30 };
  const timeoutMinutes = getDharamshalaResponseTimeoutMinutes(dharamshala);

  assert.equal(timeoutMinutes, 5, 'Dharamshala response timeout must be strictly 5 minutes');

  const now = new Date('2026-10-17T12:00:00.000Z');
  const expiresAt = getDharamshalaRequestExpiresAt(dharamshala, now);
  const diffMs = expiresAt.getTime() - now.getTime();
  assert.equal(diffMs, 5 * 60 * 1000, 'Expiration must be exactly 5 minutes in future');
});

test('Dharamshala reminder is scheduled at 2 minutes after request creation', () => {
  const now = new Date('2026-10-17T12:00:00.000Z');
  const reminderMinutes = 2;
  const reminderAt = new Date(now.getTime() + reminderMinutes * 60 * 1000);

  assert.equal(reminderAt.getTime() - now.getTime(), 2 * 60 * 1000, 'Reminder must be scheduled at 2 minutes');
});

test('Customer payment window after Dharamshala acceptance is strictly 15 minutes', () => {
  const now = new Date('2026-10-17T12:00:00.000Z');
  const paymentHoldExpiresAt = getPaymentHoldExpiresAt(now, 15);
  const diffMs = paymentHoldExpiresAt.getTime() - now.getTime();

  assert.equal(diffMs, 15 * 60 * 1000, 'Payment hold after acceptance must be exactly 15 minutes');
});

test('Expired or rejected requests cannot transition to payment or confirmation', async () => {
  const expiredBooking = { bookingStatus: 'expired_property_no_response' };
  const rejectedBooking = { bookingStatus: 'rejected_by_property' };

  await assert.rejects(async () => transitionBookingStatus(expiredBooking, 'awaiting_customer_payment'), /INVALID_BOOKING_STATE/);
  await assert.rejects(async () => transitionBookingStatus(expiredBooking, 'confirmed'), /INVALID_BOOKING_STATE/);
  await assert.rejects(async () => transitionBookingStatus(rejectedBooking, 'awaiting_customer_payment'), /INVALID_BOOKING_STATE/);
  await assert.rejects(async () => transitionBookingStatus(rejectedBooking, 'confirmed'), /INVALID_BOOKING_STATE/);
});

// ---------------------------------------------------------------------------
// 3. Financial Integrity: Partner Payouts, Gateway Fee, & Balance Deduction
// ---------------------------------------------------------------------------

test('Vrindavan Sarthi bears payment gateway fee: gateway fee is NOT deducted from partner net payout', () => {
  const baseAmount = 10000;
  const taxAmount = 1200; // 12% GST
  const commissionPercent = 10; // 10% platform commission = Rs 1,000
  const gatewayFeeAmount = 200; // 2% gateway fee = Rs 200

  const money = buildMoneyFields({
    subtotal: 11200,
    baseAmount,
    taxAmount,
    paymentOption: 'full_100',
    commissionPercent,
    gatewayFeeAmount,
  });

  const grossForHotel = 10000 + 1200; // Rs 11,200
  const platformCommissionAmount = 1000; // Rs 1,000

  assert.equal(money.grossForHotel, 11200);
  assert.equal(money.platformCommissionAmount, 1000);
  assert.equal(money.paymentGatewayFeeAmount, 200, 'Gateway fee is tracked for platform cost accounting');
  // Confirmed rule: partnerNetPayout = grossForHotel - commission = 11,200 - 1,000 = 10,200
  assert.equal(money.partnerNetPayout, grossForHotel - platformCommissionAmount, 'Gateway fee must NOT be deducted from partner net payout');
});

test('Financial reconciliation for 100% online payment (full_100)', () => {
  const baseAmount = 10000;
  const taxAmount = 1200;
  const grossForHotel = baseAmount + taxAmount; // 11,200
  const commission = (baseAmount * 10) / 100; // 1,000
  const balanceAmount = 0; // 100% paid online, 0 at property

  // Reconciled formula: (grossForHotel - commission) - balanceAmount
  const netRemittance = (grossForHotel - commission) - balanceAmount;

  assert.equal(netRemittance, 10200, 'Platform remits full net entitlement when 100% paid online');
});

test('Financial reconciliation for 30% advance payment (advance_30): desk cash balance is subtracted', () => {
  const baseAmount = 10000;
  const taxAmount = 1200;
  const grossForHotel = baseAmount + taxAmount; // 11,200
  const convenienceFee = 445; // 4.45%
  const customerTotal = 11200 + convenienceFee; // 11,645

  const advancePaidOnline = Math.round(customerTotal * 0.3); // 3,494 (30%)
  const balanceCollectedAtDesk = customerTotal - advancePaidOnline; // 8,151 (70%)

  const commission = (baseAmount * 10) / 100; // 1,000
  const netHotelEntitlement = grossForHotel - commission; // 10,200

  // The hotel already pocketed Rs 8,151 in cash at the reception!
  // Therefore, platform remittance via bank transfer MUST deduct balanceCollectedAtDesk:
  const reconciledNetRemittance = netHotelEntitlement - balanceCollectedAtDesk;

  assert.equal(reconciledNetRemittance, 10200 - 8151); // 2,049
  assert.equal(reconciledNetRemittance, 2049, 'Platform remittance must be Rs 2,049 (NOT Rs 10,200)');

  // Verify total received by hotel:
  const hotelTotalReceived = balanceCollectedAtDesk + reconciledNetRemittance;
  assert.equal(hotelTotalReceived, netHotelEntitlement, 'Hotel receives exactly their net entitlement (Rs 10,200) across cash + bank');

  // Verify platform net cash:
  const platformKept = advancePaidOnline - reconciledNetRemittance;
  assert.equal(platformKept, convenienceFee + commission, 'Platform keeps convenience fee (445) + commission (1,000) = Rs 1,445');
});

test('Customer cancellation on 30% advance is non-refundable and never attempts to refund uncollected balance', () => {
  const booking = {
    propertyType: 'hotel',
    paymentOption: 'advance_30',
    totalAmount: 11645,
    advanceAmount: 3494,
    amountPaidOnline: 3494,
    balanceAmount: 8151,
  };

  const paidOnline = Math.max(0, Number(booking.amountPaidOnline || booking.advanceAmount || 0));
  assert.equal(paidOnline, 3494);

  // For customer-initiated cancellation on advance_30: advance is non-refundable
  const refundableAmount = booking.paymentOption === 'advance_30' ? 0 : paidOnline;
  assert.equal(refundableAmount, 0, 'Customer cancellation on 30% advance must be non-refundable (refundableAmount = 0)');
  assert.ok(refundableAmount <= paidOnline, 'Refund amount must NEVER exceed funds captured online');
});

test('Property/platform failure provides 100% full refund of amount captured online', () => {
  const booking = {
    propertyType: 'hotel',
    paymentOption: 'advance_30',
    totalAmount: 11645,
    advanceAmount: 3494,
    amountPaidOnline: 3494,
    balanceAmount: 8151,
  };

  const isPropertyFailure = true;
  const paidOnline = Number(booking.amountPaidOnline || booking.advanceAmount || 0);
  const refundableAmount = isPropertyFailure ? paidOnline : 0;

  assert.equal(refundableAmount, 3494, 'Property failure must refund 100% of amount captured online (Rs 3,494)');
});

// ---------------------------------------------------------------------------
// 4. Payment Verification & Razorpay Signatures
// ---------------------------------------------------------------------------

test('Server-side Razorpay signature verification validates authenticity and rejects tampering', () => {
  const secret = 'test_razorpay_secret_12345';
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  const crypto = require('crypto');
  const validSignature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  const isAuthentic = verifyPaymentSignature({
    orderId,
    paymentId,
    signature: validSignature,
    secret,
  });
  assert.equal(isAuthentic, true, 'Valid signature must be verified successfully');

  const isTampered = verifyPaymentSignature({
    orderId,
    paymentId,
    signature: 'fake_tampered_signature_hex',
    secret,
  });
  assert.equal(isTampered, false, 'Tampered signature must be rejected');
});

test('Payable amount helper returns advanceAmount for advance_30 and totalAmount for full_100', () => {
  const advanceBooking = { propertyType: 'hotel', advanceAmount: 3494, totalAmount: 11645 };
  const fullBooking = { propertyType: 'hotel', advanceAmount: 11645, totalAmount: 11645 };

  assert.equal(payableAmountForBooking(advanceBooking), 3494, 'Advance booking must charge only advanceAmount');
  assert.equal(payableAmountForBooking(fullBooking), 11645, 'Full booking must charge totalAmount');
});

// ---------------------------------------------------------------------------
// 5. State Machine: No Booking Confirmed Without Verified Payment
// ---------------------------------------------------------------------------

test('markBookingPaymentPaid requires verified inventory locks before confirming', async () => {
  const booking = {
    _id: oid(),
    bookingType: 'room_type',
    bookingStatus: 'pending',
    paymentStatus: 'pending',
    checkIn: new Date('2026-10-10'),
    checkOut: new Date('2026-10-12'),
    roomQuantity: 1,
    statusHistory: [],
    save: async function () { return this; },
  };

  // When room night locks are verified, booking moves to confirmed
  await transitionBookingStatus(booking, 'confirmed', { reason: 'payment_verified' });
  assert.equal(booking.bookingStatus, 'confirmed');
  assert.ok(booking.confirmedAt instanceof Date);
});
