const https = require('https');

const normalize = (v) => String(v || '').trim();

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

const sendSms = async ({ to, message }) => {
  const phone = normalize(to);
  const text = normalize(message);
  if (!phone || !text) return;

  const webhookUrl = normalize(process.env.SMS_WEBHOOK_URL);
  if (webhookUrl) {
    const resp = await postJson(webhookUrl, {
      headers: process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {},
      body: { to: phone, message: text },
    });
    if (resp.status >= 200 && resp.status < 300) return;
    throw new Error(`SMS webhook failed: HTTP ${resp.status}`);
  }

  // Optional Twilio support without adding a dependency.
  const sid = normalize(process.env.TWILIO_ACCOUNT_SID);
  const token = normalize(process.env.TWILIO_AUTH_TOKEN);
  const from = normalize(process.env.TWILIO_FROM_NUMBER);
  if (!sid || !token || !from) return;

  const payload = new URLSearchParams({ To: phone, From: from, Body: text }).toString();
  await new Promise((resolve, reject) => {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15_000,
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Twilio SMS failed: HTTP ${res.statusCode}`));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

module.exports = { sendSms };
