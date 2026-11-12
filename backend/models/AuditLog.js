const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetEntityType: { type: String, default: 'booking', index: true },
    targetEntityId: { type: String, default: '', index: true },
    reason: { type: String, default: '' },
    bookingId: { type: String, index: true, default: '' },
    bookingObjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, required: true, index: true },
    actorName: { type: String, default: '' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    idempotencyKey: { type: String, index: true },
    beforeState: { type: mongoose.Schema.Types.Mixed },
    afterState: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
