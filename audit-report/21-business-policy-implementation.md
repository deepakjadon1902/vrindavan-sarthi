# Vrindavan Sarthi — Owner-Approved Business Rules Implementation Report

**Document ID:** `VS-REP-2026-10-21-0021`  
**Date:** October 21, 2026  
**Status:** **READY FOR STAGING TESTS**  
**Lead Architect & Auditor:** Senior Software Architect, Financial Systems Auditor, QA Automation Lead  
**Scope:** Controlled Implementation & Verification of Owner-Approved Business Policies (Rules A, B, and C)

---

## Executive Summary

Pursuant to direct owner instructions, three critical business rules governing OTA reservations, voluntary cancellations, customer no-shows, and front-desk balance collections have been implemented and validated across the Vrindavan Sarthi application.

All changes strictly preserve existing system architecture, maintain backward compatibility, and avoid any mock-dependency pollution or destructive data operations. Zero production deployments or live financial transactions occurred.

### Key Implementation Achievements

1. **Rule A (100% Online Booking Cancellation):**
   - Reference check-in timestamp anchored to property scheduled check-in time (`checkInTime`, default 12:00 PM IST).
   - Tiered refund schedule implemented in `backend/utils/cancellationPolicy.js` and integrated into `backend/routes/booking.routes.js`:
     - Cancellation $> 48$ hours before check-in: **75% refund** (25% deduction).
     - Cancellation from 24 hours up to and including 48 hours ($24 \le t \le 48$): **50% refund** (50% deduction).
     - Cancellation $< 24$ hours before check-in: **0% refund** (100% deduction).
     - Property or platform failure: **100% full refund** of captured online funds (0% deduction).
     - 30% Advance online booking: Customer voluntary cancellation is **non-refundable** (0% refund, 100% deduction of advance).
   - Exact boundary behavior tested and verified ($h = 48.000 \implies 50\%$, $h = 24.000 \implies 50\%$, $h = 48.001 \implies 75\%$, $h = 23.999 \implies 0\%$).

2. **Rule B (100% Online Prepaid No-Show):**
   - Check-in deadline + grace period (default 6 hours) strictly enforced before allowing property or admin to mark no-show. Premature attempts are rejected with HTTP 400 (`CHECK_IN_GRACE_PERIOD_ACTIVE`).
   - Audit trail recorded on booking: `noShowMarkedAt`, `noShowMarkedBy`, `noShowMarkedByName`, `noShowMarkedByRole`, `noShowReason`, and `noShowGracePeriodHours`.
   - Customer dispute endpoint implemented: `POST /api/bookings/:id/no-show-dispute`.
   - Admin dispute review endpoint implemented: `PUT /api/bookings/:id/no-show-review` with resolution options (`upheld` vs `overturned_customer_refund`).
   - Settlement logic: For confirmed customer no-show on 100% prepaid booking, customer receives 0% refund. The hotel held the inventory and is entitled to room tariff minus platform commission (`grossForHotel - platformCommissionAmount`), with payment gateway fees absorbed by Vrindavan Sarthi platform. Booking settlement status is set to `payout_status = 'checked_out'` (eligible for payout).
   - Hotel/property failure is never a customer no-show (entitles customer to 100% refund).
   - Unpaid balance for 30% advance bookings is **never auto-charged** to a no-show customer.

3. **Rule C (Hotel Balance Collection & Excess Discrepancy Safeguards):**
   - For 100% online bookings, `amountPayableAtProperty` and `balanceAmount` are strictly **0**.
   - For 30% advance bookings, remaining balance is calculated server-side from confirmed records: `totalAmount - amountPaidOnline`. Client-supplied balances are never trusted.
   - Dedicated balance collection endpoint implemented: `PUT /api/bookings/:id/collect-balance` with duplicate prevention via idempotency keys and audit history.
   - Excess collection safeguard: Any amount collected exceeding expected balance is recorded in `collectionDiscrepancy` (`detected: true`, `expectedAmount`, `collectedAmount`, `excessAmount`, `detectedAt`, `reportedToAdmin: true`). The excess is preserved in the auditable ledger and is not silently discarded or zeroed out.

---

## Detailed Policy Breakdown & Verification

### 1. Rule A: 100% Online Booking Cancellation

#### Reference Timestamp & Check-In Normalization
Properties in the Braj region (Vrindavan, Mathura, Govardhan, Barsana) operate on India Standard Time (IST, UTC+05:30). Booking check-in dates are stored as UTC midnight dates (`checkIn`), while check-in time of day is defined on the property (`checkInTime`, default `'12:00'`).
The helper `getScheduledCheckInDateTime(booking, hotel)` parses the UTC date component and combines it with the normalized time component in UTC+05:30:
```javascript
const scheduledCheckIn = new Date(`${dateStr}T${normalizedTime}:00+05:30`);
```
This guarantees exact millisecond calculations regardless of the server timezone or environment.

#### Exact Boundary Matrix
Let $h$ be the remaining hours before scheduled check-in time:

