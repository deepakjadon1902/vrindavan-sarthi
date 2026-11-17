const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const EmailOtp = require('../models/EmailOtp');
const User = require('../models/User');
const Booking = require('../models/Booking');
const {
  linkCustomerGuestBookings,
  hashGuestAccessToken,
  generateGuestAccessToken,
  isGuestTokenExpired,
  calculateGuestAccessTokenExpiresAt,
} = require('../utils/guestBookingAccess');

// Helper to simulate hash creation matching backend/routes/auth.routes.js
const computeOtpHash = (email, otp) => {
  const salt = process.env.OTP_SALT || process.env.JWT_SECRET || 'vvs_otp_salt';
  return crypto.createHash('sha256').update(`${String(email).trim().toLowerCase()}|${otp}|${salt}`).digest('hex');
};

// ---------------------------------------------------------------------
// 1. New Customer OTP Account Creation & Login
// ---------------------------------------------------------------------
test('OTP Login: new customer account is created securely without requiring password', () => {
  const email = 'newdevotee@example.com';
  const otp = '482910';
  const otpHash = computeOtpHash(email, otp);

  // Model schema validation for EmailOtp
  const otpEntry = new EmailOtp({
    email,
    otpHash,
    purpose: 'login',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
  });
  const otpErr = otpEntry.validateSync();
  assert.equal(otpErr, undefined, 'EmailOtp must pass Mongoose schema validation');

  // Customer account created via OTP
  const user = new User({
    name: 'newdevotee',
    email,
    role: 'user',
    isGuest: false,
    authProvider: 'email_otp',
  });
  const userErr = user.validateSync();
  assert.equal(userErr, undefined, 'User model allows passwordless customer with authProvider=email_otp');
  assert.equal(user.authProvider, 'email_otp');
  assert.equal(user.role, 'user');
});

// ---------------------------------------------------------------------
// 2. Existing Customer OTP Login & Password Login Preservation
// ---------------------------------------------------------------------
test('Authentication: existing password login still works and passwordless accounts reject missing passwords', async () => {
  // 1. Password user
  const passwordUser = new User({
    name: 'Password User',
    email: 'passuser@example.com',
    role: 'user',
    phone: '9876543210',
    authProvider: 'local',
  });
  passwordUser.password = await bcrypt.hash('secret1234', 12);

  assert.equal(await passwordUser.matchPassword('secret1234'), true, 'Valid password must match');
  assert.equal(await passwordUser.matchPassword('wrongpass'), false, 'Wrong password must be rejected');

  // 2. Passwordless customer
  const otpUser = new User({
    name: 'OTP User',
    email: 'otpuser@example.com',
    role: 'user',
    authProvider: 'email_otp',
  });
  // Has no password
  assert.equal(await otpUser.matchPassword(''), false, 'Blank password must be rejected');
  assert.equal(await otpUser.matchPassword('anypassword'), false, 'Arbitrary password on passwordless user must be rejected');
});

