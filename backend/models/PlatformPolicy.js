const mongoose = require('mongoose');

const policyTierSchema = new mongoose.Schema({
  hoursBeforeCheckIn: { type: Number, required: true },
  refundPercent: { type: Number, required: true, min: 0, max: 100 },
  description: { type: String, default: '' },
}, { _id: false });

const policyHistorySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  tiers: [policyTierSchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String, default: '' },
  reason: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const platformPolicySchema = new mongoose.Schema({
  policyKey: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  tiers: [policyTierSchema],
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  history: [policyHistorySchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PlatformPolicy', platformPolicySchema);
