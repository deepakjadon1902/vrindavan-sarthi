require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

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

connectDB();

const app = express();

app.use(cors());
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'VrindavanSarthi API running' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
