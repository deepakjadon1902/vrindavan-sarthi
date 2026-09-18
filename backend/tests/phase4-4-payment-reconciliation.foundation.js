const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const PaymentReconciliation = require('../models/PaymentReconciliation');
const {
  buildPaymentReconciliationKey,
  classifyCapturedBookingLocalState,
  classifyPaymentComparison,
  classifyProviderError,
  expectedBookingAmountPaise,
  expectedModificationAmountPaise,
  resolveProviderPayment,
} = require('../utils/paymentReconciliation');

test('reconciliation key is deterministic', () => {
  const input = {
    targetType: 'booking',
    targetId: 'booking-1',
    orderId: 'order-1',
    paymentId: 'pay-1',
  };
  assert.equal(buildPaymentReconciliationKey(input), buildPaymentReconciliationKey(input));
  assert.equal(
    buildPaymentReconciliationKey(input),
    'payment-reconcile:booking:booking-1:order-1:pay-1'
  );
});

test('booking key differs from modification key', () => {
  assert.notEqual(
    buildPaymentReconciliationKey({ targetType: 'booking', targetId: 'same', orderId: 'order', paymentId: '' }),
    buildPaymentReconciliationKey({ targetType: 'modification', targetId: 'same', orderId: 'order', paymentId: '' })
  );
});

test('PaymentReconciliation requires exactly one target', async () => {
  const bookingId = new mongoose.Types.ObjectId();
  const modificationId = new mongoose.Types.ObjectId();
  await assert.rejects(
    () => new PaymentReconciliation({
      provider: 'razorpay',
      reconciliationKey: 'bad-both',
      targetType: 'booking',
      bookingId,
      modificationId,
    }).validate(),
    /booking target requires bookingId only/
  );
  await assert.rejects(
    () => new PaymentReconciliation({
      provider: 'razorpay',
      reconciliationKey: 'bad-none',
      targetType: 'modification',
    }).validate(),
    /modification target requires modificationId only/
  );
});

test('PaymentReconciliation declares required indexes', () => {
  const indexes = PaymentReconciliation.schema.indexes();
  assert.ok(indexes.some(([fields, opts]) => fields.reconciliationKey === 1 && opts.unique));
  assert.ok(indexes.some(([fields]) => fields.reconciliationStatus === 1 && fields.nextCheckAt === 1));
  assert.ok(indexes.some(([fields]) => fields.provider === 1 && fields.orderId === 1));
  assert.ok(indexes.some(([fields]) => fields.provider === 1 && fields.paymentId === 1));
});

test('amount comparison uses integer minor units', () => {
  assert.equal(expectedBookingAmountPaise({ advanceAmount: 8800 }), 880000);
  assert.equal(expectedModificationAmountPaise({ differenceAmount: 955 }), 95500);
});

test('currency mismatch is reconciliation required', () => {
  const result = classifyPaymentComparison({
    payment: { id: 'pay', order_id: 'order', amount: 10000, currency: 'USD', status: 'captured' },
    expectedAmount: 10000,
    orderId: 'order',
  });
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.reason, 'provider_currency_mismatch');
});

test('provider captured classification', () => {
  const result = classifyPaymentComparison({
    payment: { id: 'pay', order_id: 'order', amount: 10000, currency: 'INR', status: 'captured' },
    expectedAmount: 10000,
    orderId: 'order',
  });
  assert.equal(result.status, 'captured');
});

test('provider failed classification', () => {
  const result = classifyPaymentComparison({
    payment: { id: 'pay', order_id: 'order', amount: 10000, currency: 'INR', status: 'failed' },
    expectedAmount: 10000,
    orderId: 'order',
  });
  assert.equal(result.status, 'failed');
});

test('unknown provider state is reconciliation required', () => {
  const result = classifyPaymentComparison({
    payment: { id: 'pay', order_id: 'order', amount: 10000, currency: 'INR', status: 'authorized' },
    expectedAmount: 10000,
    orderId: 'order',
  });
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.reason, 'provider_payment_state_unknown');
});

test('retryable provider error classification', () => {
  assert.equal(classifyProviderError({ statusCode: 500 }), 'retryable');
  assert.equal(classifyProviderError({ statusCode: 429 }), 'retryable');
});

test('non-retryable provider error classification', () => {
  assert.equal(classifyProviderError({ statusCode: 400 }), 'non_retryable');
  assert.equal(classifyProviderError({ statusCode: 404 }), 'not_found');
});

test('expired booking plus captured payment requires reconciliation', () => {
  const result = classifyCapturedBookingLocalState({
    bookingStatus: 'expired',
    paymentStatus: 'pending',
    inventoryComplete: false,
  });
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.reason, 'provider_captured_local_expired');
});

test('cancelled booking plus captured payment requires reconciliation', () => {
  const result = classifyCapturedBookingLocalState({
    bookingStatus: 'cancelled',
    paymentStatus: 'pending',
    inventoryComplete: false,
  });
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.reason, 'provider_captured_local_cancelled');
});

test('paid booking plus same captured payment is idempotent resolved', () => {
  const result = classifyCapturedBookingLocalState({
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    inventoryComplete: true,
  });
  assert.equal(result.status, 'resolved');
});

test('multiple payments for an order require reconciliation', async () => {
  await assert.rejects(
    () => resolveProviderPayment({
      orderId: 'order',
      provider: {
        listPaymentsForOrder: async () => ({
          items: [
            { id: 'pay-1', order_id: 'order' },
            { id: 'pay-2', order_id: 'order' },
          ],
        }),
      },
    }),
    /Multiple Razorpay payments/
  );
});

test('wrong order is reconciliation required', () => {
  const result = classifyPaymentComparison({
    payment: { id: 'pay', order_id: 'other-order', amount: 10000, currency: 'INR', status: 'captured' },
    expectedAmount: 10000,
    orderId: 'order',
  });
  assert.equal(result.status, 'reconciliation_required');
  assert.equal(result.reason, 'provider_payment_order_mismatch');
});

test('missing target becomes reconciliation required through local classification', () => {
  const result = classifyCapturedBookingLocalState({
    bookingStatus: '',
    paymentStatus: '',
    inventoryComplete: false,
  });
  assert.equal(result.status, 'reconciliation_required');
});
