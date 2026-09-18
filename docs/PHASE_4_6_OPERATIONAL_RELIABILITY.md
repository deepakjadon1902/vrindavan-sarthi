# Phase 4.6 Operational Reliability

Phase 4.6 adds the admin-facing operational control layer for the durable job work introduced in Phase 4.1 through Phase 4.5. It does not change booking, payment, inventory, refund, webhook, expiration, reconciliation, or notification business logic.

## Scope

- Admin-only operations API under `/api/admin/operations`.
- Read-only operational summary and health endpoints.
- Admin retry/reconciliation controls for existing durable records.
- Admin UI page at `/admin/operations`.
- Test coverage for pagination, sanitization, filters, and queue health behavior.

## Operational Entities

- `PaymentReconciliation`: durable payment reconciliation record.
- `RefundOperation`: durable refund intent and execution record.
- `WebhookEvent`: durable webhook receipt and processing record.
- `NotificationDelivery`: durable notification/invoice delivery intent.
- `Booking`: booking lifecycle and expiration candidate visibility.
- BullMQ queues from `backend/queues/names.js`.

MongoDB remains the source of truth for business state. Redis and BullMQ are execution infrastructure only.

## Admin API

All endpoints require authentication and `admin` role authorization.

- `GET /api/admin/operations/summary`
  Returns counts for bookings, payment reconciliations, refunds, webhooks, notifications, action-required buckets, and queue health.

- `GET /api/admin/operations/health`
  Returns API, MongoDB, Redis/BullMQ, worker-observability, and queue status. Worker liveness is reported as not directly observable because Phase 4.6 does not introduce a heartbeat store.

- `GET /api/admin/operations/payment-reconciliations`
- `GET /api/admin/operations/payment-reconciliations/:id`
- `POST /api/admin/operations/payment-reconciliations/:id/retry`

- `GET /api/admin/operations/refunds`
- `GET /api/admin/operations/refunds/:id`
- `POST /api/admin/operations/refunds/:id/retry`
- `POST /api/admin/operations/refunds/:id/reconcile`

- `GET /api/admin/operations/webhooks`
- `GET /api/admin/operations/webhooks/:id`
- `POST /api/admin/operations/webhooks/:id/retry`

- `GET /api/admin/operations/notifications`
- `GET /api/admin/operations/notifications/:id`
- `POST /api/admin/operations/notifications/:id/retry`

- `GET /api/admin/operations/bookings`
  Supports expiration-candidate visibility for stale pending bookings.

## Filtering And Pagination

List endpoints support bounded pagination with a maximum limit of 100. Common filters include status, provider, booking ID, modification ID, order ID, event type, queue name, and created-at date ranges where applicable.

ObjectId filters are validated before querying. Invalid identifiers return controlled `400` responses.

## Retry Behavior

Retry endpoints reuse existing durable execution services:

- payment reconciliation retry calls `enqueuePaymentReconciliation`.
- refund retry calls `enqueueRefundOperation`.
- refund manual reconciliation calls `reconcileRefundOperation`.
- webhook retry calls `enqueueWebhookEvent`.
- notification retry calls `enqueueNotificationDelivery`.

Phase 4.6 does not create new idempotency semantics. Existing deterministic keys and unique indexes remain the authority.

## Queue Health

Queue health is collected through the existing queue factory. The response includes queue availability, job counts, paused status, and sanitized error text. Redis URLs and credentials are never returned or logged.

If Redis is not configured or unavailable, the API remains available and reports degraded queue health. This preserves the Phase 4.1 separation between API availability and worker/queue availability.

## Admin UI

The admin sidebar now includes `Operations`. The page shows:

- action-required summary cards.
- system health.
- queue counts.
- filtered operational record lists.
- retry actions for retryable operational records.

The UI does not expose raw webhook payloads, provider credentials, authorization headers, or full sensitive notification payloads.

## Security

- Endpoints are admin-only.
- No partner or customer operational-control access is introduced.
- Raw webhook payloads are redacted from admin detail responses.
- Sensitive notification payload keys such as `secret`, `token`, and `providerHeaders` are redacted.
- Queue health does not expose Redis connection strings.
- Retry operations log safe identifiers only.

## Deferred Work

- Worker heartbeat persistence.
- Provider-level health probes.
- Admin manual notification edit/resend UI.
- Partner-scoped operational visibility.
- Fine-grained operational audit log model.
- Bulk retry controls.
- Advanced dead-letter dashboards.

These are intentionally deferred so Phase 4.6 remains an operational visibility/control foundation without changing business workflows.

## Test Strategy

Focused tests cover:

- pagination bounds.
- ObjectId filter validation.
- string allow-list validation.
- webhook payload redaction.
- notification payload redaction.
- queue health degraded mode.
- queue health available mode using a fake queue factory.

Full Atlas regression remains required before declaring the broader Phase 4 train complete.
