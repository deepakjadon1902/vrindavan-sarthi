const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
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
      ...(role === 'partner' ? { businessName, gstNumber, businessType, businessAddress, businessPhone, businessEmail, businessDescription, partnerStatus: 'approved' } : {}),
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

module.exports = router;
