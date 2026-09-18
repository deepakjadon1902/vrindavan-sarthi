const crypto = require('crypto');
const https = require('https');

const getRazorpayConfig = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    err.statusCode = 503;
    throw err;
  }
  return { keyId, keySecret };
};

const timingSafeEqualHex = (a, b) => {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const hmacSha256 = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

const verifyPaymentSignature = ({ orderId, paymentId, signature, secret }) =>
  timingSafeEqualHex(hmacSha256(`${orderId}|${paymentId}`, secret), signature);

const verifyWebhookSignature = ({ rawBody, signature, secret }) =>
  timingSafeEqualHex(hmacSha256(rawBody, secret), signature);

const razorpayHttpsRequest = ({ method = 'GET', path, body }) => {
  const { keyId, keySecret } = getRazorpayConfig();
  const payload = body ? JSON.stringify(body) : '';

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path,
        method,
        auth: `${keyId}:${keySecret}`,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const err = new Error(parsed?.error?.description || parsed?.message || 'Razorpay request failed');
          err.statusCode = res.statusCode;
          err.details = parsed;
          reject(err);
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

let razorpayProvider = { request: razorpayHttpsRequest };

const setRazorpayProvider = (provider) => {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Razorpay provider must expose request(options)');
  }
  razorpayProvider = provider;
};

const resetRazorpayProvider = () => {
  razorpayProvider = { request: razorpayHttpsRequest };
};

const razorpayRequest = (options) => razorpayProvider.request(options);

const getRazorpayOrder = (orderId) =>
  razorpayRequest({ path: `/v1/orders/${encodeURIComponent(String(orderId || ''))}` });

const getRazorpayPayment = (paymentId) =>
  razorpayRequest({ path: `/v1/payments/${encodeURIComponent(String(paymentId || ''))}` });

const listRazorpayPaymentsForOrder = (orderId) =>
  razorpayRequest({ path: `/v1/orders/${encodeURIComponent(String(orderId || ''))}/payments` });

module.exports = {
  getRazorpayConfig,
  getRazorpayOrder,
  getRazorpayPayment,
  listRazorpayPaymentsForOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  razorpayRequest,
  setRazorpayProvider,
  resetRazorpayProvider,
};
