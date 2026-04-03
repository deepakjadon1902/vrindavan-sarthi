const mongoose = require('mongoose');

const cabSchema = new mongoose.Schema({
  vehicleName: { type: String, required: true },
  vehicleType: { type: String, required: true },
  capacity: { type: Number, required: true },
  driverName: { type: String, required: true },
  driverPhone: { type: String, required: true },
  routes: [String],
  image: String,
  status: { type: String, enum: ['available', 'on-trip', 'inactive'], default: 'available' },
}, { timestamps: true });

module.exports = mongoose.model('Cab', cabSchema);
