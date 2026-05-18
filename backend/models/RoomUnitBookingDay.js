const mongoose = require('mongoose');

// Date-wise booking inventory lock per room unit.
// Stores one document per [checkIn, checkOut) day at 00:00:00.000Z.
const roomUnitBookingDaySchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    roomUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    date: { type: Date, required: true, index: true }, // 00:00Z
  },
  { timestamps: true }
);

roomUnitBookingDaySchema.index({ roomUnitId: 1, date: 1 }, { unique: true });
roomUnitBookingDaySchema.index({ bookingId: 1, date: 1 });

module.exports = mongoose.model('RoomUnitBookingDay', roomUnitBookingDaySchema);

