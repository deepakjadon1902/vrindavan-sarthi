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
  profileDisplayName: String,
  profileBio: String,
  profilePicture: String,
  partnerStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  partnerLocation: {
    lat: Number,
    lng: Number,
    address: String,
  },
  bankDetails: {
    account_holder_name: String,
    bank_name: String,
    account_number: String,
    ifsc_code: String,
    verified: { type: Boolean, default: true },
    updatedAt: Date,
  },
  payoutSettlement: {
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    paidByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  partnerDocuments: [
    {
      name: String,
      type: {
        type: String,
        enum: ['aadhar_card', 'gstin_registration', 'property_registry_document', 'other'],
        default: 'other',
      },
      url: String,
      mimeType: String,
      uploadedAt: Date,
    },
  ],

  // Password reset via email OTP
  passwordResetOtpHash: { type: String, select: false },
  passwordResetOtpExpiresAt: { type: Date, select: false },
  passwordResetOtpAttempts: { type: Number, default: 0, select: false },
  passwordResetOtpVerifiedAt: { type: Date, select: false },
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
