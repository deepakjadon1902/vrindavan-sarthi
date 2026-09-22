const mongoose = require('mongoose');

const partnerNotificationSchema = new mongoose.Schema(
  {
    eventKey: { type: String, unique: true, sparse: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['notice', 'notification'], default: 'notification', index: true },
    audience: { type: String, enum: ['all_partners', 'partner', 'admin'], default: 'all_partners' },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipientRole: { type: String, enum: ['admin', 'partner', 'user'], index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    eventType: { type: String, default: '', index: true },
    priority: { type: String, enum: ['normal', 'high', 'critical'], default: 'normal', index: true },
    entityType: { type: String, enum: ['booking', 'order', 'notice'], default: 'notice' },
    entityId: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    alarmStatus: {
      type: String,
      enum: ['created', 'delivered', 'alarming', 'acknowledged', 'expired'],
      default: 'created',
      index: true,
    },
    readAt: Date,
    acknowledgedAt: Date,
    alarmStartedAt: Date,
    alarmExpiresAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedDeviceId: String,
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

partnerNotificationSchema.index({ type: 1, createdAt: -1 });
partnerNotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
partnerNotificationSchema.index({ partnerId: 1, createdAt: -1 });
partnerNotificationSchema.index({ bookingId: 1, eventType: 1 });

module.exports = mongoose.model('PartnerNotification', partnerNotificationSchema);
