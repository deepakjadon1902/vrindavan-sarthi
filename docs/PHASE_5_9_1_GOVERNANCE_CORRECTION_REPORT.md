# VRINDAVAN SARTHI — PHASE 5.9.1 GOVERNANCE AND UI WORDING CORRECTION REPORT

**Project:** Vrindavan Sarthi OTA  
**Workspace:** `D:\vrindavan-sarthi`  
**Baseline HEAD Commit:** `1295a53036a9eaa201aaf81b38990fd706a5669e`  
**Branch:** `main`  
**Date:** November 12, 2026  
**Scope:** Narrowly scoped governance documentation and Admin UI wording corrections resolving Phase 5.9.0 findings (`docs/PHASE_5_9_0_FINAL_PRE_COMMIT_REVIEW.md` preserved intact).

---

## FINAL VERDICT

**`READY FOR FINAL PRE-COMMIT REVIEW`**

All Phase 5.9.0 documentation contradictions and misleading Admin UI labels have been corrected cleanly without modifying any financial calculations, booking/refund/payment logic, or staging/production configuration. Two unexpected edge-case findings identified during the read-only `₹79` default impact analysis (`Section 4`) are explicitly reported below without unrequested code edits for disposition during Final Pre-Commit Review.

---

## 1. FILES CHANGED & EXACT BEFORE / AFTER WORDING

Only the 6 requested files (4 documentation files + 2 frontend UI files) were modified during Phase 5.9.1, plus the creation of this report (`docs/PHASE_5_9_1_GOVERNANCE_CORRECTION_REPORT.md`):

### 1.1 Governance Documentation Corrections (Task A)

