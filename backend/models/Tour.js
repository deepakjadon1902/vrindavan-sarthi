const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema({
  name: { type: String, required: true },
  duration: { type: String, required: true },
  pricePerPerson: { type: Number, required: true },
  groupSize: { type: Number, default: 10 },
  image: String,
  description: String,
  itinerary: String,
  includes: [String],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Tour', tourSchema);
