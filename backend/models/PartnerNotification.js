const mongoose = require('mongoose');

const partnerNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['notice', 'notification'], default: 'notification', index: true },
    audience: { type: String, enum: ['all_partners', 'partner', 'admin'], default: 'all_partners' },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entityType: { type: String, enum: ['booking', 'order', 'notice'], default: 'notice' },
    entityId: String,
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

partnerNotificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('PartnerNotification', partnerNotificationSchema);
