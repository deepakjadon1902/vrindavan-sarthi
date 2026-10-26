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

const GUEST_TOKEN_EXPIRY_DAYS = 30;

const calculateGuestAccessTokenExpiresAt = (dates = {}, now = new Date()) => {
  const checkOutTime = dates.checkOut ? new Date(dates.checkOut).getTime() : NaN;
  const checkInTime = dates.checkIn ? new Date(dates.checkIn).getTime() : NaN;
  const pickupDateTime = dates.pickupDate ? new Date(dates.pickupDate).getTime() : NaN;
  const createdAtTime = dates.createdAt ? new Date(dates.createdAt).getTime() : NaN;

  let baseTime = !isNaN(checkOutTime) ? checkOutTime
    : !isNaN(checkInTime) ? checkInTime
    : !isNaN(pickupDateTime) ? pickupDateTime
    : !isNaN(createdAtTime) ? createdAtTime
    : (now instanceof Date ? now.getTime() : new Date(now).getTime());

  if (isNaN(baseTime)) {
    baseTime = Date.now();
  }

  return new Date(baseTime + GUEST_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
};

const isGuestTokenExpired = (booking, now = new Date()) => {
  if (!booking) return true;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const expiresAt = booking.guestAccessTokenExpiresAt
    ? new Date(booking.guestAccessTokenExpiresAt)
    : calculateGuestAccessTokenExpiresAt(booking, booking.createdAt || now);

  const expiryTime = expiresAt.getTime();
  if (isNaN(expiryTime)) return false;
  return currentTime > expiryTime;
};

const samePhone = (a, b) =>
  String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '');

const buildGuestAccountReminder = ({ email, created }) => ({
  email,
  username: email,
  created: Boolean(created),
  message: 'Guest booking created. You can track this booking anytime using your secure booking link or confirmation email.',
});

const getGuestAccessTokenFromRequest = (req) =>
  String(
    req.body?.guestAccessToken ||
    req.query?.guestAccessToken ||
    req.query?.token ||
    req.get?.('x-guest-booking-token') ||
    req.get?.('x-guest-access-token') ||
    ''
  ).trim();

const resolveBookingCustomer = async ({ req, customerFullName, customerMobile, customerEmail, bookingDates = {} }) => {
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
  const guestAccessTokenExpiresAt = calculateGuestAccessTokenExpiresAt(bookingDates);
  return {
    user,
    isGuestBooking: true,
    guestAccessToken,
    guestAccessTokenHash: hashGuestAccessToken(guestAccessToken),
    guestAccessTokenExpiresAt,
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
  const booking = await Booking.findOne({
    _id: bookingId,
    isGuestBooking: true,
    guestAccessTokenHash: hashGuestAccessToken(token),
  });
  if (!booking) return null;
  if (isGuestTokenExpired(booking)) return null;
  return booking;
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
  GUEST_TOKEN_EXPIRY_DAYS,
  buildGuestAccountReminder,
  calculateGuestAccessTokenExpiresAt,
  findBookingForCustomerPayment,
  getGuestAccessTokenFromRequest,
  hashGuestAccessToken,
  isGuestTokenExpired,
  isValidEmail,
  isValidPhone,
  resolveBookingCustomer,
  withGuestAccountReminder,
  withGuestAccessToken,
};
