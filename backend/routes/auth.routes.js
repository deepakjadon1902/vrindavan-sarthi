const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs/promises');
const https = require('https');
const path = require('path');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const User = require('../models/User');
const EmailOtp = require('../models/EmailOtp');
const { linkCustomerGuestBookings, isValidEmail } = require('../utils/guestBookingAccess');
const { protect } = require('../middleware/auth');
const { uploadDataUri, isCloudinaryEnabled } = require('../utils/cloudinary');
const router = express.Router();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const splitOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const allowedFrontendOrigins = new Set([
  ...splitOrigins(process.env.FRONTEND_BASE_URL),
  ...splitOrigins(process.env.PUBLIC_SITE_URL),
  ...splitOrigins(process.env.CORS_ORIGINS),
  'https://www.vrindavansarthi.in',
  'https://vrindavansarthi.in',
  'https://www.vrindavansarthi.com',
  'https://vrindavansarthi.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

const getAllowedFrontendBase = (value) => {
  try {
    const origin = new URL(String(value || '')).origin;
    return allowedFrontendOrigins.has(origin) ? origin : '';
  } catch {
    return '';
  }
};

const decodeGoogleState = (state) => {
  if (!state || typeof state !== 'string') return {};
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
};

const getDocumentPayload = (item) => {
  if (typeof item === 'string') {
    return { data: item, name: 'document', type: '' };
  }
  if (!item || typeof item !== 'object') {
    return { data: '', name: 'document', type: '' };
  }
  return {
    data: String(item.data || item.url || '').trim(),
    name: String(item.name || 'document').trim() || 'document',
    type: String(item.documentType || item.category || item.type || 'other').trim(),
    mimeType: String(item.mimeType || item.fileType || '').trim(),
  };
};

const DOCUMENT_TYPES = ['aadhar_card', 'gstin_registration', 'property_registry_document', 'business_license', 'pan_card', 'other'];
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_PARTNER_DOCUMENT_BYTES = 10 * 1024 * 1024;
const safeFileName = (value) => {
  const parsed = path.parse(String(value || 'document'));
  const base = String(parsed.name || 'document').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'document';
  const ext = String(parsed.ext || '').replace(/[^a-z0-9.]/gi, '').slice(0, 12);
  return `${base}${ext}`;
};

const extensionForMime = (mimeType) => {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'application/pdf') return '.pdf';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('msword')) return '.doc';
  if (mime.includes('wordprocessingml')) return '.docx';
  return '';
};

const mimeForFileName = (fileName) => {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return '';
};

