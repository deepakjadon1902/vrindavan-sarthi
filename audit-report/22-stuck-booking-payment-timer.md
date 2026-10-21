# Vrindavan Sarthi — Stuck Booking Payment & Countdown Verification Report

**Document ID:** `audit-report/22-stuck-booking-payment-timer.md`  
**Date:** October 21, 2026  
**Status:** FIXED AND VERIFIED  
**Target Environment:** Localhost / Staging (`localhost:8081`, API `localhost:5000`)  
**Safety Classification:** Zero Live Mutations | Zero Sensitive Key Exposure | Production Safe  

---

## 1. Executive Summary

A reproducible defect was reported on local development (`localhost:8081`) where a request-first Dharamshala booking exhibited multiple confusing, contradictory, and blocking UI behaviors:
1. **Contradictory Verification States:** The booking details view simultaneously displayed `"Payment Status: Pending"`, `"Verification: Pending partner verification"`, and `"Your request has been accepted. Pay the shown amount within 30 minutes to confirm this booking."`
2. **Policy Conflict:** The UI claimed the user had **30 minutes** to pay, while server-side policy (`DHARAMSHALA_PAYMENT_HOLD_MINUTES`) strictly enforced a **15-minute hold**.
3. **Missing Countdown Timer:** No countdown timer or time-remaining indicator was displayed to the user despite `paymentHoldExpiresAt` being sent in the booking API payload.
4. **Stuck Payment Button:** Clicking the payment button permanently locked the button into `"Opening Razorpay..."` without opening the checkout modal or resetting state upon script delay, cancellation, or failure.
5. **Backend Guard Gap:** `POST /payments/razorpay/orders` allowed orders to be created even after `paymentHoldExpiresAt` had lapsed if the background expiration worker had not yet swept the database.

All five root causes have been systematically remediated with zero regressions. All **106 backend tests passed**, frontend TypeScript compilation succeeded with **zero errors**, Vite production build succeeded in 8.96 seconds, and Vitest suite passed.

---

## 2. Evidence-Based Incident Tracing

### 2.1 Database & Server-Side Booking Trace
Inspection of recent bookings in the local MongoDB revealed the affected records:
- **Booking ID:** `VVS-DR-20261021-312717` (MongoDB `_id: 6ad87000572cb562aee1026b`)
- **Booking State:** `bookingStatus: 'awaiting_customer_payment'`
- **Payment Status:** `paymentStatus: 'pending'`
- **Verification Stage:** `verificationStage: 'pending_partner'`
- **Hold Timestamp:** `paymentHoldExpiresAt: 2026-10-21T09:47:00.000Z` (15 minutes after acceptance)
- **Order Status:** `razorpayOrderId: null` (no Razorpay order created)

### 2.2 Mechanism of Failure
```
[User Submits Request] 
         │
         ▼
[Partner Accepts] ──► sets bookingStatus = 'awaiting_customer_payment'
                  ──► sets paymentHoldExpiresAt = Date.now() + 15 mins
                  ──► verificationStage remains 'pending_partner' (inherited from initial request)
         │
         ▼
[Customer Views UI]
   ├── Verification label reads 'pending_partner' ──► Shows "Pending partner verification" (False!)
   ├── Hardcoded banner text ──► Shows "Pay within 30 minutes" (False! Actually 15 min)
   ├── No countdown timer ──► Customer has no visibility of expiring hold
   └── Customer Clicks "Pay" ──► loadRazorpayCheckout() lacks timeout / handles existing script incorrectly
                             ──► isPayingDharamshala state gets permanently stuck at true ("Opening Razorpay...")
```

---

## 3. Root Cause Analysis