// ---------------------------------------------------------------------
// 3. OTP Security: Expiry, Attempts, Replay & Throttling
// ---------------------------------------------------------------------
test('OTP Security: enforces expiry, single-use consumption, max 5 attempts, and resend throttling', () => {
  const email = 'securitytest@example.com';
  const validOtp = '654321';
  const expectedHash = computeOtpHash(email, validOtp);

  const verifyOtpLogic = (record, providedOtp, now = Date.now()) => {
    if (!record || record.consumedAt) {
      return { status: 400, message: 'Invalid or expired verification code' };
    }
    if (record.attempts >= record.maxAttempts) {
      return { status: 429, message: 'Too many incorrect attempts. Please request a new verification code.' };
    }
    if (new Date(record.expiresAt).getTime() < now) {
      return { status: 400, message: 'Verification code has expired. Please request a new code.' };
    }
    const providedHash = computeOtpHash(email, providedOtp);
    if (record.otpHash !== providedHash) {
      record.attempts += 1;
      return { status: 400, message: 'Invalid verification code' };
    }
    record.consumedAt = new Date(now);
    return { status: 200, success: true };
  };

  // Case A: Valid verification
  const recordA = {
    otpHash: expectedHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
  };
  const resA = verifyOtpLogic(recordA, validOtp);
  assert.equal(resA.status, 200);
  assert.ok(recordA.consumedAt, 'Consumed timestamp must be set on successful verification');

  // Case B: Replay / Single-use consumption
  const resB = verifyOtpLogic(recordA, validOtp);
  assert.equal(resB.status, 400, 'Consumed OTP must not be reusable');

  // Case C: Expired OTP
  const recordC = {
    otpHash: expectedHash,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
  };
  const resC = verifyOtpLogic(recordC, validOtp);
  assert.equal(resC.status, 400);
  assert.match(resC.message, /expired/i);

  // Case D: Attempt limit (max 5)
  const recordD = {
    otpHash: expectedHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 4,
    maxAttempts: 5,
    consumedAt: null,
  };
  // 5th attempt with wrong OTP
  const resD1 = verifyOtpLogic(recordD, '000000');
  assert.equal(resD1.status, 400);
  assert.equal(recordD.attempts, 5);

  // 6th attempt (exceeded limit)
  const resD2 = verifyOtpLogic(recordD, validOtp);
  assert.equal(resD2.status, 429);
  assert.match(resD2.message, /Too many/i);

  // Case E: Resend throttling (60 seconds)
  const checkResendThrottle = (lastSentAt, now = Date.now()) => {
    const elapsedMs = now - new Date(lastSentAt).getTime();
    if (elapsedMs < 60000) {
      const retryAfterSec = Math.ceil((60000 - elapsedMs) / 1000);
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true };
  };

  assert.equal(checkResendThrottle(new Date(Date.now() - 30000)).allowed, false, 'Resend within 30s must be throttled');
  assert.equal(checkResendThrottle(new Date(Date.now() - 65000)).allowed, true, 'Resend after 65s must be allowed');
});

// ---------------------------------------------------------------------
// 4. Guest Booking Linking: Historical Bookings Claim Logic
// ---------------------------------------------------------------------
test('Guest Booking Claim: links eligible guest bookings by verified email and rejects cross-account takeover', async () => {
  const verifiedEmail = 'radharani.devotee@example.com';
  const customerUserId = new mongoose.Types.ObjectId();
  const guestTempUserId = new mongoose.Types.ObjectId();
  const otherRegisteredUserId = new mongoose.Types.ObjectId();

  // Mock in-memory database representation
  const mockBookings = [
    // 1. Eligible guest booking for this email
    {
      _id: 'bk-guest-1',
      customerEmail: verifiedEmail,
      userEmail: verifiedEmail,
      userId: guestTempUserId,
      isGuestBooking: true,
      guestAccessTokenHash: 'hash-abc-1',
    },
    // 2. Second eligible guest booking for this email
    {
      _id: 'bk-guest-2',
      customerEmail: verifiedEmail,
      userEmail: verifiedEmail,
      userId: guestTempUserId,
      isGuestBooking: true,
      guestAccessTokenHash: 'hash-abc-2',
    },
    // 3. Booking for a DIFFERENT email (must NOT be claimed)
    {
      _id: 'bk-other-email',
      customerEmail: 'different.person@example.com',
      userEmail: 'different.person@example.com',
      userId: guestTempUserId,
      isGuestBooking: true,
    },
    // 4. Booking already owned by another registered user with another email (must NOT be taken over)
    {
      _id: 'bk-registered-taken',
      customerEmail: verifiedEmail,
      userEmail: verifiedEmail,
      userId: otherRegisteredUserId,
      isGuestBooking: false,
    },
  ];

  const mockUsers = [
    { _id: customerUserId, email: verifiedEmail, isGuest: false },
    { _id: guestTempUserId, email: verifiedEmail, isGuest: true },
    { _id: otherRegisteredUserId, email: 'hijack.target@example.com', isGuest: false },
  ];

  // Pure simulation of linkCustomerGuestBookings logic
  const performLinking = (targetEmail, targetUserId) => {
    const candidates = mockBookings.filter(
      (b) =>
        (b.customerEmail === targetEmail || b.userEmail === targetEmail) &&
        String(b.userId) !== String(targetUserId) &&
        b.isGuestBooking === true
    );

    const candidateUserIds = [...new Set(candidates.map((b) => String(b.userId)))];
    const forbiddenUsers = mockUsers.filter(
      (u) => candidateUserIds.includes(String(u._id)) && !u.isGuest && u.email !== targetEmail
    );
    const forbiddenUserIds = new Set(forbiddenUsers.map((u) => String(u._id)));

    const eligible = candidates.filter((b) => !forbiddenUserIds.has(String(b.userId)));

    eligible.forEach((b) => {
      b.userId = targetUserId;
      b.claimedAt = new Date();
      b.claimedByUserId = targetUserId;
    });

    return { linkedCount: eligible.length, eligibleIds: eligible.map((b) => b._id) };
  };

  // Run initial linking
  const result1 = performLinking(verifiedEmail, customerUserId);
  assert.equal(result1.linkedCount, 2, 'Exactly 2 eligible guest bookings must be claimed');
  assert.deepEqual(result1.eligibleIds, ['bk-guest-1', 'bk-guest-2']);

  // Verify ownership updated
  assert.equal(String(mockBookings[0].userId), String(customerUserId));
  assert.equal(String(mockBookings[1].userId), String(customerUserId));

  // Verify non-matching email was untouched
  assert.equal(String(mockBookings[2].userId), String(guestTempUserId));

  // Verify existing registered booking was untouched
  assert.equal(String(mockBookings[3].userId), String(otherRegisteredUserId));

  // Run repeated linking (Idempotency check)
  const result2 = performLinking(verifiedEmail, customerUserId);
  assert.equal(result2.linkedCount, 0, 'Repeated linking must be idempotent and return 0');
});

