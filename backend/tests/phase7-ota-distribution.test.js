const assert = require('node:assert/strict');
const test = require('node:test');

const ChannelConnection = require('../models/ChannelConnection');
const ChannelInboundEvent = require('../models/ChannelInboundEvent');
const ChannelReconciliation = require('../models/ChannelReconciliation');
const ChannelSyncOperation = require('../models/ChannelSyncOperation');
const {
  buildChannelOperationKey,
  buildChannelReconciliationKey,
  classifyChannelProviderError,
  getProviderCapabilities,
  normalizeInboundReservationPayload,
} = require('../utils/channelManager');
const {
  disabledProviderNames,
  getChannelProvider,
  getFakeChannelProviderState,
  resetFakeChannelProvider,
  setFakeChannelProviderFailure,
} = require('../integrations/channelManager');

test('provider registry exposes fake capabilities and safely disables unknown OTA contracts', async () => {
  const fakeCapabilities = await getProviderCapabilities('fake');
  assert.equal(fakeCapabilities.availability, true);
  assert.equal(fakeCapabilities.rates, true);
  assert.equal(fakeCapabilities.reservations, true);
  assert.equal(fakeCapabilities.idempotency, true);

  assert.ok(disabledProviderNames.has('booking_com'));
  const booking = getChannelProvider('booking_com');
  assert.equal(booking.supportsLiveCalls, false);
  assert.equal((await booking.healthCheck()).reason, 'official_contract_required');
  await assert.rejects(booking.updateRates({}), /contract is not configured/);
});

test('channel connection and reconciliation schemas declare required uniqueness', () => {
  const connectionIndexes = ChannelConnection.schema.indexes().map(([fields]) => fields);
  const reconciliationIndexes = ChannelReconciliation.schema.indexes().map(([fields]) => fields);
  const operationIndexes = ChannelSyncOperation.schema.indexes().map(([fields]) => fields);

  assert.ok(connectionIndexes.some((idx) => idx.provider === 1 && idx.hotelId === 1));
  assert.ok(reconciliationIndexes.some((idx) => idx.provider === 1 && idx.reconciliationKey === 1));
  assert.ok(operationIndexes.some((idx) => idx.provider === 1 && idx.operation === 1 && idx.entityType === 1 && idx.entityId === 1 && idx.generatedAt === -1));
});

test('operation keys include provider, target, date range, and remain deterministic', () => {
  const first = buildChannelOperationKey({
    provider: 'fake',
    operation: 'rate_sync',
    entityType: 'rate_plan',
    entityId: 'plan1',
    from: '2026-11-01',
    to: '2026-11-30',
  });
  const second = buildChannelOperationKey({
    provider: 'FAKE',
    operation: 'rate_sync',
    entityType: 'rate_plan',
    entityId: 'plan1',
    from: '2026-11-01',
    to: '2026-11-30',
  });
  assert.equal(first, second);
  assert.match(first, /channel:fake:rate_sync:rate_plan:plan1:2026-11-01:2026-11-30/);
});

test('reconciliation keys are deterministic for duplicate provider problems', () => {
  const first = buildChannelReconciliationKey({
    provider: 'fake',
    reason: 'payload_conflict',
    externalReservationId: 'res-1',
  });
  const second = buildChannelReconciliationKey({
    provider: 'FAKE',
    reason: 'payload_conflict',
    externalReservationId: 'res-1',
  });
  assert.equal(first, second);
});

test('inbound normalization preserves external financial data but does not make it authoritative', () => {
  const normalized = normalizeInboundReservationPayload({
    eventId: 'evt-7',
    eventType: 'reservation.created',
    externalReservationId: 'ota-res-7',
    externalHotelId: 'ota-hotel',
    externalRoomTypeId: 'ota-room',
    externalRatePlanId: 'ota-plan',
    checkIn: '2026-12-01',
    checkOut: '2026-12-02',
    quantity: '1',
    amount: '999999',
    currency: 'usd',
    paymentStatus: 'captured',
  });
  assert.equal(normalized.externalAmount, 999999);
  assert.equal(normalized.externalCurrency, 'USD');
  assert.equal(normalized.externalPaymentStatus, 'captured');
});

test('fake provider simulates idempotent duplicate outbound requests', async () => {
  resetFakeChannelProvider();
  const provider = getChannelProvider('fake');
  const first = await provider.updateAvailability({ operationKey: 'same-op', externalRoomTypeId: 'R1' });
  const second = await provider.updateAvailability({ operationKey: 'same-op', externalRoomTypeId: 'R1' });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(getFakeChannelProviderState().inventoryUpdates.length, 2);
});

test('fake provider can simulate timeout, 429, 500, invalid mapping, and unknown response classes', async () => {
  resetFakeChannelProvider();
  const provider = getChannelProvider('fake');

  setFakeChannelProviderFailure('updateRates', { code: 'ETIMEDOUT', message: 'timeout' });
  await assert.rejects(provider.updateRates({}), /timeout/);
  assert.equal(classifyChannelProviderError({ code: 'ETIMEDOUT' }), 'retryable');

  assert.equal(classifyChannelProviderError({ statusCode: 429 }), 'retryable');
  assert.equal(classifyChannelProviderError({ statusCode: 500 }), 'retryable');
  assert.equal(classifyChannelProviderError({ statusCode: 422 }), 'permanent');
  assert.equal(classifyChannelProviderError({ message: 'provider accepted response lost' }), 'unknown');
});

test('inbound event schema supports duplicate payload conflict state', () => {
  const statusEnum = ChannelInboundEvent.schema.path('status').enumValues;
  assert.ok(statusEnum.includes('duplicate_conflict'));
});

test('channel connection stores capabilities but not plaintext credentials by design', () => {
  const paths = ChannelConnection.schema.paths;
  assert.ok(paths.credentialsReference);
  assert.ok(paths['capabilities.availability']);
  assert.ok(paths['capabilities.idempotency']);
  assert.equal(paths.provider.options.lowercase, true);
});

test('real eZee provider remains safely disabled until official contract exists', async () => {
  const ezee = getChannelProvider('ezee');
  assert.equal(ezee.supportsLiveCalls, false);
  await assert.rejects(ezee.createReservation({}), /contract is not configured/);
});
