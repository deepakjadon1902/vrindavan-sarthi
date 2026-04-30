const User = require('../models/User');
const Settings = require('../models/Settings');

const getEnvString = (key) => (typeof process.env[key] === 'string' ? process.env[key].trim() : '');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isTruthy = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
};

const seedAdminOnce = async () => {
  const seedEnabled = getEnvString('SEED_ADMIN') === 'true';
  if (!seedEnabled) return;

  const email = normalizeEmail(getEnvString('ADMIN_EMAIL'));
  const password = getEnvString('ADMIN_PASSWORD');
  const name = getEnvString('ADMIN_NAME') || 'Admin';
  const phone = getEnvString('ADMIN_PHONE') || '0000000000';
  const legacyEmail = normalizeEmail(getEnvString('ADMIN_LEGACY_EMAIL'));

  if (!email || !password) {
    console.warn('SEED_ADMIN=true but ADMIN_EMAIL/ADMIN_PASSWORD not set. Skipping admin seed.');
    return;
  }

  console.log(`Admin seed enabled for: ${email}`);

  const forcePassword = getEnvString('ADMIN_FORCE_PASSWORD') === 'true';
  const migrateAnyAdmin = isTruthy(getEnvString('ADMIN_MIGRATE_ANY_ADMIN'));

  let adminUser = await User.findOne({ email }).select('+password');
  if (!adminUser && legacyEmail) {
    adminUser = await User.findOne({ email: legacyEmail }).select('+password');
  }
  if (!adminUser && migrateAnyAdmin) {
    adminUser = await User.findOne({ role: 'admin' }).select('+password');
  }

  if (!adminUser) {
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
  } else {
    let changed = false;
    if (adminUser.email !== email) {
      adminUser.email = email;
      changed = true;
    }
    if (adminUser.name !== name) {
      adminUser.name = name;
      changed = true;
    }
    if (adminUser.phone !== phone) {
      adminUser.phone = phone;
      changed = true;
    }
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      changed = true;
    }
    if (adminUser.authProvider !== 'local') {
      adminUser.authProvider = 'local';
      changed = true;
    }

    if (forcePassword) {
      adminUser.password = password;
      changed = true;
    }

    if (changed) {
      await adminUser.save();
      console.log(`Updated admin user: ${email}`);
    } else {
      console.log(`Admin user already present: ${email}`);
    }
  }

  // Keep public-facing admin contact info in Settings aligned with the seeded admin.
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const desiredSiteName = getEnvString('SITE_NAME') || 'Vrindavan Sarthi';
    const desiredMetaTitle = getEnvString('META_TITLE') || desiredSiteName;
    const desiredUpiName = getEnvString('UPI_NAME') || desiredSiteName;

    let settingsChanged = false;

    if (!settings.siteName || settings.siteName === 'VrindavanSarthi') {
      settings.siteName = desiredSiteName;
      settingsChanged = true;
    }
    if (!settings.metaTitle || settings.metaTitle === 'VrindavanSarthi') {
      settings.metaTitle = desiredMetaTitle;
      settingsChanged = true;
    }
    if (!settings.upiName || settings.upiName === 'VrindavanSarthi') {
      settings.upiName = desiredUpiName;
      settingsChanged = true;
    }
    if (!settings.adminEmail || String(settings.adminEmail).trim().toLowerCase() !== email) {
      settings.adminEmail = email;
      settingsChanged = true;
    }
    if (!settings.adminPhone || String(settings.adminPhone).trim() !== phone) {
      settings.adminPhone = phone;
      settingsChanged = true;
    }

    if (settingsChanged) await settings.save();
  } catch (err) {
    console.warn('Settings seed skipped:', err?.message || err);
  }
};

module.exports = { seedAdminOnce };
