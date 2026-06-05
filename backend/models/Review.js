const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ hotelId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
