const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['qr_scan_lookup', 'guest_check_in', 'property_payment_collected'],
      required: true,
      index: true,
    },
    bookingId: { type: String, required: true, index: true },
    bookingObjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, enum: ['admin', 'partner'], required: true },
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
