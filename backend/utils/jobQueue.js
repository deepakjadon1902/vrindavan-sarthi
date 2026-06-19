const queue = [];
let running = false;

const runNext = async () => {
  if (running) return;
  const job = queue.shift();
  if (!job) return;

  running = true;
  try {
    await job.fn();
  } catch (err) {
    // Queue jobs must never block the user request thread.
    console.error(`[jobQueue:${job.name}]`, err?.message || err);
  } finally {
    running = false;
    setImmediate(runNext);
  }
};

const enqueueJob = (name, fn) => {
  if (typeof fn !== 'function') return;
  queue.push({ name: String(name || 'job'), fn });
  setImmediate(runNext);
};

module.exports = { enqueueJob };
