const mongoose = require('mongoose');

const cabSchema = new mongoose.Schema({
  vehicleName: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleNumber: String,
  capacity: { type: Number, required: true },
  driverName: { type: String, required: true },
  driverPhone: { type: String, required: true },
  driverLicense: String,
  routes: [String],
  pricePerKm: Number,
  basePrice: Number,
  image: String,
  images: [String],
  description: String,
  features: [String],
  status: { type: String, enum: ['available', 'on-trip', 'inactive'], default: 'available' },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,
  partnerEmail: String,
  partnerPhone: String,
  businessName: String,
  partnerSubmitted: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  adminRemarks: String,
}, { timestamps: true });

module.exports = mongoose.model('Cab', cabSchema);
