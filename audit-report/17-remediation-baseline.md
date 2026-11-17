# Vrindavan Sarthi — Remediation Baseline Inspection Report

**Document ID:** `VRN-REM-BASE-017`  
**Execution Phase:** Phase One — Inspect Before Editing  
**Repository State:** `main` branch, clean working tree  
**Inspection Timestamp:** 2026-10-17  
**Status:** Baseline Completed — Proceeding to Controlled Code Remediation  

---

## 1. Verified Findings (Source-Code Confirmed)

### 1.1 Partner Settlement Deficit & Gateway Fee Accounting
- **Location:** [`backend/routes/partner.routes.js:517-535`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js#L517-L535), [`backend/routes/partner.routes.js:601-620`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js#L601-L620), and [`backend/utils/pricing.js:70-71`](file:///d:/vrindavan-sarthi/backend/utils/pricing.js#L70-L71).
- **Verified Code Behavior:**
  1. The MongoDB aggregation for `netPayableRemittanceBalance` computes:
     `grossForHotel - platformCommission - paymentGatewayFeeAmount`.
  2. It **fails to subtract `$balanceAmount`** (the 70% cash collected by the hotel at the desk on `advance_30` bookings), causing the platform to pay out cash it never collected.
  3. It **deducts `paymentGatewayFeeAmount` from the partner**, violating the confirmed business rule: *"Vrindavan Sarthi bears the Razorpay gateway fee. Do not deduct that fee from the hotel partner's payout."*
  4. In `pricing.js:71`, `partnerNetPayout` also improperly subtracted `paymentGatewayFeeAmount`.

### 1.2 Commercial Hotel Booking Trapped in Request-Only Flow
- **Location:** [`backend/routes/booking.routes.js:452-490`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js#L452-L490).
- **Verified Code Behavior:**
  In commit `f783dc1`, `createDharamshalaRequest` was called unconditionally on all room bookings, and line 478 immediately returns HTTP 201 with `bookingStatus = 'pending_property_confirmation'`. The downstream instant quote calculation, room unit locking, and payment checkout (lines 490–635) became completely unreachable dead code. Commercial hotels were stripped of instant booking.

### 1.3 Missing Property Approval Gate on Bookings
- **Location:** [`backend/routes/booking.routes.js:383-387`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js#L383-L387).
- **Verified Code Behavior:**
  The booking creation route checks `Hotel.findById(hotelId)` and `RoomType.findOne(...)`, but does **not** check whether `hotel.approvalStatus === 'approved'`. Unapproved properties could theoretically accept reservations if directly targeted.

### 1.4 Dharamshala Response Timeout & Expiration Drift
- **Location:** [`backend/utils/dharamshalaLifecycle.js:22-26`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js#L22-L26) and [`backend/utils/reservationLifecycle.js:30-34`](file:///d:/vrindavan-sarthi/backend/utils/reservationLifecycle.js#L30-L34).
- **Verified Code Behavior:**
  - `getDharamshalaResponseTimeoutMinutes` enforces `Math.max(30, ...)` (30 minutes minimum).
  - Confirmed business rule requires a **5-minute approval window** measured from the server-side creation timestamp, a **2-minute reminder**, and a **15-minute customer payment window** after acceptance.

### 1.5 Unit Test Suite Regex Failure (BUG-008)
- **Location:** [`backend/tests/dharamshala-booking-flow.test.js:224`](file:///d:/vrindavan-sarthi/backend/tests/dharamshala-booking-flow.test.js#L224).
- **Verified Code Behavior:**
  Test asserts `/router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('partner'\)/`, but `booking.routes.js:931` uses `authorize('admin', 'partner')`.

### 1.6 Customer Cancellation Base Discrepancy
- **Location:** [`backend/routes/booking.routes.js:1108-1110`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js#L1108-L1110).
- **Verified Code Behavior:**
  `refundableBase` for non-dharamshala bookings uses `booking.totalAmount`. On a 30% advance booking where the customer only paid 30% online, this attempts to refund money the platform never received. Under confirmed rules, the 30% advance is non-refundable for customer-initiated cancellations.

---

## 2. Unverified Audit Claims & Reconciled Policy

| Item | Unverified Claim / Legacy Code | Confirmed Business Rule Baseline | Reconciled Status |
|---|---|---|---|
| **Gateway Fee Payer** | Code deducted 2% fee from hotel payout | **Vrindavan Sarthi bears the Razorpay gateway fee.** Partner payout must NOT deduct gateway fee. | **Reconciled** |
| **Dharamshala Expiry** | Code enforced 30 minutes minimum | **Approval window is 5 minutes** from server-side request creation timestamp. | **Reconciled** |
| **Dharamshala Reminder** | Code had no scheduled partner reminder | **Reminder sent at 2 minutes** after initial request. | **Reconciled** |
| **Customer Payment Hold** | Code used 30 minutes (`BOOKING_PAYMENT_HOLD_MINUTES`) | **15 minutes** payment window after request acceptance. | **Reconciled** |
| **Homestay Booking Mode** | Unclear in legacy routes | **Configurable by administrator per property**; cannot be overridden by frontend. | **Reconciled** |
| **Cancellation Deduction** | Hardcoded 12% in `cancellationMoney` | Formula is **NOT finalized** for 100% online payments. Must not invent values. | **Open Policy** |
| **No-Show on 100% Online** | Assumed full retention in audit | **Unresolved**; 30% advance is non-refundable, 100% online remains under review. | **Open Policy** |

---

## 3. Files Required for Remediation

1. [`backend/models/Hotel.js`](file:///d:/vrindavan-sarthi/backend/models/Hotel.js)
   - Add schema support for `instantBookingEnabled` (default `false` for hotels/homestays, strictly `false` for Dharamshalas) and configurable homestay booking mode.
2. [`backend/routes/booking.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js)
   - Add explicit check: `hotel.approvalStatus === 'approved'` (reject unapproved properties with 403).
   - Branch lodging booking creation:
     - If property is `dharamshala` OR instant booking is disabled: route to property review request.
     - If property is commercial `hotel` with `instantBookingEnabled: true` OR `home_stay` configured for instant booking: execute instant quote, physical room unit lock, and payment order creation.
   - Fix customer cancellation refundable amount calculation to prevent refunding uncollected desk balances.
3. [`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js)
   - Set 5-minute approval window for Dharamshalas.
   - Schedule 2-minute partner reminder notification.
   - Set 15-minute payment hold on acceptance.
4. [`backend/utils/pricing.js`](file:///d:/vrindavan-sarthi/backend/utils/pricing.js)
   - Do not deduct `paymentGatewayFeeAmount` from `partnerNetPayout` (borne by platform).
5. [`backend/routes/partner.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js)
   - Fix `netPayableRemittanceBalance` aggregation in `GET /payouts` and `PUT /payouts/:partnerId/settled`:
     - Subtract `$balanceAmount` (cash already pocketed by property).
     - Do not deduct gateway fees from partner payout.
   - When marking a payout as settled, update matching bookings to `payout_status: 'settled'`.
6. [`backend/tests/dharamshala-booking-flow.test.js`](file:///d:/vrindavan-sarthi/backend/tests/dharamshala-booking-flow.test.js)
   - Fix assertion regex for `authorize('admin', 'partner')`.
7. [`backend/tests/controlled-remediation.test.js`](file:///d:/vrindavan-sarthi/backend/tests/controlled-remediation.test.js) (NEW)
   - Comprehensive automated test suite verifying all confirmed business rules.

---

## 4. Tests That Can Run Safely

The following tests run entirely against local in-memory fixtures or synthetic data without connecting to external production services:
- `node --test tests/phase1-security.test.js` (Auth & RBAC)
- `node --test tests/phase2-reservation.test.js` (Inventory locks & holds)
- `node --test tests/phase3-modification.test.js` (Booking adjustments)
- `node --test tests/phase4-2-webhook.foundation.js` (Idempotent webhooks)
- `node --test tests/phase4-3-refund.foundation.js` (Refund state machine)
- `node --test tests/phase4-4-payment-reconciliation.foundation.js` (Reconciliation)
- `node --test tests/phase5-rate-engine.test.js` (Dynamic pricing)
- `node --test tests/phase8-production-hardening.test.js` (Headers & sanitization)
- `node --test tests/dharamshala-booking-flow.test.js` (Dharamshala lifecycle)
- `node --test tests/controlled-remediation.test.js` (New comprehensive remediation suite)
- `npx tsc --noEmit` (TypeScript typecheck in `frontend/`)

---

## 5. Risks & Decisions Requiring Owner Approval

1. **Cancellation Deduction Formula for 100% Online Payments:**
   The exact deduction schedule (e.g. 100% refund > 48h, 50% > 24h, 0% < 24h) is not legally or commercially formalized. The code must preserve customer rights and avoid applying unapproved deductions.
2. **100% Online No-Show Treatment:**
   Does the platform disburse 100% minus commission to the property, or retain part as penalty? Remittance currently holds funds pending explicit policy.
3. **Production Domain & Vercel DNS Actions:**
   Domain-level 301 redirection from `vrindavansarthi.com` to `www.vrindavansarthi.in` requires owner/DevOps intervention in the Vercel dashboard.
4. **Resend Email API Credentials:**
   Production email delivery for password resets and partner alerts requires owner to input `RESEND_API_KEY` and verify DNS records on Render.
