const User = require('../models/User');

const getEnvString = (key) => (typeof process.env[key] === 'string' ? process.env[key].trim() : '');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const seedAdminOnce = async () => {
  const seedEnabled = getEnvString('SEED_ADMIN') === 'true';
  if (!seedEnabled) return;

  const email = normalizeEmail(getEnvString('ADMIN_EMAIL'));
  const password = getEnvString('ADMIN_PASSWORD');
  const name = getEnvString('ADMIN_NAME') || 'Admin';
  const phone = getEnvString('ADMIN_PHONE') || '0000000000';

  if (!email || !password) {
    console.warn('SEED_ADMIN=true but ADMIN_EMAIL/ADMIN_PASSWORD not set. Skipping admin seed.');
    return;
  }

  console.log(`Admin seed enabled for: ${email}`);

  const existing = await User.findOne({ email }).select('+password');
  if (!existing) {
    await User.create({
      name,
      email,
      phone,
      password,
      role: 'admin',
      authProvider: 'local',
      partnerStatus: 'approved',
    });
    console.log(`Seeded admin user: ${email}`);
    return;
  }

  let changed = false;
  if (existing.email !== email) {
    existing.email = email;
    changed = true;
  }
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    changed = true;
  }

  const forcePassword = getEnvString('ADMIN_FORCE_PASSWORD') === 'true';
  if (forcePassword) {
    existing.password = password;
    changed = true;
  }

  if (changed) {
    await existing.save();
    console.log(`Updated admin user: ${email}`);
  } else {
    console.log(`Admin user already present: ${email}`);
  }
};

module.exports = { seedAdminOnce };
