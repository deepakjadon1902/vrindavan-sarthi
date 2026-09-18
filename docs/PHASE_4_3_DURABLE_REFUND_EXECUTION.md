# Phase 4.3 Durable Refund Execution

Status: implemented for durable refund intent, queued execution, and reconciliation state.

## Problem

Inline refunds are unsafe. If Razorpay accepts a refund but the API process crashes before MongoDB records the provider refund ID, a later retry can create a duplicate refund. Phase 4.3 changes the system to persist a refund intent before provider execution.

Warning: NEVER blindly retry an uncertain Razorpay refund request.

## Existing Refund Architecture

Before this phase, booking cancellation, admin refund, and modification refund paths called Razorpay from request-time application logic. Booking and BookingModification already had refund fields, but those fields were business-facing status fields rather than a durable execution ledger.

## New Architecture

```text
Booking cancellation / modification refund
  -> server-side refund amount calculation
  -> RefundOperation
  -> MongoDB persistence
  -> BullMQ refund job
  -> worker
  -> Razorpay refund API
  -> RefundOperation provider result
  -> Booking / BookingModification refund fields
```

MongoDB remains the authoritative business store. Redis/BullMQ is durable execution infrastructure.

## RefundOperation

Model: `backend/models/RefundOperation.js`

Important fields:

- `provider`
- `operationKey`
- `bookingId`
- `modificationId`
- `paymentId`
- `orderId`
- `requestedAmount`
- `currency`
- `reason`
- `status`
- `providerRefundId`
- `providerStatus`
- `attempts`
- `lastError`
- `requestedAt`
- `queuedAt`
- `processingStartedAt`
- `processedAt`
- `failedAt`
- `reconciliationState`
- `nextReconciliationAt`
- `providerResponseMetadata`

Exactly one of `bookingId` or `modificationId` must be set.

## State Machine

Supported statuses:

- `requested`
- `queued`
- `processing`
- `retry_scheduled`
- `processed`
- `failed`
- `reconciliation_required`

The worker atomically claims `requested`, `queued`, or `retry_scheduled` operations into `processing`. Already processed operations are safe no-ops.

## Idempotency

Every logical refund intent has one deterministic `operationKey`.

Examples:

```text
refund:booking:<bookingId>:booking_cancellation
refund:modification:<modificationId>:modification_refund
```

`operationKey` is unique in MongoDB. Duplicate requests return the existing operation and do not create a second provider refund.

## BullMQ Flow

Queue:

```text
vrindavan-sarthi-refund
```

Job:

```text
razorpay.refund.process
```

Job ID:

```text
refund:operation:<refundOperationId>
```

Payload:

```json
{
  "refundOperationId": "<Mongo ObjectId>"
}
```

## Worker Flow

The worker:

1. Loads `RefundOperation`.
2. Atomically claims it.
3. Skips already processed operations.
4. If `providerRefundId` exists, repairs business state without creating another refund.
5. Validates amount, currency, and payment ID.
6. Calls Razorpay through the existing provider abstraction.
7. Persists provider refund ID/status.
8. Updates Booking or BookingModification refund fields.

## Razorpay Safety Strategy

The code does not assume a reliable refund idempotency key. It stores the operation ID and operation key in Razorpay notes for reconciliation, but the primary safety guarantee is:

```text
one operationKey -> at most one provider refund request
```

Unknown provider outcomes become `reconciliation_required`, not blind retries.

## Unknown Outcomes

Timeouts, connection resets, and response-loss style errors are classified as uncertain. The operation is marked:

```text
status = reconciliation_required
reconciliationState = required
```

The system must not issue another refund until reconciliation proves no provider refund exists.

## Reconciliation

If `providerRefundId` is already known, reconciliation repairs Booking or BookingModification state without a provider refund call.

If only the payment ID is known, reconciliation can query Razorpay payment refunds and match by operation notes. If no match is found, the operation remains visible for manual review.

Admin-only endpoints:

```text
GET  /api/payments/refunds/reconciliation
POST /api/payments/refunds/:refundOperationId/reconcile
```

## Retry Policy

Refund jobs use bounded attempts:

- attempts: 3
- exponential backoff from Phase 4.1 config

Known 4xx provider rejections become `failed`. 5xx/provider-unavailable style errors can retry. Unknown outcomes become `reconciliation_required`.

## Authorization

Refund operation creation remains behind existing booking cancellation/admin refund/modification flows. Reconciliation endpoints are admin-only.

Partners and customers cannot access global refund operations.

## Failure Matrix

| Scenario | Result |
| --- | --- |
| Duplicate request | Existing operation |
| Duplicate worker delivery | Safe no-op |
| Already processed | Safe no-op |
| Provider success | `processed` |
| Known provider rejection | `failed` |
| Safe transient failure | bounded retry |
| Retry exhausted | `failed` |
| Request timeout | `reconciliation_required` |
| Response lost | `reconciliation_required` |
| Provider accepted + DB crash | reconcile using provider state |
| Existing `providerRefundId` | never refund again; repair business state |
| Queue unavailable | durable operation retained |
| Invalid amount | rejected |
| Currency mismatch | rejected |
| Missing payment ID | controlled reconciliation state |
| Unauthorized access | rejected |

## Testing Strategy

Phase 4.3 foundation tests:

```bash
cd backend
npm run test:refund
```

Regression:

```bash
npm test
npm run test:queue
npm run test:webhook
node --test tests/phase2-reservation.integration.test.js
node --test tests/phase3-modification.integration.test.js
npm run test:all
```

The real Atlas tests still require `PHASE_2_1_MONGO_URI` and must not fall back to localhost.

## Environment

Uses existing variables:

- `REDIS_URL`
- `BULLMQ_PREFIX`
- `WORKER_CONCURRENCY`
- `JOB_ATTEMPTS_DEFAULT`
- `JOB_BACKOFF_BASE_MS`
- Razorpay key variables

No new secret is introduced.

## Operational Recovery

For `reconciliation_required` operations:

1. Inspect the operation.
2. If a provider refund ID is known, run reconciliation to repair business state.
3. If only payment ID is known, query provider refunds and match by operation notes.
4. If no match is found, keep manual review; do not blindly create another refund.

## Not Implemented

This phase does not implement payment reconciliation, expiration scheduling, email migration, notification migration, a dashboard, or channel-manager work.
