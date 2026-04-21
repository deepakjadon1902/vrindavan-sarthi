const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema({
  name: { type: String, required: true },
  duration: { type: String, required: true },
  pricePerPerson: { type: Number, required: true },
  groupSize: { type: Number, default: 10 },
  startPoint: String,
  endPoint: String,
  image: String,
  images: [String],
  description: String,
  itinerary: String,
  includes: [String],
  excludes: [String],
  highlights: [String],
  contactPhone: String,
  contactEmail: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,
  partnerEmail: String,
  partnerPhone: String,
  businessName: String,
  partnerSubmitted: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  adminRemarks: String,
}, { timestamps: true });

tourSchema.index({ status: 1, approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Tour', tourSchema);
