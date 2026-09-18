const mongoose = require('mongoose');

const channelConnectionSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    status: {
      type: String,
      enum: ['disabled', 'enabled', 'degraded', 'reconciliation_required'],
      default: 'disabled',
      index: true,
    },
    enabled: { type: Boolean, default: false, index: true },
    environment: { type: String, enum: ['sandbox', 'production', 'disabled'], default: 'disabled' },
    externalHotelId: { type: String, trim: true, default: '' },
    credentialsReference: { type: String, trim: true, default: '' },
    capabilities: {
      availability: { type: Boolean, default: false },
      rates: { type: Boolean, default: false },
      restrictions: { type: Boolean, default: false },
      reservations: { type: Boolean, default: false },
      modifications: { type: Boolean, default: false },
      cancellations: { type: Boolean, default: false },
      webhooks: { type: Boolean, default: false },
      idempotency: { type: Boolean, default: false },
    },
    lastHealthCheckAt: Date,
    lastSuccessfulSyncAt: Date,
    lastError: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
  },
  { timestamps: true }
);

channelConnectionSchema.index({ provider: 1, hotelId: 1 }, { unique: true });
channelConnectionSchema.index({ hotelId: 1, enabled: 1, status: 1 });

module.exports = mongoose.model('ChannelConnection', channelConnectionSchema);
