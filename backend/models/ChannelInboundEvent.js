const mongoose = require('mongoose');

const channelInboundEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, default: 'ezee', index: true },
    eventId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true, index: true },
    payloadHash: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['received', 'queued', 'processing', 'processed', 'failed', 'reconciliation_required', 'duplicate_conflict'],
      default: 'received',
      index: true,
    },
    externalReservationId: { type: String, trim: true, default: '', index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true, default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true, default: null },
    operationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelSyncOperation', index: true, default: null },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date,
    payloadSummary: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    processingResult: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    lastError: String,
    lastErrorAt: Date,
  },
  { timestamps: true }
);

channelInboundEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
channelInboundEventSchema.index({ status: 1, nextAttemptAt: 1, updatedAt: 1 });

module.exports = mongoose.model('ChannelInboundEvent', channelInboundEventSchema);
