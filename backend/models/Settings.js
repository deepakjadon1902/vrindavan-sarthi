const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'Vrindavan Sarthi' },
  motto: { type: String, default: 'Your Divine Guide to Braj' },
  logoUrl: { type: String, default: '' },
  faviconUrl: { type: String, default: '' },
  metaTitle: { type: String, default: 'Vrindavan Sarthi' },
  metaDescription: { type: String, default: 'Your Divine Guide to Braj' },
  metaKeywords: { type: String, default: 'Braj, Vrindavan, Mathura, Govardhan, Barsana, Gokul, hotels, rooms, cabs, tours, bookings, shop' },
  ogImageUrl: { type: String, default: '' },
  upiId: { type: String, default: '' },
  upiName: { type: String, default: 'Vrindavan Sarthi' },
  adminPhone: { type: String, default: '8679820256' },
  adminEmail: { type: String, default: 'vrindavansarthi108@gmail.com' },
  termsOfService: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
  hotelTaxPercent: { type: Number, default: 12 },
  shopEnabled: { type: Boolean, default: true },
  trackOrderEnabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
