# Phase 3 - Reservation Modification and Refund Foundation

Status: implemented foundation, pending real MongoDB execution in this environment
Date: 2026-09-10

## Architecture

Phase 3 preserves the existing stack: React/Vite frontend, Express/CommonJS backend, Mongoose, MongoDB, JWT authorization, and direct HTTPS Razorpay integration.

The authoritative lodging inventory remains `RoomUnitBookingDay` with the unique index:

```js
{ roomUnitId: 1, date: 1 }
```

Pricing is now shared through `backend/utils/pricing.js`. The formulas used by the existing room-type booking route were preserved.

Detailed modification records are stored in `BookingModification`. Booking records now also store provider refund outcome fields for cancellation/refund reconciliation.

## Modification Lifecycle

`BookingModification.status` supports:

```text
preview
inventory_pending
pending_payment
processing
refund_pending
completed
payment_failed
refund_failed
failed
cancelled
```

Valid flow:

```text
preview -> inventory_pending
inventory_pending -> pending_payment | processing | failed
pending_payment -> processing | payment_failed | cancelled
processing -> completed | refund_pending | refund_failed | failed
refund_pending -> completed | refund_failed
```

Terminal states:

```text
completed
payment_failed
refund_failed
failed
cancelled
```

The booking itself remains in its existing `confirmed` lifecycle state during modification. Financial and inventory progress is tracked by the modification record.

## APIs

Customer, partner, and admin authorization is enforced server-side.

```http
POST /api/bookings/:id/modify/preview
```

Builds a deterministic server-side preview. The client may send only:

```js
checkInDate
checkOutDate
roomTypeId
roomQuantity
adults
children
pets
guestDetails
```

Amounts from the client are rejected.

```http
POST /api/bookings/:id/modify
Idempotency-Key: required
```

Creates or returns an idempotent modification operation. If additional payment is required, a new Razorpay order is created for only the difference and the booking is not finalized until payment succeeds.

```http
POST /api/bookings/:id/modify/payment
```

Verifies the modification Razorpay payment, validates amount/currency/order/payment/signature, then applies the modification.

```http
POST /api/bookings/:id/refund
```

Admin-only reconciliation endpoint. The server determines the refundable amount from the booking record and never accepts arbitrary client refund amounts.

## Authorization

Customer:

```text
booking.userId === req.user._id
```

Partner:

```text
booking.partnerId === req.user._id
```

Admin:

```text
global access
```

Partner single-hotel ownership remains unchanged.

## Eligibility

The first production-safe modification version allows only:

```text
bookingStatus === confirmed
paymentStatus === paid
bookingType === room_type
```

Rejected with `409` or `422`:

```text
pending
payment_failed
expired
cancelled
checked_in
checked_out
completed
settled
waitlisted without assigned inventory
```

## Inventory Algorithm

The modification service does not release old inventory first.

Algorithm:

1. Load current booking locks.
2. Build target dates using UTC `[checkIn, checkOut)` semantics.
3. Load candidate room units for the target room type.
4. Prefer retaining current room units when compatible.
5. Reject room units blocked by manual `RoomUnitBlock` or other bookings.
6. Identify missing target locks.
7. Insert missing locks first.
8. If insertion fails, release only the newly inserted locks.
9. Save the booking with new dates, room type, quantity, guests, and money fields.
10. Release obsolete old locks only after booking save succeeds.
11. Verify final lock count equals `roomQuantity * nights`.

If save fails, newly acquired locks are compensated and the original booking/inventory remains valid.

## Pricing

Shared pricing lives in:

```text
backend/utils/pricing.js
```

Preserved lodging formula:

```text
baseAmount = roomType.pricePerNight * nights * roomQuantity
taxAmount = round(baseAmount * taxPercent / 100)
subtotal = baseAmount + taxAmount
convenienceFee = round(baseAmount * 4.45 / 100)
totalAmount = subtotal + convenienceFee
advanceAmount = 30% or 100% of totalAmount
```

Modification pricing never accepts client-controlled totals, taxes, convenience fees, gateway fees, or refund amounts.

## Payment Flow

