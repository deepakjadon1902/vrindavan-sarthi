# Vrindavan Sarthi — Test Execution & Regression Evidence Report

**Document ID:** `VRN-AUD-TEST-015`  
**Execution Context:** Local Node.js native test runner (`node --test`) and Vitest runner (`npm test`)  
**Workspace:** `d:\vrindavan-sarthi`  
**Execution Timestamp:** 2026-10-17  
**Status:** Complete  

---

## Executive Test Execution Summary

The backend repository includes an extensive phased test harness covering authentication security, reservation locks, pricing logic, modification workflows, OTA distribution, and channel manager stubs.
- **Backend Tests Executed:** **125 test cases** across 10 test suites.
- **Backend Tests Passed:** **124 passed (99.2%)**.
- **Backend Tests Failed:** **1 failed (0.8%)** — direct assertion error in `tests/dharamshala-booking-flow.test.js` due to route authorization regex drift (BUG-008).
- **Frontend Tests:** **1 test executed** (`frontend/src/test/example.test.ts`), **1 passed** (placeholder arithmetic assertion).
- **TypeScript Compilation:** `npx tsc --noEmit` completed with **0 errors**.

---

## Comprehensive Test Execution Matrix

| Test Suite / File | Category | Command | Exit Code | Tests | Pass | Fail | Duration | Status |
|---|---|---|---|---|---|---|---|---|
| `backend/tests/phase1-security.test.js` | Security, Auth, RBAC | `node --test tests/phase1-security.test.js` | 0 | 12 | 12 | 0 | 148 ms | **PASS** |
| `backend/tests/phase2-reservation.test.js` | Inventory Lock, Hold TTL | `node --test tests/phase2-reservation.test.js` | 0 | 10 | 10 | 0 | 122 ms | **PASS** |
| `backend/tests/phase3-modification.test.js` | Booking Date/Room Changes | `node --test tests/phase3-modification.test.js` | 0 | 7 | 7 | 0 | 114 ms | **PASS** |
| `backend/tests/phase4-pricing-and-commission.foundation.js` | Pricing Formulas, GST | `node --test tests/phase4-pricing-and-commission.foundation.js` | 0 | 33 | 33 | 0 | 185 ms | **PASS** |
| `backend/tests/phase4-settlement-and-payouts.foundation.js` | Payout Cycles & Bank Validation | `node --test tests/phase4-settlement-and-payouts.foundation.js` | 0 | 28 | 28 | 0 | 162 ms | **PASS** |
| `backend/tests/phase5-rate-engine.test.js` | Date-based Rate Engine | `node --test tests/phase5-rate-engine.test.js` | 0 | 11 | 11 | 0 | 125 ms | **PASS** |
| `backend/tests/phase6-channel-manager.test.js` | Webhook & Sync Providers | `node --test tests/phase6-channel-manager.test.js` | 0 | 8 | 8 | 0 | 98 ms | **PASS** |
| `backend/tests/phase7-ota-distribution.test.js` | OTA Inventory Stubs | `node --test tests/phase7-ota-distribution.test.js` | 0 | 8 | 8 | 0 | 95 ms | **PASS** |
| `backend/tests/phase8-production-hardening.test.js` | Rate Limit, Headers, Helmet | `node --test tests/phase8-production-hardening.test.js` | 0 | 7 | 7 | 0 | 92 ms | **PASS** |
| `backend/tests/dharamshala-booking-flow.test.js` | Dharamshala Lifecycle & Roles | `node --test tests/dharamshala-booking-flow.test.js` | 1 | 1 | 0 | 1 | 48 ms | **FAIL (BUG-008)** |
| `frontend/src/test/example.test.ts` | Frontend Dummy Placeholder | `npm test -- --run` | 0 | 1 | 1 | 0 | 365 ms | **PASS (DUMMY)** |
| `frontend/` (TypeScript Typecheck) | Static Typing Audit | `npx tsc --noEmit` | 0 | N/A | N/A | 0 | 1.82 s | **CLEAN (0 ERR)** |

---

## Detailed Test Failure Audit (BUG-008)

### Reproduction Command
```bash
cd backend && node --test tests/dharamshala-booking-flow.test.js
```

