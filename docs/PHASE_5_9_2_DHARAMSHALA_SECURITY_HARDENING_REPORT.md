# VRINDAVAN SARTHI — PHASE 5.9.2 DHARAMSHALA FEE INTEGRITY AND PARTNER SECURITY HARDENING REPORT

**Project:** Vrindavan Sarthi OTA  
**Workspace:** `D:\vrindavan-sarthi`  
**Baseline HEAD Commit:** `1295a53036a9eaa201aaf81b38990fd706a5669e`  
**Branch:** `main`  
**Date:** November 12, 2026  
**Execution Scope:** Narrowly scoped backend security hardening and staging integration tests (`87/87` runtime tests passed against isolated staging MongoDB `127.0.0.1:27018`). Zero commits, zero pushes, zero production changes.

---

## FINAL VERDICT

**`READY FOR FINAL SECURITY REVIEW`**

---

## 1. ROOT CAUSE ANALYSIS FOR ALL THREE ISSUES

1. **Issue 1 — Partner Forged Protected Dharamshala Fee Approval Fields (`backend/routes/partner.routes.js`):**
   - *Root Cause:* `stripPartnerListingProtectedFields(body)` (`lines 157-180`) deleted `dharamshalaServiceFee`, `dharamshalaPlatformFeeEnabled`, `approvalStatus`, and `partnerId`, **but omitted** `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, `dharamshalaFeeHistory`, `dharamshalaFeeApprovedBy*`, `platform_commission_percentage`, `cancellationPolicy*`, `status`, `propertyId`, and `dharamshalaPaymentMode`. Because `POST /api/partner/hotels` spread `...body` into `Hotel.create(...)` and `PUT /api/partner/hotels/:id` executed `Object.assign(hotel, body)`, partner payloads could inject forged fee-approval states or commission overrides.
2. **Issue 2 — Partner Hotel Updates Overwriting Existing Custom Fees (`backend/routes/partner.routes.js`):**
   - *Root Cause:* `applyPartnerHotelDefaults(body, req.user)` ran identically on both `POST /api/partner/hotels` and `PUT /api/partner/hotels/:id`, unconditionally assigning `body.dharamshalaServiceFee = 79`, `body.platform_commission_percentage = 10`, `body.dharamshalaPaymentMode = 'pay_at_dharamshala'`, and `body.dharamshalaPlatformFeeEnabled = true`. Consequently, `Object.assign(hotel, body)` in `PUT /hotels/:id` overwrote previously admin-configured custom service fees back to `₹79`. Furthermore, new Dharamshala listings did not explicitly initialize `dharamshalaFeeApprovalStatus: 'unconfigured'`.
3. **Issue 3 — Non-Fail-Closed Approval Gate & Missing Acceptance / Payment Order Revalidation (`backend/utils/dharamshalaLifecycle.js`, `backend/services/refundCalculationService.js`, `backend/routes/payment.routes.js`):**
   - *Root Cause:*
     - `validateDharamshalaFeeApproval(hotel)` only rejected `status === 'unconfigured'` or `(!isFeeApproved && dharamshalaFeeConfigured === false && status === 'pending_review')`, while also treating `version > 1` or non-empty `dharamshalaFeeHistory` as approved even when `status === 'pending_review'`. Missing, `null`, unknown/legacy states, or `pending_review + dharamshalaFeeConfigured: true` bypassed the gate.
     - `createDharamshalaFeeSnapshot(hotel)` (`refundCalculationService.js`) guessed `'explicitly_free'` when `approvalStatus` was missing on zero-fee records and ignored `dharamshalaPlatformFeeEnabled === false`.
     - `acceptDharamshalaRequest` (`dharamshalaLifecycle.js`) did not revalidate the property's current fee approval state or snapshot consistency prior to reserving room units and transitioning to `awaiting_customer_payment`/`confirmed`.
     - `POST /api/payments/razorpay/orders` (`payment.routes.js`) only verified `booking.bookingStatus === 'awaiting_customer_payment'` without checking whether property fee approval had been withdrawn or altered in the interim.

---

## 2. EXACT FILES CHANGED & SECURITY BEHAVIOR BEFORE VS. AFTER

### 2.1 Backend Code Files (4 Files)
1. **[`backend/routes/partner.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js#L157-L315)** *(Tracked Modified — Commit 1)*
   - Expanded `stripPartnerListingProtectedFields` to strip all fee approval, fee history/version, commission, cancellation policy, status, mode, and identifier fields (`dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, `dharamshalaFeeApprovedBy`, `dharamshalaFeeApprovedByName`, `dharamshalaFeeApprovedAt`, `dharamshalaFeeHistory`, `dharamshalaPaymentMode`, `platform_commission_percentage`, `cancellationPolicyType`, `customCancellationPolicy`, `cancellationPolicyHistory`, `status`, `propertyId`).
   - Updated `applyPartnerHotelDefaults(body, user, existingHotel = null)`:
     - On **create (`existingHotel === null`)**: initializes `dharamshalaFeeApprovalStatus: 'unconfigured'`, `dharamshalaFeeConfigured: false`, `dharamshalaServiceFeeVersion: 1`, `dharamshalaFeeHistory: []` for Dharamshalas while keeping non-Dharamshala defaults unchanged.
     - On **update (`existingHotel !== null`)**: preserves existing `dharamshalaServiceFee`, `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, `dharamshalaFeeHistory`, `dharamshalaFeeApprovedBy*`, and `platform_commission_percentage` without overwriting them to `₹79` (unless the property newly transitions from non-Dharamshala to Dharamshala, which resets fee review state to `'unconfigured'`).
2. **[`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js#L155-L460)** *(Tracked Modified — Commit 1)*
   - Replaced permissive check in `validateDharamshalaFeeApproval(hotel)` with strict fail-closed validation across the four-state model (`approved`, `explicitly_free`, `pending_review`, `unconfigured`), rejecting missing/`null`/unknown/inconsistent states and `pending_review + dharamshalaFeeConfigured === true`.
   - Removed duplicated fee validation check inside `createDharamshalaRequest`, calling `validateDharamshalaFeeApproval(hotel)` directly.
   - Added revalidation and snapshot consistency checks in `acceptDharamshalaRequest`: prevents acceptance if `paymentStatus === 'paid'`, if approval was withdrawn (`validateDharamshalaFeeApproval` throws 400), or if the fee configuration changed since request creation (throws 409 `DHARAMSHALA_FEE_SNAPSHOT_MISMATCH`), and records `AuditLog` (`action: 'dharamshala_acceptance_blocked'`) when Mongoose is connected.
3. **[`backend/services/refundCalculationService.js`](file:///d:/vrindavan-sarthi/backend/services/refundCalculationService.js#L181-L198)** *(Untracked — Commit 1)*
   - Updated `createDharamshalaFeeSnapshot(hotel)` to respect `dharamshalaPlatformFeeEnabled === false` (`fee = 0`) and return `'unconfigured'` when `dharamshalaFeeApprovalStatus` is absent instead of synthesizing `'explicitly_free'` or `'approved'`.
4. **[`backend/routes/payment.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/payment.routes.js#L98-L125)** *(Newly Modified Tracked — Commit 1)*
   - Hardened `POST /api/payments/razorpay/orders` for Dharamshala bookings to fetch the `Hotel` record, run `validateDharamshalaFeeApproval`, and reject (409) if `booking.dharamshalaFeeSnapshot` mismatches the current authorized property fee configuration. Existing non-Dharamshala payment flow and `/razorpay/verify` settlement reconciliation remain unchanged.

### 2.2 Test Files (2 Files)
5. **[`backend/tests/staging-negative-security.test.js`](file:///d:/vrindavan-sarthi/backend/tests/staging-negative-security.test.js#L260-L725)** *(Untracked — Commit 2)*
   - Added real Express + Mongoose + local staging MongoDB tests covering all 12 Phase 6 negative and positive scenarios (`Tests 5–9`).
6. **[`backend/tests/dharamshala-booking-flow.test.js`](file:///d:/vrindavan-sarthi/backend/tests/dharamshala-booking-flow.test.js#L106-L200)** *(Newly Modified Tracked — Commit 2)*
   - Updated the 3 unit-test mock `hotel` fixtures (`lines 107, 141, 172`) to include `propertyType: 'dharamshala'`, `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured: true`, and `dharamshalaFeeApprovedAt` so `acceptDharamshalaRequest` fee revalidation applies cleanly while preserving every assertion identically.

---

## 3. FOUR-STATE APPROVAL MATRIX (`validateDharamshalaFeeApproval`)

| Property State (`dharamshalaFeeApprovalStatus`) | Required Supporting Fields | Gate Outcome | Behavior Summary |
|---|---|---|---|
| `'unconfigured'` | Default on newly submitted Dharamshalas | **REJECT (400)** | Fails closed regardless of schema `dharamshalaServiceFee: 79`. |
| `'pending_review'` | Any (`configured: false` or `true`, `version > 1`, etc.) | **REJECT (400)** | Strictly blocked even if `dharamshalaFeeConfigured === true`. |
| Missing / `null` / `''` / Unknown | Legacy or malformed records | **REJECT (400)** | Fails closed without silent migration or approval. |
| `'explicitly_free'` | `dharamshalaFeeConfigured === true`, (`fee === 0` or `platformFeeEnabled === false`), and approval metadata (`ApprovedAt` / `ApprovedBy` / `version > 1` / `history`) | **ALLOW (`true`)** | Only authorized zero-fee seva properties succeed; inconsistent states fail closed (400). |
| `'approved'` | `dharamshalaFeeConfigured === true`, numeric `fee > 0`, `platformFeeEnabled !== false`, and approval metadata | **ALLOW (`true`)** | Only authorized fee-configured Dharamshalas proceed; `fee <= 0` or missing metadata fails closed (400). |
| *Non-Dharamshala (`hotel`, `home_stay`, `guest_house`)* | N/A | **ALLOW (`true`)** | Existing commercial/homestay behavior completely unchanged. |

---

## 4. RUNTIME VALIDATION RESULTS (ISOLATED STAGING MONGODB `127.0.0.1:27018`)

All checks below were executed **after the final code edit**:

| Suite / Command | Scope | Tests / Assertions | Outcome |
|---|---|---:|---|
| `node -c` on all 6 JS files (`partner.routes.js`, `dharamshalaLifecycle.js`, `payment.routes.js`, `refundCalculationService.js`, `staging-negative-security.test.js`, `dharamshala-booking-flow.test.js`) | Static JS syntax validation | 6 files | **PASSED (`EXIT: 0`)** |
| `node --test backend/tests/dharamshala-booking-flow.test.js` | Dharamshala schema, accounting, acceptance, auth & sanitizer unit tests | 8 / 8 | **PASSED** |
| `node --test backend/tests/staging-negative-security.test.js` | Cross-tenant isolation + all 12 Phase 5.9.2 HTTP/DB negative & positive security checks (`Tests 1–9`) | 9 / 9 | **PASSED** |
| `npm --prefix backend test` (`phase1-security`, `phase2-reservation`, `phase3-modification`) | Core backend security, reservation lifecycle & modification regressions | 36 / 36 | **PASSED** |
| `node --test backend/tests/partner-onboarding.test.js backend/tests/persistent-staging-acceptance.test.js` | Partner onboarding checklist & persistent staging OTA acceptance | 20 / 20 | **PASSED** |
| `node scratch/phase5_7_5/run_phase5_7_5_governance_checks.js` | Option B conservation, ledger reversals, Dharamshala 4-state gates & statements | 14 / 14 | **PASSED** |
| **TOTAL EXECUTED AFTER FINAL EDIT** | **6 Backend / Governance Suites** | **87 / 87** | **100% PASSED (`0 FAILED`)** |

*Note:* Zero frontend files were altered in Phase 5.9.2 (`tsc --noEmit` and `vite build` remained green from Phase 5.9.1). Test records inserted into `127.0.0.1:27018/vrindavan_sarthi_staging` were cleaned up in suite `after()`/`finally` hooks, and the temporary local staging `mongod` daemon was shut down cleanly afterward.

---

## 5. UNRESOLVED LIMITATIONS & GOVERNANCE NOTES

1. **Admin List Display Edge Case (`backend/routes/policy.routes.js:548` — Informational):** In `GET /api/policies/dharamshalas`, display computation evaluates `(d.dharamshalaServiceFeeVersion || 1) > 1 || hasHistory` before checking if status was later reset to `'pending_review'` or `'unconfigured'`. Booking creation, acceptance, and payment orders remain strictly fail-closed via `validateDharamshalaFeeApproval`.
2. **`Hotel.js` Numeric Default (`default: 79`):** Retained on `Hotel.js:76` to preserve schema test compatibility (`dharamshala-booking-flow.test.js:83`); new partner-submitted Dharamshalas explicitly receive `dharamshalaFeeApprovalStatus: 'unconfigured'` and `dharamshalaFeeConfigured: false`, ensuring `79` is never treated as approved.
3. **External Production Gates Unchanged:** Decisions `DEC-01` through `DEC-04` remain `PENDING OWNER APPROVAL`, 10 statutory items remain `PENDING CA APPROVAL`, and real Brij property KYC/trust deeds & automated DB backup scripts remain prerequisites before production go-live.

---

## 6. UPDATED GIT STATE & COMMIT MANIFEST (87 NON-SCRATCH FILES)

| Git Metric | Before Phase 5.9.2 | After Phase 5.9.2 (incl. this report) | Notes |
|---|---:|---:|---|
| **HEAD Commit** | `1295a53036a9eaa201aaf81b38990fd706a5669e` | `1295a53036a9eaa201aaf81b38990fd706a5669e` | Unchanged (`0` commits, `0` pushes) |
| **Staged Files** | 0 | **0** | Unchanged |
| **Modified Tracked Files** | 36 | **38** | +2 (`backend/routes/payment.routes.js`, `backend/tests/dharamshala-booking-flow.test.js`) |
| **Untracked Files (Total)** | 133 | **134** | +1 (`docs/PHASE_5_9_2_DHARAMSHALA_SECURITY_HARDENING_REPORT.md`) |
| **Untracked Non-Scratch** | 48 | **49** | 48 + Phase 5.9.2 report |
| **Excluded Scratch Files** | 85 | **85** | `scratch/phase5_*` excluded |

### Updated Five-Commit Manifest (87 Files Total)
- **Commit 1 — Complete Application & Financial Architecture (55 files):** 37 modified tracked files (36 prior + `backend/routes/payment.routes.js`) + 18 untracked application files (`10` backend incl. updated `refundCalculationService.js`, `8` frontend).
- **Commit 2 — Staging Tests & Fixtures (6 files):** 1 modified tracked (`backend/tests/dharamshala-booking-flow.test.js`) + 5 untracked (`backend/scripts/seedStagingData.js`, `startStagingServer.js`, `partner-onboarding.test.js`, `persistent-staging-acceptance.test.js`, `staging-negative-security.test.js`).
- **Commit 3 — Governance Registers & SOPs (5 files):** `CA_TAX_COMPLIANCE_REVIEW_CHECKLIST.md`, `DHARAMSHALA_PROPERTY_ONBOARDING_SOP.md`, `FINANCIAL_GOVERNANCE_DECISION_REGISTER.md`, `PLATFORM_OWNER_FINANCIAL_COMMERCIAL_APPROVAL_REGISTER.md`, `PRODUCTION_READINESS_GAP_MATRIX.md`.
- **Commit 4 — Historical Phase Reports (16 files):** `PHASE_5_OTA_BUSINESS_ACCEPTANCE_REPORT.md` through `PHASE_5_7_5_2_FINAL_GOVERNANCE_RECONCILIATION.md`.
- **Commit 5 — Audit, Pre-Commit & Security Hardening Reports (5 files):** `PHASE_5_8_OPERATIONAL_READINESS_AUDIT.md`, `PHASE_5_8_1_CRITICAL_FINDINGS_VERIFICATION.md`, `PHASE_5_9_0_FINAL_PRE_COMMIT_REVIEW.md`, `PHASE_5_9_1_GOVERNANCE_CORRECTION_REPORT.md`, `PHASE_5_9_2_DHARAMSHALA_SECURITY_HARDENING_REPORT.md`.

---

**`READY FOR FINAL SECURITY REVIEW`**
