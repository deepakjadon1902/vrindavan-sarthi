const QUEUE_NAMES = Object.freeze({
  booking: 'vrindavan-sarthi-booking',
  payment: 'vrindavan-sarthi-payment',
  refund: 'vrindavan-sarthi-refund',
  webhook: 'vrindavan-sarthi-webhook',
  notification: 'vrindavan-sarthi-notification',
  reconciliation: 'vrindavan-sarthi-reconciliation',
  channel: 'vrindavan-sarthi-channel',
});

const JOB_NAMES = Object.freeze({
  phase41Probe: 'phase4.1.probe',
  razorpayWebhook: 'razorpay.webhook.process',
  razorpayRefund: 'razorpay.refund.process',
  razorpayPaymentReconcile: 'razorpay.payment.reconcile',
  razorpayPaymentReconcileSweep: 'razorpay.payment.reconcile.sweep',
  bookingExpirePending: 'booking.expire_pending',
  bookingExpirePendingSweep: 'booking.expire_pending.sweep',
  notificationDeliverySend: 'notification.delivery.send',
  notificationRecoverySweep: 'notification.recovery.sweep',
  channelSyncProcess: 'channel.sync.process',
});

module.exports = {
  QUEUE_NAMES,
  JOB_NAMES,
};
