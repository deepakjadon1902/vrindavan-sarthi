const mongoose = require('mongoose');

const NOTIFICATION_DELIVERY_STATUSES = [
  'queued',
  'processing',
  'retry_scheduled',
  'sent',
  'failed',
  'reconciliation_required',
  'cancelled',
];

const notificationDeliverySchema = new mongoose.Schema(
  {
    notificationKey: { type: String, required: true, unique: true },
    eventType: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'in_app'], required: true, index: true },
    status: {
      type: String,
      enum: NOTIFICATION_DELIVERY_STATUSES,
      default: 'queued',
      index: true,
    },

    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    modificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingModification', index: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true },
    recipient: { type: String, trim: true },

    template: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    provider: { type: String, default: 'internal' },
    providerMessageId: String,
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    processingStartedAt: Date,
    sentAt: Date,
    failedAt: Date,
    lastError: String,
    lastErrorAt: Date,
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
notificationDeliverySchema.index({ bookingId: 1, template: 1 });
notificationDeliverySchema.index({ orderId: 1, template: 1 });
notificationDeliverySchema.index({ partnerId: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
module.exports.NOTIFICATION_DELIVERY_STATUSES = NOTIFICATION_DELIVERY_STATUSES;
