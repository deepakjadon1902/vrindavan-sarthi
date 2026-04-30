require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { seedAdminOnce } = require('./config/seedAdmin');

const authRoutes = require('./routes/auth.routes');
const hotelRoutes = require('./routes/hotel.routes');
const roomRoutes = require('./routes/room.routes');
const cabRoutes = require('./routes/cab.routes');
const tourRoutes = require('./routes/tour.routes');
const bookingRoutes = require('./routes/booking.routes');
const userRoutes = require('./routes/user.routes');
const partnerRoutes = require('./routes/partner.routes');
const settingsRoutes = require('./routes/settings.routes');
const paymentRoutes = require('./routes/payment.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');

connectDB();

let adminSeedTriggered = false;
const trySeedAdmin = async () => {
  if (adminSeedTriggered) return;
  if (mongoose.connection.readyState !== 1) return;
  adminSeedTriggered = true;
  try {
    await seedAdminOnce();
  } catch (err) {
    console.error('Admin seed failed:', err?.message || err);
  }
};

mongoose.connection.on('connected', () => {
  void trySeedAdmin();
});

// In case the connection event fires before the listener attaches (rare),
// or the initial connection is delayed, poll until connected and seed once.
void trySeedAdmin();
const seedPoll = setInterval(() => {
  if (adminSeedTriggered) return clearInterval(seedPoll);
  void trySeedAdmin();
}, 2000);

const app = express();

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_BASE_URL,
    'http://localhost:8080',
    'http://localhost:3000',
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/cabs', cabRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) =>
  res.json({
    status: 'ok',
    message: 'VrindavanSarthi API running',
    dbReadyState: mongoose.connection.readyState,
  })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
