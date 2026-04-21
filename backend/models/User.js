const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: function () { return !this.googleId; } },
  password: { type: String, required: function () { return !this.googleId; }, select: false },
  address: {
    street: String,
    city: String,
    state: String,
    pin: String,
  },
  avatar: String,
  googleId: String,
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  role: { type: String, enum: ['user', 'admin', 'partner'], default: 'user' },
  // Partner fields
  businessName: String,
  gstNumber: String,
  businessType: String,
  businessAddress: String,
  businessPhone: String,
  businessEmail: String,
  businessDescription: String,
  partnerStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.password) return next();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
