const fs = require('fs');
let code = fs.readFileSync('backend/utils/notificationDelivery.js', 'utf8');

const target = 
`    if (input.channel === 'web_push' &&
        options.immediateWebPush !== false &&
        (getWebPushConfig().configured || getFcmConfig().configured)) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.web_push.immediate_failed]', err?.message || err);
      });
    } else if (input.channel === 'email' && options.immediateEmail !== false) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.email.immediate_failed]', err?.message || err);
      });
    }`;

const rep = 
`    if (input.channel === 'web_push' &&
        options.immediateWebPush !== false &&
        (getWebPushConfig().configured || getFcmConfig().configured)) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.web_push.immediate_failed]', err?.message || err);
      });
      return (await NotificationDelivery.findById(delivery._id)) || delivery;
    } else if (input.channel === 'email' && options.immediateEmail !== false) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.email.immediate_failed]', err?.message || err);
      });
      return (await NotificationDelivery.findById(delivery._id)) || delivery;
    }`;

if (!code.includes(target.replace(/\n/g, '\r\n')) && !code.includes(target)) {
  console.error('Target not found in notificationDelivery.js');
  process.exit(1);
}
code = code.replace(target.replace(/\n/g, '\r\n'), rep.replace(/\n/g, '\r\n'));
fs.writeFileSync('backend/utils/notificationDelivery.js', code, 'utf8');
console.log('Successfully updated notificationDelivery.js');
