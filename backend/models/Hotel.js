const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
  rating: { type: Number, default: 0 },
  image: String,
  images: [String],
  description: String,
  amenities: [String],
  totalRooms: Number,
  contactPhone: String,
  contactEmail: String,
  address: String,
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
