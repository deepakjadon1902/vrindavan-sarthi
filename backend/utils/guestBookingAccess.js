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

const samePhone = (a, b) =>
  String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '');

const buildGuestAccountReminder = ({ email, created }) => ({
  email,
  username: email,
  created: Boolean(created),
  message: 'Guest booking created. You can track this booking anytime using your secure booking link or confirmation email.',
});

const getGuestAccessTokenFromRequest = (req) =>
  String(req.body?.guestAccessToken || req.query?.guestAccessToken || req.query?.token || req.get?.('x-guest-booking-token') || '').trim();

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

  let guestAccountCreated = false;
  let guestAccountReminder = null;
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    // Generate an unguessable cryptographic random password for guest user record (SEC-01)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    user = await User.create({
      name,
      email,
      phone,
      password: randomPassword,
      role: 'user',
      isGuest: true,
    });
    guestAccountCreated = true;
    guestAccountReminder = buildGuestAccountReminder({ email, created: true });
  } else if (user.isGuest) {
    if (user.phone && !samePhone(user.phone, phone)) {
      const err = new Error('This email is already linked to another guest mobile number. Please login or use the same mobile number.');
      err.statusCode = 409;
      throw err;
    }
    user.name = user.name || name;
    user.phone = user.phone || phone;
    // SEC-01 Remediation: Never overwrite user.password with phone.
    // Ensure any legacy guest account is migrated to an unguessable password string.
    user.password = crypto.randomBytes(32).toString('hex');
    await user.save();
    guestAccountReminder = buildGuestAccountReminder({ email, created: false });
  } else {
    // Registered account (isGuest: false)
    // To protect registered accounts from unauthorized guest checkout hijacking:
    const err = new Error('An account with this email already exists. Please login to complete your booking.');
    err.statusCode = 409;
    throw err;
  }

  const guestAccessToken = generateGuestAccessToken();
  return {
    user,
    isGuestBooking: true,
    guestAccessToken,
    guestAccessTokenHash: hashGuestAccessToken(guestAccessToken),
    guestAccountCreated,
    guestAccountReminder,
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

const withGuestAccountReminder = (booking, reminder = null) => {
  const plain = typeof booking?.toObject === 'function' ? booking.toObject() : { ...(booking || {}) };
  if (reminder) plain.guestAccount = reminder;
  return plain;
};

module.exports = {
  buildGuestAccountReminder,
  findBookingForCustomerPayment,
  getGuestAccessTokenFromRequest,
  hashGuestAccessToken,
  isValidEmail,
  isValidPhone,
  resolveBookingCustomer,
  withGuestAccountReminder,
  withGuestAccessToken,
};
