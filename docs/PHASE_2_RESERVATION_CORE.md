# Vrindavan Sarthi - Phase 2 Reservation Core

Status: Phase 2 implementation  
Scope: lodging reservation lifecycle, inventory lock safety, payment idempotency, expiration, cancellation, and availability consistency  
Date: 2026-09-09

## Booking Lifecycle

The authoritative lodging creation path remains:

```text
POST /api/bookings/room-type
```

Lodging bookings use `Hotel -> RoomType -> RoomUnit -> RoomUnitBookingDay`. The legacy generic `POST /api/bookings` remains restricted to non-lodging legacy booking types and cannot create lodging inventory.

## State Machine

Canonical booking states now include:

```text
pending -> confirmed
pending -> payment_failed
pending -> expired
pending -> cancelled
confirmed -> checked_in
confirmed -> cancelled
checked_in -> checked_out
```

Terminal lifecycle states are:

```text
cancelled
expired
payment_failed
checked_out
```

Transitions are enforced by `backend/utils/reservationLifecycle.js`.

## Payment Relationship

Payment status is tracked separately from booking state:

```text
pending + pending payment
confirmed + paid payment
payment_failed + failed payment
expired + expired payment
```

Razorpay verification remains server-side with signature, amount, and currency validation. Duplicate successful verification safely returns the already-processed booking.

## Inventory Locking

`RoomUnitBookingDay` remains the physical-room inventory authority. A reservation lock is one document per room unit per UTC date.

```text
1 room x 1 night = 1 lock
1 room x 3 nights = 3 locks
2 rooms x 3 nights = 6 locks
```

The unique index on `{ roomUnitId: 1, date: 1 }` remains the concurrency guard.

## Expiration

Pending payment holds receive `paymentHoldExpiresAt`, calculated from `BOOKING_PAYMENT_HOLD_MINUTES`.

Default:

```text
30 minutes
```

Admin/system maintenance can expire stale holds through:

```text
POST /api/bookings/maintenance/expire-pending
```

Expiration is bounded, idempotent, and releases only that booking's room-night locks.

## Cancellation

Cancellation keeps the existing 12 percent deduction policy. The controlled cancellation operation:

```text
authenticates caller
checks ownership
validates current state
sets cancellation fields
transitions to cancelled
releases booking locks
sends existing best-effort notification
```

Repeated inventory release is safe and deletes only `RoomUnitBookingDay` rows for the booking.

## Check-In / Check-Out

Partner check-in requires a partner-owned lodging booking in `confirmed` state with `paymentStatus=paid`.

Admin stay updates are limited to:

```text
confirmed -> checked_in
checked_in -> checked_out
checked_out -> settled
```

## Availability

Public room-type availability and public hotel availability now use the same inventory sources:

```text
RoomUnit
RoomUnitBlock
RoomUnitBookingDay
```

Hotel listing and hotel room-type availability no longer infer occupied rooms from overlapping `Booking` records.

## Idempotency

The following operations are idempotent or safe on retry:

```text
inventory release
pending hold expiration
Razorpay duplicate verification
Razorpay duplicate webhook event
payment failure release
```

## Deferred Work

Phase 2 intentionally does not implement channel manager, eZee, rate plans, dynamic pricing, Redis/BullMQ, provider refunds, or a full reservation modification engine.
