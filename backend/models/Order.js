const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  trackingId: { type: String, unique: true, index: true, sparse: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: String,
  productImage: String,
  productPrice: Number,
  quantity: { type: Number, default: 1 },
  totalAmount: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  userPhone: String,
  shippingAddress: String,
  orderNotes: String,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  orderStatus: { type: String, enum: ['pending', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  upiTransactionId: String,
}, { timestamps: true });

const generate5DigitTrackingId = () => String(Math.floor(10000 + Math.random() * 90000));

orderSchema.pre('save', function (next) {
  if (!this.orderId) {
    this.orderId = `ORD-${Date.now()}`;
  }
  next();
});

orderSchema.pre('validate', async function () {
  if (this.trackingId) return;

  // Keep it strictly 5 digits and unique.
  // NOTE: 5 digits = 90k possibilities; we guard against collisions with an exists() check.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generate5DigitTrackingId();
    // this.constructor points to the Order model for this document.
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.constructor.exists({ trackingId: candidate });
    if (!exists) {
      this.trackingId = candidate;
      return;
    }
  }

  throw new Error('Failed to generate unique tracking id. Please try again.');
});

module.exports = mongoose.model('Order', orderSchema);
