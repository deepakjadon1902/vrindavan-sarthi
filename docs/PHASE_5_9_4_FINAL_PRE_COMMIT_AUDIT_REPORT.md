# VRINDAVAN SARTHI — PHASE 5.9.4 ADMIN RBAC ALIGNMENT & FINAL PRE-COMMIT AUDIT REPORT

**Project:** Vrindavan Sarthi OTA  
**Workspace:** `D:\vrindavan-sarthi`  
**Verified Baseline HEAD:** `1295a53036a9eaa201aaf81b38990fd706a5669e`  
**Branch:** `main`  
**Audit Date:** November 12, 2026  
**Execution Scope:** Remediation of Admin Dharamshala policy RBAC mismatch & duplicate route shadowing, full backend/frontend/governance regression execution against isolated local staging (`127.0.0.1:27018`), 88-file commit manifest audit, and Git safety verification. Zero commits, zero pushes, zero staging actions (`git add`), and zero production accesses.

---

## FINAL VERDICT

**`READY FOR EXPLICIT COMMIT AUTHORIZATION`**

> [!NOTE]
> **Verified Results vs. Unresolved External Approvals:**  
> All software implementations, RBAC boundaries, regression test suites (`154 / 154` backend, governance, and frontend unit/integration assertions plus live Vite/Express/Chrome check), TypeScript/Vite builds, secret scans, and manifest integrity checks are **verified in this session**. Commercial policy ratifications (`DEC-01` through `DEC-04`), practicing CA tax sign-offs, physical Brij Dharamshala KYC/trust deeds, and production infrastructure backups remain **unresolved external production go-live blockers** and are explicitly preserved as pending in Commit 3 & Commit 4 documentation.

---

## 1. RBAC ROOT CAUSE & EXACT FIX

### Root Cause Analysis
Inspection of [`backend/routes/policy.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/policy.routes.js), [`backend/middleware/auth.js`](file:///d:/vrindavan-sarthi/backend/middleware/auth.js), and [`frontend/src/pages/admin/AdminBusinessPolicies.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/admin/AdminBusinessPolicies.tsx) uncovered **two compounding defects** on `GET /api/policies/dharamshalas`:

1. **Permission Key Mismatch:** Line `571` of `backend/routes/policy.routes.js` guarded the Phase 5.7.4/5.9.3 handler with `authorizeAdmin('manage_business_policies')`. However, `'manage_business_policies'` does not exist in `ADMIN_ROLE_PERMISSIONS` (`backend/middleware/auth.js:72-112`, including `super_admin`), causing every admin role (including `super_admin`) to fail with HTTP `403`.
2. **Express Duplicate Route Shadowing & Over-Broad Permission:** An older Phase 5.7.2 `router.get('/dharamshalas', protect, authorizeAdmin('view_reports'), ...)` handler at `policy.routes.js:358-374` had never been removed. Because it was registered earlier in the Express router:
   - It intercepted every live HTTP `GET /api/policies/dharamshalas` request, returning raw unformatted `Hotel` documents without calling `formatDharamshalaPolicyListItem` (bypassing `feeApprovalStatus`, `feeApprovalLabel`, `isValidForBooking`, and partner contact population).
   - Because `'view_reports'` is granted to all four admin roles (`super_admin`, `operations_admin`, `finance_admin`, `support_admin`), `finance_admin` and `support_admin` could access property policy configuration data beyond least privilege.

