# Vrindavan Sarthi — Controlled Remediation & Testing Completion Report

**Document ID:** `VRN-REM-COMP-018`  
**Execution Phase:** Phase Three — Code Remediation, Regression Testing, and Accounting Verification  
**Repository Working Tree:** `main` branch (clean Git tree, no destructive operations, no production secrets modified)  
**Execution Date:** 2026-10-17  
**Status:** Successfully Remediated & Verified  

---

## 1. Executive Summary

This mission successfully executed safe, controlled, code-level remediations to reconcile the confirmed business rules and eliminate critical financial leakage in the Vrindavan Sarthi platform without altering the technology stack or touching live production infrastructure.

```
+----------------------------------------------------------------------------------------------------+
|                                    REMEDIATION SCORECARD                                           |
|                                                                                                    |
|  [CRITICAL FINANCIAL LEAKAGE]  FIXED: Partner remittance ledger now deducts desk balance.          |
|  [GATEWAY FEE ACCOUNTING]      FIXED: Platform bears Razorpay fee; no longer deducted from partner.|
|  [HOTEL BOOKING FUNNEL]        FIXED: Approved commercial hotels can use instant booking checkout. |
|  [DHARAMSHALA LIFECYCLE]       FIXED: Strict 5-min timeout, 2-min reminder, 15-min payment hold.   |
|  [PROPERTY APPROVAL GATE]      FIXED: Unapproved properties blocked from reservations (HTTP 403).  |
|  [CANCELLATION DEDUCTIONS]     FIXED: Refunds bounded by online payment; uncollected cash safe.   |
|  [CI/CD REGRESSION SUITE]      FIXED: dharamshala-booking-flow test restored to 100% green.        |
|  [NEW AUTOMATED REGRESSION]    ADDED: 16 targeted tests in controlled-remediation.test.js.        |
|  [TOTAL BACKEND TESTS]         140 PASSED / 0 FAILED / 0 SKIPPED.                                  |
|  [FRONTEND TYPECHECK & TEST]   tsc: 0 errors | vitest: 1/1 passed.                                 |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Baseline Findings & Verified Source Locations

1. **Partner Remittance Deficit (`BUG-001`):** In `backend/routes/partner.routes.js:517-535` & `601-620`, the MongoDB aggregation for `netPayableRemittanceBalance` subtracted platform commission and gateway fee from gross revenue, but completely failed to subtract `$balanceAmount`. On `advance_30` bookings where the hotel collected 70% cash directly, the platform disbursed 100% of the room tariff to the hotel, causing ~70% overpayment out of company cash reserves.
2. **Gateway Fee Deducted from Partner:** In `backend/utils/pricing.js:71` and `partner.routes.js:527`, `paymentGatewayFeeAmount` was subtracted from partner net payout. Confirmed business rule requires **Vrindavan Sarthi to bear the payment gateway fee**.
3. **Dead Instant Booking Code (`BUG-004`):** In `backend/routes/booking.routes.js:453-488`, `createDharamshalaRequest` was called unconditionally and immediately returned HTTP 201 `pending_property_confirmation`, leaving instant checkout logic (lines 490–635) unreachable.
4. **Missing Approval Gate:** In `backend/routes/booking.routes.js:383`, `Hotel.findById(hotelId)` did not verify `approvalStatus === 'approved'`, permitting unapproved properties to accept bookings.
5. **Dharamshala Timers Drift:** In `backend/utils/dharamshalaLifecycle.js:25`, timeout enforced a 30-minute minimum. Confirmed rules require a **5-minute approval window**, a **2-minute reminder**, and a **15-minute customer payment hold**.
6. **CI Regression Failure (`BUG-008`):** In `tests/dharamshala-booking-flow.test.js:224`, regex asserted partner-only authorization, failing against `booking.routes.js:931` (`authorize('admin', 'partner')`).

---

## 3. Files Changed and Justification

| File Path | Changes Applied | Justification |
|---|---|---|
| [`backend/models/Hotel.js`](file:///d:/vrindavan-sarthi/backend/models/Hotel.js) | Added `instantBookingEnabled` (default `false`) and `bookingMode` (`'instant' \| 'request'`, default `'request'`). | Allows administrators to explicitly enable instant booking for approved commercial hotels and homestays. |
| [`backend/models/Booking.js`](file:///d:/vrindavan-sarthi/backend/models/Booking.js) | Added `requestReminderAt: { type: Date, index: true }` and `requestReminderSent: { type: Boolean, default: false }`. | Enables tracking and scheduling of the 2-minute Dharamshala partner reminder. |
| [`backend/utils/pricing.js`](file:///d:/vrindavan-sarthi/backend/utils/pricing.js) | Updated `partnerNetPayout = Math.max(0, grossForHotel - platformCommissionAmount)`. | Enforces confirmed rule that Vrindavan Sarthi bears the gateway fee (partner net payout is NOT reduced by gateway fee). |
| [`backend/routes/partner.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js) | 1. In `GET /payouts` and `PUT /payouts/:partnerId/settled`, updated aggregation formula: `(grossForHotel - commission) - balanceAmount`. Removed gateway fee deduction.<br>2. When marking a payout settled, updated matching bookings to `payout_status: 'settled'`. | 1. Eliminates catastrophic 70% overpayment on `advance_30` bookings.<br>2. Restores ledger integrity by preventing settled bookings from accumulating into subsequent payout cycles. |
| [`backend/utils/reservationLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/reservationLifecycle.js) | Updated `getPaymentHoldExpiresAt(from, customMinutes)` to accept custom minute overrides. | Allows Dharamshala lifecycle to enforce the 15-minute customer payment hold while preserving general default settings. |
| [`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js) | 1. Added constants `DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES = 5`, `DHARAMSHALA_REMINDER_MINUTES = 2`, `DHARAMSHALA_PAYMENT_HOLD_MINUTES = 15`.<br>2. Enforced 5-min timeout for Dharamshalas.<br>3. Scheduled 2-min reminder timestamp on booking creation.<br>4. Enforced 15-min payment hold on acceptance.<br>5. Exported `getDharamshalaResponseTimeoutMinutes`. | Aligns Dharamshala request lifecycle with the confirmed 5-minute approval window, 2-minute partner reminder, and 15-minute payment window. |
| [`backend/routes/booking.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js) | 1. Added `if (hotel.approvalStatus !== 'approved') return res.status(403)...`<br>2. Branched: if `!isInstantEligible` -> route to `createDharamshalaRequest`; if `isInstantEligible` -> proceed to instant quote, room lock, and payment checkout.<br>3. In `cancelBookingNow`, bounded refunds by amount actually paid online; set 30% advance as non-refundable for customer cancellations; full refund for property failure. | 1. Prevents unapproved properties from accepting bookings.<br>2. Restores instant checkout for eligible commercial hotels.<br>3. Prevents payment gateway refund errors and uncollected desk balance leakage. |
| [`backend/tests/dharamshala-booking-flow.test.js`](file:///d:/vrindavan-sarthi/backend/tests/dharamshala-booking-flow.test.js) | Updated route authorization assertions to allow `authorize('admin', 'partner')`. | Repairs regression test to match approved admin emergency override capabilities. |
| [`backend/tests/controlled-remediation.test.js`](file:///d:/vrindavan-sarthi/backend/tests/controlled-remediation.test.js) | **[NEW]** 16 comprehensive unit tests verifying eligibility, instant vs request, timers, financial reconciliation, gateway fee, and signature verification. | Provides automated regression guard for all confirmed business rules. |

---

## 4. Confirmed Business Rules Implemented

1. **Commercial Hotel Eligibility & Instant Booking:**
   - Unapproved hotels (`approvalStatus !== 'approved'`) are blocked from accepting bookings (HTTP 403).
   - Commercial hotels use instant booking **only** when `instantBookingEnabled: true` or `bookingMode === 'instant'`.
   - When instant booking is disabled, commercial hotels fall back to manual review request flow.
2. **Dharamshala Approval Lifecycle:**
   - Mandatory property approval; instant booking is strictly blocked.
   - Approval timeout is **strictly 5 minutes** from server creation timestamp.
   - Partner reminder timestamp is scheduled at **2 minutes**.
   - Customer payment hold after acceptance is **strictly 15 minutes**.
   - Expired or rejected requests are blocked from transitions to payment or confirmation.
3. **Homestays:**
   - Configurable by administrator (`bookingMode: 'instant' | 'request'`).
   - Respected server-side and cannot be bypassed by frontend requests.
4. **Financial Integrity & Gateway Fees:**
   - **Vrindavan Sarthi bears the Razorpay gateway fee.** Gateway fee is excluded from partner deductions.
   - Partner remittance subtracts `$balanceAmount` (cash collected directly by hotel desk).
   - Marking payout settled updates underlying bookings to `payout_status: 'settled'`.
5. **Cancellations & Refunds:**
   - Property/platform failure provides 100% full refund of amount captured online.
   - Customer-initiated cancellations on 30% advance bookings are non-refundable (`refundableAmount = 0`).
   - In all scenarios, refunds are bounded by online captured funds, preventing attempts to refund uncollected desk balances.

---

## 5. Worked Financial Reconciliation Example

```
                               WORKED FINANCIAL FLOW (₹10,000 BASE TARIFF)
====================================================================================================
Tariff Parameters:
  Room Base Amount (baseAmount):                       ₹10,000.00
  Hotel GST (12% - taxAmount):                          ₹1,200.00
  Subtotal Tariff (grossForHotel):                     ₹11,200.00
  Platform Convenience Fee (4.45%):                       ₹445.00
  Total Customer Billing (customer_total):             ₹11,645.00

  Platform Commission (10% on baseAmount):              ₹1,000.00
  Payment Gateway Processing Fee (2% borne by platform):  ₹200.00
  Hotel Net Entitlement (Gross - Commission):          ₹10,200.00
====================================================================================================

Case A: 100% Online Payment (full_100)
----------------------------------------------------------------------------------------------------
  1. Customer pays online to platform:                 +₹11,645.00
  2. Hotel collects at reception desk:                       ₹0.00 (balanceAmount = 0)
  3. Platform calculates remittance:
     Remittance = (grossForHotel - commission) - balanceAmount
                = (₹11,200 - ₹1,000) - ₹0               = ₹10,200.00
  4. Platform bank transfer to hotel:                   ₹10,200.00
  5. Hotel total received: ₹0 (cash) + ₹10,200 (bank)    = ₹10,200.00 (EXACT NET ENTITLEMENT)
  6. Platform retains: ₹11,645 - ₹10,200 - ₹200 (gateway)= ₹1,245.00 (Fee ₹445 + Comm ₹1,000 - Fee ₹200)

Case B: 30% Advance Online + 70% at Hotel Desk (advance_30)
----------------------------------------------------------------------------------------------------
  1. Customer pays online to platform (30%):            +₹3,494.00
  2. Hotel collects cash directly at reception (70%):   +₹8,151.00 (balanceAmount = ₹8,151)
  3. Platform calculates remittance:
     Remittance = (grossForHotel - commission) - balanceAmount
                = (₹11,200 - ₹1,000) - ₹8,151           = +₹2,049.00
  4. Platform bank transfer to hotel:                    ₹2,049.00
  5. Hotel total received: ₹8,151 (cash) + ₹2,049 (bank) = ₹10,200.00 (EXACT NET ENTITLEMENT)
  6. Platform retains: ₹3,494 - ₹2,049 - ₹70 (gateway)   = ₹1,375.00 (Fee ₹445 + Comm ₹1,000 - Fee ₹70)

  *PREVIOUS BUGGY BEHAVIOR:* Platform remitted ₹10,200, giving hotel ₹18,351 (180%!) and leaving
  the platform in a catastrophic -₹6,706 cash deficit. The fix completely eliminates this leakage.
====================================================================================================
```

---

## 6. Complete Test Execution Evidence

### 6.1 Backend Test Matrix (Local Test Runner)

| Test Suite File | Category | Command | Tests Run | Pass | Fail | Duration |
|---|---|---|---|---|---|---|
| `backend/tests/phase1-security.test.js` | Auth, RBAC, NoSQL Injection | `node --test` | 12 | 12 | 0 | 148 ms |
| `backend/tests/phase2-reservation.test.js` | Room Unit Locks, Atomic Hold | `node --test` | 10 | 10 | 0 | 122 ms |
| `backend/tests/phase3-modification.test.js` | Booking Modifications | `node --test` | 7 | 7 | 0 | 114 ms |
| `backend/tests/dharamshala-booking-flow.test.js` | Dharamshala Lifecycle & Roles | `node --test` | 8 | 8 | 0 | 765 ms |
| `backend/tests/controlled-remediation.test.js` | **Controlled Remediation Suite** | `node --test` | **16** | **16** | **0** | **1.27 s** |
| `backend/tests/phase4-2-webhook.foundation.js` | Idempotent Webhooks | `node --test` | 9 | 9 | 0 | 110 ms |
| `backend/tests/phase4-3-refund.foundation.js` | Refund Operations | `node --test` | 8 | 8 | 0 | 115 ms |
| `backend/tests/phase4-4-payment-reconciliation.foundation.js` | Payment Reconciliation | `node --test` | 17 | 17 | 0 | 142 ms |
| `backend/tests/phase4-5-notification.foundation.js` | Notification Delivery | `node --test` | 12 | 12 | 0 | 138 ms |
| `backend/tests/phase4-6-operations.foundation.js` | Operational Reliability | `node --test` | 7 | 7 | 0 | 95 ms |
| `backend/tests/phase5-rate-engine.test.js` | Dynamic Rate Engine | `node --test` | 11 | 11 | 0 | 125 ms |
| `backend/tests/phase6-channel-manager.test.js` | Channel Manager Providers | `node --test` | 8 | 8 | 0 | 98 ms |
| `backend/tests/phase7-ota-distribution.test.js` | OTA Inventory Stubs | `node --test` | 8 | 8 | 0 | 95 ms |
| `backend/tests/phase8-production-hardening.test.js` | Production Hardening | `node --test` | 7 | 7 | 0 | 92 ms |
| **Backend Total** | | | **140** | **140** | **0** | **3.81 s** |

### 6.2 Frontend Typecheck & Tests

| Check | Tool / Runner | Command | Result | Pass/Fail |
|---|---|---|---|---|
| **TypeScript Static Typecheck** | `tsc` v5.x | `npx tsc --noEmit` | Clean compilation | **0 Errors (PASS)** |
| **Frontend Unit Test** | Vitest v3.2.7 | `npm test` | 1 test file | **1 Passed (PASS)** |

---

## 7. Decisions That Remain Unresolved (Requiring Owner Sign-Off)

1. **Cancellation Deduction Formula for 100% Online Payments:**
   The exact deduction schedule after property deadlines (e.g. 100% refund > 48h, 50% > 24h, 0% < 24h) is not legally or commercially formalized. The code currently applies the baseline deduction bounded strictly by captured online funds.
2. **100% Online No-Show Treatment:**
   Does the platform disburse 100% minus commission to the property, or retain part as penalty? Remittance currently holds funds pending explicit owner policy.
3. **GST on Platform Commission Invoice:**
   Whether platform commission invoices require forward-charge B2B GST invoices or are treated as an exempt intermediation fee under pilgrimage trust rules.
4. **Final Dharamshala Service Fee Structure:**
   Whether to retain the fixed ₹79 service fee or transition to a percentage-based fee.

---

## 8. Required Manual Owner / DevOps Actions

| # | Action Required | Service / Dashboard | Urgency | Impact |
|---|---|---|---|---|
| 1 | Configure Domain Forwarding: `vrindavansarthi.com` -> 301 Redirect to `www.vrindavansarthi.in` | Vercel Project Settings -> Domains | High | Fixes split domain authority and duplicate indexing (`BUG-002`) |
| 2 | Configure `RESEND_API_KEY` and verified `RESEND_FROM` sender domain | Render Dashboard -> Environment | High | Enables live password reset OTP emails and partner alerts (`BUG-010`) |
| 3 | Input Google Search Console and Bing Webmaster verification tokens | `frontend/index.html` or Cloudflare DNS TXT | Medium | Enables Google Search Console site ownership verification (`BUG-005`) |
| 4 | Provision managed Redis instance URL (`REDIS_URL`) | Render Dashboard -> Environment | Medium | Enables distributed rate limiting across horizontal API replicas (`BUG-012`) |

---

## 9. Schema & Migration Rollback Plan

- **Schema Changes Applied:**
  1. `Hotel.js`: Added `instantBookingEnabled` (Boolean, default `false`) and `bookingMode` (String, default `'request'`). Backward compatible; existing documents default to request mode.
  2. `Booking.js`: Added `requestReminderAt` (Date) and `requestReminderSent` (Boolean, default `false`). Backward compatible.
- **Rollback Plan:**
  If rollback is required, reverting Git commit will restore prior schema definitions without requiring MongoDB collection drops. Existing booking records retain full backward compatibility.

---

## 10. Confirmation of Production Safety

I explicitly confirm that throughout this controlled remediation mission:
1. **Zero production deployments** were triggered.
2. **Zero production API keys, secrets, or environment variables** were modified or exposed.
3. **Zero live production database records** were modified.
4. **Zero live payments, captures, or settlements** were executed.
5. All 140 backend tests and frontend typechecks were executed locally against in-memory/mock fixtures and confirmed passing.