const storePartnerDocument = async (doc, index) => {
  const data = String(doc.data || '').trim();
  const originalName = safeFileName(doc.name || `document-${index + 1}`);
  const mimeFromDataUri = data.match(/^data:([^;]+);base64,/i)?.[1] || '';
  const mimeType = doc.mimeType || mimeFromDataUri || mimeForFileName(originalName) || 'application/octet-stream';
  const category = DOCUMENT_TYPES.includes(doc.type) ? doc.type : 'other';
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMime)) {
    const err = new Error('Upload only PNG, JPG, WEBP, PDF, DOC, or DOCX legal documents.');
    err.statusCode = 400;
    throw err;
  }

  if (!data.startsWith('data:')) {
    return {
      name: originalName,
      originalName,
      type: category,
      mimeType,
      sizeBytes: 0,
      storage: 'external',
      url: data,
      uploadedAt: new Date(),
    };
  }

  const b64 = data.split(',')[1] || '';
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) return null;
  if (buffer.length > MAX_PARTNER_DOCUMENT_BYTES) {
    const err = new Error('Each legal document must be 10 MB or smaller.');
    err.statusCode = 400;
    throw err;
  }

  if (isCloudinaryEnabled()) {
    const url = await uploadDataUri(data, {
      folder: 'vrindavan-sarthi/partner-documents',
      tags: ['partner', 'document', category],
      resourceType: normalizedMime.startsWith('image/') ? 'image' : 'raw',
    });
    if (url) {
      return {
        name: originalName,
        originalName,
        type: category,
        mimeType,
        sizeBytes: buffer.length,
        storage: 'cloudinary',
        url,
        uploadedAt: new Date(),
      };
    }
  }

  const folder = path.join(process.cwd(), 'uploads', 'partner-documents');
  await fs.mkdir(folder, { recursive: true });
  const parsed = path.parse(originalName);
  const ext = parsed.ext || extensionForMime(mimeType) || '.bin';
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${parsed.name || 'document'}${ext}`;
  await fs.writeFile(path.join(folder, fileName), buffer);
  return {
    name: originalName,
    originalName,
    type: category,
    mimeType,
    sizeBytes: buffer.length,
    storage: 'local',
    url: `/uploads/partner-documents/${fileName}`,
    uploadedAt: new Date(),
  };
};

const normalizePartnerDocuments = async (docsInput, { max = 10 } = {}) => {
  const docs = (Array.isArray(docsInput) ? docsInput : [])
    .map(getDocumentPayload)
    .filter((doc) => doc.data);
  const limited = docs.slice(0, Math.max(0, Number(max) || 0) || 10);
  if (!limited.length) return [];

  const stored = await Promise.all(limited.map((doc, index) => storePartnerDocument(doc, index)));
  return stored.filter(Boolean);
};

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

const resendSendEmail = async ({ apiKey, from, to, subject, text, html }) => {
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
    body: { from, to: [to], subject, text, ...(html ? { html } : {}) },
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


// Trusted requester IP resolution (spoofed header protection)
const getTrustedRequesterIp = (req) => {
  if (!req) return 'Unavailable';
  const isTrustProxy = Boolean(req.app && typeof req.app.get === 'function' && req.app.get('trust proxy'));
  if (isTrustProxy) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded.replace(/^::ffff:/, '');
    if (req.ip) return String(req.ip).replace(/^::ffff:/, '');
  }
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || (typeof req.ip === 'string' && !req.headers?.['x-forwarded-for'] ? req.ip : null);
  if (socketIp) {
    return String(socketIp).replace(/^::ffff:/, '');
  }
  return 'Unavailable';
};

const buildCustomerOtpHtml = (otp) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Vrindavan Sarthi Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #0f766e; padding: 28px 32px; text-align: center;">
              <span style="display: inline-block; font-size: 13px; font-weight: 700; color: #ccfbf1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Pilgrimage Platform</span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">VRINDAVAN SARTHI</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Hello,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                We received a request to sign in to your Vrindavan Sarthi account. Use the one-time verification code below to complete your login:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background-color: #f0fdfa; border: 1.5px solid #99f6e4; border-radius: 12px; padding: 20px 24px;">
                    <div style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0f766e; line-height: 1;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #0f766e; text-align: center;">
                ⏱ This verification code will expire in 10 minutes.
              </p>
              <div style="background-color: #f8fafc; border-left: 3px solid #0d9488; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                  <strong>Security Reminder:</strong> Never share this verification code with anyone. Vrindavan Sarthi staff will never ask for your code. If you did not request this code, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                Vrindavan Sarthi Enterprises &bull; Pilgrimage & Hospitality Services
              </p>
              <p style="margin: 0; font-size: 12px;">
                <a href="https://vrindavansarthi.in" style="color: #0f766e; text-decoration: none; font-weight: 600;">https://vrindavansarthi.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildCustomerOtpText = (otp) => `Hello,

Your verification code for Vrindavan Sarthi is:

${otp}

This verification code will expire in 10 minutes.

Security Reminder: Never share this verification code with anyone. Vrindavan Sarthi staff will never ask for your code. If you did not request this code, you can safely ignore this email.

Vrindavan Sarthi Enterprises
https://vrindavansarthi.in`;

const sendCustomerOtpEmail = async ({ to, otp }) => {
  const subject = 'Your Vrindavan Sarthi Login Code: ' + otp;
  const html = buildCustomerOtpHtml(otp);
  const text = buildCustomerOtpText(otp);

  if (canSendResend()) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    await resendSendEmail({ apiKey, from, to, subject, text, html });
    return;
  }

  if (canSendEmail()) {
    const transport = buildMailer();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transport.sendMail({ from, to, subject, text, html });
    return;
  }

  console.log('[VVS-AUTH] Login OTP for ' + to + ': ' + otp + ' (valid for 10 min)');
};

