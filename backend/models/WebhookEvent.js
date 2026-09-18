const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['received', 'queued', 'processing', 'processed', 'failed'],
      default: 'received',
      index: true,
    },
    receivedAt: { type: Date, default: Date.now, index: true },
    queuedAt: Date,
    processingStartedAt: Date,
    processedAt: Date,
    failedAt: Date,
    attempts: { type: Number, default: 0 },
    lastError: String,
    lastErrorAt: Date,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    bookingModificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingModification', index: true },
    payloadHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processingResult: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, receivedAt: 1 });
webhookEventSchema.index({ status: 1, processingStartedAt: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
