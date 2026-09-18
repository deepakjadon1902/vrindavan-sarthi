const mongoose = require('mongoose');

const channelSyncOperationSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, default: 'ezee', index: true },
    operation: {
      type: String,
      enum: [
        'inventory_sync',
        'rate_sync',
        'reservation_inbound',
        'reservation_create',
        'reservation_modify',
        'reservation_cancel',
        'webhook_process',
        'reconciliation',
      ],
      required: true,
      index: true,
    },
    entityType: { type: String, enum: ['hotel', 'room_type', 'rate_plan', 'booking', 'external_reservation', 'webhook', 'unknown'], default: 'unknown', index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true, default: null },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true, default: null },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', index: true, default: null },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', index: true, default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true, default: null },
    externalReservationId: { type: String, trim: true, default: '', index: true },
    externalEntityId: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'retry_scheduled', 'failed', 'reconciliation_required'],
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    idempotencyKey: { type: String, required: true, trim: true, index: true },
    requestId: { type: String, trim: true, default: '' },
    correlationId: { type: String, trim: true, default: '' },
    operationKey: { type: String, trim: true, default: '' },
    generatedAt: { type: Date, default: Date.now, index: true },
    stateVersion: { type: Number, default: 1 },
    nextAttemptAt: { type: Date, index: true, default: Date.now },
    processingStartedAt: Date,
    completedAt: Date,
    lastError: String,
    lastErrorAt: Date,
    errorClass: {
      type: String,
      enum: ['none', 'retryable', 'permanent', 'unknown', 'reconciliation_required'],
      default: 'none',
      index: true,
    },
    providerResponseReference: String,
    payloadSummary: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

channelSyncOperationSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
channelSyncOperationSchema.index({ status: 1, nextAttemptAt: 1, updatedAt: 1 });
channelSyncOperationSchema.index({ provider: 1, operation: 1, hotelId: 1, status: 1 });
channelSyncOperationSchema.index({ provider: 1, operation: 1, entityType: 1, entityId: 1, generatedAt: -1 });

module.exports = mongoose.model('ChannelSyncOperation', channelSyncOperationSchema);
