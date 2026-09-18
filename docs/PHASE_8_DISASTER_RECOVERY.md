# Phase 8 Disaster Recovery

## Source Of Truth

MongoDB Atlas is the authoritative store for bookings, inventory locks, payments, refunds, reconciliation records, notification delivery records, and channel state. Redis/BullMQ is recoverable execution infrastructure and must not be treated as the business source of truth.

## MongoDB Atlas

Required external controls:

- Enable automated backups.
- Keep point-in-time restore enabled where the Atlas tier supports it.
- Document restore operators and escalation contacts.
- Test restore into a non-production cluster before trusting a backup plan.

Restore principle:

1. Stop API and worker writes if production data corruption is suspected.
2. Restore Atlas snapshot or point-in-time backup into a safe cluster.
3. Verify business invariants, especially `RoomUnitBookingDay`.
4. Promote or replay only after payment/refund/channel reconciliation review.

## Redis/BullMQ

Redis loss may lose BullMQ runtime job state, but durable MongoDB records allow recovery for:

- `WebhookEvent`
- `RefundOperation`
- `PaymentReconciliation`
- `NotificationDelivery`
- `ChannelSyncOperation`
- `ChannelInboundEvent`

Recovery:

1. Restore Redis service.
2. Restart worker.
3. Run admin/worker retry and recovery sweeps for durable records.
4. Review reconciliation-required records before manual resolution.

## API Failure

Render Web Service restart should:

- stop accepting new requests during shutdown
- close MongoDB and queue resources
- restart and reconnect to MongoDB
- report `/api/health` and `/api/readiness`

## Worker Failure

Render Worker Service restart should:

- validate production config
- connect to MongoDB and Redis
- recreate workers and repeatable schedulers
- resume jobs from durable MongoDB records and BullMQ queues

## Payment Provider Outage

Razorpay outage handling:

- Do not mark payment/refund success unless provider/local validation succeeds.
- Use `PaymentReconciliation` and `RefundOperation` states for retry or reconciliation.
- Do not retry uncertain provider outcomes indefinitely.

## Notification Provider Outage

Email provider failure should leave `NotificationDelivery` visible as failed, retry scheduled, or reconciliation required. Business state must remain valid even if email delivery fails.

## Channel Provider Outage

Channel operations should remain durable in `ChannelSyncOperation` and `ChannelReconciliation`. Real providers remain disabled unless explicitly configured.

## Secret Rotation

Rotate immediately after suspected exposure:

- `JWT_SECRET`
- MongoDB user/password
- `REDIS_URL`
- Razorpay keys/webhook secret
- Email provider credentials
- Cloudinary credentials
- Channel provider credentials

JWT rotation invalidates existing sessions unless a multi-key strategy is introduced later.

## Rollback

Rollback should be app-version rollback only. Do not roll back MongoDB data without reconciliation. Additive indexes/models should remain in place unless a verified migration rollback exists.
