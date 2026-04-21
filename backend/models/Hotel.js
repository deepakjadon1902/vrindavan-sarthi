const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
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

module.exports = mongoose.model('Hotel', hotelSchema);
