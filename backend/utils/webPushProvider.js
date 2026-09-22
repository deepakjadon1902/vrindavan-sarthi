const webpush = require('web-push');

const normalize = (value) => String(value || '').trim();

const getWebPushConfig = () => {
  const publicKey = normalize(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
  const privateKey = normalize(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const subject = normalize(process.env.WEB_PUSH_VAPID_SUBJECT || process.env.APP_URL || 'mailto:admin@vrindavansarthi.com');
  const configured = Boolean(publicKey && privateKey && subject);
  return { publicKey, privateKey, subject, configured };
};

const validateWebPushConfig = ({ required = false } = {}) => {
  const config = getWebPushConfig();
  if (!config.configured) {
    const err = new Error('WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT are required for Web Push delivery');
    err.code = 'WEB_PUSH_NOT_CONFIGURED';
    if (required) throw err;
  }
  return config;
};

const configureWebPush = () => {
  const config = validateWebPushConfig({ required: true });
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
};

const isInvalidSubscriptionError = (err) => {
  const statusCode = Number(err?.statusCode || err?.status || 0);
  return statusCode === 404 || statusCode === 410;
};

const sendWebPush = async (subscription, payload, options = {}) => {
  configureWebPush();
  const result = await webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: options.ttl ?? 180,
    urgency: options.urgency || 'high',
  });
  return {
    provider: 'web_push',
    providerMessageId: String(result?.headers?.location || result?.statusCode || 'accepted'),
    statusCode: result?.statusCode,
  };
};

module.exports = {
  getWebPushConfig,
  validateWebPushConfig,
  sendWebPush,
  isInvalidSubscriptionError,
};
