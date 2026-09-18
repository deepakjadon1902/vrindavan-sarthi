# Phase 4.5 Notification, Invoice, and Outbox Audit

## 1. Executive Summary

Phase 4.5 should migrate production-critical notification and invoice email intent away from `backend/utils/jobQueue.js`, which is an in-memory, single-process queue. MongoDB must remain the business source of truth. BullMQ/Redis should execute asynchronous delivery, but the durable notification intent and delivery result must live in MongoDB.

The safest minimal architecture is a single new `NotificationDelivery` model plus BullMQ notification jobs. A separate generic `OutboxEvent` model is not required for the first migration because the current side effects are notification/email specific and need recipient, channel, delivery status, provider, attempts, and provider result fields. A future generic outbox can be introduced only if non-notification side effects appear.

Phase 4.5 should not delete `jobQueue.js` immediately. It should migrate each caller behind durable notification helpers and keep legacy behavior only for non-migrated, non-critical work until all callers are accounted for.

## 2. Files Inspected

- `backend/utils/jobQueue.js`
- `backend/utils/customerMessages.js`
- `backend/utils/email.js`
- `backend/utils/invoicePdf.js`
- `backend/utils/razorpayWebhook.js`
- `backend/utils/bookingModification.js`
- `backend/utils/reservationLifecycle.js`
- `backend/utils/refundOperations.js`
- `backend/utils/paymentReconciliation.js`
- `backend/utils/bookingExpirationJobs.js`
- `backend/worker.js`
- `backend/queues/names.js`
- `backend/queues/factory.js`
- `backend/config/redis.js`
- `backend/server.js`
- `backend/models/Booking.js`
- `backend/models/BookingModification.js`
- `backend/models/Order.js`
- `backend/models/PartnerNotification.js`
- `backend/models/WebhookEvent.js`
- `backend/models/RefundOperation.js`
- `backend/models/PaymentReconciliation.js`
- `backend/routes/booking.routes.js`
- `backend/routes/order.routes.js`
- `backend/routes/payment.routes.js`
- `backend/routes/auth.routes.js`
- `backend/routes/contact.routes.js`
- `backend/routes/partner.routes.js`
- `backend/README.md`
- Existing Phase 4 docs under `docs/`

## 3. Current Notification Architecture

`backend/utils/jobQueue.js` stores queued work in a process-local array:

- `enqueueJob(name, fn)` pushes `{ name, fn }` into memory.
- `setImmediate(runNext)` starts execution.
- Jobs run one at a time in the API process.
- Errors are logged and swallowed.
- There is no durable intent, retry schedule, status history, provider response, or recovery after restart.

The current durable in-app notification model is `PartnerNotification`, but some `PartnerNotification` records are created inside the volatile queue. A process crash before the queued function runs can lose both the dashboard notification and the email.

## 4. Complete Notification/Event Inventory

