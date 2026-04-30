const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'Vrindavan Sarthi' },
  motto: { type: String, default: 'Your Divine Guide to Vrindavan' },
  logoUrl: { type: String, default: '' },
  faviconUrl: { type: String, default: '' },
  metaTitle: { type: String, default: 'Vrindavan Sarthi' },
  metaDescription: { type: String, default: 'Your Divine Guide to Vrindavan' },
  metaKeywords: { type: String, default: 'Vrindavan, hotels, rooms, cabs, tours, bookings, shop' },
  ogImageUrl: { type: String, default: '' },
  upiId: { type: String, default: '' },
  upiName: { type: String, default: 'Vrindavan Sarthi' },
  adminPhone: { type: String, default: '' },
  adminEmail: { type: String, default: '' },
  termsOfService: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
