const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getBullMqPrefix,
  getDefaultJobOptions,
  getQueueConfig,
  getRedisConnectionOptions,
  getWorkerConcurrency,
} = require('../config/redis');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { createQueue, createWorker, closeQueueResources } = require('../queues/factory');
const { probeProcessor } = require('../worker');

const withEnv = async (patch, fn) => {
  const previous = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
    await closeQueueResources();
  }
};

class FakeQueue {
  constructor(name, options) {
    this.name = name;
    this.options = options;
    this.closed = false;
  }
  async close() {
    this.closed = true;
  }
}

class FakeWorker extends FakeQueue {
  constructor(name, processor, options) {
    super(name, options);
    this.processor = processor;
    this.handlers = {};
  }
  on(event, handler) {
    this.handlers[event] = handler;
  }
}

const fakeConnection = () => ({
  connect: async () => {},
  duplicate: () => fakeConnection(),
  quit: async () => {},
});

test('queue names remain centralized and conservative', () => {
  assert.deepEqual(Object.keys(QUEUE_NAMES), [
    'booking',
    'payment',
    'refund',
    'webhook',
    'notification',
    'reconciliation',
    'channel',
  ]);
  assert.equal(JOB_NAMES.phase41Probe, 'phase4.1.probe');
});

test('API queue configuration is optional when REDIS_URL is absent', async () => {
  await withEnv({ REDIS_URL: undefined }, async () => {
    assert.equal(getRedisConnectionOptions(), null);
    assert.equal(createQueue(QUEUE_NAMES.booking, { QueueClass: FakeQueue }), null);
  });
});

test('worker queue configuration requires REDIS_URL', async () => {
  await withEnv({ REDIS_URL: undefined }, async () => {
    assert.throws(
      () => getQueueConfig({ required: true }),
      /REDIS_URL is required for the worker process/
    );
  });
});

test('queue factory applies prefix, connection, and conservative defaults', async () => {
  await withEnv({
    REDIS_URL: 'redis://localhost:6379/15',
    BULLMQ_PREFIX: 'phase4-test',
    JOB_ATTEMPTS_DEFAULT: '3',
    JOB_BACKOFF_BASE_MS: '5000',
  }, async () => {
    const queue = createQueue(QUEUE_NAMES.payment, {
      QueueClass: FakeQueue,
      connectionFactory: fakeConnection,
      required: true,
    });
    assert.equal(queue.name, QUEUE_NAMES.payment);
    assert.equal(queue.options.prefix, 'phase4-test');
    assert.equal(typeof queue.options.connection.connect, 'function');
    assert.equal(typeof queue.options.connection.duplicate, 'function');
    assert.equal(queue.options.defaultJobOptions.attempts, 3);
    assert.equal(queue.options.defaultJobOptions.backoff.type, 'exponential');
    assert.equal(queue.options.defaultJobOptions.backoff.delay, 5000);
    assert.ok(queue.options.defaultJobOptions.removeOnComplete.count >= 1000);
    assert.ok(queue.options.defaultJobOptions.removeOnFail.count >= 5000);
  });
});

test('worker factory applies safe concurrency and event handlers', async () => {
  await withEnv({
    REDIS_URL: 'redis://localhost:6379/15',
    WORKER_CONCURRENCY: '4',
  }, async () => {
    const worker = createWorker(QUEUE_NAMES.refund, async () => ({ ok: true }), {
      WorkerClass: FakeWorker,
      connectionFactory: fakeConnection,
      required: true,
    });
    assert.equal(worker.name, QUEUE_NAMES.refund);
    assert.equal(worker.options.concurrency, 4);
    assert.equal(typeof worker.handlers.active, 'function');
    assert.equal(typeof worker.handlers.completed, 'function');
    assert.equal(typeof worker.handlers.failed, 'function');
  });
});

test('worker concurrency and job defaults are bounded', async () => {
  await withEnv({
    WORKER_CONCURRENCY: '999',
    JOB_ATTEMPTS_DEFAULT: '999',
    JOB_BACKOFF_BASE_MS: '1',
  }, async () => {
    assert.equal(getWorkerConcurrency(), 25);
    assert.equal(getDefaultJobOptions().attempts, 10);
    assert.equal(getDefaultJobOptions().backoff.delay, 1000);
  });
});

test('Phase 4.1 probe processor has no business side effects', async () => {
  const result = await probeProcessor({ name: JOB_NAMES.phase41Probe, queueName: QUEUE_NAMES.booking });
  assert.deepEqual(result, {
    ok: true,
    jobName: JOB_NAMES.phase41Probe,
    queueName: QUEUE_NAMES.booking,
  });
});

test('basic enqueue/dequeue behavior is covered with a test-safe fake queue', async () => {
  const jobs = [];
  class FakeDequeuingQueue extends FakeQueue {
    async add(name, data, options) {
      const job = { id: String(jobs.length + 1), name, data, options, queueName: this.name };
      jobs.push(job);
      return job;
    }
  }

  await withEnv({ REDIS_URL: 'redis://localhost:6379/15', BULLMQ_PREFIX: 'phase4-test' }, async () => {
    const queue = createQueue(QUEUE_NAMES.booking, {
      QueueClass: FakeDequeuingQueue,
      connectionFactory: fakeConnection,
      required: true,
    });
    const job = await queue.add(JOB_NAMES.phase41Probe, { safeId: 'probe-1' });
    const next = jobs.shift();
    const result = await probeProcessor(next);

    assert.equal(job.id, '1');
    assert.equal(next.queueName, QUEUE_NAMES.booking);
    assert.deepEqual(result, {
      ok: true,
      jobName: JOB_NAMES.phase41Probe,
      queueName: QUEUE_NAMES.booking,
    });
  });
});
