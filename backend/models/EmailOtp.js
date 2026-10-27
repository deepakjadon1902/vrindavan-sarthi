const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['login', 'password_reset'],
      default: 'login',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto-expire documents after 2 hours
emailOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });
emailOtpSchema.index({ email: 1, purpose: 1, consumedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('EmailOtp', emailOtpSchema);
