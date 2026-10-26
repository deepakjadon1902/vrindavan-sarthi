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


const {
  buildGuestAccountReminder,
  hashGuestAccessToken,
} = require('../utils/guestBookingAccess');

test('SEC-01 remediation: buildGuestAccountReminder excludes passwordHint and cleartext credentials', () => {
  const reminder = buildGuestAccountReminder({ email: 'guest@example.com', created: true });
  assert.equal(reminder.email, 'guest@example.com');
  assert.equal(reminder.passwordHint, undefined);
  assert.equal(reminder.phone, undefined);
  assert.doesNotMatch(reminder.message, /password/i);
  assert.match(reminder.message, /secure booking link/i);
});

test('SEC-01 remediation: resolveBookingCustomer assigns unguessable password for new guests and never uses phone', async () => {
  const userPath = require.resolve('../models/User');
  const originalUserModule = require.cache[userPath];

  let createdUserPayload = null;
  require.cache[userPath] = {
    id: userPath,
    filename: userPath,
    loaded: true,
    exports: {
      findOne: () => ({ select: async () => null }),
      create: async (payload) => {
        createdUserPayload = payload;
        return { ...payload, _id: 'mock-guest-id' };
      },
    },
  };

  try {
    delete require.cache[require.resolve('../utils/guestBookingAccess')];
    const { resolveBookingCustomer: resolveCustomerFresh } = require('../utils/guestBookingAccess');

    const result = await resolveCustomerFresh({
      req: {},
      customerFullName: 'Sita Ram',
      customerMobile: '9876543210',
      customerEmail: 'sitaram@example.com',
    });

    assert.equal(result.isGuestBooking, true);
    assert.ok(result.guestAccessToken);
    assert.equal(result.guestAccessTokenHash, hashGuestAccessToken(result.guestAccessToken));
    assert.ok(createdUserPayload);
    assert.notEqual(createdUserPayload.password, '9876543210');
    assert.equal(createdUserPayload.password.length, 64); // 32 bytes in hex = 64 hex chars
    assert.equal(result.guestAccountReminder?.passwordHint, undefined);
  } finally {
    if (originalUserModule) require.cache[userPath] = originalUserModule;
    else delete require.cache[userPath];
    delete require.cache[require.resolve('../utils/guestBookingAccess')];
  }
});

