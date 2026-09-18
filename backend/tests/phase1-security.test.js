const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const {
  LEGACY_GENERIC_BOOKING_TYPES,
  isLodgingBookingType,
  normalizeBookingType,
  pickAllowed,
} = require('../utils/security');
const Booking = require('../models/Booking');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');

const readBackendFile = (...segments) => fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

test('booking type classifier protects lodging from legacy generic booking path', () => {
  assert.equal(isLodgingBookingType('hotel'), true);
  assert.equal(isLodgingBookingType('room'), true);
  assert.equal(isLodgingBookingType('room_type'), true);
  assert.equal(isLodgingBookingType(' ROOM_TYPE '), true);
  assert.equal(isLodgingBookingType('tour'), false);
  assert.equal(LEGACY_GENERIC_BOOKING_TYPES.has('tour'), true);
  assert.equal(LEGACY_GENERIC_BOOKING_TYPES.has('cab'), false);
});

test('generic booking route no longer mass-assigns the request body into Booking', () => {
  const routeSource = readBackendFile('routes', 'booking.routes.js');
  assert.equal(routeSource.includes('...req.body'), false);
  assert.match(routeSource, /isLodgingBookingType\(bookingType\)/);
  assert.match(routeSource, /Lodging bookings must use the room-type reservation flow/);
});

test('partner booking and payment views are scoped to authenticated partner id', () => {
  const bookingRoutes = readBackendFile('routes', 'booking.routes.js');
  const paymentRoutes = readBackendFile('routes', 'payment.routes.js');

  assert.match(bookingRoutes, /Booking\.find\(\{\s*partnerId:\s*req\.user\._id\s*\}\)/);
  assert.match(bookingRoutes, /String\(booking\.partnerId\)\s*===\s*String\(req\.user\._id\)/);
  assert.match(bookingRoutes, /req\.user\.role === 'partner'\s*\?\s*\{\s*_id:\s*req\.params\.id,\s*partnerId:\s*req\.user\._id\s*\}/);
  assert.match(paymentRoutes, /Booking\.find\(\{\s*partnerId:\s*req\.user\._id\s*\}\)/);
});

test('partner inventory routes resolve resources through authenticated partner ownership', () => {
  const inventoryRoutes = readBackendFile('routes', 'inventory.routes.js');

  assert.match(inventoryRoutes, /router\.use\(protect,\s*authorize\('partner'\)\)/);
  assert.match(inventoryRoutes, /Hotel\.findOne\(\{\s*_id:\s*hotelId,\s*partnerId\s*\}\)/);
  assert.match(inventoryRoutes, /RoomType\.findOne\(\{\s*_id:\s*req\.params\.roomTypeId,\s*partnerId:\s*req\.user\._id\s*\}/);
  assert.match(inventoryRoutes, /RoomUnit\.findOne\(\{\s*_id:\s*req\.params\.roomUnitId,\s*partnerId:\s*req\.user\._id\s*\}/);
  assert.match(inventoryRoutes, /RoomUnit\.findOne\(\{\s*_id:\s*block\.roomUnitId,\s*partnerId:\s*req\.user\._id\s*\}/);
});

test('admin-only payment and payout controls remain admin scoped', () => {
  const paymentRoutes = readBackendFile('routes', 'payment.routes.js');
  const partnerRoutes = readBackendFile('routes', 'partner.routes.js');

  assert.match(paymentRoutes, /router\.get\('\/all',\s*protect,\s*authorize\('admin'\)/);
  assert.match(paymentRoutes, /router\.put\('\/:id\/verify',\s*protect,\s*authorize\('admin'\)/);
  assert.match(paymentRoutes, /router\.put\('\/:id\/reject',\s*protect,\s*authorize\('admin'\)/);
  assert.match(partnerRoutes, /router\.get\('\/payouts',\s*protect,\s*authorize\('admin'\)/);
  assert.match(partnerRoutes, /router\.put\('\/payouts\/:partnerId\/settled',\s*protect,\s*authorize\('admin'\)/);
});

test('public registration cannot create admin accounts from request body role', () => {
  const authRoutes = readBackendFile('routes', 'auth.routes.js');

  assert.match(authRoutes, /const accountRole = requestedRole === 'partner' \? 'partner' : 'user'/);
  assert.match(authRoutes, /!\['user', 'partner'\]\.includes\(requestedRole\)/);
  assert.doesNotMatch(authRoutes, /role:\s*role\s*\|\|\s*'user'/);
});

test('allowed-field picker prevents protected ownership and state fields from being copied', () => {
  const picked = pickAllowed(
    {
      customerFullName: 'Customer A',
      upiTransactionId: 'UPI123',
      role: 'admin',
      userId: 'other-user',
      partnerId: 'other-partner',
      hotelId: 'other-hotel',
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      totalAmount: 1,
    },
    ['customerFullName', 'upiTransactionId']
  );

  assert.deepEqual(picked, {
    customerFullName: 'Customer A',
    upiTransactionId: 'UPI123',
  });
});

test('RoomUnitBookingDay keeps unique room-night lock index', () => {
  const indexes = RoomUnitBookingDay.schema.indexes();
  assert.ok(indexes.some(([fields, options]) =>
    fields.roomUnitId === 1 &&
    fields.date === 1 &&
    options?.unique === true
  ));
});

test('Booking ownership fields remain indexed for customer and partner scoped reads', () => {
  const indexes = Booking.schema.indexes();
  assert.ok(indexes.some(([fields]) => fields.userId === 1 && fields.createdAt === -1));
  assert.ok(indexes.some(([fields]) => fields.partnerId === 1 && fields.createdAt === -1));
});

test('auth middleware rejects missing token and deleted users', async () => {
  process.env.JWT_SECRET = 'phase1-test-secret';

  const userPath = require.resolve('../models/User');
  const authPath = require.resolve('../middleware/auth');
  const originalUserModule = require.cache[userPath];
  const originalAuthModule = require.cache[authPath];

  require.cache[userPath] = {
    id: userPath,
    filename: userPath,
    loaded: true,
    exports: {
      findById: () => ({
        select: async () => null,
      }),
    },
  };
  delete require.cache[authPath];

  const { protect } = require('../middleware/auth');

  try {
    let statusCode = 0;
    let payload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
      },
    };

    await protect({ headers: {} }, res, () => assert.fail('next should not run without token'));
    assert.equal(statusCode, 401);
    assert.equal(payload.success, false);

    statusCode = 0;
    payload = null;
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    await protect(
      { headers: { authorization: `Bearer ${token}` } },
      res,
      () => assert.fail('next should not run for deleted user')
    );
    assert.equal(statusCode, 401);
    assert.equal(payload.message, 'User no longer exists');
  } finally {
    if (originalUserModule) require.cache[userPath] = originalUserModule;
    else delete require.cache[userPath];
    if (originalAuthModule) require.cache[authPath] = originalAuthModule;
    else delete require.cache[authPath];
  }
});

test('normalizeBookingType is stable for security decisions', () => {
  assert.equal(normalizeBookingType(' Room_Type '), 'room_type');
  assert.equal(normalizeBookingType(null), '');
});
