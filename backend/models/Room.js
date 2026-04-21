const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hotelName: { type: String, required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  type: { type: String, default: 'Double Bed' },
  floor: { type: String, default: '' },
  pricePerNight: { type: Number, required: true },
  pricePerBed: { type: Number, default: 0 },
  capacity: { type: Number, default: 2 },
  bedCount: { type: Number, default: 1 },
  isAC: { type: Boolean, default: true },
  hasAttachedBathroom: { type: Boolean, default: true },
  hasBalcony: { type: Boolean, default: false },
  hasTV: { type: Boolean, default: true },
  hasWiFi: { type: Boolean, default: true },
  image: String,
  images: [String],
  amenities: [String],
  description: { type: String, default: '' },
  status: { type: String, enum: ['available', 'booked', 'inactive'], default: 'available' },
  // Partner
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,
  partnerEmail: String,
  partnerPhone: String,
  businessName: String,
  partnerSubmitted: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  adminRemarks: String,
}, { timestamps: true });

roomSchema.index({ status: 1, approvalStatus: 1, createdAt: -1 });
roomSchema.index({ hotelId: 1, createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);