| Condition | Policy Tier | Eligible Refund | Cancellation Deduction | Verified By Automated Test |
|---|---|---|---|---|
| $h > 48$ hours | `more_than_48h` | 75% of paid online | 25% of paid online | `PASS` ($h = 50.0$, $h = 48.001$) |
| $h = 48.000$ hours | `between_24h_and_48h` | 50% of paid online | 50% of paid online | `PASS` (Exact boundary) |
| $24 \le h < 48$ hours | `between_24h_and_48h` | 50% of paid online | 50% of paid online | `PASS` ($h = 36.0$) |
| $h = 24.000$ hours | `between_24h_and_48h` | 50% of paid online | 50% of paid online | `PASS` (Exact boundary) |
| $h < 24$ hours | `less_than_24h` | 0% | 100% of paid online | `PASS` ($h = 23.999$, $h = 2.0$) |
| Past Check-in | `less_than_24h` | 0% | 100% of paid online | `PASS` ($h = -2.0$) |
| Property/Platform Failure | `platform_or_property_failure` | 100% full refund | 0% | `PASS` |
| 30% Advance Online | `advance_30_non_refundable` | 0% refund | 100% of advance | `PASS` |

#### Payment Breakdown & Explicit Ambiguity Reporting
- **Room Tariff:** `booking.baseAmount` (`grossForHotel` minus hotel GST).
- **Applicable Taxes:** `booking.taxAmount` (hotel GST passed to partner/government).
- **Platform Convenience Fee:** `booking.convenienceFeeAmount` (4.45% platform fee for booking software and customer support).
- **Amount Actually Captured Online:** `paidOnline` = `booking.amountPaidOnline`.
- **Refundable Base & Deduction Treatment:**
  When a customer voluntarily cancels, the cancellation deduction (25%, 50%, or 100%) is applied against `paidOnline`. The retained cancellation deduction absorbs the non-refundable platform convenience fee, gateway processing fees, and hotel reservation holding damages. In property or platform failure, customer receives 100% of `paidOnline` including convenience fee and taxes.
- **Retained Cancellation Allocation Ambiguity:**
  Under the current approved partner agreements, there is no contractually established split defining what percentage of retained customer cancellation fees belongs to the partner versus Vrindavan Sarthi platform. In the codebase, cancelled bookings are set to `payout_status = 'cancelled'`. Rather than inventing an unauthorized accounting split, this ambiguity is explicitly flagged for owner and partner committee determination.

---

### 2. Rule B: 100% Online Prepaid No-Show

#### Check-In Grace Period Protection
A customer who has not cancelled may arrive late due to travel delays, train schedules, or traffic. To prevent properties from prematurely marking no-show, the system enforces a mandatory grace period (default 6 hours past scheduled check-in time):
```javascript
const deadline = new Date(scheduledCheckIn.getTime() + gracePeriodHours * 3600 * 1000);
if (now.getTime() < deadline.getTime()) {
  return res.status(400).json({
    success: false,
    code: 'CHECK_IN_GRACE_PERIOD_ACTIVE',
    message: `Check-in grace period of ${gracePeriodHours} hours is active until ${deadline.toISOString()}`,
  });
}
```

#### Audit Trail & Lifecycle Fields Added to `Booking` Model
- `noShowMarkedAt`: Timestamp when no-show was confirmed.
- `noShowMarkedBy`: ObjectId of actor (partner or admin).
- `noShowMarkedByName`: Full name of actor.
- `noShowMarkedByRole`: Role of actor (`partner` or `admin`).
- `noShowReason`: Formal justification recorded.
- `noShowGracePeriodHours`: Grace period window enforced (6 hours).
- `noShowDisputed`: Boolean flag indicating customer dispute.
- `noShowDisputeReason`: Text explanation submitted by guest.
- `noShowDisputedAt`: Timestamp when customer raised dispute.
- `noShowDisputeReviewedByAdmin`: Boolean flag for admin review.
- `noShowDisputeReviewedAt`: Timestamp of admin decision.
- `noShowDisputeReviewedBy`: Admin ObjectId.
- `noShowDisputeResolution`: Resolution (`upheld` vs `overturned_customer_refund`).
- `noShowDisputeNotes`: Admin notes on dispute outcome.

#### Financial Settlement for 100% Prepaid No-Show
- Customer refund: ₹0 (100% no-show charge).
- Hotel entitlement: Hotel reserved and held the room for the night. Partner is entitled to net room tariff:
  $$\text{hotel\_net\_payout} = \text{grossForHotel} - \text{platformCommissionAmount}$$
- Gateway fees: Borne by Vrindavan Sarthi platform.
- Settlement status: `payout_status = 'checked_out'` (eligible for payout settlement to partner).
- Advance 30 protection: Unpaid balance is never auto-charged or forcibly debited.

---

### 3. Rule C: Hotel Balance Collection & Excess Safeguards

#### Server-Side Enforcement
- For 100% online bookings (`full_100`): Server enforces `balanceAmount = 0`, `balance_at_property = 0`, and `amountPayableAtProperty = 0`.
- For 30% advance bookings (`advance_30`): Server calculates:
  $$\text{expectedBalance} = \max(0, \text{totalAmount} - \text{amountPaidOnline})$$
  Client-supplied balances are rejected.

