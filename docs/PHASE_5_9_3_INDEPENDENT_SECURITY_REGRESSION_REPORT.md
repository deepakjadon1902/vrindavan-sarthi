# VRINDAVAN SARTHI — PHASE 5.9.3 INDEPENDENT DHARAMSHALA SECURITY REGRESSION REPORT

**Project:** Vrindavan Sarthi OTA  
**Workspace:** `D:\vrindavan-sarthi`  
**Expected & Verified HEAD Commit:** `1295a53036a9eaa201aaf81b38990fd706a5669e`  
**Branch:** `main`  
**Audit Date:** November 12, 2026  
**Execution Scope:** Independent line-by-line verification of Phase 5.9.2 hardening, remediation of Admin Dharamshala approval-status list display, and full regression execution against isolated local staging MongoDB (`127.0.0.1:27018`). Zero commits, zero pushes, zero production accesses.

---

## FINAL VERDICT

**`READY FOR FINAL PRE-COMMIT REVIEW`**

---

## 1. INDEPENDENT CODE VERIFICATION RESULTS

Every Phase 5.9.2 security control was verified directly in source files:

1. **Partner Protected Fields & Custom Fee Preservation ([`backend/routes/partner.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js#L157-L320)):**
   - Verified `stripPartnerListingProtectedFields(body)` (`lines 157-196`) deletes all 32 protected fields including `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, `dharamshalaFeeApprovedBy`, `dharamshalaFeeApprovedByName`, `dharamshalaFeeApprovedAt`, `dharamshalaFeeHistory`, `dharamshalaServiceFee`, `dharamshalaPlatformFeeEnabled`, `dharamshalaPaymentMode`, `platform_commission_percentage`, `cancellationPolicyType`, `customCancellationPolicy`, `cancellationPolicyHistory`, `status`, `approvalStatus`, and `propertyId`.
   - Verified `applyPartnerHotelDefaults(body, user, existingHotel)` (`lines 204-264`):
     - On `POST /api/partner/hotels` (`existingHotel === null`), sets `dharamshalaFeeApprovalStatus: 'unconfigured'`, `dharamshalaFeeConfigured: false`, `dharamshalaServiceFeeVersion: 1`, `dharamshalaFeeHistory: []` for Dharamshalas while preserving existing non-Dharamshala defaults.
     - On `PUT /api/partner/hotels/:id` (`existingHotel = hotel`), preserves previously configured custom `dharamshalaServiceFee`, approval status, version, history, and commission untouched (only resetting fee review to `'unconfigured'` if a non-Dharamshala listing transitions to `'dharamshala'`).
2. **Four-State Fail-Closed Approval Model ([`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js#L163-L267)):**
   - Verified `evaluateDharamshalaFeeApprovalState(hotel)` provides a single source of truth shared by `validateDharamshalaFeeApproval` and `getDharamshalaFeeApprovalDisplay`:
     - `'pending_review'` $\rightarrow$ always fails closed (HTTP `400`, even if `dharamshalaFeeConfigured === true`, `version > 1`, or history exists).
     - `'unconfigured'`, missing, `null`, `''`, or unknown state $\rightarrow$ always fails closed (HTTP `400`).
     - `'explicitly_free'` $\rightarrow$ allowed **only** when `dharamshalaFeeConfigured === true`, (`fee === 0` or `dharamshalaPlatformFeeEnabled === false`), and approval metadata (`ApprovedAt`/`ApprovedBy`/`version > 1`/`history`) is present.
     - `'approved'` $\rightarrow$ allowed **only** when `dharamshalaFeeConfigured === true`, numeric `fee > 0`, `dharamshalaPlatformFeeEnabled !== false`, and approval metadata is present.
     - Non-Dharamshala properties $\rightarrow$ unchanged (`validateDharamshalaFeeApproval` returns `true`).
3. **Acceptance & Payment Order Revalidation ([`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js#L425-L530), [`backend/routes/payment.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/payment.routes.js#L101-L125), [`backend/services/refundCalculationService.js`](file:///d:/vrindavan-sarthi/backend/services/refundCalculationService.js#L181-L198)):**
   - Verified `acceptDharamshalaRequest` refuses paid bookings (HTTP `409`), revalidates current property approval (`validateDharamshalaFeeApproval`), compares `booking.dharamshalaFeeSnapshot` against `createDharamshalaFeeSnapshot` (rejecting mismatches with HTTP `409` `DHARAMSHALA_FEE_SNAPSHOT_MISMATCH`), and records `AuditLog` (`action: 'dharamshala_acceptance_blocked'`) before any inventory reservation or booking mutation.
   - Verified `POST /api/payments/razorpay/orders` revalidates `Hotel` fee approval state and `booking.dharamshalaFeeSnapshot` consistency before returning or creating a Razorpay order.
   - Verified `createDharamshalaFeeSnapshot` honors `dharamshalaPlatformFeeEnabled === false` (`fee = 0`) and defaults missing `dharamshalaFeeApprovalStatus` to `'unconfigured'`.

---

## 2. ADMIN LIST STATUS DISPLAY CORRECTION (`GET /api/policies/dharamshalas` & UI)

### Defect Fixed
- Previously, `backend/routes/policy.routes.js:548` computed `isApproved = (d.dharamshalaServiceFeeVersion || 1) > 1 || hasHistory || d.dharamshalaFeeApprovalStatus === 'approved'`, which allowed stale version/history to mask withdrawn (`pending_review` / `unconfigured`) properties, failed to validate supporting fee metadata, omitted `dharamshalaFeeApprovalStatus`, and emitted `'pending_owner_review'` instead of `'pending_review'`.
- Likewise, `frontend/src/pages/admin/AdminBusinessPolicies.tsx:703-715` contained a duplicate stale override `(d.dharamshalaServiceFeeVersion || 1) > 1` and grouped `unconfigured` under `Pending Owner Review`.

### Changes Applied
1. **[`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js#L163-L253):** Extracted `evaluateDharamshalaFeeApprovalState` + exported `getDharamshalaFeeApprovalDisplay(hotel)`.
2. **[`backend/routes/policy.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/policy.routes.js#L539-L586):** Added `formatDharamshalaPolicyListItem(d)` (exposed as `router._formatDharamshalaPolicyListItem`) using `getDharamshalaFeeApprovalDisplay(d)`:
   - `'pending_review'` $\rightarrow$ `feeApprovalStatus: 'pending_review'`, `feeApprovalLabel: 'Pending Review'`, `isValidForBooking: false`, `approvedAt: null`, `approvedByName: ''` (stale version/history never override).
   - `'unconfigured'` or invalid/missing metadata $\rightarrow$ `feeApprovalStatus: 'unconfigured'`, `feeApprovalLabel: 'Unconfigured'`, `isValidForBooking: false`.
   - `'approved'` (only when valid `fee > 0`, `configured: true`, metadata present) $\rightarrow$ `feeApprovalStatus: 'approved'`, `feeApprovalLabel: 'Approved'`, `isValidForBooking: true`.
   - `'explicitly_free'` (only when valid `fee === 0` or fee disabled, `configured: true`, metadata present) $\rightarrow$ `feeApprovalStatus: 'explicitly_free'`, `feeApprovalLabel: 'Explicitly Free'`, `isValidForBooking: true`.
   - Approval permissions (`authorizeAdmin`) and financial calculations were left unchanged.
3. **[`frontend/src/pages/admin/AdminBusinessPolicies.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/admin/AdminBusinessPolicies.tsx#L55-L60):** Updated badge rendering (`lines 705-734`) to read `d.feeApprovalStatus || d.dharamshalaFeeApprovalStatus || 'unconfigured'` without client-side stale version overrides, displaying `✓ Explicitly Free (₹0)`, `✓ Approved`, `⚠ Pending Review`, or `⚠ Unconfigured`.

---

## 3. INDIVIDUAL NEGATIVE & POSITIVE SCENARIO AUDIT

Every scenario below was individually verified by name and assertion inside [`backend/tests/staging-negative-security.test.js`](file:///d:/vrindavan-sarthi/backend/tests/staging-negative-security.test.js) and [`backend/tests/dharamshala-booking-flow.test.js`](file:///d:/vrindavan-sarthi/backend/tests/dharamshala-booking-flow.test.js):

| # | Required Scenario | Exact Test Name | Exact Key Assertion(s) Verified | Result |
|:---:|---|---|---|:---:|
| **1** | Partner sends forged `approved` status (`approvalStatus` & `dharamshalaFeeApprovalStatus`) | `5. Partner POST forged approvalStatus, dharamshalaFeeApprovalStatus, dharamshalaFeeConfigured, and fake history/version are stripped; new Dharamshala stays unconfigured` (`staging-negative-security.test.js`) | `assert.equal(created.approvalStatus, 'pending')`; `assert.equal(created.dharamshalaFeeApprovalStatus, 'unconfigured')` | **PASS** |
| **2** | Partner sends `dharamshalaFeeConfigured = true` | Same Test `5.` | `assert.equal(created.dharamshalaFeeConfigured, false)` | **PASS** |
| **3** | Partner sends forged fee history/version/commission/fee | Same Test `5.` | `assert.equal(created.dharamshalaServiceFeeVersion, 1)`; `assert.equal(created.dharamshalaFeeHistory.length, 0)`; `assert.equal(created.platform_commission_percentage, 10)` | **PASS** |
| **4** | Partner tries to change an existing custom fee via `PUT` | `6. Partner PUT preserves previously admin-configured custom service fee, approval status, version, and history` (`staging-negative-security.test.js`) | `assert.equal(updated.dharamshalaServiceFee, 125)`; `assert.equal(updated.dharamshalaFeeApprovalStatus, 'approved')`; `assert.equal(updated.dharamshalaServiceFeeVersion, 2)`; `assert.equal(updated.dharamshalaFeeHistory.length, 1)` | **PASS** |
| **5** | New Dharamshala starts `unconfigured` & is blocked from booking | Test `5.` + Test `8.` (`blockedBookRes`) | `assert.throws(() => validateDharamshalaFeeApproval(created), err.statusCode === 400)`; `assert.equal(blockedBookRes.status, 400)` with `/pending owner review and approval/i` | **PASS** |
| **6** | Legacy property with missing/null/unknown approval status fails closed | `7. Fail-closed gate rejects missing/null/unknown legacy approval states, pending_review+configured=true, and unconfigured state` (`staging-negative-security.test.js`) | Loops `[undefined, null, '', 'legacy_approved', 'random_state']` $\rightarrow$ `assert.throws(..., err.statusCode === 400)` | **PASS** |
| **7** | `pending_review` with `configured = true` (& `version > 1`) is rejected | Same Test `7.` | `assert.throws(() => validateDharamshalaFeeApproval({ ...dharamshalaFeeApprovalStatus: 'pending_review', dharamshalaFeeConfigured: true, dharamshalaServiceFeeVersion: 3 ... }), err.statusCode === 400)` | **PASS** |
| **8** | `explicitly_free` property with valid admin approval succeeds (invalid fails closed) | Test `7.` (invalid cases) + Test `8.` (`setFreeRes`, `freeBookRes`, `freeAcceptRes`) | `assert.equal(setFreeRes.data.data.dharamshalaFeeApprovalStatus, 'explicitly_free')`; `assert.equal(freeAcceptRes.status, 200)`; `assert.equal(freeAcceptRes.data.data.bookingStatus, 'confirmed')`; `assert.equal(freeAcceptRes.data.data.vrindavanSarthiServiceFee, 0)` | **PASS** |
| **9** | `approved` property with valid positive fee proceeds (invalid fails closed) | Test `7.` (invalid cases) + Test `8.` (`approveFeeRes`, `okAcceptRes`, `orderAllowedRes`) | `assert.equal(approveFeeRes.status, 200)`; `assert.equal(okAcceptRes.status, 200)`; `assert.equal(okAcceptRes.data.data.vrindavanSarthiServiceFee, 110)` | **PASS** |
| **10** | Approval withdrawn or fee changed before booking acceptance | Test `8.` (`withdrawnAcceptRes`, `auditBlocked`, `mismatchAcceptRes`) | `assert.equal(withdrawnAcceptRes.status, 400)`; `assert.equal(bookingAAfter.bookingStatus, 'pending_property_confirmation')`; `assert.ok(auditBlocked)`; `assert.equal(mismatchAcceptRes.status, 409)` | **PASS** |
| **11** | Approval withdrawn before Razorpay order creation | Test `8.` (`orderBlockedRes`) | `assert.equal(orderBlockedRes.status, 400)` | **PASS** |
| **12** | Existing non-Dharamshala hotel booking & validation flow unchanged | `9. Non-Dharamshala hotel booking behavior and validation remain unchanged` (`staging-negative-security.test.js`) | `assert.equal(validateDharamshalaFeeApproval(adminHotel), true)`; `assert.equal(reqRes.status, 201)`; `assert.equal(acceptResult.booking.bookingStatus, 'awaiting_customer_payment')` | **PASS** |
| **+A** | Admin list status display with withdrawal & stale version/history | `10. Admin list status display derives from authoritative approval state without stale version/history override` (`staging-negative-security.test.js`) | Asserts `'pending_review'` / `'Pending Review'`, `'unconfigured'` / `'Unconfigured'`, invalid `'approved'` failing closed to `'unconfigured'`, valid `'approved'` / `'Approved'`, and valid `'explicitly_free'` / `'Explicitly Free'` | **PASS** |
| **+B** | Paid booking repricing protection & desk balance exclusion | `11. Already-paid bookings cannot be repriced at acceptance and uncollected desk balance is excluded from online payment and refund math` (`staging-negative-security.test.js`) + `dharamshala-booking-flow.test.js` | `assert.rejects(() => acceptDharamshalaRequest(...), err.statusCode === 409)`; `assert.equal(paidMockBooking.amountPaidOnline, 110)`; `assert.equal(payableAmountForBooking(...), 99)`; `assert.equal(refundEval.refundableAmount, 500)` | **PASS** |

---

## 4. FULL REGRESSION VALIDATION & PAYMENT / SNAPSHOT SAFETY

### 4.1 Runtime & Build Execution Summary (After Final Code Edit)

| Check / Suite | Result | Count |
|---|---:|---:|
| `node -c` syntax check (`partner.routes.js`, `dharamshalaLifecycle.js`, `refundCalculationService.js`, `payment.routes.js`, `policy.routes.js`, `Hotel.js`, `dharamshala-booking-flow.test.js`, `staging-negative-security.test.js`) | **PASSED** (`EXIT: 0`) | 8 files |
| `node --test backend/tests/dharamshala-booking-flow.test.js` | **PASSED** (`DHARAM_EXIT: 0`) | 8 / 8 |
| `node --test backend/tests/staging-negative-security.test.js` | **PASSED** (`NEGSEC_EXIT: 0`) | 11 / 11 |
| `node --test backend/tests/partner-onboarding.test.js backend/tests/persistent-staging-acceptance.test.js` | **PASSED** (`ONBOARD_ACCEPT_EXIT: 0`) | 20 / 20 |
| `npm --prefix backend test` (`phase1-security`, `phase2-reservation`, `phase3-modification`) | **PASSED** (`CORE_EXIT: 0`) | 36 / 36 |
| `node scratch/phase5_7_5/run_phase5_7_5_governance_checks.js` | **PASSED** (`GOV_EXIT: 0`) | 14 / 14 |
| `.\frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.app.json --noEmit` & `tsconfig.node.json --noEmit` | **PASSED** (`EXIT: 0`) | 0 errors |
| `npm --prefix frontend run build` | **PASSED** (`VITE_BUILD_EXIT: 0`) | 2268 modules (`18.80s`) |
| **Total Backend & Governance Runtime Tests** | **100% PASSED** | **89 / 89** |

### 4.2 Payment and Snapshot Safety Verification (Section 5)
- **Paid bookings protected:** `acceptDharamshalaRequest` returns idempotently if status is no longer `pending_property_confirmation` and throws HTTP `409` (`BOOKING_ALREADY_PAID`) if `paymentStatus === 'paid'`.
- **Desk balance isolated:** Verified via `payableAmountForBooking` and `calculateRefund` (`amountPayableAtProperty` is never included in online payable or online refund calculations).
- **Fee snapshot tamper protection:** `acceptDharamshalaRequest` and `POST /api/payments/razorpay/orders` reject bookings with HTTP `409` if `hotel` fee configuration changed after request snapshot creation.
- **Invalid approval state blocked from Razorpay orders:** Verified by Test `8.` (`orderBlockedRes.status === 400`).
- **Non-Dharamshala payment flow unchanged:** Non-Dharamshala bookings bypass Dharamshala-specific guards cleanly (Test `9.`).

---

## 5. RESIDUAL SECURITY & OPERATIONAL RISKS

1. **Pre-Existing RBAC Permission Key Mismatch (`backend/routes/policy.routes.js:574`):**  
   `GET /api/policies/dharamshalas` requires `authorizeAdmin('manage_business_policies')`, while `ADMIN_ROLE_PERMISSIONS.super_admin` in `backend/middleware/auth.js:72-87` does not include `'manage_business_policies'` (other policy admin routes use `'manage_properties'`, `'view_reports'`, or `'view_audit_logs'`). Left untouched per rule *"Do not change approval permissions"* — flagged for owner/pre-commit authorization review, as `AdminBusinessPolicies.tsx` calls `GET /policies/dharamshalas` and would receive `403` until aligned.
2. **External Production Release Gates (Unchanged):**  
   Owner sign-off on `DEC-01`–`DEC-04`, Practicing CA tax opinion, physical Dharamshala KYC/trust deeds, and automated in-repo database backup scripts remain external production blockers.

---

## 6. EXACT FILES CHANGED, GIT STATUS & UPDATED COMMIT MANIFEST

### Files Modified / Created in Phase 5.9.3
1. [`backend/utils/dharamshalaLifecycle.js`](file:///d:/vrindavan-sarthi/backend/utils/dharamshalaLifecycle.js) *(Tracked Modified)* — Extracted `evaluateDharamshalaFeeApprovalState` + `getDharamshalaFeeApprovalDisplay`.
2. [`backend/routes/policy.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/policy.routes.js) *(Untracked)* — Updated `GET /api/policies/dharamshalas` via `formatDharamshalaPolicyListItem`.
3. [`frontend/src/pages/admin/AdminBusinessPolicies.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/admin/AdminBusinessPolicies.tsx) *(Untracked)* — Updated badge status rendering to use authoritative state without stale version override.
4. [`backend/tests/staging-negative-security.test.js`](file:///d:/vrindavan-sarthi/backend/tests/staging-negative-security.test.js) *(Untracked)* — Added Tests `10.` & `11.`.
5. [`docs/PHASE_5_9_3_INDEPENDENT_SECURITY_REGRESSION_REPORT.md`](file:///d:/vrindavan-sarthi/docs/PHASE_5_9_3_INDEPENDENT_SECURITY_REGRESSION_REPORT.md) *(New Report — Untracked)*.

### Git Status Before vs. After Phase 5.9.3

| Metric | Before Phase 5.9.3 | After Phase 5.9.3 (incl. this report) |
|---|---:|---:|
| **HEAD Commit** | `1295a53036a9eaa201aaf81b38990fd706a5669e` | `1295a53036a9eaa201aaf81b38990fd706a5669e` |
| **Staged Files** | 0 | **0** |
| **Modified Tracked Files** | 38 | **38** |
| **Untracked Files (Total)** | 134 (49 non-scratch + 85 scratch) | **135** (50 non-scratch + 85 scratch) |
| **Excluded Scratch Files** | 85 | **85** |

### Updated Proposed Commit Manifest (88 Non-Scratch Files Total)
- **Commit 1 — Complete Application & Financial Architecture (55 files):** 37 modified tracked + 18 untracked (incl. `dharamshalaLifecycle.js`, `policy.routes.js`, `AdminBusinessPolicies.tsx`).
- **Commit 2 — Staging Tests & Fixtures (6 files):** 1 modified tracked (`dharamshala-booking-flow.test.js`) + 5 untracked (incl. `staging-negative-security.test.js`).
- **Commit 3 — Governance Registers & SOPs (5 files):** `CA_TAX_COMPLIANCE_REVIEW_CHECKLIST.md` .. `PRODUCTION_READINESS_GAP_MATRIX.md`.
- **Commit 4 — Historical Phase Reports (16 files):** `PHASE_5_OTA_BUSINESS_ACCEPTANCE_REPORT.md` .. `PHASE_5_7_5_2_FINAL_GOVERNANCE_RECONCILIATION.md`.
- **Commit 5 — Audit, Pre-Commit & Security Reports (6 files):** `PHASE_5_8`, `PHASE_5_8_1`, `PHASE_5_9_0`, `PHASE_5_9_1`, `PHASE_5_9_2`, `PHASE_5_9_3`.

---

**`READY FOR FINAL PRE-COMMIT REVIEW`**
