const mongoose = require('mongoose');

const propertyTermsSectionsSchema = new mongoose.Schema(
  {
    generalTerms: { type: String, default: '' },
    checkInRequirements: { type: String, default: '' },
    checkOutRules: { type: String, default: '' },
    cancellationPolicy: { type: String, default: '' },
    guestPolicies: { type: String, default: '' },
    idVerificationRequirements: { type: String, default: '' },
    ageRestrictions: { type: String, default: '' },
    propertyRules: { type: String, default: '' },
    additionalInstructions: { type: String, default: '' },
  },
  { _id: false }
);

const propertyTermsVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    sections: { type: propertyTermsSectionsSchema, default: () => ({}) },
    publishedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByRole: String,
  },
  { _id: false }
);

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  propertyType: { type: String, enum: ['hotel', 'dharamshala'], default: 'hotel' },
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
  hotelGstin: String,
  fullAddress: String,
  googleMapLink: { type: String, required: true },
  nearestTemple: { type: String, required: true },
  nearbyPlaces: String,
  policies: String,
  propertyTerms: {
    currentVersion: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    sections: { type: propertyTermsSectionsSchema, default: () => ({}) },
    publishedAt: { type: Date, default: Date.now },
    history: { type: [propertyTermsVersionSchema], default: [] },
  },
  taxEnabled: { type: Boolean, default: false },
  taxPercent: { type: Number, default: 12 },
  platform_commission_percentage: { type: Number, default: 10 },
  // Pets allowed at hotel level (room type / room unit can still restrict further)
  petsAllowed: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
  // Partner
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,
  partnerEmail: String,
  partnerPhone: String,
  businessName: String,
  partnerSubmitted: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminRemarks: String,
}, { timestamps: true });

// Support global lists (admin) that sort by createdAt without additional filters.
hotelSchema.index({ createdAt: -1 });
hotelSchema.index({ status: 1, approvalStatus: 1, createdAt: -1 });
hotelSchema.index({ location: 1, createdAt: -1 });
hotelSchema.index({ propertyType: 1, location: 1, createdAt: -1 });
hotelSchema.index({ partnerId: 1, createdAt: -1 });
hotelSchema.index({ partnerSubmitted: 1, createdAt: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);
