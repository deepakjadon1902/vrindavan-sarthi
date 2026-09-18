const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

const createMemoryStore = () => {
  const entries = new Map();
  return {
    increment(key, now, windowMs) {
      const current = entries.get(key);
      if (!current || current.resetAt <= now) {
        const next = { count: 1, resetAt: now + windowMs };
        entries.set(key, next);
        return next;
      }
      current.count += 1;
      return current;
    },
    reset() {
      entries.clear();
    },
  };
};

const createRateLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = 100,
  message = 'Too many requests',
  keyGenerator = (req) => `${getClientIp(req)}:${req.method}:${req.baseUrl || ''}${req.path || req.originalUrl || ''}`,
  skip = () => false,
  now = () => Date.now(),
  store = createMemoryStore(),
} = {}) => {
  const limit = Math.max(1, Number(max) || 1);
  const windowLength = Math.max(1000, Number(windowMs) || DEFAULT_WINDOW_MS);

  const middleware = (req, res, next) => {
    if (skip(req)) return next();
    const timestamp = now();
    const key = keyGenerator(req);
    const entry = store.increment(key, timestamp, windowLength);
    const remaining = Math.max(0, limit - entry.count);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
  middleware.reset = () => store.reset();
  return middleware;
};

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 25, message: 'Too many authentication attempts' });
const passwordResetRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many password reset attempts' });
const publicWriteRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, message: 'Too many requests' });
const paymentRateLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 40, message: 'Too many payment requests' });
const webhookRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300, message: 'Too many webhook requests' });
const uploadRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many upload requests' });

module.exports = {
  createMemoryStore,
  createRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  publicWriteRateLimiter,
  paymentRateLimiter,
  webhookRateLimiter,
  uploadRateLimiter,
};