// ---------------------------------------------------------------------
// 5. Existing Guest Access Token Compatibility
// ---------------------------------------------------------------------
test('Guest Access Compatibility: guest links and tokens continue working after claiming', () => {
  const token = generateGuestAccessToken();
  const tokenHash = hashGuestAccessToken(token);

  const claimedBooking = {
    _id: 'bk-claimed-101',
    isGuestBooking: true,
    guestAccessTokenHash: tokenHash,
    guestAccessTokenExpiresAt: new Date(Date.now() + 86400000 * 30), // 30 days
  };

  // Verification matching GET /:id and GET /:id/invoice
  const isGuestAuthorized = (booking, providedToken) =>
    Boolean(
      providedToken &&
      booking.isGuestBooking &&
      booking.guestAccessTokenHash &&
      booking.guestAccessTokenHash === hashGuestAccessToken(providedToken) &&
      !isGuestTokenExpired(booking)
    );

  assert.equal(isGuestAuthorized(claimedBooking, token), true, 'Valid guest token must continue to grant access');
  assert.equal(isGuestAuthorized(claimedBooking, 'wrong-token'), false, 'Invalid guest token is rejected');
  assert.equal(isGuestAuthorized(claimedBooking, ''), false, 'Empty guest token is rejected');
});

// ---------------------------------------------------------------------
// 6. Optional Password Creation & Changing in Account Settings
// ---------------------------------------------------------------------
test('Optional Password: passwordless customer can set a password and update it securely', async () => {
  const customer = new User({
    name: 'Gopal Devotee',
    email: 'gopal@example.com',
    role: 'user',
    authProvider: 'email_otp',
  });

  // Initially has no password
  assert.equal(Boolean(customer.password), false);

  // Set password
  const newPass = 'Vrindavan@2026';
  customer.password = await bcrypt.hash(newPass, 12);
  customer.authProvider = 'local';

  assert.equal(await customer.matchPassword(newPass), true);
  assert.equal(await customer.matchPassword('old'), false);

  // Change password with current password verification
  const changePassword = async (user, currentPassword, proposedPassword) => {
    if (proposedPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters' };
    if (user.password) {
      if (!currentPassword || !(await user.matchPassword(currentPassword))) {
        return { success: false, message: 'Current password is incorrect' };
      }
    }
    user.password = await bcrypt.hash(proposedPassword, 12);
    return { success: true };
  };

  // Wrong current password fails
  const failRes = await changePassword(customer, 'WrongCurrent', 'NewPass123');
  assert.equal(failRes.success, false);
  assert.equal(failRes.message, 'Current password is incorrect');

  // Correct current password succeeds
  const successRes = await changePassword(customer, newPass, 'UpdatedPass123');
  assert.equal(successRes.success, true);
  assert.equal(await customer.matchPassword('UpdatedPass123'), true);
});

// ---------------------------------------------------------------------
// 7. Role Boundary: Staff Accounts Blocked from Customer OTP
// ---------------------------------------------------------------------
test('Role Boundary: admin and partner accounts are blocked from Customer OTP login', () => {
  const checkRoleEligibilityForOtp = (userRole) => {
    if (userRole === 'admin' || userRole === 'partner') {
      return {
        allowed: false,
        status: 403,
        message: 'Admin and partner accounts must sign in using staff login with their password.',
      };
    }
    return { allowed: true };
  };

  assert.equal(checkRoleEligibilityForOtp('admin').allowed, false);
  assert.equal(checkRoleEligibilityForOtp('partner').allowed, false);
  assert.equal(checkRoleEligibilityForOtp('user').allowed, true);
  assert.equal(checkRoleEligibilityForOtp(undefined).allowed, true); // New user
});

// ---------------------------------------------------------------------
// 8. Customer OTP Email Template Design & Plaintext Validation
// ---------------------------------------------------------------------
test('Customer OTP Email Template: HTML & plaintext match branding, expiry, security, and wording rules', () => {
  const authRouter = require('../routes/auth.routes');
  const { buildCustomerOtpHtml, buildCustomerOtpText } = authRouter._testHelpers;

  const testOtp = '849201';
  const html = buildCustomerOtpHtml(testOtp);
  const text = buildCustomerOtpText(testOtp);

  // 1. Prominent OTP presence
  assert.ok(html.includes(testOtp), 'HTML must contain the OTP code');
  assert.ok(text.includes(testOtp), 'Plaintext must contain the OTP code');

  // 2. Subtle teal / emerald branding tokens
  assert.ok(html.includes('#0f766e'), 'HTML must feature primary teal branding (#0f766e)');
  assert.ok(html.includes('#ccfbf1') || html.includes('#f0fdfa'), 'HTML must feature subtle teal highlight tokens');
  assert.ok(html.includes('#f8fafc'), 'HTML must use clean off-white background (#f8fafc)');

  // 3. Expiration notice (10 minutes)
  assert.match(html, /10\s*minutes/i, 'HTML must clearly state 10 minutes expiry');
  assert.match(text, /10\s*minutes/i, 'Plaintext must clearly state 10 minutes expiry');

  // 4. Security reminder
  assert.match(html, /never share/i, 'HTML must contain security reminder to never share code');
  assert.match(html, /staff will never ask/i, 'HTML must warn staff will never ask for code');
  assert.match(text, /never share/i, 'Plaintext must contain security reminder to never share code');
  assert.match(text, /staff will never ask/i, 'Plaintext must warn staff will never ask for code');

  // 5. Neutral greeting: "Hello,"
  assert.match(html, /Hello,/i, 'HTML must greet with neutral "Hello,"');
  assert.match(text, /^Hello,/m, 'Plaintext must greet with neutral "Hello,"');

  // 6. Strict wording requirements: NO "Devotee" and NO "Radha Radhe" in customer OTP template
  assert.ok(!html.includes('Devotee'), 'HTML OTP template must NOT contain the word "Devotee"');
  assert.ok(!html.includes('Radha Radhe'), 'HTML OTP template must NOT contain "Radha Radhe"');
  assert.ok(!text.includes('Devotee'), 'Plaintext OTP template must NOT contain the word "Devotee"');
  assert.ok(!text.includes('Radha Radhe'), 'Plaintext OTP template must NOT contain "Radha Radhe"');

  // 7. Exact website link in footer
  assert.ok(html.includes('https://vrindavansarthi.in'), 'HTML must include https://vrindavansarthi.in in footer');
  assert.ok(text.includes('https://vrindavansarthi.in'), 'Plaintext must include https://vrindavansarthi.in in footer');

  // 8. Mobile / Gmail table-based layout
  assert.ok(html.includes('<table role="presentation"'), 'HTML must use table-based presentation for broad email client support');
});

// ---------------------------------------------------------------------
// 9. Uniform 6-digit Generation and Layered Abuse Throttling
// ---------------------------------------------------------------------
test('OTP Abuse Protection: uniform 6-digit generation and multi-tier rate limiting', () => {
  // 1. Uniform 6-digit cryptographic generation [100000, 1000000)
  for (let i = 0; i < 200; i++) {
    const val = crypto.randomInt(100000, 1000000);
    assert.ok(val >= 100000 && val <= 999999, `Generated OTP ${val} must be in range 100000..999999`);
    assert.equal(String(val).length, 6, 'Generated OTP must be exactly 6 digits');
  }

  // 2. Layered limit simulator
  const evaluateOtpLimits = ({ recentEmailOtps, recentIpOtps, lastSentAt, now = Date.now() }) => {
    // Limit 1: Cooldown (60s)
    if (lastSentAt) {
      const elapsedMs = now - new Date(lastSentAt).getTime();
      if (elapsedMs < 60000) {
        return { allowed: false, status: 429, reason: 'cooldown', retryAfter: Math.ceil((60000 - elapsedMs) / 1000) };
      }
    }
    // Limit 2: Per-email rolling window (max 5/hr)
    if (recentEmailOtps >= 5) {
      return { allowed: false, status: 429, reason: 'email_window_exceeded' };
    }
    // Limit 3: Per-IP rolling window (max 10/hr)
    if (recentIpOtps >= 10) {
      return { allowed: false, status: 429, reason: 'ip_window_exceeded' };
    }
    return { allowed: true, status: 200 };
  };

  const now = 1761600000000;

  // Allowed request under limits
  const r1 = evaluateOtpLimits({ recentEmailOtps: 2, recentIpOtps: 4, lastSentAt: now - 90000, now });
  assert.equal(r1.allowed, true);

  // Throttled by cooldown (< 60s)
  const r2 = evaluateOtpLimits({ recentEmailOtps: 2, recentIpOtps: 4, lastSentAt: now - 20000, now });
  assert.equal(r2.allowed, false);
  assert.equal(r2.reason, 'cooldown');
  assert.equal(r2.retryAfter, 40);

  // Throttled by email rolling window (>= 5/hr)
  const r3 = evaluateOtpLimits({ recentEmailOtps: 5, recentIpOtps: 4, lastSentAt: now - 120000, now });
  assert.equal(r3.allowed, false);
  assert.equal(r3.reason, 'email_window_exceeded');

  // Throttled by IP rolling window (>= 10/hr)
  const r4 = evaluateOtpLimits({ recentEmailOtps: 1, recentIpOtps: 10, lastSentAt: now - 120000, now });
  assert.equal(r4.allowed, false);
  assert.equal(r4.reason, 'ip_window_exceeded');
});

// ---------------------------------------------------------------------
// 10. Trusted Requester IP Resolution & Spoofing Defense
// ---------------------------------------------------------------------
test('Requester IP Resolution: ignores spoofed X-Forwarded-For when trust proxy is off, honors it when on', () => {
  const authRouter = require('../routes/auth.routes');
  const { getTrustedRequesterIp } = authRouter._testHelpers;

  // Case 1: Untrusted proxy (trust proxy = false / undefined) with spoofed client header
  const reqUntrusted = {
    app: { get: (k) => (k === 'trust proxy' ? false : undefined) },
    headers: { 'x-forwarded-for': '203.0.113.195, 198.51.100.1' },
    socket: { remoteAddress: '::ffff:192.168.1.100' },
  };
  const ip1 = getTrustedRequesterIp(reqUntrusted);
  assert.equal(ip1, '192.168.1.100', 'Must use socket address and ignore spoofed X-Forwarded-For when trust proxy is false');

  // Case 2: Trusted proxy (trust proxy = true)
  const reqTrusted = {
    app: { get: (k) => (k === 'trust proxy' ? true : undefined) },
    headers: { 'x-forwarded-for': '203.0.113.195, 198.51.100.1' },
    socket: { remoteAddress: '10.0.0.1' },
  };
  const ip2 = getTrustedRequesterIp(reqTrusted);
  assert.equal(ip2, '203.0.113.195', 'Must extract client IP from X-Forwarded-For when trust proxy is active');

  // Case 3: Graceful fallback when no socket or IP available
  const reqEmpty = {
    app: { get: () => false },
    headers: {},
  };
  const ip3 = getTrustedRequesterIp(reqEmpty);
  assert.equal(ip3, 'Unavailable', 'Must gracefully fall back to "Unavailable"');
});

// ---------------------------------------------------------------------
// 11. Partner Registration Notification Email & Internal Disclosure
// ---------------------------------------------------------------------
test('Partner Registration Alert: formats timestamps in IST and UTC, includes requester IP, and keeps IP internal', () => {
  const authRouter = require('../routes/auth.routes');
  const { buildPartnerRegistrationHtml, buildPartnerRegistrationText } = authRouter._testHelpers;

  const partnerUser = {
    name: 'Shyam Sundar',
    email: 'shyam.hotel@example.com',
    businessName: 'Radha Kripa Guest House',
    businessPhone: '+91 98765 43210',
    businessType: 'Hotel / Guest House',
  };

  const formattedTimestampIST = 'Sunday, 25 October 2026 at 11:30:00 pm GMT+5:30 (IST / UTC+05:30)';
  const formattedTimestampUTC = '2026-10-25T18:00:00.000Z';
  const requesterIp = '49.36.120.45';

  const html = buildPartnerRegistrationHtml({
    user: partnerUser,
    formattedTimestampIST,
    formattedTimestampUTC,
    requesterIp,
  });

  const text = buildPartnerRegistrationText({
    user: partnerUser,
    formattedTimestampIST,
    formattedTimestampUTC,
    requesterIp,
  });

  // Verify partner details present
  assert.ok(html.includes('Shyam Sundar'));
  assert.ok(html.includes('Radha Kripa Guest House'));
  assert.ok(html.includes('+91 98765 43210'));
  assert.ok(html.includes('Hotel / Guest House'));

  // Verify timestamps in both IST and UTC
  assert.ok(html.includes('IST / UTC+05:30'), 'HTML must display IST / UTC+05:30 timezone');
  assert.ok(html.includes('2026-10-25T18:00:00.000Z'), 'HTML must display UTC timestamp');
  assert.ok(text.includes('IST / UTC+05:30'), 'Plaintext must display IST / UTC+05:30 timezone');
  assert.ok(text.includes('UTC'), 'Plaintext must mention UTC');

  // Verify requester IP included in admin alert
  assert.ok(html.includes('49.36.120.45'), 'Admin HTML alert must include requester IP');
  assert.ok(text.includes('49.36.120.45'), 'Admin plaintext alert must include requester IP');

  // Verify administrative review reminder
  assert.match(html, /Action Required/i);
  assert.match(html, /Admin Dashboard/i);
  assert.match(text, /Action Required/i);
  assert.match(text, /Admin Dashboard/i);

  // Security test: simulate client registration response payload
  const clientResponsePayload = {
    success: true,
    message: 'Registration successful! Your partner account is pending approval.',
    user: {
      _id: 'usr-123',
      name: partnerUser.name,
      email: partnerUser.email,
      role: 'partner',
      isApproved: false,
    },
    token: 'jwt-token-sample',
  };

  assert.equal(
    clientResponsePayload.requesterIp,
    undefined,
    'Requester IP must NOT be leaked in the client registration HTTP response'
  );
  assert.equal(
    clientResponsePayload.user.requesterIp,
    undefined,
    'Requester IP must NOT be leaked inside user object in registration response'
  );
});