### Exact Terminal Output & Stack Trace
```
▶ Dharamshala Booking Flow Integration
  ✖ Dharamshala booking lifecycle - route surface and safety controls (5.6015ms)
    AssertionError [ERR_ASSERTION]: The input did not match the regular expression /router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('partner'\)/.
        at TestContext.<anonymous> (d:\vrindavan-sarthi\backend\tests\dharamshala-booking-flow.test.js:224:12)
        at Test.runInAsyncScope (node:async_hooks:206:9)
        at Test.run (node:internal/test_runner/test:898:25)
        at Test.start (node:internal/test_runner/test:812:17)
        at node:internal/test_runner/test:1270:71
        at node:internal/per_context/primordials:518:82
        at new Promise (<anonymous>)
        at new SafePromise (node:internal/per_context/primordials:486:29)
        at node:internal/per_context/primordials:518:9
        at Array.map (<anonymous>) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: '...',
      expected: /router\\.put\\('\\/:id\\/dharamshala\\/accept', protect, authorize\\('partner'\\)/,
      operator: 'match'
    }
▶ Dharamshala Booking Flow Integration (7.2144ms)

ℹ tests 1
ℹ suites 1
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 48.12
```

### Root Cause Mechanism
1. In `backend/tests/dharamshala-booking-flow.test.js:221-226`, the test parses `backend/routes/booking.routes.js` as raw text and executes a regex match:
   ```javascript
   assert.match(
     bookingRoutesSource,
     /router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('partner'\)/,
     'Dharamshala accept route should exist with partner protection'
   );
   ```
2. In commit `f783dc1` ("Add admin override to property response endpoints"), the author added administrative emergency override capabilities to `backend/routes/booking.routes.js:931`:
   ```javascript
   router.put('/:id/dharamshala/accept', protect, authorize('admin', 'partner'), async (req, res) => {
   ```
3. Because the route code now passes two roles (`'admin', 'partner'`), the strict regex looking exclusively for `authorize('partner')` fails immediately.
4. **Resolution:** Update the regex assertion to accept both roles:
   `/router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('(admin', 'partner'|'partner', 'admin')'\)/`.

---

## Test Suite Execution Evidence Highlights

### 1. Phased Security Suite (`phase1-security.test.js`)
- **Key Verifications:**
  - `rejectInvalidObjectId` blocks MongoDB BSON injection and malformed hex IDs (`abc`, `null`, `12345`).
  - Rate limiting middleware sets `Retry-After` headers on burst violations.
  - JWT authorization rejects expired tokens, malformed bearer headers, and unauthorized roles.
- **Log Snippet:**
  `✔ Phase 1: Security Controls & Middleware Sanitization (148ms) - 12 tests passed.`

### 2. Physical Inventory & Hold Locking (`phase2-reservation.test.js`)
- **Key Verifications:**
  - `acquireInventoryLock` sets MongoDB atomic index locks on `roomUnitId` + `nightKey`.
  - Concurrent booking collisions for the same room night yield HTTP 409 Conflict without double-booking.
  - Unpaid reservations automatically release inventory upon `paymentHoldExpiresAt` expiration.
- **Log Snippet:**
  `✔ Phase 2: Reservation Lock Engine & TTL Expiry (122ms) - 10 tests passed.`

### 3. Date Rates & Dynamic Pricing (`phase4-pricing-and-commission.foundation.js`)
- **Key Verifications:**
  - Base amounts scale accurately across night count, room count, and adults.
  - GST calculation respects ₹1,000 threshold rules (12% tax applied above threshold).
  - Platform convenience fee clamps properly at 4.45%.
- **Log Snippet:**
  `✔ Phase 4: Pricing Foundations & Commission Math (185ms) - 33 tests passed.`

---

## Quality Gap Audit & Test Coverage Recommendations

1. **Implement Missing Frontend Component Tests:**
   The frontend presently has 0% actual test coverage. Add test suites for:
   - `frontend/src/store/bookingStore.ts` (state machine transitions and price math).
   - `frontend/src/pages/HotelDetail.tsx` (calendar date picker and price quotation).
   - `frontend/src/pages/checkout/BookingCheckout.tsx` (Razorpay payment flow trigger).
2. **Add End-to-End Cypress or Playwright Integration Tests:**
   Implement automated smoke tests simulating guest checkout and partner acceptance.
3. **Correct Regression in `dharamshala-booking-flow.test.js`:**
   Remediate the assertion regex so that `npm test` runs green across the entire repository.
