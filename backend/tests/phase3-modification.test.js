const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const {
  MODIFICATION_STATUSES,
  calculatePreviewAmounts,
  authorizeBookingForActor,
  validateIdempotencyKey,
  createModification,
} = require('../utils/bookingModification');
const {
  calculateConvenienceFee,
  buildMoneyFields,
  calculateLodgingPrice,
} = require('../utils/pricing');

const readBackendFile = (...segments) => fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
const oid = () => new mongoose.Types.ObjectId();

test('BookingModification schema supports Phase 3 audit, payment, refund, and idempotency fields', () => {
  assert.ok(BookingModification.schema.path('bookingId'));
  assert.ok(BookingModification.schema.path('actorId'));
  assert.ok(BookingModification.schema.path('actorRole'));
  assert.ok(BookingModification.schema.path('idempotencyKey'));
  assert.ok(BookingModification.schema.path('oldValues'));
  assert.ok(BookingModification.schema.path('newValues'));
  assert.ok(BookingModification.schema.path('differenceAmount'));
  assert.ok(BookingModification.schema.path('paymentAction'));
  assert.ok(BookingModification.schema.path('razorpayOrderId'));
  assert.ok(BookingModification.schema.path('razorpayPaymentId'));
  assert.ok(BookingModification.schema.path('refundId'));
  assert.ok(BookingModification.schema.path('refundStatus'));
  assert.ok(BookingModification.schema.path('inventoryStatus'));
  assert.ok(BookingModification.schema.path('reconciliationState'));

  const indexes = BookingModification.schema.indexes();
  assert.ok(indexes.some(([fields]) => fields.bookingId === 1 && fields.createdAt === -1));
  assert.ok(indexes.some(([fields, options]) =>
    fields.bookingId === 1 &&
    fields.idempotencyKey === 1 &&
    options?.unique === true
  ));
});

test('Booking schema records provider refund outcome separately from refundable amount', () => {
  assert.ok(Booking.schema.path('refundableAmount'));
  assert.ok(Booking.schema.path('refundId'));
  assert.ok(Booking.schema.path('refundAmount'));
  assert.ok(Booking.schema.path('refundStatus'));
  assert.ok(Booking.schema.path('refundRequestedAt'));
  assert.ok(Booking.schema.path('refundProcessedAt'));
  assert.ok(Booking.schema.path('refundFailureReason'));
  assert.ok(Booking.schema.path('refundReconciliationState'));
});

test('modification lifecycle blocks uncontrolled transitions by construction', () => {
  assert.ok(MODIFICATION_STATUSES.preview.has('inventory_pending'));
  assert.ok(MODIFICATION_STATUSES.inventory_pending.has('pending_payment'));
  assert.ok(MODIFICATION_STATUSES.pending_payment.has('processing'));
  assert.ok(MODIFICATION_STATUSES.processing.has('completed'));
  assert.ok(MODIFICATION_STATUSES.refund_pending.has('refund_failed'));
  assert.equal(MODIFICATION_STATUSES.completed.size, 0);
  assert.equal(MODIFICATION_STATUSES.failed.size, 0);
});

test('price difference calculation is deterministic', () => {
  assert.deepEqual(calculatePreviewAmounts(10000, 12000), {
    oldAmount: 10000,
    newAmount: 12000,
    differenceAmount: 2000,
    paymentAction: 'additional_payment',
    additionalAmount: 2000,
    refundAmount: 0,
  });
  assert.deepEqual(calculatePreviewAmounts(10000, 8800), {
    oldAmount: 10000,
    newAmount: 8800,
    differenceAmount: -1200,
    paymentAction: 'refund',
    additionalAmount: 0,
    refundAmount: 1200,
  });
  assert.equal(calculatePreviewAmounts(10000, 10000).paymentAction, 'no_change');
});

