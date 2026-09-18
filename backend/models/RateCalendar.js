const mongoose = require('mongoose');

const rateCalendarSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', required: true, index: true },
    date: { type: Date, required: true, index: true },

    price: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    minimumStay: { type: Number, default: null },
    maximumStay: { type: Number, default: null },
    closed: { type: Boolean, default: false },
    closedToArrival: { type: Boolean, default: false },
    closedToDeparture: { type: Boolean, default: false },
    minimumAdvanceDays: { type: Number, default: null },
    maximumAdvanceDays: { type: Number, default: null },
    active: { type: Boolean, default: true, index: true },

    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByRole: { type: String, enum: ['admin', 'partner', 'system'], default: 'system' },
  },
  { timestamps: true }
);

rateCalendarSchema.index({ ratePlanId: 1, date: 1 }, { unique: true });
rateCalendarSchema.index({ roomTypeId: 1, date: 1 });
rateCalendarSchema.index({ hotelId: 1, date: 1 });

module.exports = mongoose.model('RateCalendar', rateCalendarSchema);
