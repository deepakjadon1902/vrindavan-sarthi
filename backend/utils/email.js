const https = require('https');
const nodemailer = require('nodemailer');

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    const err = new Error(`Missing required env: ${key}`);
    err.statusCode = 500;
    throw err;
  }
  return value;
};

const canSendResend = () => Boolean(String(process.env.RESEND_API_KEY || '').trim());
const canSendSmtp = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

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
        headers: { 'Content-Type': 'application/json', ...headers },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.write(JSON.stringify(body ?? {}));
    req.end();
  });

const normalizeAttachments = (attachments) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((a) => ({
      filename: String(a?.filename || 'attachment.pdf'),
      content: Buffer.isBuffer(a?.content) ? a.content : Buffer.from(String(a?.content || ''), 'utf8'),
      contentType: String(a?.contentType || 'application/pdf'),
    }))
    .filter((a) => a.content.length > 0);

const resendSendEmail = async ({ apiKey, from, to, subject, text, html, attachments, replyTo }) => {
  const files = normalizeAttachments(attachments).map((a) => ({
    filename: a.filename,
    content: a.content.toString('base64'),
    content_type: a.contentType,
  }));
  const resp = await postJson('https://api.resend.com/emails', {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { from, to: [to], subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}), ...(files.length ? { attachments: files } : {}) },
  });
  if (resp.status >= 200 && resp.status < 300) return;
  const err = new Error(`Resend send failed: HTTP ${resp.status}`);
  err.code = 'RESEND_SEND_FAILED';
  throw err;
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
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
};

const sendEmail = async ({ to, subject, text, html, attachments, replyTo }) => {
  const toAddr = String(to || '').trim();
  const replyToAddr = String(replyTo || '').trim();
  if (!toAddr) return;
  const files = normalizeAttachments(attachments);

  if (canSendResend()) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!from) throw new Error('Missing RESEND_FROM (or SMTP_FROM/SMTP_USER)');
    await resendSendEmail({ apiKey, from, to: toAddr, subject, text, html, attachments: files, replyTo: replyToAddr });
    return;
  }

  if (!canSendSmtp()) {
    const err = new Error('Email provider not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.');
    err.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  const transport = buildMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to: toAddr, subject, text, html, replyTo: replyToAddr || undefined, attachments: files });
};

module.exports = { sendEmail };
