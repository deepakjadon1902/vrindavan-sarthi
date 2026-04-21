const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  images: [{ type: String }],
  inStock: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ inStock: 1, createdAt: -1 });
productSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
