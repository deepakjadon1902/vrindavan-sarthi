const mongoose = require('mongoose');

const REFUND_OPERATION_STATUSES = [
  'requested',
  'queued',
  'processing',
  'retry_scheduled',
  'processed',
  'failed',
  'reconciliation_required',
];

const refundOperationSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['razorpay'], default: 'razorpay', required: true, index: true },
    operationKey: { type: String, required: true, unique: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    modificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingModification', index: true },
    paymentId: { type: String, index: true },
    orderId: { type: String, index: true },
    requestedAmount: { type: Number, required: true },
    currency: { type: String, enum: ['INR'], default: 'INR', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: REFUND_OPERATION_STATUSES, default: 'requested', index: true },
    providerRefundId: { type: String, index: true },
    providerStatus: String,
    attempts: { type: Number, default: 0 },
    lastError: String,
    lastErrorAt: Date,
    requestedAt: { type: Date, default: Date.now },
    queuedAt: Date,
    processingStartedAt: Date,
    processedAt: Date,
    failedAt: Date,
    reconciliationState: {
      type: String,
      enum: ['none', 'required', 'resolved', 'manual_review'],
      default: 'none',
      index: true,
    },
    reconciliationAttempts: { type: Number, default: 0 },
    lastReconciledAt: Date,
    nextReconciliationAt: Date,
    providerResponseMetadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

refundOperationSchema.pre('validate', function validateSingleTarget(next) {
  const hasBooking = Boolean(this.bookingId);
  const hasModification = Boolean(this.modificationId);
  if (hasBooking === hasModification) {
    return next(new Error('RefundOperation requires exactly one of bookingId or modificationId'));
  }
  if (!Number.isInteger(this.requestedAmount) || this.requestedAmount < 0) {
    return next(new Error('RefundOperation requestedAmount must be a non-negative integer'));
  }
  return next();
});

refundOperationSchema.index({ status: 1, nextReconciliationAt: 1 });
refundOperationSchema.index({ status: 1, processingStartedAt: 1 });
refundOperationSchema.index({ provider: 1, paymentId: 1, providerRefundId: 1 });

module.exports = mongoose.model('RefundOperation', refundOperationSchema);
module.exports.REFUND_OPERATION_STATUSES = REFUND_OPERATION_STATUSES;
