const fs = require('fs');
let code = fs.readFileSync('backend/utils/notificationDelivery.js', 'utf8');

const target = 
`  try {
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
  } catch (err) {`;

const rep = 
`  try {
    const queue = queueFactory(QUEUE_NAMES.notification, { required: false });
    if (!queue) return { queued: false, reason: 'redis_not_configured' };
    const delay = Math.max(0, new Date(delivery.nextAttemptAt || Date.now()).getTime() - Date.now());
    await Promise.race([
      queue.add(
        JOB_NAMES.notificationDeliverySend,
        { notificationDeliveryId: String(delivery._id) },
        {
          jobId: notificationJobId(delivery._id),
          attempts: 1,
          delay,
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
          removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
        }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Queue add timeout')), 1000)),
    ]);
    return { queued: true };
  } catch (err) {`;

code = code.replace(target.replace(/\n/g, '\r\n'), rep.replace(/\n/g, '\r\n'));
fs.writeFileSync('backend/utils/notificationDelivery.js', code, 'utf8');
console.log('Successfully updated enqueueNotificationDelivery with Promise.race timeout');