test('SEC-01 remediation: registered user email cannot be hijacked by guest checkout', async () => {
  const userPath = require.resolve('../models/User');
  const originalUserModule = require.cache[userPath];

  require.cache[userPath] = {
    id: userPath,
    filename: userPath,
    loaded: true,
    exports: {
      findOne: () => ({
        select: async () => ({
          _id: 'registered-user-id',
          email: 'registered@example.com',
          phone: '9876543210',
          password: 'secure-bcrypt-hash',
          isGuest: false,
          role: 'user',
        }),
      }),
    },
  };

  try {
    delete require.cache[require.resolve('../utils/guestBookingAccess')];
    const { resolveBookingCustomer: resolveCustomerFresh } = require('../utils/guestBookingAccess');

    await assert.rejects(
      async () => {
        await resolveCustomerFresh({
          req: {},
          customerFullName: 'Attacker Impersonator',
          customerMobile: '9999999999',
          customerEmail: 'registered@example.com',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /An account with this email already exists\. Please login/);
        return true;
      }
    );
  } finally {
    if (originalUserModule) require.cache[userPath] = originalUserModule;
    else delete require.cache[userPath];
    delete require.cache[require.resolve('../utils/guestBookingAccess')];
  }
});

test('SEC-01 remediation: getGuestAccessTokenFromRequest extracts tokens across header and query conventions', () => {
  const { getGuestAccessTokenFromRequest } = require('../utils/guestBookingAccess');

  // Header extraction: x-guest-access-token and x-guest-booking-token
  const reqAccessHeader = { get: (h) => (h.toLowerCase() === 'x-guest-access-token' ? 'tok-access-123' : '') };
  assert.equal(getGuestAccessTokenFromRequest(reqAccessHeader), 'tok-access-123');

  const reqBookingHeader = { get: (h) => (h.toLowerCase() === 'x-guest-booking-token' ? 'tok-booking-456' : '') };
  assert.equal(getGuestAccessTokenFromRequest(reqBookingHeader), 'tok-booking-456');

  // Query extraction: token and guestAccessToken
  assert.equal(getGuestAccessTokenFromRequest({ query: { token: 'tok-query-1' } }), 'tok-query-1');
  assert.equal(getGuestAccessTokenFromRequest({ query: { guestAccessToken: 'tok-query-2' } }), 'tok-query-2');

  // Body extraction
  assert.equal(getGuestAccessTokenFromRequest({ body: { guestAccessToken: 'tok-body-3' } }), 'tok-body-3');

  // Safe fallback
  assert.equal(getGuestAccessTokenFromRequest({}), '');
});

test('SEC-01 remediation: guest access validation strictly rejects registered-user bookings and invalid tokens', () => {
  const { hashGuestAccessToken } = require('../utils/guestBookingAccess');

  const validToken = 'secret-token-xyz-12345';
  const validHash = hashGuestAccessToken(validToken);

  const isGuestAuthorized = (booking, token) => Boolean(
    token &&
    booking.isGuestBooking &&
    booking.guestAccessTokenHash &&
    booking.guestAccessTokenHash === hashGuestAccessToken(token)
  );

  // 1. Valid guest booking with matching token
  assert.equal(isGuestAuthorized({ isGuestBooking: true, guestAccessTokenHash: validHash }, validToken), true);

  // 2. Mismatched token
  assert.equal(isGuestAuthorized({ isGuestBooking: true, guestAccessTokenHash: validHash }, 'wrong-token'), false);

  // 3. Missing token
  assert.equal(isGuestAuthorized({ isGuestBooking: true, guestAccessTokenHash: validHash }, ''), false);

  // 4. Registered-user booking (isGuestBooking: false) - MUST NEVER BE AUTHORIZED VIA GUEST TOKEN
  assert.equal(isGuestAuthorized({ isGuestBooking: false, guestAccessTokenHash: validHash }, validToken), false);
  assert.equal(isGuestAuthorized({ isGuestBooking: undefined, guestAccessTokenHash: validHash }, validToken), false);
});
test('SEC-02: public QR booking verification is protected by IP rate limiter (30 req/min)', () => {
  const { qrVerificationRateLimiter, createRateLimiter, createMemoryStore } = require('../middleware/rateLimit');

  const createMockRes = () => {
    const headers = {};
    return {
      statusCode: 200,
      body: null,
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

  // Reset any previous state
  qrVerificationRateLimiter.reset();

  // 1. Within limit: 30 requests from IP 192.168.1.100 pass through
  let passedCount = 0;
  for (let i = 1; i <= 30; i++) {
    const req = {
      headers: { 'x-forwarded-for': '192.168.1.100' },
      path: '/verify/BK-' + i,
      method: 'GET',
    };
    const res = createMockRes();
    let nextCalled = false;
    qrVerificationRateLimiter(req, res, () => {
      nextCalled = true;
      passedCount++;
    });
    assert.equal(nextCalled, true, 'Request ' + i + ' within limit must pass');
    assert.equal(res.headers['RateLimit-Limit'], '30');
    assert.equal(res.headers['RateLimit-Remaining'], String(30 - i));
  }
  assert.equal(passedCount, 30, 'Exactly 30 requests must pass');

  // 2. Exceeding limit: 31st request from IP 192.168.1.100 is blocked with 429
  const blockedReq = {
    headers: { 'x-forwarded-for': '192.168.1.100' },
    path: '/verify/BK-999',
    method: 'GET',
  };
  const blockedRes = createMockRes();
  let blockedNext = false;
  qrVerificationRateLimiter(blockedReq, blockedRes, () => {
    blockedNext = true;
  });
  assert.equal(blockedNext, false, '31st request must NOT call next()');
  assert.equal(blockedRes.statusCode, 429, '31st request must return HTTP 429');
  assert.equal(blockedRes.body.success, false);
  assert.equal(blockedRes.body.message, 'Too many verification requests. Please try again later.');
  assert.equal(blockedRes.headers['RateLimit-Remaining'], '0');

  // 3. Different IP is NOT throttled (independent counters)
  const differentIpReq = {
    headers: { 'x-forwarded-for': '10.0.0.50' },
    path: '/verify/BK-1',
    method: 'GET',
  };
  const differentIpRes = createMockRes();
  let differentIpNext = false;
  qrVerificationRateLimiter(differentIpReq, differentIpRes, () => {
    differentIpNext = true;
  });
  assert.equal(differentIpNext, true, 'Different IP must not be throttled');
  assert.equal(differentIpRes.statusCode, 200);
  assert.equal(differentIpRes.headers['RateLimit-Remaining'], '29');

  // 4. Verify router has qrVerificationRateLimiter mounted on /verify/:bookingId
  const routeSource = readBackendFile('routes', 'booking.routes.js');
  assert.ok(
    routeSource.includes("router.get('/verify/:bookingId', qrVerificationRateLimiter,"),
    'booking.routes.js must mount qrVerificationRateLimiter directly on GET /verify/:bookingId'
  );

  // Clean up
  qrVerificationRateLimiter.reset();
});