If `newAmount > oldAmount`:

```text
paymentAction = additional_payment
differenceAmount = newAmount - oldAmount
```

The service:

1. Holds additional target inventory.
2. Creates a new Razorpay order for the difference.
3. Stores the order ID on `BookingModification`.
4. Waits for verification or webhook.
5. Applies the booking modification only after successful payment verification.

Duplicate verification returns the existing completed operation.

## Refund Flow

If `newAmount < oldAmount`:

```text
paymentAction = refund
refundAmount = oldAmount - newAmount
```

The modification is applied only after target inventory is secured. Then Razorpay refund execution is attempted when the booking has a captured Razorpay payment ID.

If refund execution fails, the modification record becomes:

```text
refund_failed
reconciliationState = needs_refund_reconciliation
```

The financial obligation is retained for manual/admin recovery.

## Cancellation Refund

The existing 12% cancellation deduction remains authoritative:

```text
deduction = round(totalAmount * 12 / 100)
refundableAmount = totalAmount - deduction
```

For paid Razorpay bookings, cancellation now attempts a provider refund and records:

```text
refundId
refundAmount
refundStatus
refundRequestedAt
refundProcessedAt
refundFailureReason
refundReconciliationState
```

If Razorpay refund fails, cancellation still records the refundable obligation as failed/pending reconciliation; it does not mark the refund as processed.

## Idempotency

Modification execution requires `Idempotency-Key`.

Unique constraint:

```js
{ bookingId: 1, idempotencyKey: 1 }, { unique: true }
```

Repeated requests with the same booking/key return the existing modification operation and do not duplicate:

```text
inventory locks
Razorpay orders
refunds
booking updates
```

Razorpay payment webhooks also track event IDs on modification records.

## Audit Trail

Detailed modification history is stored in `BookingModification`:

```text
actor
role
old values
new values
old amount
new amount
difference
payment/refund status
inventory status
failure reason
reconciliation state
timestamps
```

The existing `Booking.statusHistory` is also appended with a `booking_modified:<modificationId>` entry when a modification is applied.

## Failure Recovery

Inventory failure:

```text
release newly acquired locks only
preserve original booking and locks
mark modification failed
```

Payment failure:

```text
release held target locks
preserve original booking
mark modification payment_failed
```

Refund failure:

```text
do not mark refund processed
record failure reason
mark reconciliation required
```

Notification jobs remain best-effort and are not used for durable financial retries.

## Tests

Added:

```text
backend/tests/phase3-modification.test.js
backend/tests/phase3-modification.integration.test.js
```

Unit tests cover schema, lifecycle, authorization, idempotency, pricing, protected-field rejection, and refund fields.

Integration tests cover real MongoDB inventory modification scenarios, Razorpay order/payment/refund boundaries with fake HTTPS responses, duplicate modification/payment/webhook behavior, partner/customer/admin authorization, invalid inputs, cancellation refund calculation, and compensation after failure.

## Current Test Results

Executed successfully in this environment:

```text
backend npm test: 27 passed
frontend npm run build: passed
backend syntax checks on changed JS files: passed
```

Blocked in this environment:

```text
Phase 3 real MongoDB integration test
```

Reason:

```text
PHASE_2_1_MONGO_URI was not present in this shell, so the Atlas-only integration tests were blocked.
```

The integration suite refuses to clean any database except:

```text
vrindavan_sarthi_test
```

## Known Limitations

Live Razorpay refund execution was not verified against Razorpay credentials in this environment. Tests use a safe fake HTTPS boundary and do not contact Razorpay.

There is no durable retry worker for refunds. Failed refunds are recorded for reconciliation instead of retried forever.

The initial frontend modification UI is customer-facing on booking detail. Backend authorization already supports admin and partner modification calls, but richer admin/partner modification workflows can be expanded later.

## Deferred Phase 4 Work

Do not include channel manager work in Phase 3. Deferred:

```text
eZee
SiteMinder
HotelRunner
STAAH
RateGain
Booking.com
Agoda
MakeMyTrip
Expedia
multi-hotel-per-partner
durable refund retry queue
advanced admin/partner modification workbench
```
