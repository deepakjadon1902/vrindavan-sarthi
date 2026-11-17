const fs = require('fs');
const path = require('path');

const testFilePath = path.join(__dirname, '..', 'backend', 'tests', 'phase1-security.test.js');
let testCode = fs.readFileSync(testFilePath, 'utf8');

const additionalTests = `
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
        assert.match(err.message, /An account with this email already exists\\. Please login/);
        return true;
      }
    );
  } finally {
    if (originalUserModule) require.cache[userPath] = originalUserModule;
    else delete require.cache[userPath];
    delete require.cache[require.resolve('../utils/guestBookingAccess')];
  }
});
`;

if (!testCode.includes('SEC-01 remediation')) {
  testCode += '\n' + additionalTests;
  fs.writeFileSync(testFilePath, testCode, 'utf8');
  console.log('Appended SEC-01 tests to phase1-security.test.js');
} else {
  console.log('SEC-01 tests already present');
}
