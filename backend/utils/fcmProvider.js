const crypto = require('crypto');

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

const normalize = (value) => String(value || '').trim();

const base64Url = (value) =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const getFcmConfig = () => {
  const projectId = normalize(process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalize(process.env.FCM_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalize(process.env.FCM_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n');
  const configured = Boolean(projectId && clientEmail && privateKey);
  return { projectId, clientEmail, privateKey, configured };
};

const validateFcmConfig = ({ required = false } = {}) => {
  const config = getFcmConfig();
  if (!config.configured) {
    const err = new Error('FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY are required for native Android alarm delivery');
    err.code = 'FCM_NOT_CONFIGURED';
    if (required) throw err;
  }
  return config;
};

const createServiceAccountJwt = (config) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: config.clientEmail,
    scope: FCM_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(config.privateKey);
  return `${unsigned}.${base64Url(signature)}`;
};

const getAccessToken = async () => {
  const config = validateFcmConfig({ required: true });
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) return cachedAccessToken;

  const assertion = createServiceAccountJwt(config);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'Could not obtain FCM access token');
    err.statusCode = res.status;
    err.body = JSON.stringify(data).slice(0, 500);
    throw err;
  }
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  return cachedAccessToken;
};

const asDataPayload = (payload = {}) =>
  Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? '')]));

const sendFcmAlarm = async (fcmToken, payload = {}) => {
  const config = validateFcmConfig({ required: true });
  const accessToken = await getAccessToken();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        data: asDataPayload({
          title: payload.title || 'Vrindavan Sarthi booking alert',
          body: payload.body || 'A booking notification is waiting.',
          notificationId: payload.notificationId || '',
          bookingId: payload.bookingId || '',
          deepLink: payload.deepLink || '/admin/bookings',
          type: payload.type || 'BOOKING_ALARM',
          priority: payload.priority || 'critical',
        }),
        android: {
          priority: 'HIGH',
          ttl: `${Math.max(30, Number(payload.ttl || 180))}s`,
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'FCM alarm delivery failed');
    err.statusCode = res.status;
    err.body = JSON.stringify(data).slice(0, 500);
    err.fcmStatus = data?.error?.status;
    throw err;
  }
  return {
    provider: 'fcm',
    providerMessageId: String(data.name || 'accepted'),
  };
};

const isInvalidFcmTokenError = (err) => {
  const status = normalize(err?.fcmStatus).toUpperCase();
  const body = normalize(err?.body).toUpperCase();
  return status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT' || body.includes('UNREGISTERED') || body.includes('INVALID_ARGUMENT');
};

module.exports = {
  getFcmConfig,
  validateFcmConfig,
  sendFcmAlarm,
  isInvalidFcmTokenError,
};
