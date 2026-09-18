const { Queue, Worker, QueueEvents } = require('bullmq');
const {
  createRedisClient,
  getQueueConfig,
  getWorkerConcurrency,
} = require('../config/redis');

const activeResources = new Set();

const closeResource = async (resource) => {
  if (!resource || typeof resource.close !== 'function') return;
  await resource.close();
};

const track = (resource) => {
  activeResources.add(resource);
  return resource;
};

const logQueueEvent = ({ level = 'log', event, queueName, job, err, durationMs }) => {
  const payload = {
    event,
    queueName,
    jobName: job?.name,
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    durationMs,
    error: err?.message,
  };
  const compact = Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value !== 'undefined'));
  console[level === 'error' ? 'error' : 'log']('[bullmq]', JSON.stringify(compact));
};

const createQueue = (name, options = {}) => {
  const {
    QueueClass = Queue,
    connectionFactory = createRedisClient,
    required = false,
    connectionName = `api:${name}`,
    ...overrides
  } = options;
  const config = getQueueConfig({ required, connectionName });
  const connection = connectionFactory({ required, connectionName });
  if (!connection) return null;
  return track(new QueueClass(name, {
    connection,
    prefix: config.prefix,
    defaultJobOptions: config.defaultJobOptions,
    ...overrides,
  }));
};

const createQueueEvents = (name, options = {}) => {
  const {
    QueueEventsClass = QueueEvents,
    connectionFactory = createRedisClient,
    required = false,
    connectionName = `events:${name}`,
    ...overrides
  } = options;
  const config = getQueueConfig({ required, connectionName });
  const connection = connectionFactory({ required, connectionName });
  if (!connection) return null;
  return track(new QueueEventsClass(name, {
    connection,
    prefix: config.prefix,
    ...overrides,
  }));
};

const createWorker = (name, processor, options = {}) => {
  const {
    WorkerClass = Worker,
    connectionFactory = createRedisClient,
    required = true,
    connectionName = `worker:${name}`,
    concurrency = getWorkerConcurrency(),
    ...overrides
  } = options;
  if (typeof processor !== 'function') {
    throw new Error(`Processor is required for queue ${name}`);
  }
  const config = getQueueConfig({ required, connectionName });
  const connection = connectionFactory({ required, connectionName });
  if (!connection) return null;
  const worker = track(new WorkerClass(name, processor, {
    connection,
    prefix: config.prefix,
    concurrency,
    removeOnComplete: config.defaultJobOptions.removeOnComplete,
    removeOnFail: config.defaultJobOptions.removeOnFail,
    ...overrides,
  }));

  const startedAt = new Map();
  if (typeof worker.on === 'function') {
    worker.on('active', (job) => {
      startedAt.set(job.id, Date.now());
      logQueueEvent({ event: 'job_started', queueName: name, job });
    });
    worker.on('completed', (job) => {
      const start = startedAt.get(job.id);
      startedAt.delete(job.id);
      logQueueEvent({ event: 'job_completed', queueName: name, job, durationMs: start ? Date.now() - start : undefined });
    });
    worker.on('failed', (job, err) => {
      if (job?.id) startedAt.delete(job.id);
      logQueueEvent({ level: 'error', event: 'job_failed', queueName: name, job, err });
    });
    worker.on('error', (err) => {
      logQueueEvent({ level: 'error', event: 'worker_error', queueName: name, err });
    });
    worker.on('closing', () => logQueueEvent({ event: 'worker_closing', queueName: name }));
    worker.on('closed', () => logQueueEvent({ event: 'worker_closed', queueName: name }));
  }
  return worker;
};

const closeQueueResources = async () => {
  const resources = Array.from(activeResources).reverse();
  activeResources.clear();
  await Promise.allSettled(resources.map(closeResource));
};

module.exports = {
  createQueue,
  createQueueEvents,
  createWorker,
  closeQueueResources,
  logQueueEvent,
};
