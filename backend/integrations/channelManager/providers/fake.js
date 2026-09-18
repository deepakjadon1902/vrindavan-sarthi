const state = {
  inventoryUpdates: [],
  rateUpdates: [],
  reservationCalls: [],
  duplicateKeys: new Set(),
  failures: new Map(),
};

const fakeCapabilities = Object.freeze({
  availability: true,
  rates: true,
  restrictions: true,
  reservations: true,
  modifications: true,
  cancellations: true,
  webhooks: true,
  idempotency: true,
});

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const maybeFail = (method) => {
  const failure = state.failures.get(method);
  if (!failure) return;
  state.failures.delete(method);
  const err = new Error(failure.message || 'Fake channel provider failure');
  err.statusCode = failure.statusCode;
  err.retryable = failure.retryable;
  err.code = failure.code;
  throw err;
};

const setFakeChannelProviderFailure = (method, failure = {}) => {
  state.failures.set(method, failure);
};

const resetFakeChannelProvider = () => {
  state.inventoryUpdates = [];
  state.rateUpdates = [];
  state.reservationCalls = [];
  state.duplicateKeys.clear();
  state.failures.clear();
};

const getFakeChannelProviderState = () => clone({
  inventoryUpdates: state.inventoryUpdates,
  rateUpdates: state.rateUpdates,
  reservationCalls: state.reservationCalls,
});

const rememberIdempotency = (payload = {}) => {
  const key = payload.idempotencyKey || payload.operationKey;
  if (!key) return false;
  if (state.duplicateKeys.has(key)) return true;
  state.duplicateKeys.add(key);
  return false;
};

const createFakeChannelProvider = () => ({
  name: 'fake',
  supportsLiveCalls: false,
  capabilities: fakeCapabilities,

  async getCapabilities() {
    return fakeCapabilities;
  },

  async healthCheck() {
    return { ok: true, provider: 'fake', capabilities: fakeCapabilities };
  },

  async updateAvailability(payload) {
    maybeFail('updateAvailability');
    const duplicate = rememberIdempotency(payload);
    const record = { ...clone(payload), duplicate, providerReference: duplicate ? 'fake-duplicate' : `fake-inventory-${state.inventoryUpdates.length + 1}` };
    state.inventoryUpdates.push(record);
    return { ok: true, duplicate, providerReference: record.providerReference };
  },

  async updateRates(payload) {
    maybeFail('updateRates');
    const duplicate = rememberIdempotency(payload);
    const record = { ...clone(payload), duplicate, providerReference: duplicate ? 'fake-duplicate' : `fake-rate-${state.rateUpdates.length + 1}` };
    state.rateUpdates.push(record);
    return { ok: true, duplicate, providerReference: record.providerReference };
  },

  async createReservation(payload) {
    maybeFail('createReservation');
    const duplicate = rememberIdempotency(payload);
    const record = { action: 'createReservation', ...clone(payload), duplicate, providerReference: duplicate ? 'fake-duplicate' : `fake-reservation-${state.reservationCalls.length + 1}` };
    state.reservationCalls.push(record);
    return { ok: true, duplicate, providerReference: record.providerReference };
  },

  async modifyReservation(payload) {
    maybeFail('modifyReservation');
    const duplicate = rememberIdempotency(payload);
    const record = { action: 'modifyReservation', ...clone(payload), duplicate, providerReference: duplicate ? 'fake-duplicate' : `fake-reservation-${state.reservationCalls.length + 1}` };
    state.reservationCalls.push(record);
    return { ok: true, duplicate, providerReference: record.providerReference };
  },

  async cancelReservation(payload) {
    maybeFail('cancelReservation');
    const duplicate = rememberIdempotency(payload);
    const record = { action: 'cancelReservation', ...clone(payload), duplicate, providerReference: duplicate ? 'fake-duplicate' : `fake-cancel-${state.reservationCalls.length + 1}` };
    state.reservationCalls.push(record);
    return { ok: true, duplicate, providerReference: record.providerReference };
  },
});

module.exports = {
  createFakeChannelProvider,
  getFakeChannelProviderState,
  resetFakeChannelProvider,
  setFakeChannelProviderFailure,
};
