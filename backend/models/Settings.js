const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'Vrindavan Sarthi Enterprises' },
  motto: { type: String, default: 'Your Divine Guide to Vrindavan' },
  logoUrl: { type: String, default: '' },
  faviconUrl: { type: String, default: '' },
  metaTitle: { type: String, default: 'Vrindavan Sarthi Enterprises' },
  metaDescription: { type: String, default: 'Your Divine Guide to Vrindavan' },
  metaKeywords: { type: String, default: 'Vrindavan, hotels, rooms, cabs, tours, bookings, shop' },
  ogImageUrl: { type: String, default: '' },
  upiId: { type: String, default: '' },
  upiName: { type: String, default: 'Vrindavan Sarthi Enterprises' },
  adminPhone: { type: String, default: '+91 8218303066' },
  adminEmail: { type: String, default: 'vrindavansarthi108@gmail.com' },
  termsOfService: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
  hotelTaxPercent: { type: Number, default: 12 },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);