### Established RBAC Alignment Applied
Every property policy mutation route in `backend/routes/policy.routes.js` (`PUT /cancellation/platform-default` at line `45`, `PUT /hotels/:hotelId/cancellation` at line `182`, `PUT /hotels/:hotelId/cancellation/reset-default` at line `297`, `PUT /dharamshalas/:hotelId/fee` at line `361`) and property approval routes in [`backend/routes/hotel.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/hotel.routes.js#L706-L768) (`PUT /:id/approval`, `PUT /:id/correction-request`, `PUT /:id/status-toggle`) use **`authorizeAdmin('manage_properties')`**, which `ADMIN_ROLE_PERMISSIONS` grants strictly to **`super_admin`** and **`operations_admin`** (denying `finance_admin` and `support_admin`).

**Fix Applied in [`backend/routes/policy.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/policy.routes.js#L352-L566):**
1. Removed the shadowed legacy `GET /dharamshalas` handler (formerly lines `358-374`, `authorizeAdmin('view_reports')`) so `GET /api/policies/dharamshalas` executes solely through `formatDharamshalaPolicyListItem`.
2. Changed the single authoritative `GET /dharamshalas` handler from `authorizeAdmin('manage_business_policies')` to `authorizeAdmin('manage_properties')` (`line 551`).
3. Preserved `ADMIN_ROLE_PERMISSIONS` in [`backend/middleware/auth.js`](file:///d:/vrindavan-sarthi/backend/middleware/auth.js), fee-update permissions (`PUT /api/policies/dharamshalas/:hotelId/fee`), approval rules, and financial calculations untouched.

---

## 2. FILES CHANGED IN PHASE 5.9.4

1. [`backend/routes/policy.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/policy.routes.js#L352-L566) *(Untracked — Commit 1)*: Removed shadowed legacy `/dharamshalas` GET route (`view_reports`) and aligned the authoritative `/dharamshalas` GET route to `authorizeAdmin('manage_properties')`.
2. [`backend/tests/staging-negative-security.test.js`](file:///d:/vrindavan-sarthi/backend/tests/staging-negative-security.test.js#L887-L1005) *(Untracked — Commit 2)*: Imported `ADMIN_ROLE_PERMISSIONS` (`line 30`) and added Test `12.` validating least-privilege RBAC across all admin and non-admin roles on `GET /api/policies/dharamshalas` and `PUT /api/policies/dharamshalas/:hotelId/fee`, unshadowed formatted output, and fail-closed unknown `adminRole` handling.
3. [`docs/PHASE_5_9_4_FINAL_PRE_COMMIT_AUDIT_REPORT.md`](file:///d:/vrindavan-sarthi/docs/PHASE_5_9_4_FINAL_PRE_COMMIT_AUDIT_REPORT.md) *(New Report — Untracked)*: This final pre-commit audit deliverable.

*(Zero changes were needed in `backend/middleware/auth.js` or `frontend/src/pages/admin/AdminBusinessPolicies.tsx`.)*

---

## 3. AUTHORIZATION & LIVE FRONTEND VERIFICATION EVIDENCE

### 3.1 Automated RBAC Matrix (`Test 12.` in `backend/tests/staging-negative-security.test.js`)

| Caller / Scenario | Target Endpoint | Expected | Verified Observed | Status |
|---|---|---:|---:|:---:|
| Unauthenticated request (no Bearer JWT) | `GET /api/policies/dharamshalas` | `401` | **`401`** | **PASS** |
| Customer (`role: 'user'`) | `GET /api/policies/dharamshalas` | `403` | **`403`** | **PASS** |
| Partner (`role: 'partner'`) | `GET /api/policies/dharamshalas` | `403` | **`403`** | **PASS** |
| Finance Admin (`adminRole: 'finance_admin'`) | `GET /api/policies/dharamshalas` | `403` | **`403`** (`Required permission: manage_properties`) | **PASS** |
| Support Admin (`adminRole: 'support_admin'`) | `GET /api/policies/dharamshalas` | `403` | **`403`** (`Required permission: manage_properties`) | **PASS** |
| Unmapped Admin Role (`adminRole: 'unmapped_role'`) | `GET /api/policies/dharamshalas` | `403` | **`403`** (fails closed) | **PASS** |
| Operations Admin (`adminRole: 'operations_admin'`) | `GET /api/policies/dharamshalas` | `200` | **`200`** + formatted `feeApprovalStatus: 'pending_review'` | **PASS** |
| Super Admin (`adminRole: 'super_admin'`) | `GET /api/policies/dharamshalas` | `200` | **`200`** + formatted `feeApprovalLabel: 'Pending Review'`, `isValidForBooking: false`, `approvedAt: null` | **PASS** |
| Finance Admin / Support Admin fee mutation | `PUT /api/policies/dharamshalas/:hotelId/fee` | `403` | **`403`** (fee permissions unchanged) | **PASS** |
| Permission Matrix Integrity Check | `ADMIN_ROLE_PERMISSIONS` | No `'manage_business_policies'` | Verified `'manage_properties'` on `super_admin` & `operations_admin` only | **PASS** |

### 3.2 Live Frontend End-to-End Request Check (`AdminBusinessPolicies.tsx` via Vite + Chrome + Staging Express)
- Executed against isolated staging Vite server (`http://127.0.0.1:18081`) proxied to staging Express (`http://127.0.0.1:15001`) backed by local MongoDB (`mongodb://127.0.0.1:27018/vrindavan_sarthi_staging`).
- **Denied Roles via Live Vite Proxy:** `finance_admin` $\rightarrow$ HTTP `403`, `support_admin` $\rightarrow$ HTTP `403`.
- **Authorized `super_admin` Browser Navigation (`/admin/policies` $\rightarrow$ `Dharamshala Service Fees` tab in Headless Chrome):**
  - Network call `GET /api/policies/dharamshalas` returned **HTTP `200`** (`success: true`, `feeApprovalStatus: 'pending_review'`, `feeApprovalLabel: 'Pending Review'`).
  - Rendered UI row confirmed: `Live Frontend RBAC Dharamshala ... Raman Reti, Vrindavan ₹99 ⚠ Pending Review v3 Platform Managed Edit Service Fee` (even with stale `dharamshalaServiceFeeVersion: 3`).
  - All ephemeral staging records were cleaned up and staging daemons stopped after verification (`LIVE_PW_EXIT: 0`).

---

## 4. FULL REGRESSION SUITE RESULTS (AFTER FINAL CODE EDIT)

| Check / Suite | Exact Command | Result & Count | Exit Code | Failures |
|---|---|---|---:|---:|
| Backend Syntax Checks | `node -c backend/routes/policy.routes.js`, `auth.js`, `staging-negative-security.test.js` | **PASSED** (3 files) | `0` | `0` |
| Dharamshala Booking Flow | `node --test backend/tests/dharamshala-booking-flow.test.js` | **8 / 8 PASSED** | `0` | `0` |
| Staging Negative & RBAC Security | `node --test backend/tests/staging-negative-security.test.js` | **12 / 12 PASSED** | `0` | `0` |
| Partner Onboarding & Persistent Acceptance | `node --test backend/tests/partner-onboarding.test.js backend/tests/persistent-staging-acceptance.test.js` | **20 / 20 PASSED** (`8` + `11` + suite `1`) | `0` | `0` |
| Core Backend Security, Reservation & Modification | `npm --prefix backend test` | **36 / 36 PASSED** | `0` | `0` |
| Phase 5.7.5 Governance Checks | `node scratch/phase5_7_5/run_phase5_7_5_governance_checks.js` | **14 / 14 PASSED** | `0` | `0` |
| **Backend & Governance Combined Total** | — | **90 / 90 PASSED** | **`0`** | **`0`** |
| Frontend Unit & Component Tests | `npm --prefix frontend test` (Vitest v3.2.7) | **64 / 64 PASSED** (7 files) | `0` | `0` |
| Frontend TypeScript Checks | `.\frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.app.json --noEmit` & `tsconfig.node.json --noEmit` | **0 TypeScript errors** | `0` | `0` |
| Frontend Production Build | `npm --prefix frontend run build` | **PASSED** (2268 modules, `22.46s`, dist gitignored) | `0` | `0` |
| Live Staging Chrome RBAC Check | Playwright Chromium against `/admin/policies` | **PASSED** (`HTTP 200` super_admin, `403` finance/support) | `0` | `0` |

*Combined Automated Assertions Executed & Passed After Final Code Edit:* **`154 / 154` (`90` backend/governance + `64` frontend), `0` skipped, `0` failed.**

---

## 5. FINAL 88-FILE MANIFEST AUDIT

Independent programmatic verification of the 88 committable non-scratch files (`38` tracked modified + `50` untracked non-scratch prior to adding this report):

1. **Existence Check (`Test-Path` across all 88 paths):** **`88 / 88` exist on disk (`MISSING_COUNT: 0`).**
2. **Excluded File Hygiene Scan:**
   - `.env`, `.env.staging`, `frontend/.env`, credentials, private keys (`-----BEGIN`), local DB binaries/dumps, generated build outputs (`frontend/dist`), or `scratch/` files included: **`0`** (`git check-ignore -v` confirms `.env*`, `backend/.env.staging`, `frontend/.env`, and `frontend/dist` are gitignored; all `85` files in `scratch/phase5_*` are excluded).
3. **Secret & Live Credential Scan across all 88 files:**
   - Zero live `rzp_live_`, Resend `re_...`, private keys, or live Atlas credentials present. Only documentation template/pattern mentions exist in `PHASE_5_1_STAGING_ENVIRONMENT_REPORT.md:172` and `PHASE_5_9_0_FINAL_PRE_COMMIT_REVIEW.md:135-136`.
4. **Config Diff Audit (`backend/server.js`, `frontend/vite.config.ts`, `frontend/tsconfig.app.json`):**
   - `backend/server.js`: mounts `/api/support` and `/api/policies` only.
   - `frontend/tsconfig.app.json`: changes `"lib"` from `ES2020` to `ES2021`.
   - `frontend/vite.config.ts`: changes fallback local dev proxy port from `5000` to `5001` (dev server only; zero impact on production configuration, secrets, MongoDB URIs, Razorpay, or Resend).
5. **Governance & Historical Documentation Honesty Scan (`docs/*.md`):**
   - `docs/FINANCIAL_GOVERNANCE_DECISION_REGISTER.md:45-46` displays an unchecked `- [ ] **APPROVE Option B Policy (DEC-01):**` marked `PENDING OWNER APPROVAL (DEC-01)`.
   - `docs/PLATFORM_OWNER_FINANCIAL_COMMERCIAL_APPROVAL_REGISTER.md` preserves `DEC-01` through `DEC-04` unchecked/pending.
   - `docs/CA_TAX_COMPLIANCE_REVIEW_CHECKLIST.md` preserves `PENDING CA REVIEW & FORMAL TAX OPINION` across all 10 statutory tax items.
   - `docs/PRODUCTION_READINESS_GAP_MATRIX.md` preserves commercial/CA/KYC pending classifications (`COMP-09`, `COMP-10`, `COMP-11`, `COMP-12`, `COMP-20`, `COMP-21`, `COMP-24`).
   - Historical reports (`PHASE_5_4`, `PHASE_5_7_4`, `PHASE_5_7_4_1`) retain dated Phase 5.9.1 Correction Notes clarifying pending owner approvals and `₹79` schema fallback facts. *(Note: `PHASE_5_4:166` mentions "owner-approved check-in reference (12:00 PM IST)", referring solely to the standard check-in clock time, not commercial policies `DEC-01`–`DEC-04`.)*
6. **Workspace Scope / Unrelated Changes:** Zero unrelated store/external project files exist (`D:\vrindavan-sarthi` verified; `Shri Radha Govind Store` files absent).

### Complete 5-Group Commit Manifest Structure

| Commit Group | Description | Tracked Modified | Untracked | Total | Verification Status |
|:---:|---|---:|---:|---:|---|
| **Commit 1** | Complete Application & Financial Architecture | 37 *(14 backend, 23 frontend)* | 18 *(10 backend, 8 frontend)* | **55** | Self-contained (`node -c`, `tsc`, `vite build`, RBAC verified) |
| **Commit 2** | Staging Tests & Fixtures (`stagingGuard` protected) | 1 (`dharamshala-booking-flow.test.js`) | 5 | **6** | Depends on Commit 1 (`90/90` runtime verified) |
| **Commit 3** | Governance Registers & SOPs | 0 | 5 | **5** | Pending owner/CA flags preserved |
| **Commit 4** | Historical Phase Reports (`PHASE_5`..`PHASE_5_7_5_2`) | 0 | 16 | **16** | Correction notes intact |
| **Commit 5** | Audit, Pre-Commit & Security Reports (`PHASE_5_8`..`5_9_3`) | 0 | 6 *(+1 if `PHASE_5_9_4` included $\rightarrow$ 7)* | **6** *(or 7)* | Complete pre-commit audit chain |
| **TOTAL** | **Explicit 5-Commit Manifest** | **38** | **50** *(51 w/ 5.9.4 report)* | **88** *(89 w/ 5.9.4 report)* | **All groups logically complete** |

---

## 6. GIT STATUS & SAFETY VERIFICATION

Verified immediately prior to and upon authoring this report:

| Metric | Verified Pre-Report State | Notes |
|---|---|---|
| **Workspace / Git Root** | `D:\vrindavan-sarthi` / `D:/vrindavan-sarthi` | Matches Vrindavan Sarthi OTA |
| **Current Branch** | `main` | No branch switches or merges |
| **HEAD Commit** | `1295a53036a9eaa201aaf81b38990fd706a5669e` | Unchanged from approved baseline |
| **Staged Files** | **`0`** | Zero `git add` executed |
| **Commits / Pushes Created** | **`0` / `0`** | Strictly uncommitted awaiting explicit owner authorization |
| **Modified Tracked Files** | **`38`** (`15` backend, `23` frontend) | Exact match with Commit 1 (`37`) + Commit 2 (`1`) |
| **Untracked Files (Total)** | **`135`** pre-report $\rightarrow$ **`136`** incl. this report | **`50`** non-scratch manifest + **`1`** new Phase 5.9.4 report + **`85`** `scratch/phase5_*` |
| **Excluded Scratch Files** | **`85`** under `scratch/phase5_*` | Must remain excluded during staging |

---

## 7. REMAINING EXTERNAL PRODUCTION BLOCKERS (OUTSIDE COMMIT GATE)

The codebase and manifest are clean for explicit Git commit authorization, whereas **live production launch** remains blocked until these external business/compliance gates are closed:
1. **Platform Owner Formal Commercial Sign-Off:** Written decision/signature on `DEC-01` (Option B allocation), `DEC-02` (commission shortfall waiver), `DEC-03` (convenience fee retention/refund policy), and `DEC-04` (gateway fee absorption) in `docs/PLATFORM_OWNER_FINANCIAL_COMMERCIAL_APPROVAL_REGISTER.md`.
2. **Chartered Accountant Statutory Opinion:** Written CA determination across all 10 tax items in `docs/CA_TAX_COMPLIANCE_REVIEW_CHECKLIST.md` (Section 9(5) GST, cancellation GST, convenience fee SAC 9985, 194-O TDS, Section 52 TCS).
3. **Physical Dharamshala KYC & Trust Verification:** Collection and admin review of real property trust deeds, PAN/registration documents, and explicit service-fee approvals before onboarding live properties.
4. **Production Backup & Live Gateway Reconciliation:** Automated off-host MongoDB backup/restore scripts and controlled live Razorpay Route/webhook smoke verification under production cutover runbooks.

---

**`READY FOR EXPLICIT COMMIT AUTHORIZATION`**