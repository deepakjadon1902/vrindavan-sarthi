const mongoose = require('mongoose');

// Represents manual blocks like closed/maintenance/offline booking block, etc.
// NOTE: Dates are stored as date-times; treat as date-only boundaries in UTC with [start, end) semantics.
const roomUnitBlockSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    roomUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit', required: true, index: true },

    kind: {
      type: String,
      enum: ['closed', 'maintenance', 'offline_booking', 'temp_unavailable'],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true }, // exclusive
    note: { type: String, default: '' },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

roomUnitBlockSchema.index({ roomUnitId: 1, startDate: 1, endDate: 1 });
roomUnitBlockSchema.index({ hotelId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('RoomUnitBlock', roomUnitBlockSchema);

