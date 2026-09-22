const mongoose = require('mongoose');

const moneySnapshotSchema = new mongoose.Schema(
  {
    baseAmount: Number,
    taxPercent: Number,
    taxAmount: Number,
    checkoutSubtotal: Number,
    convenienceFeePercent: Number,
    convenienceFeeAmount: Number,
    totalAmount: Number,
    advanceAmount: Number,
    balanceAmount: Number,
    paymentOption: String,
  },
  { _id: false }
);

const bookingValueSnapshotSchema = new mongoose.Schema(
  {
    checkIn: Date,
    checkOut: Date,
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan' },
    ratePlanName: String,
    ratePlanCode: String,
    ratePlanMealPlan: String,
    nightlyBreakdown: [{ type: mongoose.Schema.Types.Mixed }],
    roomQuantity: Number,
    guests: Number,
    totalAdults: Number,
    totalChildren: Number,
    hasPet: Boolean,
    guestDetails: [{ type: mongoose.Schema.Types.Mixed }],
    roomUnitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit' }],
    roomNumbers: [String],
    itemId: String,
    itemName: String,
    itemImage: String,
    money: moneySnapshotSchema,
  },
  { _id: false }
);

const inventoryLockSchema = new mongoose.Schema(
  {
    roomUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit' },
    date: Date,
  },
  { _id: false }
);

const bookingModificationSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, enum: ['user', 'admin', 'partner', 'system'], required: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'preview',
        'pending_payment',
        'inventory_pending',
        'processing',
        'completed',
        'payment_failed',
        'refund_pending',
        'refund_failed',
        'failed',
        'cancelled',
      ],
      default: 'preview',
      index: true,
    },
    action: {
      type: String,
      enum: ['additional_payment', 'refund', 'no_change'],
      required: true,
      index: true,
    },
    oldValues: bookingValueSnapshotSchema,
    newValues: bookingValueSnapshotSchema,
    oldAmount: { type: Number, default: 0 },
    newAmount: { type: Number, default: 0 },
    differenceAmount: { type: Number, default: 0 },
    paymentAction: {
      type: String,
      enum: ['additional_payment', 'refund', 'no_change'],
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['not_required', 'pending', 'paid', 'failed'],
      default: 'not_required',
      index: true,
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpayWebhookEventIds: [{ type: String }],
    refundId: { type: String, index: true },
    refundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ['not_required', 'pending', 'processed', 'failed'],
      default: 'not_required',
      index: true,
    },
    refundRequestedAt: Date,
    refundProcessedAt: Date,
    refundFailureReason: String,
    activeBookingModification: { type: Boolean, default: false },
    inventoryStatus: {
      type: String,
      enum: ['not_required', 'planned', 'held', 'applied', 'released', 'failed'],
      default: 'planned',
      index: true,
    },
    heldLocks: [inventoryLockSchema],
    releasedLocks: [inventoryLockSchema],
    failureReason: String,
    reconciliationState: {
      type: String,
      enum: ['none', 'needs_refund_reconciliation', 'needs_payment_reconciliation', 'needs_inventory_reconciliation'],
      default: 'none',
      index: true,
    },
    completedAt: Date,
    failedAt: Date,
  },
  { timestamps: true }
);

bookingModificationSchema.index({ bookingId: 1, createdAt: -1 });
bookingModificationSchema.index({ bookingId: 1, idempotencyKey: 1 }, { unique: true });
bookingModificationSchema.index(
  { bookingId: 1, activeBookingModification: 1 },
  {
    unique: true,
    partialFilterExpression: { activeBookingModification: true },
    name: 'booking_active_modification_unique',
  }
);

module.exports = mongoose.model('BookingModification', bookingModificationSchema);