#### Front-Desk Collection Endpoint (`PUT /api/bookings/:id/collect-balance`)
- Allowed actors: Property partner or admin.
- Allowed booking states: `confirmed` or `checked_in`.
- Idempotency: `idempotencyKey` prevents duplicate double-clicks or retries.
- Updating balances:
  $$\text{newTotalCollected} = \text{amountPaidToProperty} + \text{amountCollected}$$
  $$\text{balanceAmount} = \max(0, \text{expectedBalance} - \text{newTotalCollected})$$
- Excess Collection Safeguard:
  If $\text{newTotalCollected} > \text{expectedBalance}$:
  ```javascript
  booking.collectionDiscrepancy = {
    detected: true,
    expectedAmount: expectedBalance,
    collectedAmount: newTotalCollected,
    excessAmount: newTotalCollected - expectedBalance,
    detectedAt: new Date(),
    reportedToAdmin: true,
    notes: 'Desk collection exceeds expected booking balance',
  };
  ```
  The discrepancy is permanently logged and flagged on admin/partner dashboards without silently zeroing out or corrupting the ledger.

---

## Verification Test Results

### 1. Backend Automated Test Suite
Command:
```powershell
node --test backend/tests/phase1-security.test.js backend/tests/phase2-reservation.test.js backend/tests/phase3-modification.test.js backend/tests/controlled-remediation.test.js backend/tests/post-remediation-verification.test.js backend/tests/critical-logic-stabilization.test.js backend/tests/business-rules-implementation.test.js
```
**Results:**
- **Total Tests Run:** 87 tests
- **Passed:** 87
- **Failed:** 0
- **Duration:** 6.31s

Additional Dharamshala Lifecycle Tests:
```powershell
node --test backend/tests/dharamshala-booking-flow.test.js
```
- **Passed:** 8 / 8 tests (0 failures).

### 2. Frontend Verification
1. **TypeScript Typecheck (`cmd /c "cd frontend && npx tsc --noEmit"`):**
   - Exit code: `0` (Zero compiler errors).
2. **Vitest Unit Test Suite (`npm --prefix frontend test -- --run`):**
   - Exit code: `0` (Passed).
3. **Production Build (`npm --prefix frontend run build`):**
   - Exit code: `0` (2222 modules transformed, built in 21.60s without errors).

---

## Files Modified and Created

### New Modules & Test Suites
- `backend/utils/cancellationPolicy.js`: Pure mathematical and lifecycle calculation helper for scheduled check-in, tiered cancellations, grace periods, and no-show settlements.
- `backend/tests/business-rules-implementation.test.js`: 20 unit and integration tests covering exact boundaries, no-show grace periods, and balance collection discrepancy safeguards.
- `audit-report/21-business-policy-implementation.md`: This comprehensive implementation artifact.

### Modified Files
- `backend/models/Booking.js`: Added `checkInTime`, no-show audit and dispute fields, `balanceCollections`, and `collectionDiscrepancy`.
- `backend/routes/booking.routes.js`: Integrated `calculateCancellationRefund`, enhanced `PUT /:id/no-show` with grace period enforcement, added `POST /:id/no-show-dispute`, added `PUT /:id/no-show-review`, added `PUT /:id/collect-balance`, and snapshotted `checkInTime`.
- `backend/utils/pricing.js`: Included `amountPayableAtProperty: balanceAmount` in `buildMoneyFields`.
- `backend/utils/dharamshalaLifecycle.js`: Added `checkInTime: hotel?.checkInTime || '12:00'` to booking creation.
- `frontend/src/components/BookingFormDetails.tsx`: Corrected partner payout display (gateway fee borne platform-side, not deducted from partner), added No-Show Audit Record display, added Desk Balance Collection and discrepancy alert displays.
- `frontend/src/pages/CancellationPolicy.tsx`: Updated cancellation table to owner-approved tiered schedule (>48h: 75%, 24-48h: 50%, <24h: 0%, 30% advance: non-refundable, platform failure: 100%).
- `frontend/src/pages/user/BookingDetail.tsx`: Updated cancellation prompts with policy schedule disclosure; added "Dispute No-Show" workflow.
- `frontend/src/pages/partner/PartnerBookings.tsx`: Enabled no-show marking across all lodging bookings; added "Collect Desk Balance" button.
- `frontend/src/store/bookingStore.ts`: Added `markNoShow`, `collectBalance`, `disputeNoShow`, and `reviewNoShowDispute`.

---

## Production Safety Checklist

- [x] No deployments, publishing, or release actions occurred.
- [x] Zero real payments, charges, webhooks, captures, or settlements triggered.
- [x] All `.env` files and environment variables remain 100% untouched.
- [x] No database credentials, API keys, or secrets printed to logs or reports.
- [x] Full backward compatibility maintained with all pre-existing tests.

**Status:** **READY FOR STAGING TESTS**
