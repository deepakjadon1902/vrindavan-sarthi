const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { maybeUploadImageArray } = require('../utils/imageFields');
const router = express.Router();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    const err = new Error(`Missing required env: ${key}`);
    err.statusCode = 500;
    throw err;
  }
  return value;
};

const canSendEmail = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const getMissingSmtpKeys = () => {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  return keys.filter((k) => !String(process.env[k] || '').trim());
};

const buildMailer = () => {
  const host = requireEnv('SMTP_HOST');
  const port = Number(requireEnv('SMTP_PORT'));
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Fail fast instead of hanging when SMTP is blocked by hosting/network.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
};

const hashOtp = (email, otp) => {
  const salt = process.env.PASSWORD_RESET_OTP_SALT || process.env.JWT_SECRET || 'vvs_otp_salt';
  return crypto.createHash('sha256').update(`${normalizeEmail(email)}|${otp}|${salt}`).digest('hex');
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const canSendResend = () => Boolean(String(process.env.RESEND_API_KEY || '').trim());

const postJson = (urlString, { headers = {}, body, timeoutMs = 15_000 } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body ?? {}));
    req.end();
  });

const resendSendEmail = async ({ apiKey, from, to, subject, text }) => {
  const fromLower = String(from || '').trim().toLowerCase();
  if (!fromLower) {
    const err = new Error('Missing RESEND_FROM (or SMTP_FROM/SMTP_USER)');
    err.code = 'RESEND_FROM_MISSING';
    throw err;
  }

  // Resend requires a verified sender. Personal inbox domains typically won't work.
  const fromDomain = fromLower.includes('@') ? fromLower.split('@').pop() : '';
  if (fromDomain === 'gmail.com' || fromDomain === 'yahoo.com' || fromDomain === 'outlook.com' || fromDomain === 'hotmail.com') {
    const err = new Error(
      `RESEND_FROM must be a verified sender (usually your domain), not a personal inbox like ${fromDomain}.`
    );
    err.code = 'RESEND_FROM_NOT_VERIFIED';
    throw err;
  }

  const resp = await postJson('https://api.resend.com/emails', {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { from, to: [to], subject, text },
    timeoutMs: 15_000,
  });

  if (resp.status >= 200 && resp.status < 300) return;

  // Resend returns JSON errors; keep a short excerpt for logs and a safer message for clients.
  let resendMessage = '';
  try {
    const parsed = JSON.parse(resp.body || '{}');
    resendMessage = String(parsed?.message || parsed?.error || '').trim();
  } catch {
    // ignore
  }

  const err = new Error(`Resend send failed: HTTP ${resp.status}${resendMessage ? ` - ${resendMessage}` : ''}`);
  err.code = 'RESEND_SEND_FAILED';
  err.httpStatus = resp.status;
  err.resendMessage = resendMessage;
  throw err;
};

const sendOtpEmail = async ({ to, otp }) => {
  const subject = 'VrindavanSarthi Password Reset OTP';
  const text = `Your OTP for password reset is: ${otp}\n\nThis OTP expires in 10 minutes.`;

  // Prefer HTTPS email provider for deployments where SMTP ports are blocked.
  if (canSendResend()) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    await resendSendEmail({ apiKey, from, to, subject, text });
    return;
  }

  // SMTP fallback (local/dev)
  const transport = buildMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to, subject, text });
};

const redirectToLoginWithError = (res, error) => {
  const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:8080';
  const url = new URL('/login', frontendBase);
  url.searchParams.set('error', error);
  return res.redirect(url.toString());
};

// Google OAuth: start
router.get('/google', async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) return redirectToLoginWithError(res, 'google_oauth_not_configured');

    const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : '/';
    const state = Buffer.from(JSON.stringify({ redirect })).toString('base64url');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state);

    res.redirect(url.toString());
  } catch (err) {
    next(err);
  }
});

