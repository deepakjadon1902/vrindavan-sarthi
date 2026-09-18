const { createEzeeProvider } = require('./providers/ezee');
const { createFakeChannelProvider } = require('./providers/fake');
const { createDisabledProvider } = require('./providers/disabled');

const customProviders = new Map();
const disabledProviderNames = new Set(['booking_com', 'agoda', 'expedia', 'makemytrip', 'ota_provider_a', 'ota_provider_b']);

const normalizeProvider = (provider) => String(provider || 'ezee').trim().toLowerCase();

const setChannelProvider = (provider, implementation) => {
  customProviders.set(normalizeProvider(provider), implementation);
};

const resetChannelProviders = () => {
  customProviders.clear();
};

const getChannelProvider = (provider = 'ezee') => {
  const key = normalizeProvider(provider);
  if (customProviders.has(key)) return customProviders.get(key);
  if (key === 'fake') return createFakeChannelProvider();
  if (key === 'ezee') return createEzeeProvider();
  if (disabledProviderNames.has(key)) return createDisabledProvider(key);
  const err = new Error(`Unsupported channel provider: ${key}`);
  err.statusCode = 400;
  throw err;
};

module.exports = {
  getChannelProvider,
  disabledProviderNames,
  normalizeProvider,
  resetChannelProviders,
  setChannelProvider,
};