| Event/source | Current trigger | Current queue | Persistence today | Provider | Missing delivery danger | Duplicate danger | Phase 4.5 recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Booking created admin panel notification | `notifyBookingCreated()` in `customerMessages.js`, called by booking creation routes | `jobQueue` | `PartnerNotification` created inside queued job | MongoDB only | High: admin may not see booking alert | Medium | Durable `NotificationDelivery` job creates or references `PartnerNotification` idempotently |
| Booking created partner panel notification | `notifyBookingCreated()` | `jobQueue` | `PartnerNotification` created inside queued job | MongoDB only | High: partner may not see booking alert | Medium | Same notification queue, deterministic key per booking/partner-created |
| Booking created admin email alert | `notifyBookingCreated()` -> `sendAdminAlert()` | `jobQueue` | none | Resend or SMTP | Medium/high | Medium: duplicate admin emails | Durable email delivery record per booking/admin-created recipient |
| Partner booking email alert | `enqueueBookingNotifications()` -> `sendPartnerBookingAlert()` | `jobQueue` | none | Resend or SMTP | High for partner operations | Medium | Durable email delivery record per booking/partner-alert |
| Booking invoice/receipt email | `enqueueBookingNotifications(... invoice: true)` and Razorpay webhook `markBookingPaidFromRazorpay()` | `jobQueue` | `Booking.invoiceSentAt` after send | Resend or SMTP | High: customer receipt can be lost | High: duplicate invoice email | Durable `NotificationDelivery` with key `notification:booking:<id>:invoice`; update `invoiceSentAt` only after sent/accepted |
| Booking cancellation email | `cancelBookingNow()` | `jobQueue` with `Date.now()` in job name | none except booking cancellation fields | Resend or SMTP | Medium/high | High because job name is not deterministic | Durable cancellation notification key; no timestamp in logical key |
| Order created admin panel notification | `notifyOrderCreated()` | `jobQueue` | `PartnerNotification` created inside queued job | MongoDB only | Medium | Medium | Durable notification record and idempotent `PartnerNotification` write |
| Order created admin email alert | `notifyOrderCreated()` | `jobQueue` | none | Resend or SMTP | Medium | Medium | Durable email delivery record per order/admin-created recipient |
| Order invoice email | `PUT /api/orders/:id/verify` | `jobQueue` | `Order.invoiceSentAt` after send | Resend or SMTP | High | High | Durable key `notification:order:<id>:invoice`; update `invoiceSentAt` after accepted |
| Order cancellation email | order reject and cancel routes | `jobQueue` with `Date.now()` in job name | none except order cancellation fields | Resend or SMTP | Medium | High | Durable key `notification:order:<id>:cancelled` |
| Razorpay payment success booking invoice | `markBookingPaidFromRazorpay()` | `jobQueue` | `Booking.invoiceSentAt` after send | Resend or SMTP | High | High | Create durable notification intent after booking is marked paid |
| Manual UPI booking invoice | `booking.routes.js` verify endpoints | `jobQueue` | `Booking.invoiceSentAt` after send | Resend or SMTP | High | High | Same booking invoice notification key |
| Modification completion notification | No dedicated email/panel notification found | none | modification fields only | none | Not currently implemented | n/a | Phase 4.5 may add only if product requires; do not invent customer communication silently |
| Modification payment notification | No dedicated email/panel notification found | none | modification fields only | none | Not currently implemented | n/a | Defer unless requirements are added |
| Password reset OTP | `auth.routes.js` forgot password | synchronous await | OTP hash fields on `User`; email not recorded | Resend or SMTP | High for request, but user expects immediate response | Low/medium | Do not migrate in first Phase 4.5 business-notification pass; consider separate auth-delivery design later |
| Partner registration admin email | `auth.routes.js`, `void sendPartnerRegistrationAlert(user)` | fire-and-forget promise, no queue | none | Resend or SMTP | Medium | Medium | Candidate for durable notification after critical booking/order migration |
| Contact form email | `contact.routes.js` | synchronous await | none | Resend or SMTP | High for contact request | Low | Leave synchronous or create separate contact submission persistence first |

## 5. Current JobQueue Dependency Map

Current `enqueueJob()` callers:

- `backend/routes/booking.routes.js`
  - `invoice:<bookingId>`
  - `partner-alert:<bookingId>`
  - `booking-cancel-email:<bookingId>:<Date.now()>`
- `backend/routes/order.routes.js`
  - `order-invoice:<orderId>`
  - `order-cancel-email:<orderId>:<Date.now()>`
- `backend/utils/customerMessages.js`
  - `admin-booking-alert:<bookingId>`
  - `admin-order-alert:<orderId>`
- `backend/utils/razorpayWebhook.js`
  - `invoice:<bookingId>`

The timestamp-based cancellation job names are not idempotent. Repeated cancellation paths can enqueue logically duplicate cancellation email jobs.

## 6. Invoice Architecture

Invoices are generated in memory at send time:

- Booking invoice: `sendBookingInvoice(booking)` builds rows from the passed `Booking` document and attaches a PDF from `buildPdf()`.
- Order invoice: `sendOrderInvoice(order)` builds rows from the passed `Order` document and attaches a PDF from `buildPdf()`.
- There is no durable invoice document, no stored PDF/file URL, and no immutable invoice snapshot.
- `Booking.invoiceSentAt` and `Order.invoiceSentAt` are the only durable send markers.

