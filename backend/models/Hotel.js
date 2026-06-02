const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  // Deprecated: pricing is handled at RoomType level. Kept for backward compatibility.
  pricePerNight: { type: Number, default: 0 },
  pricePerBed: { type: Number, default: 0 },
  priceDoubleAC: { type: Number, default: 0 },
  priceDoubleNonAC: { type: Number, default: 0 },
  priceSingleAC: { type: Number, default: 0 },
  priceSingleNonAC: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  image: String,
  images: [String],
  description: String,
  amenities: [String],
  totalRooms: Number,
  checkInTime: { type: String, default: '12:00' },
  checkOutTime: { type: String, default: '11:00' },
  contactPhone: String,
  contactEmail: String,
  fullAddress: String,
  nearbyPlaces: String,
  policies: String,
  taxEnabled: { type: Boolean, default: false },
  taxPercent: { type: Number, default: 12 },
  // Pets allowed at hotel level (room type / room unit can still restrict further)
  petsAllowed: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
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

// Support global lists (admin) that sort by createdAt without additional filters.
hotelSchema.index({ createdAt: -1 });
hotelSchema.index({ status: 1, approvalStatus: 1, createdAt: -1 });
hotelSchema.index({ location: 1, createdAt: -1 });
hotelSchema.index({ partnerId: 1, createdAt: -1 });
hotelSchema.index({ partnerSubmitted: 1, createdAt: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);
