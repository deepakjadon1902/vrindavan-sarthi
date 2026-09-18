const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addObjectIdFilter,
  addStringFilter,
  getQueueHealth,
  parsePagination,
  sanitizeNotificationDelivery,
  sanitizeWebhookEvent,
} = require('../utils/operationalReliability');

test('operation pagination clamps unsafe limits', () => {
  assert.deepEqual(parsePagination({ page: '2', limit: '5000' }), { page: 2, limit: 100, skip: 100 });
  assert.deepEqual(parsePagination({ page: '-1', limit: 'bad' }), { page: 1, limit: 25, skip: 0 });
});

test('operation filters reject invalid ObjectIds', () => {
  const filter = {};
  assert.throws(() => addObjectIdFilter(filter, { bookingId: 'bad-id' }, 'bookingId'), /Invalid bookingId/);
});

test('operation filters whitelist controlled string values', () => {
  const filter = {};
  addStringFilter(filter, { status: 'failed' }, 'status', 'status', ['failed', 'queued']);
  assert.equal(filter.status, 'failed');
  assert.throws(() => addStringFilter({}, { status: 'hacked' }, 'status', 'status', ['failed']), /Invalid status/);
});

test('webhook sanitizer removes raw payload from detail response', () => {
  const sanitized = sanitizeWebhookEvent({
    eventId: 'evt_1',
    payload: { secret: 'do-not-return' },
    payloadHash: 'abc',
  });
  assert.equal(sanitized.eventId, 'evt_1');
  assert.equal(sanitized.payload, undefined);
  assert.equal(sanitized.payloadHash, 'abc');
});

test('notification sanitizer removes sensitive payload keys', () => {
  const sanitized = sanitizeNotificationDelivery({
    notificationKey: 'notification:test',
    payload: { safe: 'ok', secret: 'no', token: 'no', providerHeaders: { authorization: 'no' } },
  });
  assert.deepEqual(sanitized.payload, { safe: 'ok' });
});

test('queue health reports degraded when Redis queue factory is unavailable', async () => {
  const health = await getQueueHealth({ queueFactory: () => null });
  assert.equal(health.redisAvailable, false);
  assert.ok(health.queues.length >= 1);
  assert.ok(health.queues.every((queue) => queue.available === false));
});

test('queue health uses safe BullMQ count API without exposing connection details', async () => {
  const health = await getQueueHealth({
    queueFactory: (queueName) => ({
      getJobCounts: async () => ({ waiting: 1, active: 0, failed: 2 }),
      isPaused: async () => false,
      close: async () => {},
      queueName,
    }),
  });
  assert.equal(health.redisAvailable, true);
  assert.equal(health.queues[0].available, true);
  assert.equal(health.queues[0].counts.failed, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(health.queues[0], 'url'), false);
});
