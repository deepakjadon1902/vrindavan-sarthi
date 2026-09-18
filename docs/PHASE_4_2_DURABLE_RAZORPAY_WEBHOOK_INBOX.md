# Phase 4.2 Durable Razorpay Webhook Inbox

Status: implemented for Razorpay webhook durability only.

MongoDB remains the authoritative business datastore. Redis/BullMQ provides durable execution. `WebhookEvent` is an execution inbox/audit record, not the source of truth for booking or modification payment state.

## Objective

Phase 4.2 makes Razorpay webhook receipt durable before business processing. It does not migrate refunds, payment reconciliation, booking expiration, invoices, emails, or notifications.

## Before Architecture

`POST /api/payments/razorpay/webhook` verified the Razorpay signature and then directly mutated `Booking` or `BookingModification` inside the HTTP request. Duplicate event IDs were guarded on those business records, but there was no durable inbox, attempt history, worker retry visibility, or durable receipt record.

## After Architecture

```text
Razorpay
  -> POST /api/payments/razorpay/webhook
  -> verify raw-body HMAC signature
  -> parse and validate event envelope
  -> persist WebhookEvent in MongoDB
  -> enqueue deterministic BullMQ job
  -> worker loads WebhookEvent
  -> worker atomically claims event
  -> existing booking/modification lifecycle runs
  -> WebhookEvent records processed/failed state
```

If Redis is not configured in a local/test environment, the API route processes the already-persisted inbox event inline to preserve existing no-Redis regression behavior. When `NODE_ENV=test`, the route also processes the persisted event inline after enqueueing so regression tests do not require a separately running worker. Production should run Redis and the worker service.

## WebhookEvent Schema

Model: `backend/models/WebhookEvent.js`

Important fields:

- `provider`
- `eventId`
- `eventType`
- `status`
- `receivedAt`
- `queuedAt`
- `processingStartedAt`
- `processedAt`
- `failedAt`
- `attempts`
- `lastError`
- `lastErrorAt`
- `bookingId`
- `bookingModificationId`
- `payloadHash`
- `payload`
- `processingResult`

Status values:

- `received`
- `queued`
- `processing`
- `processed`
- `failed`

## Indexes

Unique durable idempotency:

```js
{ provider: 1, eventId: 1 }
```

Operational indexes:

```js
{ status: 1, receivedAt: 1 }
{ status: 1, processingStartedAt: 1 }
```

## Webhook Lifecycle

1. Reject missing webhook secret.
2. Verify `x-razorpay-signature` against the raw body.
3. Reject malformed JSON.
4. Reject missing event ID or event type.
5. Store a sanitized Razorpay event payload and SHA-256 payload hash.
6. Use MongoDB unique index to collapse duplicate event delivery.
7. Enqueue `razorpay.webhook.process` on the webhook queue using deterministic job ID.
8. Worker claims and processes the event.

## BullMQ Job Structure

Queue:

```text
vrindavan-sarthi-webhook
```

Job:

```text
razorpay.webhook.process
```

Job ID:

```text
webhook:razorpay:<eventId>
```

Payload:

```json
{
  "webhookEventId": "<Mongo ObjectId>",
  "provider": "razorpay",
  "eventId": "<Razorpay event id>"
}
```

The full webhook payload is loaded from MongoDB, not Redis.

## Worker Behavior

`backend/worker.js` now processes the webhook queue. Other queue categories remain foundation-only.

The worker:

- validates job payload
- loads and atomically claims the `WebhookEvent`
- skips already processed or actively processing events
- invokes existing booking/modification payment lifecycle helpers
- marks the event `processed`
- records `failed`, `attempts`, `lastError`, and `lastErrorAt` if processing throws

## Idempotency Strategy

Durable receipt idempotency is enforced by MongoDB:

```js
provider + eventId
```

BullMQ job idempotency uses the deterministic job ID. Business-level duplicate protection remains on `Booking.razorpayWebhookEventIds` and `BookingModification.razorpayWebhookEventIds`.

## Concurrency Protection

Workers claim events with an atomic MongoDB transition from `received`, `queued`, or `failed` to `processing`. Already `processed` events cannot be claimed again. Stale `processing` events can be reclaimed after a bounded threshold.

## Retry Policy

Webhook jobs use a bounded policy:

- max attempts: 5
- exponential backoff

Invalid signatures and malformed JSON are rejected before persistence and are not queued. Processing failures are recorded on `WebhookEvent` and re-thrown so BullMQ can retry.

## Failure Recovery

Webhook received, MongoDB fails:

- no success acknowledgement
- Razorpay can retry

MongoDB succeeds, queue unavailable:

- event remains durable as `received`
- local/test compatibility path processes inline
- production should recover by enqueueing unprocessed inbox events in a later reconciliation phase

Job queued, API crashes:

- event and job are durable
- worker can process later

Worker crashes during processing:

- event remains `processing`
- stale processing reclaim allows recovery

Same event delivered twice:

- one `WebhookEvent`
- one deterministic job
- one business transition

## HTTP Acknowledgement

The API returns success only after the webhook has passed signature validation and the inbox record has been persisted. Duplicate already-processed events are acknowledged safely.

## Security

The implementation does not store or log:

- Razorpay webhook secret
- Razorpay API key/secret
- MongoDB URI
- Redis URL
- authorization tokens
- request headers

Logs contain safe identifiers only.

## Testing

Phase 4.2 tests:

```bash
cd backend
npm run test:webhook
```

Existing regression gates remain:

```bash
npm run test:queue
node --test tests/phase2-reservation.integration.test.js
node --test tests/phase3-modification.integration.test.js
npm run test:all
```

The Phase 2.1 and Phase 3 integration cleanups now remove only their own `evt_phase21*` and `evt_phase3*` inbox records so repeated Atlas runs remain deterministic.

## Environment Requirements

Uses existing Phase 4.1 variables:

- `REDIS_URL`
- `BULLMQ_PREFIX`
- `WORKER_CONCURRENCY`
- `JOB_ATTEMPTS_DEFAULT`
- `JOB_BACKOFF_BASE_MS`
- `REDIS_CONNECT_TIMEOUT_MS`

No new production secret is required.

## Production Deployment

Render Web Service:

```text
node server.js
```

Render Worker Service:

```text
node worker.js
```

Both services use MongoDB Atlas. The worker and API use Redis through `REDIS_URL`.

## Known Limitations

Phase 4.2 does not implement a reconciliation scanner for durable inbox events stuck in `received` after a queue outage. The event is recoverable in MongoDB; automated recovery belongs to a later reconciliation phase.

## Not Implemented In Phase 4.2

- refund worker
- refund reconciliation
- payment reconciliation scanner
- booking expiration worker
- email/invoice job migration
- notification migration
- outbox framework
- frontend changes

## Next Phase

Phase 4.3: Durable Refund Execution + Reconciliation.