const sendOtpEmail = async ({ to, otp }) => {
  const subject = 'Vrindavan Sarthi Enterprises Password Reset OTP';
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

const buildPartnerRegistrationHtml = ({ user, formattedTimestampIST, formattedTimestampUTC, requesterIp }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Partner Registration Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #0f766e; padding: 24px 32px;">
              <span style="font-size: 11px; font-weight: 700; color: #ccfbf1; text-transform: uppercase; letter-spacing: 1.5px;">Admin Alert &bull; Internal Review Required</span>
              <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">New Partner Registration</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155;">
                A new property partner has registered on Vrindavan Sarthi and is awaiting administrative verification.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px; margin-bottom: 24px;">
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b; width: 38%;">Partner Name</td>
                  <td style="padding: 10px 16px; font-weight: 600; color: #0f172a;">${user.name || '-'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Registered Email</td>
                  <td style="padding: 10px 16px; color: #0f172a;">${user.email || '-'}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Property / Business Name</td>
                  <td style="padding: 10px 16px; font-weight: 600; color: #0f172a;">${user.businessName || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Contact Number</td>
                  <td style="padding: 10px 16px; color: #0f172a;">${user.businessPhone || user.phone || 'Not specified'}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Category / Business Type</td>
                  <td style="padding: 10px 16px; color: #0f172a;">${user.businessType || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Registration Timestamp</td>
                  <td style="padding: 10px 16px; color: #0f172a;">
                    ${formattedTimestampIST}<br/>
                    <span style="font-size: 11px; color: #64748b;">${formattedTimestampUTC} (UTC)</span>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Requester IP Address</td>
                  <td style="padding: 10px 16px; font-family: monospace; font-size: 12px; color: #0f766e;">${requesterIp}</td>
                </tr>
              </table>
              <div style="background-color: #f0fdfa; border-left: 3px solid #0f766e; padding: 14px 18px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 13px; color: #115e59; line-height: 1.5;">
                  <strong>Action Required:</strong> This partner registration is currently pending review. Please sign in to the Vrindavan Sarthi Admin Dashboard to inspect their submitted documents and approve or reject this listing.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
              Vrindavan Sarthi Internal Operations &bull; Automated Security Notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildPartnerRegistrationText = ({ user, formattedTimestampIST, formattedTimestampUTC, requesterIp }) => `VRINDAVAN SARTHI — Internal Admin Alert: New Partner Registration

A new property partner has registered on Vrindavan Sarthi and is awaiting administrative verification.

Partner Details:
- Partner Name: ${user.name || '-'}
- Registered Email: ${user.email || '-'}
- Property / Business Name: ${user.businessName || 'Not specified'}
- Contact Number: ${user.businessPhone || user.phone || 'Not specified'}
- Category / Business Type: ${user.businessType || 'Not specified'}
- Registration Timestamp: ${formattedTimestampIST} [${formattedTimestampUTC} UTC]
- Requester IP Address: ${requesterIp}

Action Required:
This partner registration is currently pending review. Please sign in to the Vrindavan Sarthi Admin Dashboard to inspect their submitted documents and approve or reject this listing.

Vrindavan Sarthi Internal Operations
https://vrindavansarthi.in`;

const sendPartnerRegistrationAlert = async (user, req) => {
  const to = 'vrindavansarthi108@gmail.com';
  const serverTime = new Date();
  const formattedTimestampIST = serverTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'long',
  }) + ' (IST / UTC+05:30)';
  const formattedTimestampUTC = serverTime.toISOString();
  const requesterIp = getTrustedRequesterIp(req);

  const subject = `New partner registration: ${user.businessName || user.name}`;
  const html = buildPartnerRegistrationHtml({ user, formattedTimestampIST, formattedTimestampUTC, requesterIp });
  const text = buildPartnerRegistrationText({ user, formattedTimestampIST, formattedTimestampUTC, requesterIp });

  try {
    if (canSendResend()) {
      const apiKey = String(process.env.RESEND_API_KEY || '').trim();
      const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
      await resendSendEmail({ apiKey, from, to, subject, text, html });
      return;
    }
    if (!canSendEmail()) {
      console.warn(`[VVS] SMTP not configured. Partner registration alert skipped for ${user.email}.`);
      return;
    }
    const transport = buildMailer();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transport.sendMail({ from, to, subject, text, html });
  } catch (err) {
    console.warn('[VVS] Partner registration alert failed:', err?.code || err?.name || err, err?.message || '');
  }
};

const getFrontendBase = () =>
  process.env.FRONTEND_BASE_URL ||
  process.env.PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://www.vrindavansarthi.in' : 'http://localhost:8080');

const getOAuthFrontendBase = (req, state = {}) => {
  const queryOrigin = typeof req.query.origin === 'string' ? req.query.origin : '';
  const stateOrigin = typeof state.frontendBase === 'string' ? state.frontendBase : '';
  const headerOrigin = req.get('origin') || '';
  const forwardedHost = req.get('x-forwarded-host') || '';
  const forwardedProto = String(req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${String(forwardedHost).split(',')[0].trim()}` : '';

  return (
    getAllowedFrontendBase(queryOrigin) ||
    getAllowedFrontendBase(stateOrigin) ||
    getAllowedFrontendBase(headerOrigin) ||
    getAllowedFrontendBase(forwardedOrigin) ||
    getAllowedFrontendBase(getFrontendBase()) ||
    getFrontendBase()
  );
};

const getGoogleRedirectUri = (frontendBase) =>
  `${String(frontendBase || '').replace(/\/+$/, '')}/api/auth/google/callback`;

const redirectToLoginWithError = (res, error) => {
  const frontendBase = getFrontendBase();
  const url = new URL('/login', frontendBase);
  url.searchParams.set('error', error);
  return res.redirect(url.toString());
};

// Google OAuth: start
router.get('/google', async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const frontendBase = getOAuthFrontendBase(req);
    const redirectUri = getGoogleRedirectUri(frontendBase) || process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) return redirectToLoginWithError(res, 'google_oauth_not_configured');

    const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : '/';
    const state = Buffer.from(JSON.stringify({ redirect, frontendBase, redirectUri })).toString('base64url');

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
    const statePayload = decodeGoogleState(req.query.state);
    const frontendBase = getOAuthFrontendBase(req, statePayload);
    const redirectUri = getGoogleRedirectUri(frontendBase) || process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return redirectToLoginWithError(res, 'google_oauth_not_configured');

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

    if (statePayload?.redirect) redirectUrl.searchParams.set('redirect', String(statePayload.redirect));

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    next(err);
  }
});

// Register

// Send customer login OTP with layered abuse protections
router.post('/send-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    // Role check: Staff accounts (admin, partner) must use staff login with password
    const existingStaff = await User.findOne({ email, role: { $in: ['admin', 'partner'] } });
    if (existingStaff) {
      return res.status(403).json({
        success: false,
        message: 'Admin and partner accounts must sign in using staff login with their password.',
      });
    }

    // Capture trusted requester IP
    const requesterIp = getTrustedRequesterIp(req);
    const oneHourAgo = new Date(Date.now() - 3600000);

    // Limit 1: Per-email cooldown (60 seconds minimum interval)
    const activeOtp = await EmailOtp.findOne({ email, consumedAt: null, purpose: 'login' }).sort({ createdAt: -1 });
    if (activeOtp && activeOtp.lastSentAt) {
      const elapsedMs = Date.now() - new Date(activeOtp.lastSentAt).getTime();
      if (elapsedMs < 60000) {
        const retryAfterSec = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: 'Please wait ' + retryAfterSec + ' seconds before requesting a new code.',
          retryAfter: retryAfterSec,
        });
      }
    }

    // Limit 2: Per-email rolling window limit (max 5 OTP requests per hour)
    const hourlyEmailCount = await EmailOtp.countDocuments({
      email,
      purpose: 'login',
      createdAt: { $gte: oneHourAgo },
    });
    if (hourlyEmailCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many verification code requests for this email address. Please try again later.',
      });
    }

    // Limit 3: Per-IP rolling window limit (max 10 OTP requests per hour)
    if (requesterIp && requesterIp !== 'Unavailable') {
      const hourlyIpCount = await EmailOtp.countDocuments({
        ip: requesterIp,
        purpose: 'login',
        createdAt: { $gte: oneHourAgo },
      });
      if (hourlyIpCount >= 10) {
        return res.status(429).json({
          success: false,
          message: 'Too many verification code requests from this network. Please try again later.',
        });
      }
    }

    // Invalidate previous unconsumed login OTPs for this email
    await EmailOtp.updateMany({ email, consumedAt: null, purpose: 'login' }, { $set: { consumedAt: new Date() } });

    // Uniform 6-digit cryptographic OTP generation: [100000, 1000000) covers all values 100000 through 999999
    const otp = String(crypto.randomInt(100000, 1000000));
    const salt = process.env.OTP_SALT || process.env.JWT_SECRET || 'vvs_otp_salt';
    const otpHash = crypto.createHash('sha256').update(email + '|' + otp + '|' + salt).digest('hex');

    await EmailOtp.create({
      email,
      otpHash,
      purpose: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      lastSentAt: new Date(),
      ip: requesterIp,
    });

    // Send OTP via configured email provider
    await sendCustomerOtpEmail({ to: email, otp });

    return res.json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email address.',
    });
  } catch (err) {
    console.error('[auth.send-otp.error]', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to send OTP' });
  }
});

// Verify customer login OTP & authenticate
router.post('/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const cleanOtp = String(req.body?.otp || '').trim();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit code' });
    }

    const otpRecord = await EmailOtp.findOne({ email, consumedAt: null, purpose: 'login' }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please request a new code.' });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new verification code.' });
    }

    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }

    const salt = process.env.OTP_SALT || process.env.JWT_SECRET || 'vvs_otp_salt';
    const expectedHash = crypto.createHash('sha256').update(email + '|' + cleanOtp + '|' + salt).digest('hex');

    if (otpRecord.otpHash !== expectedHash) {
      await EmailOtp.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
    }

    // Mark OTP consumed immediately
    await EmailOtp.updateOne({ _id: otpRecord._id }, { $set: { consumedAt: new Date() } });

    // Find or create customer account
    let user = await User.findOne({ email }).select('+password');
    if (user) {
      if (user.role === 'admin' || user.role === 'partner') {
        return res.status(403).json({ success: false, message: 'Staff accounts must sign in using staff login with password.' });
      }
      if (user.isGuest) {
        user.isGuest = false;
        user.authProvider = user.authProvider || 'email_otp';
        await user.save();
      }
    } else {
      const defaultName = email.split('@')[0];
      user = await User.create({
        name: defaultName,
        email,
        role: 'user',
        isGuest: false,
        authProvider: 'email_otp',
      });
    }

    // Link any eligible historical guest bookings
    const linkResult = await linkCustomerGuestBookings({
      userId: user._id,
      email,
      userName: user.name,
    });

    const token = generateToken(user._id);
    const hasPassword = Boolean(user.password);
    const { password: _, ...userData } = user.toObject();

    return res.json({
      success: true,
      token,
      user: { ...userData, hasPassword },
      linkedBookingsCount: linkResult.linkedCount || 0,
    });
  } catch (err) {
    console.error('[auth.verify-otp.error]', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Verification failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, street, city, state, pin,
      businessName, gstNumber, businessType, businessAddress, businessPhone, businessEmail, businessDescription } = req.body;
    const requestedRole = String(role || 'user').trim().toLowerCase();
    const accountRole = requestedRole === 'partner' ? 'partner' : 'user';
    if (requestedRole && !['user', 'partner'].includes(requestedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid account role' });
    }

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    let partnerDocuments = [];
    let partnerPolicyConsent = undefined;
    if (accountRole === 'partner') {
      if (req.body?.partnerPolicyConsent?.accepted !== true) {
        return res.status(400).json({ success: false, message: 'Please accept the owner terms, conditions, and privacy policy to register as a partner' });
      }
      const docsInput = Array.isArray(req.body?.documents) ? req.body.documents : [];
      if (!docsInput.length) {
        return res.status(400).json({ success: false, message: 'Government/legal documents are required for partner registration' });
      }
      partnerDocuments = await normalizePartnerDocuments(docsInput, { max: 10 });
      if (!partnerDocuments.length) return res.status(400).json({ success: false, message: 'No valid partner documents provided' });
      partnerPolicyConsent = {
        accepted: true,
        acceptedAt: new Date(),
        termsVersion: String(req.body?.partnerPolicyConsent?.termsVersion || 'owner-partner-terms-v1'),
        privacyVersion: String(req.body?.partnerPolicyConsent?.privacyVersion || 'privacy-policy-v1'),
        source: 'partner_registration',
      };
    }

    const user = await User.create({
      name, email: normalizedEmail, phone, password,
      address: { street, city, state, pin },
      role: accountRole,
      ...(accountRole === 'partner' ? { businessName, gstNumber, businessType, businessAddress, businessPhone, businessEmail, businessDescription, partnerDocuments, partnerPolicyConsent, partnerStatus: 'pending' } : {}),
    });

    if (accountRole === 'partner') {
      void sendPartnerRegistrationAlert(user, req);
    }

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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// Get profile
router.get('/me', protect, async (req, res) => {
  try {
    const userWithPassword = await User.findById(req.user._id).select('+password');
    const hasPassword = Boolean(userWithPassword?.password);
    const safeUser = req.user.toObject ? req.user.toObject() : { ...req.user };
    res.json({ success: true, user: { ...safeUser, hasPassword } });
  } catch {
    res.json({ success: true, user: req.user });
  }
});

// Update or create password (authenticated customer)
router.post('/me/password', protect, async (req, res) => {
  try {
    const newPassword = String(req.body?.newPassword || '');
    const currentPassword = String(req.body?.currentPassword || '');

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // If user already has a password, verify current password
    if (user.password) {
      if (!currentPassword || !(await user.matchPassword(currentPassword))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    user.password = newPassword;
    user.authProvider = user.authProvider || 'local';
    await user.save();

    return res.json({
      success: true,
      message: user.password ? 'Password saved successfully' : 'Password created successfully',
      hasPassword: true,
    });
  } catch (err) {
    console.error('[auth.me.password.error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update password' });
  }
});

// Update profile
router.put('/me', protect, async (req, res) => {
  try {
    const allowed = [
      'name', 'phone', 'address', 'avatar',
      'businessName', 'gstNumber', 'businessType', 'businessAddress', 'businessPhone', 'businessEmail', 'businessDescription',
      'profileDisplayName', 'profileBio', 'profilePicture',
    ];
    const body = {};
    for (const key of allowed) {
      if (typeof req.body?.[key] !== 'undefined') body[key] = req.body[key];
    }
    const partnerVerificationFields = [
      'businessName', 'gstNumber', 'businessType', 'businessAddress', 'businessPhone', 'businessEmail', 'businessDescription',
    ];
    if (req.user.role === 'partner' && partnerVerificationFields.some((key) => typeof body[key] !== 'undefined')) {
      body.partnerStatus = 'pending';
    }
    const user = await User.findByIdAndUpdate(req.user._id, body, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// Partner: upload verification documents.
// Body: { documents: Array<string|{ data, name, type }> , location?: { lat, lng, address } }
router.post('/me/partner-verification', protect, async (req, res) => {
  try {
    if (req.user.role !== 'partner') return res.status(403).json({ success: false, message: 'Not a partner account' });

    const docsInput = Array.isArray(req.body?.documents) ? req.body.documents : [];
    if (!docsInput.length) return res.status(400).json({ success: false, message: 'documents[] is required' });

    const newDocuments = await normalizePartnerDocuments(docsInput, { max: 10 });
    if (!newDocuments.length) return res.status(400).json({ success: false, message: 'No valid documents provided' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existing = Array.isArray(user.partnerDocuments) ? user.partnerDocuments : [];
    user.partnerDocuments = [
      ...existing,
      ...newDocuments,
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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


// Export test helpers for automated test verification
router._testHelpers = {
  getTrustedRequesterIp,
  buildCustomerOtpHtml,
  buildCustomerOtpText,
  buildPartnerRegistrationHtml,
  buildPartnerRegistrationText,
};