1. **[`docs/FINANCIAL_GOVERNANCE_DECISION_REGISTER.md`](file:///d:/vrindavan-sarthi/docs/FINANCIAL_GOVERNANCE_DECISION_REGISTER.md#L45-L46)**
   - **Before:**
     ```markdown
     ### 2.4 Decision Request for Owner:
     - [x] **APPROVE Option B Policy:** Ratify the mathematical model above as the official platform policy for all partial-advance voluntary cancellations.
     ```
   - **After:**
     ```markdown
     ### 2.4 Decision Request for Owner — `PENDING OWNER APPROVAL (DEC-01)`
     - [ ] **APPROVE Option B Policy (`DEC-01`):** Proposed mathematical model awaiting formal Platform Owner ratification as the official policy for all partial-advance voluntary cancellations.
     ```

2. **[`docs/PHASE_5_7_4_FINANCIAL_GOVERNANCE_REPORT.md`](file:///d:/vrindavan-sarthi/docs/PHASE_5_7_4_FINANCIAL_GOVERNANCE_REPORT.md#L23-L25)**
   - **Before:**
     ```markdown
     1. **Option B Breakage Accounting Policy Implementation:**
        - Established the owner-approved "Option B" financial policy for retained 30% advance deposits following voluntary customer cancellation.
     ```
   - **After:**
     ```markdown
     1. **Option B Breakage Accounting Policy Implementation:**
        - Implemented the proposed "Option B" accounting calculation model for retained 30% advance deposits following voluntary customer cancellation (*see dated correction note below*).
        > **Correction Note (2026-11-12 — Phase 5.9.1):** This historical Phase 5.7.4 report originally described Option B as "owner-approved." While the Option B calculation logic and integer-paise ledger are implemented and verified in staging, commercial decision **`DEC-01`** remains **`PENDING OWNER APPROVAL`** pending formal written Platform Owner sign-off in `docs/PLATFORM_OWNER_FINANCIAL_COMMERCIAL_APPROVAL_REGISTER.md`.
     ```

3. **[`docs/PHASE_5_4_OTA_BUSINESS_LOGIC_FINANCIAL_AUDIT.md`](file:///d:/vrindavan-sarthi/docs/PHASE_5_4_OTA_BUSINESS_LOGIC_FINANCIAL_AUDIT.md#L130-L133)**
   - **Before:**
     ```markdown
     > [!IMPORTANT]
     > **Gateway Fee Absorption Verified:** In accordance with the owner-approved policy, the ₹100 payment gateway fee is absorbed entirely by Vrindavan Sarthi. It is **never** deducted from the partner's payout (`partnerNetPayout = ₹5,250 - ₹500 = ₹4,750`).
     ```
   - **After:**
     ```markdown
     > [!IMPORTANT]
     > **Gateway Fee Absorption Behavior Verified (Software):** Under the implemented payout calculation, the ₹100 payment gateway fee is absorbed at the platform layer and is **never** deducted from the partner's payout (`partnerNetPayout = ₹5,250 - ₹500 = ₹4,750`).
     >
     > **Correction Note (2026-11-12 — Phase 5.9.1):** This historical Phase 5.4 report originally described gateway fee absorption as an "owner-approved policy." Software behavior is verified, while commercial policy decision **`DEC-04`** (Payment Gateway Processing Fee Absorption) remains **`PENDING OWNER APPROVAL`** pending formal written Platform Owner sign-off in `docs/PLATFORM_OWNER_FINANCIAL_COMMERCIAL_APPROVAL_REGISTER.md`.
     ```

4. **[`docs/PHASE_5_7_4_1_INDEPENDENT_VERIFICATION_REPORT.md`](file:///d:/vrindavan-sarthi/docs/PHASE_5_7_4_1_INDEPENDENT_VERIFICATION_REPORT.md#L189-L190)**
   - **Before:**
     ```markdown
     2. **Elimination of Silent Defaults:** Verified. The schema default fallback to ₹79 has been eliminated. New properties default to `dharamshalaFeeApprovalStatus: 'pending_review'`, and `dharamshalaFeeConfigured` defaults to `false`.
     ```
   - **After:**
     ```markdown
     2. **Default Fee Safeguards (Schema Fallback Retained — Gated at Booking):** `backend/models/Hotel.js` (and helper/route defaults in `hotel.routes.js`, `partner.routes.js`, `dharamshalaLifecycle.js`, and `refundCalculationService.js`) **still retain `79` as the numeric default fallback** for `dharamshalaServiceFee`. New properties default to `dharamshalaFeeApprovalStatus: 'pending_review'` and `dharamshalaFeeConfigured: false`, and are blocked by the booking gate `validateDharamshalaFeeApproval(hotel)` rather than by removal of the `79` numeric default. A numeric schema default is distinct from an explicitly approved property fee configuration (`'approved'` or `'explicitly_free'`).
        > **Correction Note (2026-11-12 — Phase 5.9.1):** This historical Phase 5.7.4.1 report originally stated that *"The schema default fallback to ₹79 has been eliminated."* Direct code inspection in Phase 5.9.1 confirmed that claim was inaccurate: `79` remains present in the Mongoose schema and route/service fallbacks. Moreover, the default is **not** unconditionally harmless across every execution path—for example, `partner.routes.js` does not strip `dharamshalaFeeApprovalStatus`/`dharamshalaFeeConfigured` in `stripPartnerListingProtectedFields`, and legacy records lacking `'unconfigured'`/`'pending_review'` status or having `dharamshalaFeeConfigured: true` while `'pending_review'` are not blocked by `validateDharamshalaFeeApproval` and would inherit `hotel.dharamshalaServiceFee ?? 79`.
     ```

### 1.2 Admin UI Wording Corrections (Task B)

5. **[`frontend/src/pages/admin/AdminBusinessPolicies.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/admin/AdminBusinessPolicies.tsx#L708-L710)**
   - **Before:**
     ```tsx
                             ✓ Owner Approved
     ```
   - **After:**
     ```tsx
                             ✓ Approved
     ```

6. **[`frontend/src/pages/admin/AdminRevenue.tsx`](file:///d:/vrindavan-sarthi/frontend/src/pages/admin/AdminRevenue.tsx#L218)**
   - **Before:**
     ```tsx
                     <span className="text-muted-foreground">Vrindavan Sarthi Service Fees (₹79/₹99):</span>
     ```
   - **After:**
     ```tsx
                     <span className="text-muted-foreground">Property-Configured Service Fees:</span>
     ```

---

## 2. PROXY CONFIGURATION CONCLUSION (TASK C)

- **Inspected Files:**
  - [`frontend/vite.config.ts`](file:///d:/vrindavan-sarthi/frontend/vite.config.ts#L8-L32): `const proxyTarget = env.VITE_API_PROXY_TARGET || env.VITE_BACKEND_URL || "http://localhost:5001";` and `const devPort = Number(env.VITE_DEV_PORT || 8081);`
  - [`backend/scripts/startStagingServer.js`](file:///d:/vrindavan-sarthi/backend/scripts/startStagingServer.js#L20-L24): `process.env.PORT = process.env.PORT || '5001';` and `process.env.NODE_ENV = 'staging';`
  - [`backend/server.js`](file:///d:/vrindavan-sarthi/backend/server.js#L292): `const PORT = process.env.PORT || 5000;`
- **Evidence & Conclusion:**
  - `http://localhost:5001` **is the intended local staging backend target**, matching `backend/scripts/startStagingServer.js` (`PORT=5001`) and `devPort=8081` across all Phase 5 staging runs (`PHASE_5_1` through `PHASE_5_8_1`).
  - `frontend/vite.config.ts` supports overriding via `VITE_API_PROXY_TARGET` or `VITE_BACKEND_URL`, and `server.proxy` has zero effect on Vite production builds (`vite build`).
  - **Action Taken:** Kept `frontend/vite.config.ts` **unchanged** (no conclusive evidence that `http://localhost:5001` is incorrect).

---

## 3. ₹79 DEFAULT IMPACT ANALYSIS (TASK D — READ-ONLY)

Inspected `backend/models/Hotel.js`, `backend/routes/hotel.routes.js`, `backend/routes/partner.routes.js`, `backend/services/refundCalculationService.js`, `backend/utils/dharamshalaLifecycle.js`, and `backend/routes/booking.routes.js`.

### 3.1 Where `79` Is Applied
1. **`backend/models/Hotel.js:76`:** Schema default `dharamshalaServiceFee: { type: Number, default: 79, min: 0 }`.
2. **`backend/routes/hotel.routes.js:110, 123` (`normalizeHotelTaxControls`):** Sets `body.dharamshalaServiceFee = 79` when undefined on Dharamshala create/update, and falls back to `79` if a non-finite/negative fee is passed.
3. **`backend/routes/partner.routes.js:216` (`applyPartnerHotelDefaults`):** Unconditionally sets `body.dharamshalaServiceFee = 79` on `POST /api/partner/hotels` and `PUT /api/partner/hotels/:id`.
4. **`backend/utils/dharamshalaLifecycle.js:19, 46-50` (`getDharamshalaPlatformFee`):** `DEFAULT_DHARAMSHALA_PLATFORM_FEE = 79`; returns `79` if `hotel?.dharamshalaServiceFee` is non-finite (unless `dharamshalaPlatformFeeEnabled === false`).
5. **`backend/services/refundCalculationService.js:185` (`createDharamshalaFeeSnapshot`):** Falls back to `79` for Dharamshalas if `hotel?.dharamshalaServiceFee` is non-finite.

### 3.2 Inheritance, Approval Status & Booking/Payment Path Behavior
- **Do new properties inherit `79`?** Yes—numerically, new Dharamshala documents created without an explicit fee inherit `dharamshalaServiceFee: 79` from `Hotel.js:76` / `hotel.routes.js:110` / `partner.routes.js:216`.
- **Can the numeric `79` default be treated as an approved fee?** **No.** In `Hotel.js:78-83`, new properties also default to `dharamshalaFeeApprovalStatus: 'pending_review'` and `dharamshalaFeeConfigured: false`, `dharamshalaServiceFeeVersion: 1`, `dharamshalaFeeHistory: []`.
- **Can unconfigured properties reach a booking/payment path?**
  - **Standard path (`POST /api/bookings` -> `booking.routes.js:503-506` -> `createDharamshalaRequest` -> `dharamshalaLifecycle.js:197`):** **Blocked.** `isInstantEligible` is always `false` for Dharamshalas, routing all Dharamshala bookings into `createDharamshalaRequest`, which calls `validateDharamshalaFeeApproval(hotel)` (`dharamshalaLifecycle.js:155-174`) and throws **HTTP 400** when `dharamshalaFeeApprovalStatus === 'unconfigured'` or `(!isFeeApproved && dharamshalaFeeConfigured === false && dharamshalaFeeApprovalStatus === 'pending_review')`. Because booking creation fails before `Booking.create(...)`, no booking reaches `acceptDharamshalaRequest` or payment order creation.
- **Unexpected Edge Paths / Risks Identified (NOT Auto-Fixed per Strict Rules):**
  1. **[UNEXPECTED FINDING — MASS ASSIGNMENT / OVERWRITE IN `partner.routes.js`]:**
     - `stripPartnerListingProtectedFields` (`backend/routes/partner.routes.js:157-180`) deletes `dharamshalaServiceFee` and `dharamshalaPlatformFeeEnabled`, **but omits `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, and `dharamshalaFeeHistory`**. If a partner request supplied `dharamshalaFeeApprovalStatus: 'approved'` (or `dharamshalaFeeConfigured: true`), `Hotel.create` (`line 249`) would store it alongside `dharamshalaServiceFee: 79` from `applyPartnerHotelDefaults` (`line 216`); once an admin approved the property listing (`/approval`), `validateDharamshalaFeeApproval` would permit bookings at `₹79` without `/admin/policies` fee review.
     - Additionally, `PUT /api/partner/hotels/:id` (`line 273, 286`) invokes `applyPartnerHotelDefaults`, overwriting `hotel.dharamshalaServiceFee = 79` even on an existing Dharamshala with a prior custom fee (while setting `approvalStatus = 'pending'` and `status = 'inactive'`).
  2. **[UNEXPECTED FINDING — LEGACY / OLD RECORDS & MISSING FAIL-CLOSED CHECK]:**
     - In `validateDharamshalaFeeApproval` (`dharamshalaLifecycle.js:163-172`), the rejection branch checks `status === 'unconfigured' || (!isFeeApproved && dharamshalaFeeConfigured === false && status === 'pending_review')` rather than failing closed (`if (!isFeeApproved)`).
     - Any pre-Phase-5.7.4 legacy record in MongoDB lacking `dharamshalaFeeApprovalStatus` (`undefined` / `null`) or having `dharamshalaFeeConfigured: true` with `dharamshalaFeeApprovalStatus: 'pending_review'` bypasses `validateDharamshalaFeeApproval` and falls back to `hotel.dharamshalaServiceFee ?? 79` in `buildDharamshalaAccounting` and `createDharamshalaFeeSnapshot`.
     - Similarly, `acceptDharamshalaRequest` (`dharamshalaLifecycle.js:383`) calls `buildDharamshalaAccounting` without re-running `validateDharamshalaFeeApproval` if a booking already existed in `pending_property_confirmation` before a property's fee status changed.

---

## 4. VALIDATION RESULTS (TASK E)

| Check | Command | Result |
|---|---|---|
| **Frontend TypeScript (App)** | `.\frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.app.json --noEmit` | **PASSED** (`TSC_APP_EXIT: 0`, 0 errors) |
| **Frontend TypeScript (Node)** | `.\frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.node.json --noEmit` | **PASSED** (`TSC_NODE_EXIT: 0`, 0 errors) |
| **Frontend Production Build** | `npm --prefix frontend run build` | **PASSED** (`VITE_BUILD_EXIT: 0`, 2268 modules transformed, built in `23.28s`) |
| **Backend Syntax Check** | `node -c` on `Hotel.js`, `hotel.routes.js`, `partner.routes.js`, `refundCalculationService.js`, `dharamshalaLifecycle.js`, `booking.routes.js` | **PASSED** (`BACKEND_SYNTAX_EXIT: 0`, 0 backend JS files altered in Phase 5.9.1) |

### Git Status Before vs. After Phase 5.9.1

| Metric | Before Phase 5.9.1 | After Phase 5.9.1 (incl. this report) | Explanation |
|---|---:|---:|---|
| **HEAD Commit** | `1295a53036a9eaa201aaf81b38990fd706a5669e` | `1295a53036a9eaa201aaf81b38990fd706a5669e` | Unchanged (0 commits, 0 pushes) |
| **Staged Files** | 0 | **0** | Unchanged |
| **Modified Tracked Files** | 36 (`+4452 / -841`) | **36** (`+4452 / -841`) | Exact diff unchanged (all 6 edited files were untracked) |
| **Untracked Files (Total)** | 132 (47 non-scratch + 85 scratch) | **133** (48 non-scratch + 85 scratch) | +1 (`docs/PHASE_5_9_1_GOVERNANCE_CORRECTION_REPORT.md`) |

---

## 5. REMAINING BLOCKERS & UPDATED PROPOSED COMMIT MANIFEST

### Remaining Engineering & Release Blockers
1. **Unexpected Engineering Edge Cases Discovered in Task D (Decision Needed Before/After Commit):**
   - `backend/routes/partner.routes.js:157-180, 216`: `stripPartnerListingProtectedFields` should also strip `dharamshalaFeeApprovalStatus`, `dharamshalaFeeConfigured`, `dharamshalaServiceFeeVersion`, and `dharamshalaFeeHistory` (and avoid overwriting custom fees on `PUT /hotels/:id`).
   - `backend/utils/dharamshalaLifecycle.js:163-172`: `validateDharamshalaFeeApproval` should fail closed (`if (!isFeeApproved)`) so legacy records without `'pending_review'`/`'unconfigured'` status cannot default to `₹79`.
2. **External Production Release Blockers (Unchanged):**
   - Formal Platform Owner sign-off pending on `DEC-01` through `DEC-04`.
   - Practicing CA written tax opinion pending across all 10 checklist items.
   - Real Brij property KYC/trust deeds pending (`CRIT-03`) and automated database backup/restore scripts absent (`CRIT-04`).

### Updated Proposed Commit Manifest (84 Non-Scratch Files Total)
- **Commit 1 — Complete Application & Financial Architecture (54 files):** Same 54 files verified in Phase 5.9.0 (now including the UI wording updates in `AdminBusinessPolicies.tsx` and `AdminRevenue.tsx`).
- **Commit 2 — Staging Tests & Fixtures (5 files):** Same 5 files (`backend/scripts/seedStagingData.js`, `startStagingServer.js`, and 3 `backend/tests/*.test.js`).
- **Commit 3 — Governance Registers & SOPs (5 files):** Same 5 files (now with `docs/FINANCIAL_GOVERNANCE_DECISION_REGISTER.md` unchecked/marked `PENDING OWNER APPROVAL`).
- **Commit 4 — Historical Phase Reports (16 files):** Same 16 files (now with dated Phase 5.9.1 correction notes in `PHASE_5_4`, `PHASE_5_7_4`, and `PHASE_5_7_4_1` reports).
- **Commit 5 — Audit & Pre-Commit Review Reports (4 files, expanded from 2):**
  - `docs/PHASE_5_8_OPERATIONAL_READINESS_AUDIT.md`
  - `docs/PHASE_5_8_1_CRITICAL_FINDINGS_VERIFICATION.md`
  - `docs/PHASE_5_9_0_FINAL_PRE_COMMIT_REVIEW.md` *(preserved unmodified)*
  - `docs/PHASE_5_9_1_GOVERNANCE_CORRECTION_REPORT.md`
- **Excluded:** `85` files in `scratch/phase5_*` and all `.env*` files.

---

**`READY FOR FINAL PRE-COMMIT REVIEW`**