| # | Defect | Root Cause Location | Impact |
|---|--------|---------------------|--------|
| **RC-1** | Contradictory "Pending partner verification" | [BookingDetail.tsx](file:///d:/vrindavan-sarthi/frontend/src/pages/user/BookingDetail.tsx#L154-L162) | `verificationStage` was designed for manual offline UPI QR payments. For request-first bookings, partner acceptance changes `bookingStatus` to `awaiting_customer_payment` without updating `verificationStage`. The UI displayed contradictory copy: property accepted alongside pending verification. |
| **RC-2** | False 30-minute promise | [BookingDetail.tsx](file:///d:/vrindavan-sarthi/frontend/src/pages/user/BookingDetail.tsx#L817), [MyBookings.tsx](file:///d:/vrindavan-sarthi/frontend/src/pages/user/MyBookings.tsx#L309) | Both pages hardcoded `"within 30 minutes"`. The backend policy in `dharamshalaLifecycle.js` is strictly 15 minutes (`DHARAMSHALA_PAYMENT_HOLD_MINUTES = 15`), causing unexpected hold expirations. |
| **RC-3** | Absent countdown timer | Customer UI (`BookingDetail.tsx`, `MyBookings.tsx`) | `paymentHoldExpiresAt` was delivered by the backend API and stored in `bookingStore.ts`, but no timer component or clock interval existed to render the active hold window. |
| **RC-4** | Permanently stuck button | [BookingDetail.tsx](file:///d:/vrindavan-sarthi/frontend/src/pages/user/BookingDetail.tsx#L19-L34,L219-L270) | 1. `loadRazorpayCheckout()` lacked a timeout. If an existing `<script>` was in DOM or network hung, the promise never resolved or rejected.<br>2. Missing `(rzp as any).on?.('payment.failed')` listener.<br>3. `isPayingDharamshala(false)` was not guaranteed on all exit branches.<br>4. Button lacked hold expiry pre-check. |
| **RC-5** | Order creation allowed on expired hold | [payment.routes.js](file:///d:/vrindavan-sarthi/backend/routes/payment.routes.js#L90-L100) | `POST /payments/razorpay/orders` checked status strings (`cancelled`, `expired`) but failed to check if `paymentHoldExpiresAt <= new Date()`. An expired hold could still create orders before the background worker executed. |

---

## 4. Code Remediation Summary

### 4.1 Reusable Countdown Timer Component
Created [`frontend/src/components/BookingCountdownTimer.tsx`](file:///d:/vrindavan-sarthi/frontend/src/components/BookingCountdownTimer.tsx):
- Computes `remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))` on a 1-second interval.
- **Refresh Resilience:** Uses absolute server timestamp; page refreshes resume at the exact remaining duration and never reset to 15:00.
- **Progress Bar:** Visual bar showing time elapsed against the 15-minute hold window.
- **Urgency Modes:**
  - Normal (> 3 minutes): Brand gold / crimson theme.
  - Warning (1 to 3 minutes): Saffron / amber alert banner.
  - Critical (< 1 minute): Pulsing red warning with explicit notification.
  - Expired (<= 0 seconds): Clear expired state and invokes `onExpire()` callback to re-fetch booking status.
- **Compact Mode:** Embedded inline for dashboard card views (`MyBookings.tsx`).

### 4.2 Booking Details Refactoring
Updated [`frontend/src/pages/user/BookingDetail.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/user/BookingDetail.tsx):
1. **Accurate Verification Label:**
   ```typescript
   if (bookingStatus === 'awaiting_customer_payment') return 'Property Approved (Payment Pending)';
   if (bookingStatus === 'pending_property_confirmation') return 'Awaiting Property Approval';
   if (bookingStatus === 'expired_property_no_response') return 'Expired (Property Timed Out)';
   if (bookingStatus === 'expired') return 'Expired (Payment Hold Expired)';
   if (bookingStatus === 'rejected_by_property') return 'Declined by Property';
   if (stage === 'verified' || booking.paymentStatus === 'paid') return 'Verified';
   ```
2. **Robust `loadRazorpayCheckout(timeoutMs = 10000)`:**
   - 10-second timeout prevents indefinite hanging.
   - Cleans up event listeners on timeout or resolution.
   - Immediate resolution if `window.Razorpay` is already present.
3. **Resilient Button State & Error Recovery:**
   - Pre-check: Blocks checkout immediately if `booking.paymentHoldExpiresAt <= Date.now()`.
   - `modal.ondismiss`: Resets `isPayingDharamshala(false)` and displays informative toast.
   - `rzp.on('payment.failed')`: Resets `isPayingDharamshala(false)` and displays Razorpay error description.
   - `catch`: Resets `isPayingDharamshala(false)`. If error code is `PAYMENT_HOLD_EXPIRED`, refreshes booking to transition UI.
4. **Hold Expired Action Flow:**
   - Added `'expired'` to `canFindAnotherDharamshala`.
   - When hold expires, UI disables the pay button (`"Payment Hold Expired"`) and presents a 1-click `"Find Another Dharamshala"` button.

### 4.3 MyBookings Synchronization
Updated [`frontend/src/pages/user/MyBookings.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/user/MyBookings.tsx):
- Removed hardcoded `"within 30 minutes"` text.
- Embedded `<BookingCountdownTimer compact={true} />` directly inside booking cards in `awaiting_customer_payment` state.

### 4.4 Checkout Script Safety in RoomTypeDetail
Updated [`frontend/src/pages/RoomTypeDetail.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/RoomTypeDetail.tsx):
- Synchronized `loadRazorpayCheckout(timeoutMs = 10000)` with 10-second timeout protection.

### 4.5 Backend Hold Guard in Razorpay Orders
Updated [`backend/routes/payment.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/payment.routes.js#L98-L110):
```javascript
if (booking.paymentHoldExpiresAt && new Date(booking.paymentHoldExpiresAt).getTime() <= Date.now()) {
  await transitionBookingStatus(booking, 'expired', { actorRole: 'system', reason: 'payment_hold_expired' });
  booking.paymentStatus = 'expired';
  booking.verificationStage = 'rejected';
  booking.payout_status = 'cancelled';
  booking.expiredAt = new Date();
  await booking.save();
  await releaseBookingInventory(booking);
  return res.status(409).json({ success: false, message: 'PAYMENT_HOLD_EXPIRED' });
}
```

---

## 5. Automated Regression Test Suite

Created dedicated regression suite: [`backend/tests/stuck-booking-payment-timer.test.js`](file:///d:/vrindavan-sarthi/backend/tests/stuck-booking-payment-timer.test.js) covering 10 distinct test scenarios.

| Scenario | Description | Result |
|----------|-------------|:------:|
| **Scenario 1** | Verification stage label resolves to "Property Approved (Payment Pending)" without contradictory pending partner copy | **PASS** |
| **Scenario 2** | Partner approval transitions booking to `awaiting_customer_payment` with strictly 15-minute hold (`900,000ms`) | **PASS** |
| **Scenario 3** | Countdown calculation uses server timestamp, survives page refresh, and does not restart from 15:00 | **PASS** |
| **Scenario 4** | Countdown urgency boundaries: normal (>3m), warning (<=3m), critical (<=1m), expired (<=0s) | **PASS** |
| **Scenario 5** | Order creation blocked (`HTTP 409 PAYMENT_HOLD_EXPIRED`), status moved to `expired`, inventory released when hold lapsed | **PASS** |
| **Scenario 6** | Order creation permitted and hold recognized as valid when within 15-minute window | **PASS** |
| **Scenario 7** | Stuck button recovery: `isPaying` state resets to `false` on modal dismiss, failure event, timeout, or API error | **PASS** |
| **Scenario 8** | Expired booking UI state displays clear next action (`Find Another Dharamshala`) without dead ends | **PASS** |
| **Scenario 9** | Late payment capture after hold expiry routes safely to `PaymentReconciliation` with `provider_captured_inventory_incomplete` | **PASS** |
| **Scenario 10** | Multi-channel consistency: verifies zero instances of hardcoded `"within 30 minutes"` in user views | **PASS** |

---

## 6. Full Test Suite & Build Verification

### 6.1 Backend Test Results
```bash
node --test backend/tests/phase1-security.test.js \
            backend/tests/phase2-reservation.test.js \
            backend/tests/phase3-modification.test.js \
            backend/tests/dharamshala-booking-flow.test.js \
            backend/tests/business-rules-implementation.test.js \
            backend/tests/controlled-remediation.test.js \
            backend/tests/critical-logic-stabilization.test.js \
            backend/tests/post-remediation-verification.test.js \
            backend/tests/stuck-booking-payment-timer.test.js
```
```
ℹ tests 106
ℹ suites 0
ℹ pass 106
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 2099.9856
```

### 6.2 Frontend TypeScript Check
```bash
npx --prefix frontend tsc --noEmit -p frontend/tsconfig.json
# Exited with code 0 (Zero type errors)
```

### 6.3 Vite Production Build
```bash
npm --prefix frontend run build
# vite v5.4.21 building for production...
# ✓ 2223 modules transformed.
# ✓ built in 8.96s
```

### 6.4 Vitest Suite
```bash
npm --prefix frontend test
# Test Files  1 passed (1)
#      Tests  1 passed (1)
```

### 6.5 Runtime Services
- Backend API listening on port `5000` (PID 16400)
- Frontend Vite dev server listening on port `8081` (PID 18496)

---

## 7. Safety & Compliance Sign-Off

1. **Zero Live Charges:** No actual payments, refunds, settlements, or Razorpay API charge mutations were executed.
2. **Credential Protection:** All `.env` configurations, database URIs, payment gateway keys, and JWT secrets remain untouched.
3. **Audit Trail Maintained:** All state transitions use `appendStatusHistory` and record actor roles, timestamps, and reasons.
4. **Idempotency Preserved:** Webhook deduplication, reconciliation records, and inventory locks remain intact.
