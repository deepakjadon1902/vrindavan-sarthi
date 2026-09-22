const mongoose = require('mongoose');

const notificationDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['admin', 'partner', 'user'], required: true, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    deviceId: { type: String, required: true, trim: true },
    platform: { type: String, default: '', trim: true },
    browser: { type: String, default: '', trim: true },
    permissionStatus: { type: String, enum: ['default', 'granted', 'denied', 'unsupported'], default: 'default' },
    alarmEnabled: { type: Boolean, default: true },
    pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    registeredAt: { type: Date, default: Date.now },
    revokedAt: Date,
  },
  { timestamps: true }
);

notificationDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
notificationDeviceSchema.index({ role: 1, revokedAt: 1, lastSeenAt: -1 });

module.exports = mongoose.model('NotificationDevice', notificationDeviceSchema);
