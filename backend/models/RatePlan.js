const mongoose = require('mongoose');

const occupancyRulesSchema = new mongoose.Schema(
  {
    maxAdults: { type: Number, default: null },
    maxChildren: { type: Number, default: null },
  },
  { _id: false }
);

const rateRestrictionsSchema = new mongoose.Schema(
  {
    minimumStay: { type: Number, default: 1 },
    maximumStay: { type: Number, default: null },
    closed: { type: Boolean, default: false },
    closedToArrival: { type: Boolean, default: false },
    closedToDeparture: { type: Boolean, default: false },
    minimumAdvanceDays: { type: Number, default: null },
    maximumAdvanceDays: { type: Number, default: null },
  },
  { _id: false }
);

const ratePlanSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: '' },
    mealPlan: {
      type: String,
      enum: ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD'],
      default: 'ROOM_ONLY',
      index: true,
    },
    cancellationPolicy: {
      type: String,
      enum: ['FLEXIBLE', 'NON_REFUNDABLE', 'CUSTOM'],
      default: 'FLEXIBLE',
    },
    paymentPolicy: {
      type: String,
      enum: ['ADVANCE_30', 'FULL_100', 'EITHER'],
      default: 'EITHER',
    },

    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    occupancyRules: { type: occupancyRulesSchema, default: () => ({}) },
    restrictions: { type: rateRestrictionsSchema, default: () => ({}) },

    active: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
  },
  { timestamps: true }
);

ratePlanSchema.index({ roomTypeId: 1, active: 1, sortOrder: 1 });
ratePlanSchema.index({ hotelId: 1, roomTypeId: 1, code: 1 }, { unique: true });
ratePlanSchema.index(
  { roomTypeId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

module.exports = mongoose.model('RatePlan', ratePlanSchema);
