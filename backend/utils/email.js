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

const resendSendEmail = async ({ apiKey, from, to, subject, text }) => {
  const resp = await postJson('https://api.resend.com/emails', {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { from, to: [to], subject, text },
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

const sendEmail = async ({ to, subject, text }) => {
  const toAddr = String(to || '').trim();
  if (!toAddr) return;

  if (canSendResend()) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!from) throw new Error('Missing RESEND_FROM (or SMTP_FROM/SMTP_USER)');
    await resendSendEmail({ apiKey, from, to: toAddr, subject, text });
    return;
  }

  if (!canSendSmtp()) return;
  const transport = buildMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to: toAddr, subject, text });
};

module.exports = { sendEmail };

