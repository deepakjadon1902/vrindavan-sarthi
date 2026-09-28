const crypto = require('crypto');
const Booking = require('../models/Booking');
const User = require('../models/User');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').trim();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const isValidPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

const generateGuestAccessToken = () => crypto.randomBytes(32).toString('base64url');
const hashGuestAccessToken = (token) =>
  crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');

const getGuestAccessTokenFromRequest = (req) =>
  String(req.body?.guestAccessToken || req.query?.guestAccessToken || req.get?.('x-guest-booking-token') || '').trim();

const resolveBookingCustomer = async ({ req, customerFullName, customerMobile, customerEmail }) => {
  if (req.user?._id) {
    return {
      user: req.user,
      isGuestBooking: false,
      guestAccessToken: '',
      guestAccessTokenHash: '',
    };
  }

  const name = String(customerFullName || '').trim();
  const email = normalizeEmail(customerEmail);
  const phone = normalizePhone(customerMobile);

  if (!name || !email || !phone) {
    const err = new Error('Name, mobile number and email are required for guest booking');
    err.statusCode = 400;
    throw err;
  }
  if (!isValidEmail(email)) {
    const err = new Error('Please enter a valid email address');
    err.statusCode = 400;
    throw err;
  }
  if (!isValidPhone(phone)) {
    const err = new Error('Please enter a valid mobile number');
    err.statusCode = 400;
    throw err;
  }

  let user = await User.findOne({ email }).select('-password');
  if (!user) {
    user = await User.create({
      name,
      email,
      phone,
      password: crypto.randomBytes(24).toString('base64url'),
      role: 'user',
      isGuest: true,
    });
  }

  const guestAccessToken = generateGuestAccessToken();
  return {
    user,
    isGuestBooking: true,
    guestAccessToken,
    guestAccessTokenHash: hashGuestAccessToken(guestAccessToken),
  };
};

const findBookingForCustomerPayment = async (req, bookingId) => {
  if (req.user?._id) {
    return Booking.findOne({ _id: bookingId, userId: req.user._id });
  }

  const token = getGuestAccessTokenFromRequest(req);
  if (!token) return null;
  return Booking.findOne({
    _id: bookingId,
    isGuestBooking: true,
    guestAccessTokenHash: hashGuestAccessToken(token),
  });
};

const withGuestAccessToken = (booking, guestAccessToken = '') => {
  const plain = typeof booking?.toObject === 'function' ? booking.toObject() : { ...(booking || {}) };
  if (guestAccessToken) plain.guestAccessToken = guestAccessToken;
  return plain;
};

module.exports = {
  findBookingForCustomerPayment,
  hashGuestAccessToken,
  isValidEmail,
  isValidPhone,
  resolveBookingCustomer,
  withGuestAccessToken,
};
