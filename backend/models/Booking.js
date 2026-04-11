const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  bookingType: { type: String, enum: ['hotel', 'room', 'cab', 'tour'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: String,
  itemImage: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  userPhone: String,
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,
  checkIn: Date,
  checkOut: Date,
  guests: Number,
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['online', 'doorstep'], default: 'online' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  bookingStatus: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'confirmed' },
  additionalInfo: String,
  upiTransactionId: String,
}, { timestamps: true });

bookingSchema.pre('save', function (next) {
  if (!this.bookingId) {
    this.bookingId = `VVS-2025-${String(Math.floor(10000 + Math.random() * 90000))}`;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
