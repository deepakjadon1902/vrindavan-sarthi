const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateProductionConfig,
  redactSecret,
  isLocalMongoUri,
} = require('../config/productionConfig');
const { findUnsafeMongoKey, rejectUnsafeMongoKeys } = require('../middleware/noSqlSanitizer');
const { createMemoryStore, createRateLimiter } = require('../middleware/rateLimit');
const { securityHeaders } = require('../middleware/securityHeaders');
const { getReadinessSnapshot } = require('../utils/readiness');
const { createGracefulShutdown } = require('../utils/gracefulShutdown');

const createRes = () => {
  const headers = {};
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

test('production configuration rejects unsafe production fallbacks without exposing values', () => {
  const env = {
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://localhost:27017/vrindavan',
    JWT_SECRET: 'short',
    CORS_ORIGINS: '*',
    REDIS_REQUIRED: 'true',
  };
  const result = validateProductionConfig(env, { role: 'api' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((msg) => msg.includes('localhost')));
  assert.ok(result.errors.some((msg) => msg.includes('JWT_SECRET')));
  assert.ok(result.errors.some((msg) => msg.includes('wildcard')));
  assert.ok(result.errors.some((msg) => msg.includes('REDIS_URL')));
  assert.equal(result.errors.join(' ').includes('mongodb://localhost:27017/vrindavan'), false);
  assert.equal(redactSecret('super-secret-production-value').includes('secret-production'), false);
});

test('production configuration allows API Redis to be optional when durable jobs are disabled', () => {
  const result = validateProductionConfig({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb+srv://cluster.example/vrindavan',
    JWT_SECRET: 'a'.repeat(40),
    CORS_ORIGINS: 'https://vrindavansarthi.in',
    PAYMENT_RECONCILIATION_ENABLED: 'false',
    BOOKING_EXPIRATION_ENABLED: 'false',
  }, { role: 'api' });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((msg) => msg.includes('REDIS_URL')));
  assert.equal(isLocalMongoUri('mongodb://127.0.0.1:27017/test'), true);
});

test('NoSQL sanitizer rejects operator and dotted keys', () => {
  assert.equal(findUnsafeMongoKey({ email: { $ne: null } }), 'email.$ne');
  assert.equal(findUnsafeMongoKey({ 'profile.role': 'admin' }), 'profile.role');
  assert.equal(findUnsafeMongoKey({ email: 'guest@example.com', nested: [{ ok: true }] }), null);

  const req = { body: { status: { $in: ['admin'] } }, query: {} };
  const res = createRes();
  let nextCalled = false;
  rejectUnsafeMongoKeys(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Invalid request payload');
});

test('rate limiter blocks repeated requests for the same key', () => {
  let time = 1000;
  const limiter = createRateLimiter({
    windowMs: 10000,
    max: 2,
    now: () => time,
    store: createMemoryStore(),
    keyGenerator: () => 'same-client',
  });
  const req = { headers: {}, method: 'POST', path: '/login' };
  const first = createRes();
  const second = createRes();
  const third = createRes();
  let calls = 0;
  limiter(req, first, () => { calls += 1; });
  limiter(req, second, () => { calls += 1; });
  limiter(req, third, () => { calls += 1; });
  assert.equal(calls, 2);
  assert.equal(third.statusCode, 429);
  time += 11000;
  const afterWindow = createRes();
  limiter(req, afterWindow, () => { calls += 1; });
  assert.equal(afterWindow.statusCode, 200);
});

test('security headers are applied without logging secrets', () => {
  const req = {};
  const res = createRes();
  let nextCalled = false;
  securityHeaders(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('readiness separates liveness from infrastructure readiness', () => {
  const ready = getReadinessSnapshot({
    mongoReadyState: 1,
    queueConfig: { configured: true },
    redisRequired: true,
  });
  assert.equal(ready.ready, true);
  const notReady = getReadinessSnapshot({
    mongoReadyState: 0,
    queueConfig: { configured: false },
    redisRequired: true,
  });
  assert.equal(notReady.ready, false);
  assert.equal(notReady.checks.mongo, 'not_ready');
  assert.equal(notReady.checks.redis, 'missing');
});

test('graceful shutdown closes HTTP, queues, and database once', async () => {
  const calls = [];
  const server = {
    close(cb) {
      calls.push('server');
      cb();
    },
  };
  const shutdown = createGracefulShutdown({
    server,
    closeQueues: async () => calls.push('queues'),
    closeDatabase: async () => calls.push('database'),
    exit: () => calls.push('exit'),
    logger: { log: () => {} },
  });
  await shutdown('SIGTERM');
  await shutdown('SIGTERM');
  assert.deepEqual(calls, ['server', 'queues', 'database', 'exit']);
});
