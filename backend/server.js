const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { closeDB } = require('./config/db');
const { seedAdminOnce } = require('./config/seedAdmin');
const { seedToursOnce } = require('./config/seedTours');
const { ensureIndexesOnce } = require('./config/ensureIndexes');
const { requestTiming } = require('./middleware/requestTiming');
const { securityHeaders } = require('./middleware/securityHeaders');
const { rejectUnsafeMongoKeys } = require('./middleware/noSqlSanitizer');
const {
  authRateLimiter,
  passwordResetRateLimiter,
  publicWriteRateLimiter,
  paymentRateLimiter,
  webhookRateLimiter,
  uploadRateLimiter,
} = require('./middleware/rateLimit');
const { assertProductionConfig, boolEnv } = require('./config/productionConfig');
const { getReadinessSnapshot } = require('./utils/readiness');
const { closeQueueResources } = require('./queues/factory');
const { createGracefulShutdown } = require('./utils/gracefulShutdown');

const authRoutes = require('./routes/auth.routes');
const hotelRoutes = require('./routes/hotel.routes');
const roomTypeRoutes = require('./routes/roomType.routes');
const cabRoutes = require('./routes/cab.routes');
const tourRoutes = require('./routes/tour.routes');
const bookingRoutes = require('./routes/booking.routes');
const userRoutes = require('./routes/user.routes');
const partnerRoutes = require('./routes/partner.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const adminInventoryRoutes = require('./routes/adminInventory.routes');
const settingsRoutes = require('./routes/settings.routes');
const paymentRoutes = require('./routes/payment.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const adminAnalyticsRoutes = require('./routes/adminAnalytics.routes');
const cabFareRoutes = require('./routes/cabFare.routes');
const contactRoutes = require('./routes/contact.routes');
const reviewRoutes = require('./routes/review.routes');
const seoRoutes = require('./routes/seo.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminOperationsRoutes = require('./routes/adminOperations.routes');
const rateRoutes = require('./routes/rate.routes');
const channelRoutes = require('./routes/channel.routes');
const Hotel = require('./models/Hotel');
const Tour = require('./models/Tour');
const Booking = require('./models/Booking');
const { getQueueConfig } = require('./config/redis');

try {
  const configResult = assertProductionConfig(process.env, { role: 'api' });
  for (const warning of configResult.warnings || []) {
    console.warn(`[config] ${warning}`);
  }
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

connectDB();

let adminSeedTriggered = false;
const trySeedAdmin = async () => {
  if (adminSeedTriggered) return;
  if (mongoose.connection.readyState !== 1) return;
  adminSeedTriggered = true;
  try {
    await seedAdminOnce();
    await seedToursOnce();
  } catch (err) {
    console.error('Admin seed failed:', err?.message || err);
  }
};

mongoose.connection.on('connected', () => {
  void trySeedAdmin();
  void ensureIndexesOnce();
});

// In case the connection event fires before the listener attaches (rare),
// or the initial connection is delayed, poll until connected and seed once.
void trySeedAdmin();
void ensureIndexesOnce();
const seedPoll = setInterval(() => {
  if (adminSeedTriggered) return clearInterval(seedPoll);
  void trySeedAdmin();
}, 2000);

const app = express();
app.disable('x-powered-by');

// Log only slow requests to help identify hangs/timeouts in prod/local.
app.use(requestTiming());
app.use(securityHeaders);

app.use(
  compression({
    // Avoid compressing tiny payloads.
    threshold: 1024,
  })
);

// If MongoDB is down, return a clear error instead of hanging/throwing deep in handlers.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/readiness') return next();
  if (mongoose.connection.readyState === 1) return next();

  // If the DB is currently connecting, wait briefly to avoid transient "DB not connected" errors
  // during startup/reconnects.
  const start = Date.now();
  const maxWaitMs = 1500;

  const check = () => mongoose.connection.readyState === 1;
  if (mongoose.connection.readyState === 2) {
    const interval = setInterval(() => {
      if (check() || Date.now() - start > maxWaitMs) clearInterval(interval);
    }, 50);

    return setTimeout(() => {
      if (check()) return next();
      return res.status(503).json({
        success: false,
        message: 'Database not connected. Please check MONGO_URI in backend/.env and restart the backend.',
        dbReadyState: mongoose.connection.readyState,
      });
    }, maxWaitMs);
  }

  return res.status(503).json({
    success: false,
    message: 'Database not connected. Please check MONGO_URI in backend/.env and restart the backend.',
    dbReadyState: mongoose.connection.readyState,
  });
});

const splitOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
  ...splitOrigins(process.env.FRONTEND_BASE_URL),
  ...splitOrigins(process.env.CORS_ORIGINS),
  'https://www.vrindavansarthi.in',
  'https://vrindavansarthi.in',
  'https://www.vrindavansarthi.com',
  'https://vrindavansarthi.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '25mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '10mb' }));