Critical distinction:

- Phase 4.5 should make invoice email delivery durable.
- It should not expand scope into durable invoice artifact storage unless implementation discovers this is necessary for idempotent rendering. The first safe option is to store a minimal payload snapshot in `NotificationDelivery` so retries use the same rendered facts.

## 7. Email Provider Architecture

Two implementations exist:

- Shared transactional email utility: `backend/utils/email.js`
  - Prefers Resend when `RESEND_API_KEY` is present.
  - Falls back to SMTP when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` are present.
  - Throws `EMAIL_PROVIDER_NOT_CONFIGURED` when neither provider is configured.
  - Does not return or persist provider message IDs.
- Auth-local email utility inside `auth.routes.js`
  - Duplicates Resend/SMTP logic for OTP and partner registration alert.
  - Adds Resend sender-domain validation for OTP path.

Provider idempotency:

- The current Resend call does not send an idempotency key and does not parse/store a provider message id.
- Nodemailer SMTP has no reliable provider-level idempotency.
- Therefore Phase 4.5 must not claim exactly-once email delivery.

Recommended guarantee:

- At-least-once job execution.
- Durable logical notification idempotency.
- Best-effort duplicate suppression before provider send.
- Provider result audit when a response is received.
- `reconciliation_required` or equivalent state when provider outcome is unknown.

## 8. Current Retry Behavior

Current `jobQueue` retry behavior:

- none.
- A thrown email/provider error is logged and dropped.
- `EMAIL_PROVIDER_NOT_CONFIGURED` prevents invoice marker updates but leaves no durable retry record.

Current BullMQ defaults:

- `JOB_ATTEMPTS_DEFAULT` default is 1.
- Default exponential backoff base is `JOB_BACKOFF_BASE_MS`, default 30 seconds.
- Queue-level failure retention exists, but business delivery status should still be in MongoDB.

## 9. Current Idempotency Behavior

Existing idempotency is partial:

- Booking/order invoice helpers skip if `invoiceSentAt` exists on the document passed to the helper.
- Routes update `invoiceSentAt` after successful send.
- Cancellation email jobs include `Date.now()` in job name, so they are not logically idempotent.
- `PartnerNotification` has no `notificationKey` or unique logical event index.
- Admin alert emails send to all admin recipients with `Promise.allSettled()` and no per-recipient delivery records.

## 10. Duplicate Delivery Risks

Important duplicate scenarios:

- Worker sends email, provider accepts, response is lost, retry sends again.
- API enqueues both legacy `jobQueue` and future BullMQ job during migration.
- Webhook and payment verification both trigger the same invoice.
- Manual admin verify endpoint is called twice.
- Cancellation route is retried by client and timestamp job IDs produce multiple cancellation emails.
- Multiple admin recipients are sent concurrently; individual recipient success/failure is not persisted.

Phase 4.5 should use deterministic notification keys plus atomic claim before send. It cannot fully prevent duplicate email after unknown provider outcome without provider idempotency support.

## 11. Crash/Restart Failure Scenarios

| Scenario | Current behavior | Desired Phase 4.5 behavior |
| --- | --- | --- |
| API crashes after booking confirmed but before `enqueueJob()` | Notification/invoice intent lost | Business mutation should create durable notification intent before response or recovery sweep should detect missing intent |
| API crashes after `enqueueJob()` but before job runs | In-memory job lost | Mongo `NotificationDelivery` remains pending and can be re-enqueued |
| Worker/API crashes during email send | Outcome unknown and untracked | Delivery remains `processing`; stale processing recovery moves it to retry/reconciliation |
| Email provider unavailable | Error logged, job dropped | Delivery marked retryable with bounded next attempt |
| Email provider accepts but response lost | Current job may log error and drop | Mark uncertain outcome; avoid blind infinite retry; allow admin review or provider-specific reconciliation if possible |
| Duplicate trigger | Multiple jobs/emails possible | Unique `notificationKey` prevents duplicate logical intent |
| Duplicate BullMQ delivery | Current code may send again | Worker claim must only send when status is eligible |

## 12. Outbox Design Recommendation

Use one new model first:

`NotificationDelivery`

Rationale:

- Current side effects are notification-specific.
- We need recipient/channel/template/provider/attempt/status fields that a generic outbox would duplicate or hide in opaque payloads.
- `NotificationDelivery.notificationKey` can act as the outbox identity.
- A separate `OutboxEvent` can be deferred until the system has multiple non-notification side-effect categories.

Recommended statuses:

- `pending`
- `queued`
- `processing`
- `sent`
- `retry_scheduled`
- `failed`
- `reconciliation_required`
- `cancelled`

Recommended fields:

- `notificationKey` unique
- `eventType`
- `channel`: initially `email` or `in_app`
- `status`
- `priority`
- `recipientEmail`
- `recipientUserId`
- `recipientRole`
- `bookingId`
- `orderId`
- `modificationId`
- `partnerId`
- `hotelId`
- `template`
- `payloadSnapshot`
- `provider`
- `providerMessageId`
- `attempts`
- `maxAttempts`
- `nextAttemptAt`
- `processingStartedAt`
- `queuedAt`
- `sentAt`
- `failedAt`
- `lastError`
- `lastErrorAt`
- `reconciliationState`
- timestamps

Data minimization:

- Prefer references (`bookingId`, `orderId`, `recipientUserId`) over full payload snapshots.
- Use a snapshot only for invoice/receipt rows where retry must reproduce the same business document.
- Do not store SMTP passwords, Resend API keys, auth tokens, or full provider request headers.

## 13. Queue/Job Design

Use existing Phase 4.1 queue infrastructure:

- Queue: `QUEUE_NAMES.notification` (`vrindavan-sarthi-notification`)

Recommended job names:

- `notification.deliver`
- `notification.recovery.sweep`

Recommended deterministic BullMQ job IDs:

- `notification:<NotificationDelivery._id>`
- recovery sweep: `phase4.5:notification-recovery-sweep`

Do not use random job IDs for durable business events.

## 14. Deterministic Notification Key Strategy

Recommended logical keys:

- Booking invoice: `notification:booking:<bookingId>:invoice`
- Booking partner email alert: `notification:booking:<bookingId>:partner-alert`
- Booking admin email alert per recipient: `notification:booking:<bookingId>:admin-alert:<recipientHash>`
- Booking admin panel notification: `notification:booking:<bookingId>:admin-panel`
- Booking partner panel notification: `notification:booking:<bookingId>:partner-panel`
- Booking cancellation email: `notification:booking:<bookingId>:cancelled`
- Order invoice: `notification:order:<orderId>:invoice`
- Order admin email alert per recipient: `notification:order:<orderId>:admin-alert:<recipientHash>`
- Order admin panel notification: `notification:order:<orderId>:admin-panel`
- Order cancellation email: `notification:order:<orderId>:cancelled`
- Partner registration admin alert: `notification:partner-registration:<userId>:admin-alert`

Use the Mongo `_id` where available, not human-readable IDs alone, to avoid collisions. If a recipient is part of the logical identity, hash the normalized email instead of embedding it in the key.

## 15. Retry Policy

Recommended defaults for notification delivery:

- Attempts: 5
- Backoff: exponential using existing `JOB_BACKOFF_BASE_MS`, with per-notification override allowed.
- No infinite retries.

Retryable:

- network timeout
- connection reset
- HTTP 429
- HTTP 5xx
- temporary DNS/provider outage

Permanent:

- missing recipient
- malformed payload/template
- invalid email address
- provider authentication/configuration failure
- missing verified sender

Uncertain/reconciliation:

- provider accepted request but response was lost
- worker crashed after provider request before Mongo update
- provider response cannot be classified

## 16. Failed/DLQ Strategy

BullMQ failed jobs alone are not sufficient because failed-job retention is operational, not business-facing.

Use `NotificationDelivery.status = failed` for terminal failures and keep:

- `attempts`
- `lastError`
- `lastErrorAt`
- `recipientEmail`
- `template`
- related booking/order/modification refs
- provider

Admin APIs should later expose failed delivery search and manual retry. A separate DLQ queue is not required in the first implementation.

## 17. Recovery Sweep Strategy

A bounded recovery sweep is recommended but should not be enabled by default until tested.

It should find:

- `pending` records that were never queued.
- `queued` records with no corresponding BullMQ job, if detectable.
- stale `processing` records older than a safe processing timeout.
- `retry_scheduled` records whose `nextAttemptAt <= now`.

It should enqueue at most a bounded batch per run and should never send directly in the sweep. The worker remains the only delivery executor.

## 18. Atomicity/Transaction Analysis

The strongest pattern is:

1. Apply business mutation.
2. Create `NotificationDelivery` intent in the same MongoDB transaction/session.
3. After commit, enqueue BullMQ job.
4. Recovery sweep repairs any committed intent that was not enqueued.

Current code does not consistently use Mongoose transactions. MongoDB Atlas replica sets support transactions, but introducing transactions into booking/payment flows is risky and should be scoped carefully.

Safe incremental pattern:

- For first implementation, create durable `NotificationDelivery` immediately after successful business save and before returning when possible.
- Use deterministic keys so duplicate triggers are safe.
- Use recovery sweep to detect confirmed/paid/cancelled business states missing required notification intents.
- Later harden selected high-value flows with explicit sessions if the existing save path can safely be wrapped without affecting inventory/payment behavior.

Do not introduce broad transactions around inventory/payment code during Phase 4.5 unless a dedicated test proves no regression to Phase 2.1/3/4.4 invariants.

## 19. Admin Reconciliation Requirements

Minimum future admin-only APIs:

- `GET /api/notifications/deliveries`
- `GET /api/notifications/deliveries/:id`
- `POST /api/notifications/deliveries/:id/retry`

Filters:

- status
- channel
- template
- bookingId/orderId
- recipient
- createdAt range
- failed/reconciliation required

Authorization:

- Admin: global access.
- Partner: no global delivery endpoint. If partner visibility is later added, scope through booking.hotelId/partnerId and hide customer-sensitive payload where not needed.
- Customer: no global endpoint. Customer notification history should only expose their own booking/order messages if a product requirement appears.

## 20. Partner Authorization Requirements

The existing partner model is one partner to one hotel. Notification records tied to bookings must include enough references for scoping:

- `bookingId`
- `hotelId`
- `partnerId`

Partner-facing notification reads must only return records for the authenticated partner. Admin notification delivery records may contain customer emails and invoice data, so partner access should be conservative.

## 21. Privacy and Data Minimization

Do not store:

- provider credentials
- SMTP password
- Resend API key
- auth tokens
- Razorpay secrets
- raw email headers

Minimize:

- customer email in `recipientEmail` is necessary for delivery audit.
- phone/address/guest details should be stored only when needed for invoice snapshot replay.
- PDF binary should not be stored in MongoDB in Phase 4.5 unless a later invoice artifact phase requires it.

Logs should include only:

- notification id
- event type
- status
- attempt count
- related business id
- sanitized error code/message

## 22. Test Strategy

Preserve all existing tests and add Phase 4.5 tests.

Foundation/unit tests:

1. notification key determinism
2. duplicate notification creation returns one record
3. model requires a supported channel/template/status
4. BullMQ job ID is deterministic
5. retry classification
6. permanent failure classification
7. provider unknown outcome classification
8. payload sanitization/data minimization

Worker tests:

1. atomic claim sends once
2. duplicate worker delivery does not send twice when already sent
3. successful fake provider delivery records provider message id
4. transient fake provider failure schedules retry
5. permanent fake provider failure marks failed
6. stale processing recovery requeues

Integration tests with Atlas where Mongo concurrency matters:

1. concurrent creation of same notification key creates one record
2. payment success creates one booking invoice intent
3. webhook plus verification duplicate trigger creates one invoice intent
4. cancellation creates one cancellation intent
5. order verification creates one order invoice intent
6. admin/partner panel notification intent remains isolated

No test should send real email. Use fake provider boundaries.

## 23. Exact Implementation Sequence

1. Add `NotificationDelivery` model and indexes.
2. Add notification key builder and retry classifier utilities.
3. Add email provider adapter that returns provider metadata and supports fake provider injection for tests.
4. Add durable notification creation helpers for booking/order invoice, booking/order cancellation, admin/partner alerts, and in-app `PartnerNotification` creation.
5. Add BullMQ job names for `notification.deliver` and `notification.recovery.sweep`.
6. Add notification enqueue helper with deterministic job ID and Redis-absent recovery behavior.
7. Add notification worker processor to `worker.js`.
8. Add recovery sweep helper, disabled by default unless env enables it.
9. Migrate booking invoice trigger from `jobQueue` to durable helper.
10. Migrate Razorpay webhook invoice trigger.
11. Migrate manual UPI invoice trigger.
12. Migrate partner booking alert email.
13. Migrate admin/partner in-app booking notification creation.
14. Migrate booking cancellation email.
15. Migrate order invoice and cancellation emails.
16. Migrate order admin in-app/email alerts.
17. Add admin-only notification delivery inspection/retry endpoints.
18. Keep `jobQueue.js` until all production-critical callers are migrated and tests prove no duplicate delivery.
19. Run Phase 2.1, Phase 3, Phase 4.1/4.2/4.3/4.4, backend unit, full regression, and new Phase 4.5 suites.

## 24. Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Duplicate invoice email after unknown provider outcome | High | Mark `reconciliation_required`, do not blindly retry uncertain sends |
| Losing intent between business save and notification create | High | Deterministic recovery sweep; later targeted transactions |
| Double delivery during migration | High | Never call old `jobQueue` and new durable helper for same logical event |
| Partner data leakage | High | Store partner/hotel refs; admin-only global endpoints |
| Sensitive data in payload snapshot | Medium/high | Store references where possible; snapshot only invoice rows needed for retry |
| Redis unavailable | Medium | Mongo intent remains pending; recovery sweep/enqueue later |
| Email provider not configured | Medium | Mark delivery `failed`/configuration error, do not block business mutation |
| Invoice content changes on retry | Medium | Store minimal invoice row snapshot for invoice notifications |
| Existing 96/96 regression breakage | High | Incremental migration and run full regression after each group |

## 25. Explicit Must Not Change

Phase 4.5 must not change:

- booking lifecycle
- payment lifecycle
- modification lifecycle
- refund logic
- webhook processing semantics
- expiration logic
- payment reconciliation logic
- inventory locking
- `RoomUnitBookingDay`
- partner one-hotel ownership
- admin global access model
- Razorpay payment/refund behavior
- Express/CommonJS architecture
- MongoDB/Mongoose architecture
- frontend architecture
- channel manager/eZee/OTA integrations
- existing tests or assertions

## 26. Likely Files for Phase 4.5 Implementation

Likely new files:

- `backend/models/NotificationDelivery.js`
- `backend/utils/notificationKeys.js`
- `backend/utils/notificationDelivery.js`
- `backend/utils/notificationProvider.js`
- `backend/tests/phase4-5-notification.foundation.js`
- `backend/tests/phase4-5-notification.integration.test.js`
- `docs/PHASE_4_5_NOTIFICATION_OUTBOX.md`

Likely modified files:

- `backend/queues/names.js`
- `backend/worker.js`
- `backend/utils/customerMessages.js`
- `backend/utils/email.js`
- `backend/utils/razorpayWebhook.js`
- `backend/routes/booking.routes.js`
- `backend/routes/order.routes.js`
- `backend/routes/partner.routes.js` or a new admin notifications route
- `backend/package.json` only for test scripts, not dependencies unless needed

## 27. Final Recommendation

Phase 4.5 is safe to implement if it is treated as a notification-delivery migration, not a booking/payment rewrite. Start with the `NotificationDelivery` model and fake-provider-tested worker, then migrate one logical event at a time. Booking/order invoice and cancellation notifications should be first because they are the most customer-visible and currently rely on volatile in-memory jobs.

Do not implement a generic outbox and notification model simultaneously in the first pass. One durable notification model gives the required reliability, idempotency, retryability, auditability, and administrative visibility with the smallest architectural surface.
