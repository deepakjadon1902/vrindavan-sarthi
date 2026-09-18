const assert = require('node:assert/strict');
const test = require('node:test');

const ChannelInboundEvent = require('../models/ChannelInboundEvent');
const ChannelMapping = require('../models/ChannelMapping');
const ChannelSyncOperation = require('../models/ChannelSyncOperation');
const ExternalReservation = require('../models/ExternalReservation');
const { JOB_NAMES, QUEUE_NAMES } = require('../queues/names');
const {
  buildChannelOperationKey,
  classifyChannelProviderError,
  createOrGetChannelSyncOperation,
  enqueueChannelSyncOperation,
  normalizeInboundReservationPayload,
} = require('../utils/channelManager');
const {
  getChannelProvider,
  getFakeChannelProviderState,
  resetFakeChannelProvider,
  setFakeChannelProviderFailure,
} = require('../integrations/channelManager');

test('Phase 6 queue names and job names are centralized', () => {
  assert.equal(QUEUE_NAMES.channel, 'vrindavan-sarthi-channel');
  assert.equal(JOB_NAMES.channelSyncProcess, 'channel.sync.process');
});

test('channel operation keys are deterministic for the same logical sync', () => {
  const a = buildChannelOperationKey({
    provider: 'ezee',
    operation: 'inventory_sync',
    entityType: 'room_type',
    entityId: 'roomType1',
    from: '2026-10-01',
    to: '2026-10-03',
  });
  const b = buildChannelOperationKey({
    provider: 'EZEE',
    operation: 'inventory_sync',
    entityType: 'room_type',
    entityId: 'roomType1',
    from: '2026-10-01',
    to: '2026-10-03',
  });
  assert.equal(a, b);
});

test('provider error classification separates retryable and permanent failures', () => {
  assert.equal(classifyChannelProviderError({ statusCode: 429 }), 'retryable');
  assert.equal(classifyChannelProviderError({ statusCode: 503 }), 'retryable');
  assert.equal(classifyChannelProviderError({ statusCode: 401 }), 'permanent');
  assert.equal(classifyChannelProviderError({ code: 'ETIMEDOUT' }), 'retryable');
  assert.equal(classifyChannelProviderError({ message: 'lost response' }), 'unknown');
});

test('fake channel provider records deterministic outbound calls', async () => {
  resetFakeChannelProvider();
  const provider = getChannelProvider('fake');
  const response = await provider.updateAvailability({
    externalHotelId: 'H1',
    externalRoomTypeId: 'RT1',
    from: '2026-10-01',
    to: '2026-10-02',
    availableCount: 2,
  });
  assert.equal(response.ok, true);
  assert.equal(getFakeChannelProviderState().inventoryUpdates.length, 1);
});

test('fake channel provider can simulate retryable provider failures', async () => {
  resetFakeChannelProvider();
  setFakeChannelProviderFailure('updateRates', { statusCode: 503, message: 'provider unavailable' });
  const provider = getChannelProvider('fake');
  await assert.rejects(
    provider.updateRates({ externalRatePlanId: 'RP1' }),
    /provider unavailable/
  );
  assert.equal(getFakeChannelProviderState().rateUpdates.length, 0);
});

test('eZee provider is gated until official live contract is configured', async () => {
  const provider = getChannelProvider('ezee');
  const health = await provider.healthCheck();
  assert.equal(health.provider, 'ezee');
  assert.equal(provider.supportsLiveCalls, false);
  await assert.rejects(provider.updateAvailability({}), /contract is not configured/);
});

test('channel schemas declare durable idempotency indexes', () => {
  const mappingIndexes = ChannelMapping.schema.indexes().map(([fields]) => fields);
  const operationIndexes = ChannelSyncOperation.schema.indexes().map(([fields]) => fields);
  const eventIndexes = ChannelInboundEvent.schema.indexes().map(([fields]) => fields);
  const reservationIndexes = ExternalReservation.schema.indexes().map(([fields]) => fields);

  assert.ok(mappingIndexes.some((idx) => idx.provider === 1 && idx.entityType === 1 && idx.internalEntityId === 1));
  assert.ok(operationIndexes.some((idx) => idx.provider === 1 && idx.idempotencyKey === 1));
  assert.ok(eventIndexes.some((idx) => idx.provider === 1 && idx.eventId === 1));
  assert.ok(reservationIndexes.some((idx) => idx.provider === 1 && idx.externalReservationId === 1));
});

test('inbound reservation payload normalization does not trust client pricing as authority', () => {
  const normalized = normalizeInboundReservationPayload({
    eventId: 'evt_1',
    externalReservationId: 'res_1',
    externalHotelId: 'hotel_ext',
    externalRoomTypeId: 'room_ext',
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
    quantity: '2',
    totalAmount: '12345',
    currency: 'inr',
  });
  assert.equal(normalized.quantity, 2);
  assert.equal(normalized.externalAmount, 12345);
  assert.equal(normalized.externalCurrency, 'INR');
});

test('enqueue uses deterministic channel BullMQ job id without requiring Redis in API mode', async () => {
  const operation = {
    _id: '507f1f77bcf86cd799439011',
    provider: 'fake',
  };
  const calls = [];
  const queueFactory = () => ({
    add: async (name, data, opts) => calls.push({ name, data, opts }),
  });
  const result = await enqueueChannelSyncOperation(operation, { queueFactory });
  assert.equal(result.queued, true);
  assert.equal(calls[0].name, JOB_NAMES.channelSyncProcess);
  assert.equal(calls[0].opts.jobId, 'channel:fake:507f1f77bcf86cd799439011');
});

test('create operation helper can be tested with a fake model boundary', async () => {
  assert.equal(typeof createOrGetChannelSyncOperation, 'function');
});