test('extracted pricing preserves existing convenience and money formulas', () => {
  assert.equal(calculateConvenienceFee(10000), 445);
  const money = buildMoneyFields({
    subtotal: 10500,
    baseAmount: 10000,
    taxAmount: 500,
    paymentOption: 'advance_30',
    commissionPercent: 10,
    gatewayFeeAmount: 200,
  });
  assert.equal(money.totalAmount, 10945);
  assert.equal(money.advanceAmount, 3284);
  assert.equal(money.balanceAmount, 7661);
  assert.equal(money.platformCommissionAmount, 1000);
  assert.equal(money.paymentGatewayFeeAmount, 200);
});

test('dharamshala lodging pricing charges only fixed 10 percent platform fee', async () => {
  const money = await calculateLodgingPrice({
    hotel: {
      propertyType: 'dharamshala',
      taxEnabled: true,
      taxPercent: 18,
      gstMode: 'manual',
      partnerId: oid(),
      platform_commission_percentage: 25,
    },
    roomType: { pricePerNight: 1000 },
    nights: 2,
    roomQuantity: 3,
    paymentOption: 'advance_30',
    gatewayFeeAmount: 999,
  });

  assert.equal(money.baseAmount, 6000);
  assert.equal(money.taxPercent, 0);
  assert.equal(money.taxAmount, 0);
  assert.equal(money.convenienceFeePercent, 10);
  assert.equal(money.convenienceFeeAmount, 600);
  assert.equal(money.totalAmount, 6600);
  assert.equal(money.paymentOption, 'full_100');
  assert.equal(money.advancePercent, 100);
  assert.equal(money.advanceAmount, 6600);
  assert.equal(money.balanceAmount, 0);
  assert.equal(money.platformCommissionPercent, 0);
  assert.equal(money.platformCommissionAmount, 0);
  assert.equal(money.paymentGatewayFeeAmount, 0);
});

test('authorization helper preserves customer, partner, and admin ownership boundaries', () => {
  const customerId = oid();
  const partnerId = oid();
  const otherId = oid();
  const booking = { userId: customerId, partnerId };

  assert.equal(authorizeBookingForActor(booking, { _id: customerId, role: 'user' }), true);
  assert.equal(authorizeBookingForActor(booking, { _id: partnerId, role: 'partner' }), true);
  assert.equal(authorizeBookingForActor(booking, { _id: otherId, role: 'admin' }), true);
  assert.throws(() => authorizeBookingForActor(booking, { _id: otherId, role: 'user' }), /Not authorized/);
  assert.throws(() => authorizeBookingForActor(booking, { _id: otherId, role: 'partner' }), /Not authorized/);
});

test('idempotency keys are required and tightly formatted', () => {
  assert.equal(validateIdempotencyKey('phase3-key:1234'), 'phase3-key:1234');
  assert.throws(() => validateIdempotencyKey(''), /required/);
  assert.throws(() => validateIdempotencyKey('short'), /Invalid/);
  assert.throws(() => validateIdempotencyKey('bad key with spaces'), /Invalid/);
});

test('malformed booking id is rejected before Mongoose query casting', async () => {
  await assert.rejects(
    createModification({
      bookingId: 'bad-id',
      actor: { _id: oid(), role: 'admin' },
      changes: { adults: 1 },
      idempotencyKey: 'phase3-key:bad-id',
    }),
    /Invalid booking id/
  );
});

test('modification route does not expose arbitrary Booking field updates', () => {
  const routeSource = readBackendFile('routes', 'booking.routes.js');
  const serviceSource = readBackendFile('utils', 'bookingModification.js');

  assert.doesNotMatch(routeSource, /Object\.assign\(booking,\s*req\.body/);
  assert.match(serviceSource, /publicModificationFields/);
  assert.match(serviceSource, /Field is not modifiable/);
  assert.match(serviceSource, /bookingStatus/);
  assert.match(serviceSource, /paymentStatus/);
  assert.match(serviceSource, /confirmed/);
  assert.match(serviceSource, /paid/);
});