// Google OAuth: callback
router.get('/google/callback', async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return redirectToLoginWithError(res, 'google_oauth_not_configured');
    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:8080';

    const { code, error, state } = req.query;
    if (error) {
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', String(error));
      return res.redirect(url.toString());
    }

    if (!code || typeof code !== 'string') {
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', 'missing_code');
      return res.redirect(url.toString());
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      const errMsg = tokenJson?.error_description || tokenJson?.error || 'google_token_exchange_failed';
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', String(errMsg));
      return res.redirect(url.toString());
    }

    const idToken = tokenJson.id_token;
    if (!idToken) {
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', 'missing_id_token');
      return res.redirect(url.toString());
    }

    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const info = await infoRes.json();
    if (!infoRes.ok || !info?.email) {
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', 'google_tokeninfo_failed');
      return res.redirect(url.toString());
    }

    if (info.aud !== clientId) {
      const url = new URL('/login', frontendBase);
      url.searchParams.set('error', 'invalid_audience');
      return res.redirect(url.toString());
    }

    if (mongoose.connection.readyState !== 1) {
      return redirectToLoginWithError(res, 'db_not_connected');
    }

    const normalizedEmail = normalizeEmail(info.email);
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        name: info.name || info.email,
        email: normalizedEmail,
        avatar: info.picture,
        googleId: info.sub,
        authProvider: 'google',
        role: 'user',
      });
    } else {
      let changed = false;
      if (!user.googleId) { user.googleId = info.sub; changed = true; }
      if (!user.avatar && info.picture) { user.avatar = info.picture; changed = true; }
      if (user.authProvider !== 'google') { user.authProvider = 'google'; changed = true; }
      if (changed) await user.save();
    }

    const token = generateToken(user._id);
    const redirectUrl = new URL('/auth/google/callback', frontendBase);
    redirectUrl.searchParams.set('token', token);

    if (state && typeof state === 'string') {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decoded?.redirect) redirectUrl.searchParams.set('redirect', String(decoded.redirect));
      } catch {
        // ignore
      }
    }

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    next(err);
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, street, city, state, pin,
      businessName, gstNumber, businessType, businessAddress, businessPhone, businessEmail, businessDescription } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({
      name, email: normalizedEmail, phone, password,
      address: { street, city, state, pin },
      role: role || 'user',
      ...(role === 'partner' ? { businessName, gstNumber, businessType, businessAddress, businessPhone, businessEmail, businessDescription, partnerStatus: 'pending' } : {}),
    });

    const token = generateToken(user._id);
    const { password: _, ...userData } = user.toObject();
    res.status(201).json({ success: true, token, user: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (user && user.authProvider === 'google' && !user.password) {
      return res.status(401).json({ success: false, message: 'Use Google sign-in for this account' });
    }
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const token = generateToken(user._id);
    const { password: _, ...userData } = user.toObject();
    res.json({ success: true, token, user: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get profile
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// Update profile
router.put('/me', protect, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: upload verification documents (base64 data:image/* strings).
// Body: { documents: string[] , location?: { lat, lng, address } }
router.post('/me/partner-verification', protect, async (req, res) => {
  try {
    if (req.user.role !== 'partner') return res.status(403).json({ success: false, message: 'Not a partner account' });

    const docsInput = Array.isArray(req.body?.documents) ? req.body.documents : [];
    if (!docsInput.length) return res.status(400).json({ success: false, message: 'documents[] is required' });

    const urls = await maybeUploadImageArray(docsInput, { folder: 'vrindavan-sarthi/partner-documents', tags: ['partner', 'document'], max: 10 });
    if (!urls.length) return res.status(400).json({ success: false, message: 'No valid documents provided' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const now = new Date();
    const existing = Array.isArray(user.partnerDocuments) ? user.partnerDocuments : [];
    user.partnerDocuments = [
      ...existing,
      ...urls.map((url) => ({ name: 'document', url, uploadedAt: now })),
    ];

    const loc = req.body?.location;
    if (loc && typeof loc === 'object') {
      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      const address = String(loc.address || '').trim();
      user.partnerLocation = {
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        address: address || undefined,
      };
    }

    // Keep status pending until admin approval.
    user.partnerStatus = 'pending';
    await user.save();

    const safe = await User.findById(user._id).select('-password');
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Forgot password: send OTP to email
router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email }).select('_id email name');
    // Always respond success to avoid account enumeration.
    if (!user) return res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });

    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetOtpHash: otpHash,
          passwordResetOtpExpiresAt: expiresAt,
          passwordResetOtpAttempts: 0,
          passwordResetOtpVerifiedAt: null,
        },
      }
    );

    if (canSendResend() || canSendEmail()) {
      try {
        await sendOtpEmail({ to: email, otp });
      } catch (mailErr) {
        console.error('[VVS] OTP email send failed:', mailErr?.code || mailErr?.name || mailErr, mailErr?.message || '');

        let message =
          'OTP email could not be sent. Please verify email settings. If you are deployed, prefer RESEND_API_KEY (HTTPS) because many hosting providers block SMTP ports.';

        if (mailErr?.code === 'RESEND_FROM_NOT_VERIFIED') {
          message =
            'OTP email could not be sent. RESEND_FROM must be a verified sender in Resend (typically your own domain like no-reply@yourdomain.com), not a personal Gmail address.';
        } else if (mailErr?.code === 'RESEND_SEND_FAILED') {
          message = 'OTP email could not be sent due to email provider error. Please verify RESEND_API_KEY and RESEND_FROM.';
        }

        return res.status(502).json({
          success: false,
          message,
        });
      }
    } else {
      // Dev fallback: show OTP in backend logs if SMTP isn't configured.
      const missing = getMissingSmtpKeys();
      console.log(
        `[VVS] SMTP not configured (${missing.join(', ') || 'unknown missing keys'}). Password reset OTP for ${email}: ${otp} (expires in 10 minutes)`
      );
    }

    res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify OTP and return a short-lived reset token
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({ email }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts');
    if (!user?.passwordResetOtpHash || !user?.passwordResetOtpExpiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (user.passwordResetOtpAttempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
    }

    const expected = user.passwordResetOtpHash;
    const provided = hashOtp(email, otp);
    if (expected !== provided) {
      await User.updateOne({ _id: user._id }, { $inc: { passwordResetOtpAttempts: 1 } });
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { passwordResetOtpVerifiedAt: new Date() },
      }
    );

    const secret = requireEnv('JWT_SECRET');
    const resetToken = jwt.sign({ email, action: 'reset_password' }, secret, { expiresIn: '15m' });
    res.json({ success: true, resetToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset password using reset token
router.post('/reset-password', async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!resetToken || !newPassword) return res.status(400).json({ success: false, message: 'Missing reset token or password' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const secret = requireEnv('JWT_SECRET');
    let payload;
    try {
      payload = jwt.verify(resetToken, secret);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const email = normalizeEmail(payload?.email);
    if (!email || payload?.action !== 'reset_password') {
      return res.status(401).json({ success: false, message: 'Invalid reset token' });
    }

    const user = await User.findOne({ email }).select('+password +passwordResetOtpVerifiedAt');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Require OTP verification before allowing reset.
    if (!user.passwordResetOtpVerifiedAt) {
      return res.status(400).json({ success: false, message: 'OTP verification required' });
    }

    user.password = newPassword;
    user.authProvider = user.authProvider || 'local';
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpVerifiedAt = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
