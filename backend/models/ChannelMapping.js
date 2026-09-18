const mongoose = require('mongoose');

const channelMappingSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, default: 'ezee', index: true },
    entityType: {
      type: String,
      enum: ['hotel', 'room_type', 'rate_plan'],
      required: true,
      index: true,
    },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', index: true, default: null },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', index: true, default: null },
    internalEntityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    externalEntityId: { type: String, required: true, trim: true },
    externalCode: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
  },
  { timestamps: true }
);

channelMappingSchema.index({ provider: 1, entityType: 1, internalEntityId: 1 }, { unique: true });
channelMappingSchema.index({ provider: 1, entityType: 1, externalEntityId: 1 }, { unique: true });
channelMappingSchema.index({ hotelId: 1, provider: 1, entityType: 1, active: 1 });

module.exports = mongoose.model('ChannelMapping', channelMappingSchema);