app.use(rejectUnsafeMongoKeys);
app.use('/uploads', express.static('uploads'));

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/forgot-password', passwordResetRateLimiter);
app.use('/api/auth/verify-reset-otp', passwordResetRateLimiter);
app.use('/api/auth/reset-password', passwordResetRateLimiter);
app.use('/api/contact', publicWriteRateLimiter);
app.use('/api/bookings/room-type', publicWriteRateLimiter);
app.use('/api/bookings/cab', publicWriteRateLimiter);
app.use('/api/payments/razorpay/orders', paymentRateLimiter);
app.use('/api/payments/razorpay/verify', paymentRateLimiter);
app.use('/api/payments/razorpay/fail', paymentRateLimiter);
app.use('/api/payment/razorpay/orders', paymentRateLimiter);
app.use('/api/payment/razorpay/verify', paymentRateLimiter);
app.use('/api/payment/razorpay/fail', paymentRateLimiter);
app.use('/api/payments/razorpay/webhook', webhookRateLimiter);
app.use('/api/payment/razorpay/webhook', webhookRateLimiter);
app.use('/api/channel/webhooks', webhookRateLimiter);
app.use('/api/settings/logo', uploadRateLimiter);
app.use('/api/settings/favicon', uploadRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/cabs', cabRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/partner/inventory', inventoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cab-fares', cabFareRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/channel', channelRoutes);
app.use('/api/admin/operations', adminOperationsRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin/inventory', adminInventoryRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
  });
});

app.get('/api/readiness', (req, res) => {
  const snapshot = getReadinessSnapshot({
    queueConfig: getQueueConfig(),
    redisRequired: boolEnv(process.env, 'REDIS_REQUIRED'),
  });
  res.status(snapshot.ready ? 200 : 503).json({
    status: snapshot.ready ? 'ready' : 'not_ready',
    checks: snapshot.checks,
  });
});

app.get('/api/public-stats', async (_req, res) => {
  try {
    const [happyPilgrims, hotelsListed, tourPackages] = await Promise.all([
      Booking.distinct('userId', {
        paymentStatus: 'paid',
        bookingStatus: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'] },
      }).then((ids) => ids.length),
      Hotel.countDocuments({
        status: 'active',
        approvalStatus: 'approved',
        propertyType: { $in: ['hotel', 'dharamshala', 'home_stay', 'guest_house'] },
      }),
      Tour.countDocuments({ status: 'active', approvalStatus: 'approved' }),
    ]);

    res.json({
      success: true,
      data: {
        happyPilgrims,
        hotelsListed,
        tourPackages,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const safeMessage = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Server Error'
    : (err.message || 'Server Error');
  console.error('[request_error]', JSON.stringify({
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
  }));
  res.status(statusCode).json({ success: false, message: safeMessage });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const shutdown = createGracefulShutdown({
  server,
  closeQueues: closeQueueResources,
  closeDatabase: closeDB,
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

module.exports = { app, server, shutdown };

