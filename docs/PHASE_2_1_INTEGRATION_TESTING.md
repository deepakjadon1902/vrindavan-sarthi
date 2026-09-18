# Vrindavan Sarthi - Phase 2.1 Integration Testing

Status: Phase 2.1 verification harness  
Scope: real MongoDB reservation locking, lifecycle release, payment idempotency, and route-backed booking creation  
Date: 2026-09-10

## Purpose

Phase 2.1 proves the Phase 2 reservation lifecycle against real MongoDB and real Mongoose operations. The critical invariant is:

```text
one physical room + one room-night + two simultaneous reservation attempts
= exactly one successful lock
```

The integration suite does not use mocks or fakes for the critical room-night lock tests. It verifies the actual MongoDB index on `RoomUnitBookingDay` and exercises real `insertMany`, duplicate-key enforcement, document cleanup, cancellation release, expiration release, and payment lifecycle state transitions.

## Test Database

Use the dedicated Atlas test database:

```text
Database: vrindavan_sarthi_test
Environment variable: PHASE_2_1_MONGO_URI
```

Do not use production MongoDB. Do not provide production credentials for this test suite.

## Environment Variables

The integration suite requires:

```bash
PHASE_2_1_MONGO_URI=<Atlas URI for vrindavan_sarthi_test>
```

There is no localhost fallback. The suite fails closed if `PHASE_2_1_MONGO_URI` is absent or if the URI does not target `vrindavan_sarthi_test`.

Razorpay tests use local test-only secrets if none are supplied. They do not call a real payment transaction. The route-level Razorpay verification tests replace HTTPS calls with an in-process fake provider response.

## Running Tests

Backend unit regression tests:

```bash
cd backend
npm test
```

Phase 2.1 real-Mongo integration tests:

```bash
cd backend
npm run test:integration
```

All backend tests:

```bash
cd backend
npm run test:all
```

Frontend regression tests:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Backend syntax checks:

```bash
cd backend
node --check server.js
node --check utils/reservationLifecycle.js
node --check tests/phase2-reservation.integration.test.js
```

## Safety Protections

The integration suite refuses to run destructive cleanup when:

```text
NODE_ENV=production
```

or when the connected database name does not clearly look like a test/integration database.

Cleanup uses controlled collection cleanup for known test collections. It does not call `dropDatabase()` against an arbitrary connection.

## Index Verification

The suite reads the actual MongoDB collection indexes for `RoomUnitBookingDay` and fails unless it finds:

```js
{ roomUnitId: 1, date: 1 }
```

with:

```js
{ unique: true }
```

It also attempts a real duplicate insert to prove MongoDB enforces the unique constraint.

## Expected Concurrency Result

For one physical room `101` and one room-night `2026-10-10`:

```text
attempts = 2
successful = 1
failed = 1
RoomUnitBookingDay count = 1
duplicate locks = 0
```

For multi-night `2026-10-10 -> 2026-10-13`, one concurrent attempt wins and creates exactly three locks. The losing attempt leaves no partial lock set.

For quantity concurrency with rooms `101` and `102`, one booking receives both rooms and the other fails to reserve. No physical room-night is allocated to two bookings.

## Cleanup Behavior

Each test starts from a clean dedicated test database state and removes test documents after completion. This is safe only because the database name is guarded as a test database.

## Production Rule

Never run Phase 2.1 integration tests against production. If no safe isolated MongoDB is available, the correct result is:

```text
BLOCKED - SAFE TEST DATABASE UNAVAILABLE
```
