const mongoose = require('mongoose');

const cabFareSchema = new mongoose.Schema(
  {
    pickupLocation: { type: String, required: true, trim: true },
    dropLocation: { type: String, required: true, trim: true },
    cabType: { type: String, required: true, trim: true },
    baseFare: { type: Number, required: true, default: 0 },
    includedPersons: { type: Number, required: true, default: 1 },
    extraPersonCharge: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

cabFareSchema.index({ pickupLocation: 1, dropLocation: 1, cabType: 1 }, { unique: true });
cabFareSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CabFare', cabFareSchema);
