const DEFAULT_TIMEOUT_MS = 10_000;

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ timedOut: true, label }), timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

const closeHttpServer = (server) =>
  new Promise((resolve) => {
    if (!server || typeof server.close !== 'function') return resolve();
    server.close(() => resolve());
  });

const createGracefulShutdown = ({
  server,
  closeQueues,
  closeDatabase,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = console,
  exit = process.exit,
} = {}) => {
  let shuttingDown = false;
  return async (signal = 'SIGTERM') => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`[shutdown] ${signal} received`);
    await withTimeout(closeHttpServer(server), timeoutMs, 'http_server');
    if (typeof closeQueues === 'function') {
      await withTimeout(Promise.resolve().then(closeQueues), timeoutMs, 'queues');
    }
    if (typeof closeDatabase === 'function') {
      await withTimeout(Promise.resolve().then(closeDatabase), timeoutMs, 'database');
    }
    logger.log('[shutdown] complete');
    if (typeof exit === 'function') exit(0);
  };
};

module.exports = {
  createGracefulShutdown,
  withTimeout,
};
