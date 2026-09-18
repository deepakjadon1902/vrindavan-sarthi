const mongoose = require('mongoose');

const channelReconciliationSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, index: true },
    reconciliationKey: { type: String, required: true, trim: true },
    reason: {
      type: String,
      enum: [
        'missing_mapping',
        'payload_conflict',
        'out_of_order_event',
        'inventory_conflict',
        'unsupported_operation',
        'provider_unknown_outcome',
        'provider_contract_missing',
        'relationship_invalid',
        'manual_review',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true, default: null },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', index: true, default: null },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', index: true, default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true, default: null },
    operationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelSyncOperation', index: true, default: null },
    inboundEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelInboundEvent', index: true, default: null },
    externalReservationId: { type: String, trim: true, default: '', index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    resolvedAt: Date,
    resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

channelReconciliationSchema.index({ provider: 1, reconciliationKey: 1 }, { unique: true });
channelReconciliationSchema.index({ status: 1, updatedAt: -1 });
channelReconciliationSchema.index({ hotelId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('ChannelReconciliation', channelReconciliationSchema);
