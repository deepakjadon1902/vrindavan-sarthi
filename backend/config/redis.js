const { createClient } = require('redis');
const { createNodeRedisClient } = require('bullmq');

const DEFAULT_PREFIX = 'vrindavan-sarthi';

const DEFAULT_WORKER_CONCURRENCY = 2;

const DEFAULT_JOB_ATTEMPTS = 1;

const DEFAULT_BACKOFF_BASE_MS = 30_000;

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

const asPositiveInt = (
  value,
  fallback,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {}
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const getRedisUrl = () => String(process.env.REDIS_URL || '').trim();

const getBullMqPrefix = () =>
  String(process.env.BULLMQ_PREFIX || DEFAULT_PREFIX)
    .trim()
    .replace(/[^A-Za-z0-9:_-]/g, '-')
    .slice(0, 80) || DEFAULT_PREFIX;

const getWorkerConcurrency = () =>
  asPositiveInt(
    process.env.WORKER_CONCURRENCY,
    DEFAULT_WORKER_CONCURRENCY,
    {
      min: 1,
      max: 25,
    }
  );

const getDefaultJobAttempts = () =>
  asPositiveInt(
    process.env.JOB_ATTEMPTS_DEFAULT,
    DEFAULT_JOB_ATTEMPTS,
    {
      min: 1,
      max: 10,
    }
  );

const getBackoffBaseMs = () =>
  asPositiveInt(
    process.env.JOB_BACKOFF_BASE_MS,
    DEFAULT_BACKOFF_BASE_MS,
    {
      min: 1_000,
      max: 60 * 60 * 1000,
    }
  );

const getRedisConnectTimeoutMs = () =>
  asPositiveInt(
    process.env.REDIS_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
    {
      min: 1_000,
      max: 60_000,
    }
  );

const getRedisConnectionOptions = ({
  required = false,
  connectionName,
} = {}) => {
  const url = getRedisUrl();

  if (!url && required) {
    const err = new Error(
      'REDIS_URL is required for the worker process'
    );

    err.code = 'REDIS_URL_REQUIRED';

    throw err;
  }

  if (!url) return null;

  return {
    url,
    connectionName,
    connectTimeout: getRedisConnectTimeoutMs(),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  };
};

const createRedisClient = ({
  required = false,
  connectionName,
} = {}) => {
  const connection = getRedisConnectionOptions({
    required,
    connectionName,
  });

  if (!connection) return null;

  const redisClient = createClient({
    url: connection.url,
    name: connection.connectionName,

    socket: {
      connectTimeout: connection.connectTimeout,

      reconnectStrategy: (retries) =>
        Math.min(
          30_000,
          500 * Math.max(1, retries)
        ),
    },

    // Keep Redis requests retrying for BullMQ worker usage.
    maxRetriesPerRequest: null,
  });

  redisClient.on('error', (err) => {
    console.error(
      `[redis] ${connection.connectionName || 'connection'} error:`,
      err?.message || err
    );
  });

  redisClient.on('reconnecting', () => {
    console.warn(
      `[redis] ${connection.connectionName || 'connection'} reconnecting`
    );
  });

  redisClient.on('ready', () => {
    console.log(
      `[redis] ${connection.connectionName || 'connection'} ready`
    );
  });

  // IMPORTANT:
  // BullMQ 6.x expects node-redis clients to be adapted
  // through createNodeRedisClient() before they are supplied
  // to Queue / Worker.
  return createNodeRedisClient(redisClient);
};

const getDefaultJobOptions = () => ({
  attempts: getDefaultJobAttempts(),

  backoff: {
    type: 'exponential',
    delay: getBackoffBaseMs(),
  },

  removeOnComplete: {
    age: 7 * 24 * 60 * 60,
    count: 1000,
  },

  removeOnFail: {
    age: 30 * 24 * 60 * 60,
    count: 5000,
  },
});

const getQueueConfig = ({
  required = false,
  connectionName,
} = {}) => ({
  configured: Boolean(getRedisUrl()),

  prefix: getBullMqPrefix(),

  connection: getRedisConnectionOptions({
    required,
    connectionName,
  }),

  defaultJobOptions: getDefaultJobOptions(),

  workerConcurrency: getWorkerConcurrency(),
});

module.exports = {
  DEFAULT_PREFIX,

  getRedisUrl,

  getBullMqPrefix,

  getWorkerConcurrency,

  getDefaultJobAttempts,

  getBackoffBaseMs,

  getRedisConnectTimeoutMs,

  getRedisConnectionOptions,

  createRedisClient,

  getDefaultJobOptions,

  getQueueConfig,
};