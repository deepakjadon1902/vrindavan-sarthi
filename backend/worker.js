const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { QUEUE_NAMES, JOB_NAMES } = require('./queues/names');
const { createQueue, createWorker, closeQueueResources } = require('./queues/factory');
const { getQueueConfig } = require('./config/redis');
const connectDB = require('./config/db');
const { closeDB } = require('./config/db');
const { assertProductionConfig } = require('./config/productionConfig');
const { ensureIndexesOnce } = require('./config/ensureIndexes');
const { processWebhookEventJob } = require('./utils/razorpayWebhook');
const { processRefundOperationJob } = require('./utils/refundOperations');
const {
  getPaymentReconciliationEnabled,
  getPaymentReconciliationIntervalMs,
  processPaymentReconciliationJob,
  sweepPaymentReconciliation,
} = require('./utils/paymentReconciliation');
const {
  getBookingExpirationEnabled,
  getBookingExpirationIntervalMs,
  processBookingExpirationJob,
  sweepBookingExpiration,
} = require('./utils/bookingExpirationJobs');
const {
  processNotificationDeliveryJob,
  processNotificationRecoveryJob,
} = require('./utils/notificationDelivery');
const { processChannelSyncOperation } = require('./utils/channelManager');

const queueNames = Object.values(QUEUE_NAMES);
let shuttingDown = false;

const probeProcessor = async (job) => ({
  ok: true,
  jobName: job.name,
  queueName: job.queueName,
});

const startWorkers = () => {
  const config = getQueueConfig({ required: true, connectionName: 'worker:bootstrap' });
  console.log('[worker] BullMQ worker starting');
  console.log(`[worker] Redis configured: ${config.configured ? 'yes' : 'no'}`);
  console.log(`[worker] Queue prefix: ${config.prefix}`);
  console.log(`[worker] Worker concurrency: ${config.workerConcurrency}`);

  return queueNames.map((queueName) => {
    const worker = createWorker(queueName, async (job) => {
      if (job.name === JOB_NAMES.phase41Probe) return probeProcessor(job);
      if (queueName === QUEUE_NAMES.webhook && job.name === JOB_NAMES.razorpayWebhook) {
        return processWebhookEventJob(job.data);
      }
      if (queueName === QUEUE_NAMES.refund && job.name === JOB_NAMES.razorpayRefund) {
        return processRefundOperationJob(job.data);
      }
      if (queueName === QUEUE_NAMES.payment && job.name === JOB_NAMES.razorpayPaymentReconcile) {
        return processPaymentReconciliationJob(job.data);
      }
      if (queueName === QUEUE_NAMES.payment && job.name === JOB_NAMES.razorpayPaymentReconcileSweep) {
        return sweepPaymentReconciliation();
      }
      if (queueName === QUEUE_NAMES.booking && job.name === JOB_NAMES.bookingExpirePending) {
        return processBookingExpirationJob(job.data);
      }
      if (queueName === QUEUE_NAMES.booking && job.name === JOB_NAMES.bookingExpirePendingSweep) {
        return sweepBookingExpiration();
      }
      if (queueName === QUEUE_NAMES.notification && job.name === JOB_NAMES.notificationDeliverySend) {
        return processNotificationDeliveryJob(job.data);
      }
      if (queueName === QUEUE_NAMES.notification && job.name === JOB_NAMES.notificationRecoverySweep) {
        return processNotificationRecoveryJob(job.data);
      }
      if (queueName === QUEUE_NAMES.channel && job.name === JOB_NAMES.channelSyncProcess) {
        return processChannelSyncOperation(job.data);
      }
      console.log(`[worker] No Phase 4.1 business processor for job ${job.name} on ${queueName}`);
      return { ignored: true };
    }, {
      required: true,
      connectionName: `worker:${queueName}`,
      concurrency: config.workerConcurrency,
    });
    console.log(`[worker] Queue initialized: ${queueName}`);
    return worker;
  });
};

const upsertScheduler = async ({ queueName, schedulerId, every, jobName, data = {} }) => {
  const queue = createQueue(queueName, { required: true, connectionName: `scheduler:${queueName}` });
  if (!queue) return null;
  if (typeof queue.upsertJobScheduler === 'function') {
    await queue.upsertJobScheduler(
      schedulerId,
      { every },
      {
        name: jobName,
        data,
        opts: {
          jobId: schedulerId,
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
          removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
        },
      }
    );
    console.log(`[worker] Scheduler upserted: ${schedulerId} every=${every}`);
    return queue;
  }
  await queue.add(jobName, data, {
    jobId: schedulerId,
    repeat: { every },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
  });
  console.log(`[worker] Legacy repeatable job upserted: ${schedulerId} every=${every}`);
  return queue;
};

const scheduleRecurringJobs = async () => {
  if (getPaymentReconciliationEnabled()) {
    await upsertScheduler({
      queueName: QUEUE_NAMES.payment,
      schedulerId: 'phase4.4:razorpay-payment-reconcile-sweep',
      every: getPaymentReconciliationIntervalMs(),
      jobName: JOB_NAMES.razorpayPaymentReconcileSweep,
    });
  }
  if (getBookingExpirationEnabled()) {
    await upsertScheduler({
      queueName: QUEUE_NAMES.booking,
      schedulerId: 'phase4.4:booking-expire-pending-sweep',
      every: getBookingExpirationIntervalMs(),
      jobName: JOB_NAMES.bookingExpirePendingSweep,
    });
  }
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received; closing BullMQ workers`);
  await closeQueueResources();
  await closeDB();
  console.log('[worker] BullMQ worker stopped');
};

const main = async () => {
  try {
    const configResult = assertProductionConfig(process.env, { role: 'worker' });
    for (const warning of configResult.warnings || []) {
      console.warn(`[worker:config] ${warning}`);
    }
    connectDB();
    void ensureIndexesOnce();
    startWorkers();
    void scheduleRecurringJobs().catch((err) => {
      console.error('[worker] Scheduler startup failure:', err?.message || err);
    });
  } catch (err) {
    console.error('[worker] Fatal startup failure:', err?.code || err?.message || err);
    process.exitCode = 1;
    return;
  }
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit(0));
});

if (require.main === module) {
  void main();
}

module.exports = {
  startWorkers,
  shutdown,
  probeProcessor,
  scheduleRecurringJobs,
  upsertScheduler,
};
