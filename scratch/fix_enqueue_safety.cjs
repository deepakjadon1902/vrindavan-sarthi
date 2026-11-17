const fs = require('fs');
let code = fs.readFileSync('backend/utils/notificationDelivery.js', 'utf8');

const target = 
`const enqueueNotificationDelivery = async (delivery, { queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.notification, { required: false });
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  const delay = Math.max(0, new Date(delivery.nextAttemptAt || Date.now()).getTime() - Date.now());
  await queue.add(
    JOB_NAMES.notificationDeliverySend,
    { notificationDeliveryId: String(delivery._id) },
    {
      jobId: notificationJobId(delivery._id),
      attempts: 1,
      delay,
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );
  return { queued: true };
};`;

const replacement = 
`const enqueueNotificationDelivery = async (delivery, { queueFactory = createQueue } = {}) => {
  try {
    const queue = queueFactory(QUEUE_NAMES.notification, { required: false });
    if (!queue) return { queued: false, reason: 'redis_not_configured' };
    const delay = Math.max(0, new Date(delivery.nextAttemptAt || Date.now()).getTime() - Date.now());
    await queue.add(
      JOB_NAMES.notificationDeliverySend,
      { notificationDeliveryId: String(delivery._id) },
      {
        jobId: notificationJobId(delivery._id),
        attempts: 1,
        delay,
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
      }
    );
    return { queued: true };
  } catch (err) {
    console.warn('[notification.enqueue_failed]', err?.message || err);
    return { queued: false, reason: 'queue_error', error: err?.message || String(err) };
  }
};`;

code = code.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
fs.writeFileSync('backend/utils/notificationDelivery.js', code, 'utf8');
console.log('Successfully updated enqueueNotificationDelivery with try/catch');
