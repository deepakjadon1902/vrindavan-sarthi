const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const splitList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const boolEnv = (env, key) => TRUE_VALUES.has(String(env[key] || '').trim().toLowerCase());

const isProduction = (env = process.env) => String(env.NODE_ENV || '').trim() === 'production';

const isLocalMongoUri = (value) => {
  const uri = String(value || '').trim().toLowerCase();
  if (!uri) return false;
  return (
    uri.includes('://localhost') ||
    uri.includes('://127.0.0.1') ||
    uri.includes('@localhost') ||
    uri.includes('@127.0.0.1')
  );
};

const isLocalRedisUrl = (value) => {
  const url = String(value || '').trim().toLowerCase();
  if (!url) return false;
  return url.includes('://localhost') || url.includes('://127.0.0.1') || url.includes('@localhost') || url.includes('@127.0.0.1');
};

const isWeakSecret = (value) => {
  const secret = String(value || '').trim();
  if (secret.length < 32) return true;
  return /^(secret|password|changeme|change_me|dev|test|jwt|vrindavan)$/i.test(secret);
};

const hasWildcardOrigin = (env) => splitList(env.CORS_ORIGINS).includes('*') || String(env.FRONTEND_BASE_URL || '').trim() === '*';

const requiresRedis = (env, role) =>
  role === 'worker' ||
  boolEnv(env, 'REDIS_REQUIRED') ||
  boolEnv(env, 'PAYMENT_RECONCILIATION_ENABLED') ||
  boolEnv(env, 'BOOKING_EXPIRATION_ENABLED') ||
  boolEnv(env, 'CHANNEL_SYNC_ENABLED') ||
  boolEnv(env, 'CHANNEL_PROVIDER_ENABLED') ||
  boolEnv(env, 'NOTIFICATION_WORKER_ENABLED');

const validateProductionConfig = (env = process.env, { role = 'api' } = {}) => {
  const errors = [];
  const warnings = [];
  const mongoUri = env.MONGO_URI || env.MONGODB_URI;

  if (!isProduction(env)) {
    return { ok: true, errors, warnings };
  }

  if (!mongoUri) errors.push('MONGO_URI is required in production');
  if (isLocalMongoUri(mongoUri)) errors.push('MONGO_URI must not point to localhost in production');

  if (isWeakSecret(env.JWT_SECRET)) errors.push('JWT_SECRET must be a strong production secret of at least 32 characters');

  if (hasWildcardOrigin(env)) errors.push('CORS_ORIGINS/FRONTEND_BASE_URL must not use wildcard origins in production');
  if (!splitList(env.CORS_ORIGINS).length && !String(env.FRONTEND_BASE_URL || '').trim()) {
    errors.push('CORS_ORIGINS or FRONTEND_BASE_URL is required in production');
  }

  if (requiresRedis(env, role)) {
    if (!env.REDIS_URL) errors.push('REDIS_URL is required for production worker or enabled durable jobs');
    if (isLocalRedisUrl(env.REDIS_URL)) errors.push('REDIS_URL must not point to localhost in production');
  } else if (!env.REDIS_URL) {
    warnings.push('REDIS_URL is not configured; API will run, but workers/durable queues cannot process jobs');
  }

  if (boolEnv(env, 'RAZORPAY_REQUIRED') || role === 'api') {
    if (!env.RAZORPAY_KEY_ID) warnings.push('RAZORPAY_KEY_ID is not configured; Razorpay payment routes will fail until set');
    if (!env.RAZORPAY_KEY_SECRET) warnings.push('RAZORPAY_KEY_SECRET is not configured; Razorpay payment routes will fail until set');
    if (!env.RAZORPAY_WEBHOOK_SECRET) warnings.push('RAZORPAY_WEBHOOK_SECRET is not configured; Razorpay webhooks will be unavailable');
  }

  if ((boolEnv(env, 'CHANNEL_SYNC_ENABLED') || boolEnv(env, 'CHANNEL_PROVIDER_ENABLED')) && !env.CHANNEL_WEBHOOK_SECRET) {
    errors.push('CHANNEL_WEBHOOK_SECRET is required when channel providers are enabled in production');
  }

  return { ok: errors.length === 0, errors, warnings };
};

const assertProductionConfig = (env = process.env, options = {}) => {
  const result = validateProductionConfig(env, options);
  if (result.ok) return result;
  const err = new Error(`Production configuration invalid: ${result.errors.join('; ')}`);
  err.code = 'PRODUCTION_CONFIG_INVALID';
  err.errors = result.errors;
  throw err;
};

const redactSecret = (value) => {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '[redacted]';
  return `${text.slice(0, 3)}...[redacted]...${text.slice(-3)}`;
};

module.exports = {
  splitList,
  boolEnv,
  isProduction,
  isLocalMongoUri,
  isLocalRedisUrl,
  isWeakSecret,
  requiresRedis,
  validateProductionConfig,
  assertProductionConfig,
  redactSecret,
};
