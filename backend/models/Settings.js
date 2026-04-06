const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'VrindavanSarthi' },
  motto: { type: String, default: 'Your Divine Guide to Vrindavan' },
  logoUrl: { type: String, default: '' },
  upiId: { type: String, default: '' },
  upiName: { type: String, default: 'VrindavanSarthi' },
  adminPhone: { type: String, default: '' },
  adminEmail: { type: String, default: '' },
  termsOfService: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
