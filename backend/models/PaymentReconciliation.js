const mongoose = require('mongoose');

const PAYMENT_RECONCILIATION_STATUSES = [
  'pending',
  'processing',
  'resolved',
  'retry_scheduled',
  'reconciliation_required',
  'failed',
  'ignored',
];

const paymentReconciliationSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['razorpay'], default: 'razorpay', required: true, index: true },
    reconciliationKey: { type: String, required: true, unique: true },
    targetType: { type: String, enum: ['booking', 'modification'], required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    modificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingModification', index: true },
    orderId: { type: String, index: true },
    paymentId: { type: String, index: true },
    expectedAmount: { type: Number, default: 0 },
    providerAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    providerStatus: String,
    localPaymentStatus: String,
    localBookingStatus: String,
    reconciliationStatus: {
      type: String,
      enum: PAYMENT_RECONCILIATION_STATUSES,
      default: 'pending',
      index: true,
    },
    reason: String,
    attemptCount: { type: Number, default: 0 },
    lastCheckedAt: Date,
    nextCheckAt: Date,
    resolvedAt: Date,
    failureReason: String,
    providerResponseMetadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

paymentReconciliationSchema.pre('validate', function validateSingleTarget(next) {
  const hasBooking = Boolean(this.bookingId);
  const hasModification = Boolean(this.modificationId);
  if (this.targetType === 'booking' && (!hasBooking || hasModification)) {
    return next(new Error('PaymentReconciliation booking target requires bookingId only'));
  }
  if (this.targetType === 'modification' && (!hasModification || hasBooking)) {
    return next(new Error('PaymentReconciliation modification target requires modificationId only'));
  }
  return next();
});

paymentReconciliationSchema.index({ reconciliationStatus: 1, nextCheckAt: 1 });
paymentReconciliationSchema.index({ provider: 1, orderId: 1 });
paymentReconciliationSchema.index({ provider: 1, paymentId: 1 });
paymentReconciliationSchema.index({ bookingId: 1, createdAt: -1 });
paymentReconciliationSchema.index({ modificationId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentReconciliation', paymentReconciliationSchema);
module.exports.PAYMENT_RECONCILIATION_STATUSES = PAYMENT_RECONCILIATION_STATUSES;
