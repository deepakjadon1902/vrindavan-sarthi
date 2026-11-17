# VRINDAVAN SARTHI — PHASE 5.7.2 ACCEPTANCE REPORT
## Business Policy Configuration Engine, Custom Hotel Policies & Immutable Snapshot Integrity

**Repository:** `https://github.com/deepakjadon1902/vrindavan-sarthi.git`  
**Local Workspace:** `D:\vrindavan-sarthi`  
**Target Environment:** Isolated Local Staging (`mongodb://127.0.0.1:27018/vrindavan_sarthi_staging`)  
**Production Baseline Commit:** `1295a53036a9eaa201aaf81b38990fd706a5669e`  
**Report Date:** November 6, 2026  
**Status:** Approved & Verified Against Isolated Staging  

---

## 1. Executive Summary & Objective

In Phase 5.7.2, we engineered and verified a centralized, production-grade **Business Policy Configuration Engine** for the Vrindavan Sarthi Online Travel Agency (OTA) platform.

Prior to this phase, cancellation terms and Dharamshala service fees were partially hardcoded in route handlers or calculated on-the-fly at the moment of cancellation. This created operational risks: retroactive policy updates could alter refund entitlements for already-booked stays, property-specific luxury terms could not be honored, and Dharamshala fees lacked granular per-property control and immutable provenance.

Phase 5.7.2 delivers:
1. **Platform-Wide Default Cancellation Policy:** Configurable tiered cancellation policies for commercial hotels (>48h: 75% refund, 24h–48h: 50% refund, <24h: 0% refund) with strict range validation and versioning.
2. **Hotel-Specific Custom Cancellation Policies:** Granular property overrides with full version history and justification logging, overriding the platform default *only* for eligible 100% full-payment hotel reservations.
3. **Strict 30% Advance Booking Non-Refundability:** Fixed commercial rule where voluntary customer cancellations on 30% advance deposits yield **0% refund** (retaining the advance deposit), while hotel or platform failure yields **100% refund of actual online funds paid**. Custom hotel policies are strictly prohibited from overriding this advance deposit rule.
4. **Individually Configurable Dharamshala Service Fees:** Configurable per Dharamshala property (supporting ₹0 for non-profit seva ashrams or custom non-negative fees), independent of commercial hotel fees, with version tracking.
5. **Immutable Booking-Time Policy Snapshots:** Capture of `cancellationPolicySnapshot` and `dharamshalaFeeSnapshot` at the exact instant a reservation is confirmed, ensuring subsequent policy or fee adjustments never alter existing contracts.
6. **Authoritative Refund Engine (`refundCalculationService.js`):** Unified, single-source-of-truth service enforcing integer currency math (paise), desk balance exclusion, boundary handling, and responsibility classification.
7. **Customer Role Protection Gate & Admin Reclassification:** Customers cannot self-certify hotel or platform fault; all customer cancellations are categorized as `customer_voluntary`. Authorized administrators can reclassify responsibility with mandatory justifications and complete audit logging.
8. **Admin Control UI & Disclosures:** 4-tab control center at `/admin/policies`, fault reclassification modal in `/admin/cancellations`, and accurate disclosures on pre-booking and booking detail pages.

---

## 2. Existing Policy Audit Findings

| Component | Pre-Phase 5.7.2 State | Vulnerability / Deficiency | Remediated Architecture in Phase 5.7.2 |
|---|---|---|---|
| **Platform Default Policy** | Hardcoded conditional checks inside `booking.routes.js` | Modifying cancellation rules required code changes and server redeployment. | Dynamic `PlatformPolicy` MongoDB collection with version history and admin API controls. |
| **Hotel Custom Overrides** | Non-existent; all hotels subjected to same static formula | Luxury hotels requiring stricter windows (e.g. 96h) could not customize terms. | `Hotel.cancellationPolicyType` and `Hotel.customCancellationPolicy` with tier validation and admin management. |
| **30% Advance Deposit Rule** | Fragmented checks across booking cancellation routes | Risk of customer receiving partial refund on advance deposits if custom tiers applied. | Hardcoded safety barrier in `refundCalculationService.js`: `advance_30` always enforces 0% refund for voluntary cancellations. |
| **Dharamshala Service Fee** | Hardcoded ₹79 in helper scripts | Dharamshalas could not have customized fees (e.g., ₹0 for charitable trust ashrams). | Individual `Hotel.dharamshalaServiceFee` field with versioning, audit trail, and zero-fee support. |
| **Contract Immutability** | Cancellation policies evaluated dynamically at cancellation time | If an admin updated policy tiers, prior reservations would be evaluated under new rules. | `Booking.cancellationPolicySnapshot` captured at booking creation; immutable across property lifecycle. |
| **Responsibility Classification** | Any cancellation treated under generic formula | Customers could claim property fault to bypass cancellation charges without admin audit. | Role gate: customer requests forced to `customer_voluntary`; admin-only reclassification with mandatory reason. |

---

## 3. Business Rules Implemented & Verified

### 3.1 Commercial Hotel Full-Payment Cancellation (Platform Default)
- **> 48 hours before check-in:** 75% refund of total amount paid online (25% cancellation charge).
- **24 hours to 48 hours before check-in:** 50% refund of total amount paid online (50% cancellation charge).
- **< 24 hours before check-in:** 0% refund (100% cancellation charge, 0 refund).
- **Boundary Handling:** An exact 48.000 hours falls into the 24h–48h tier (50% refund). Exactly 24.000 hours falls into the 24h–48h tier (50% refund). Under 24 hours (e.g., 23h 59m 59s) yields 0% refund.

### 3.2 Commercial Hotel 30% Advance Booking Rule
- **Customer Voluntary Cancellation:** **0% refund** of online amount paid (the 30% advance deposit is completely non-refundable and retained by the platform/partner).
- **Hotel or Platform Failure:** **100% refund** of online amount paid (full ₹3,000 refunded on ₹10,000 booking with ₹3,000 paid).
- **Precedence Rule:** Custom hotel policies **CANNOT** override the 30% advance deposit rule. The non-refundable rule applies unconditionally to all commercial hotel advance bookings.

### 3.3 Hotel-Specific Custom Policy Overrides
- Individual commercial hotels can be assigned custom cancellation tiers (e.g., luxury tier: >96h: 90%, 48h–96h: 60%, <48h: 0%).
- Custom tiers must be strictly descending by hours and terminate at 0 hours.
- Overrides apply **only** to full-payment (`full_100`) reservations for that property.
- Resetting to platform default immediately reinstates the active platform default policy for future bookings.

### 3.4 Individually Configurable Dharamshala Service Fees
- Each Dharamshala property has an individually configurable service fee (default ₹79).
- Supports ₹0 service fee for non-profit/charitable trust ashrams.
- Negative fees are strictly rejected (`min: 0`).
- Updating a Dharamshala service fee requires a mandatory justification reason and increments the property's fee version.
- Non-dharamshala commercial hotels are rejected if an admin attempts to configure a Dharamshala fee.

### 3.5 Immutable Policy Snapshots
- When a customer creates a reservation, an immutable policy snapshot is embedded in the booking document:
  - `cancellationPolicySnapshot`: Contains the policy type, policy name, active version, exact tier array, and disclaimer.
  - `dharamshalaFeeSnapshot`: Contains the fee amount, fee version, and timestamp.
- Any subsequent change to the hotel's custom policy or platform default policy leaves existing reservations completely unaffected.

### 3.6 Financial Integrity & Desk Balance Exclusion
- The maximum refundable amount is strictly capped at `amountPaidOnline`.
- Any uncollected desk balance (e.g., ₹7,000 remaining on a ₹10,000 booking with ₹3,000 advance) is **strictly excluded** from refund calculations.
- All monetary calculations execute with integer math (paise) to eliminate floating-point rounding errors.

### 3.7 Role Protection Gate & Admin Reclassification
- Customers can never self-certify `hotel_fault`, `platform_fault`, or `system_technical`.
- Any cancellation submitted through customer endpoints is automatically forced to `customer_voluntary`.
- Authorized administrators (`manage_refunds` or `super_admin`) can reclassify responsibility to `hotel_fault` or `platform_fault` via `PUT /api/bookings/admin/cancellations/:id/override-fault` with a mandatory justification.
- Reclassification automatically recalculates `refundableAmount` (e.g., unlocking 100% refund for advance deposits) and logs the action in the platform audit trail.

---

## 4. Schema & Data Model Changes

### 4.1 `PlatformPolicy` (`backend/models/PlatformPolicy.js`)
```javascript
const platformPolicySchema = new mongoose.Schema({
  policyKey: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  tiers: [{
    hoursBeforeCheckIn: { type: Number, required: true, min: 0 },
    refundPercent: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String, required: true }
  }],
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  history: [{
    version: { type: Number, required: true },
    tiers: { type: Array, required: true },
    reason: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    updatedAt: { type: Date, default: Date.now }
  }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String },
}, { timestamps: true });
```

### 4.2 `Hotel` (`backend/models/Hotel.js`)
Added the following fields:
- `cancellationPolicyType`: `'platform_default' | 'custom'` (default: `'platform_default'`)
- `customCancellationPolicy`: Object containing `tiers`, `version`, `updatedAt`, `updatedBy`, `updatedByName`, `reason`
- `cancellationPolicyHistory`: Array of historical policy revisions
- `dharamshalaServiceFee`: Number, default: `79`, `min: 0`
- `dharamshalaServiceFeeVersion`: Number, default: `1`
- `dharamshalaFeeHistory`: Array of fee revisions with reason, user, and timestamps

### 4.3 `Booking` (`backend/models/Booking.js`)
Added the following fields:
- `cancellationPolicySnapshot`: Embedded subdocument storing `policyType`, `policyVersion`, `isCustom`, `policyName`, `tiers`, `disclaimer`, `capturedAt`
- `dharamshalaFeeSnapshot`: Embedded subdocument storing `fee`, `feeVersion`, `capturedAt`
- `cancellationResponsibility`: `'customer_voluntary' | 'hotel_fault' | 'platform_fault' | 'system_technical' | 'administrative'`
- `cancellationExplanation`: Human-readable explanation of refund calculation
- `cancellationFaultOverrideReason`: Mandatory administrative justification for reclassifying fault
- `cancellationFaultOverriddenBy`: Administrator User ID
- `cancellationFaultOverriddenAt`: Timestamp of reclassification

---

## 5. Refund Calculation Boundary Truth Table

| Payment Option | Hours Before Check-in | Responsibility | Amount Paid Online | Desk Balance | Refund % | Refundable Amount | Policy Applied |
|---|---|---|---|---|---|---|---|
| `full_100` | 72 hours (>48h) | `customer_voluntary` | ₹10,000 | ₹0 | **75%** | **₹7,500** | Platform Default (>48h tier) |
| `full_100` | 48.000 hours | `customer_voluntary` | ₹10,000 | ₹0 | **50%** | **₹5,000** | Platform Default (24-48h tier) |
| `full_100` | 36.500 hours | `customer_voluntary` | ₹10,000 | ₹0 | **50%** | **₹5,000** | Platform Default (24-48h tier) |
| `full_100` | 24.000 hours | `customer_voluntary` | ₹10,000 | ₹0 | **50%** | **₹5,000** | Platform Default (24-48h tier) |
| `full_100` | 12 hours (<24h) | `customer_voluntary` | ₹10,000 | ₹0 | **0%** | **₹0** | Platform Default (<24h tier) |
| `full_100` (Custom Hotel) | 72 hours (48h–96h) | `customer_voluntary` | ₹10,000 | ₹0 | **60%** | **₹6,000** | Hotel Custom (Luxury 48h-96h) |
| `advance_30` | 72 hours (>48h) | `customer_voluntary` | ₹3,000 | ₹7,000 | **0%** | **₹0** | 30% Advance Deposit Rule |
| `advance_30` | 12 hours (<24h) | `customer_voluntary` | ₹3,000 | ₹7,000 | **0%** | **₹0** | 30% Advance Deposit Rule |
| `advance_30` | Any time | `hotel_fault` | ₹3,000 | ₹7,000 | **100%** | **₹3,000** | Hotel Failure Exception |
| `advance_30` | Any time | `platform_fault` | ₹3,000 | ₹7,000 | **100%** | **₹3,000** | Platform Failure Exception |
| `advance_30` | Any time | Customer claims fault | ₹3,000 | ₹7,000 | **0%** | **₹0** | Customer Role Gate (forced voluntary) |

---

## 6. End-to-End Test Suite Execution Results

All test suites were executed against the isolated local staging environment (`mongodb://127.0.0.1:27018/vrindavan_sarthi_staging`).

### 6.1 Phase 5.7.2 Dedicated Policy Engine Suite (`run_phase5_7_2_policy_suite.js`)
**Result: 46 / 46 Passed (0 Failed)**
- **Section 1: Staging Isolation & Safety:** 4/4 assertions passed.
- **Section 2: Platform Default Cancellation Policy:** 8/8 assertions passed (RBAC rejection, mandatory reason, tier range validation, version history).
- **Section 3: Hotel Custom Policy Overrides:** 5/5 assertions passed (default inheritance, custom tier update, precedence).
- **Section 4: Dharamshala Service Fee Configuration:** 4/4 assertions passed (hotel rejection, independent fee update, ₹0 free seva, negative fee validation).
- **Section 5: Policy & Fee Snapshot Creation & Immutability:** 6/6 assertions passed (snapshot creation, immutability across subsequent property updates).
- **Section 6: Authoritative Refund Calculation & Boundaries:** 5/5 assertions passed (>48h, 48.000h, 24h-48h, 24.000h, <24h).
- **Section 7: 30% Advance Booking Cancellation Rules:** 6/6 assertions passed (0% voluntary refund, 100% hotel/platform failure refund, desk balance exclusion).
- **Section 8: Customer Role Protection Gate:** 2/2 assertions passed (customer cannot self-certify fault; denied 100% refund).
- **Section 9: Admin Cancellation & Fault Reclassification:** 4/4 assertions passed (fault reclassification, 100% recalculation, audit log recording).
- **Section 10: Historical Booking Backward Compatibility:** 2/2 assertions passed (graceful fallback without snapshots).

### 6.2 Full Regression Suite Summary
| Suite | Command | Tests / Assertions | Result |
|---|---|---|---|
| **Phase 5.7.2 Business Policy Suite** | `node scratch/phase5_7_2/run_phase5_7_2_policy_suite.js` | 46 assertions | **46 / 46 PASS** |
| **Backend Core Unit Tests** | `npm --prefix backend test` | 36 tests | **36 / 36 PASS** |
| **Staging Persistence & Onboarding** | `node --test backend/tests/partner-onboarding.test.js ...` | 24 tests | **24 / 24 PASS** |
| **Phase 5.7 Admin Portal Suite** | `node scratch/phase5_7/run_phase5_7_admin_suite.js` | 49 assertions | **49 / 49 PASS** |
| **Phase 5.6 Customer Experience Suite** | `node scratch/phase5_6/run_phase5_6_customer_suite.js` | 46 assertions | **46 / 46 PASS** |
| **Phase 5.5 Partner Operations Suite** | `node scratch/phase5_5/run_phase5_5_partner_suite.js` | 47 assertions | **47 / 47 PASS** |
| **Phase 5.4 OTA Audit & Financial Suite** | `node scratch/phase5_4/run_phase5_4_audit_suite.js` | 40 tests | **40 / 40 PASS** |
| **Frontend Unit Tests** | `npm --prefix frontend test -- --run` | 64 tests | **64 / 64 PASS** |
| **TypeScript Static Typecheck** | `node frontend/node_modules/typescript/bin/tsc --noEmit` | Project-wide | **0 ERRORS** |
| **Frontend Production Build** | `npm --prefix frontend run build` | 2,268 modules | **EXIT CODE 0** |

---

## 7. Playwright Visual Verification & Screenshots

All 6 visual checkpoints were captured using Google Chrome via Playwright in both Desktop (1280x900) and Mobile (390x844) viewports:

| Filename | Viewport | Page / Feature Captured | Status |
|---|---|---|---|
| `01_admin_policies_platform_desktop.png` | Desktop (1280x900) | `/admin/policies` — Platform Default Policy tab with tiered refund cards, version badge, and Edit Tiers trigger. | **Verified (442 KB)** |
| `02_admin_policies_hotels_desktop.png` | Desktop (1280x900) | `/admin/policies` — Hotel Policy Overrides tab listing properties with current policy type badges, custom tier editor, and reset buttons. | **Verified (750 KB)** |
| `03_admin_policies_dharamshala_desktop.png` | Desktop (1280x900) | `/admin/policies` — Dharamshala Service Fees tab with per-property fee cards, version badges, and fee edit dialog. | **Verified (583 KB)** |
| `04_admin_policies_audit_desktop.png` | Desktop (1280x900) | `/admin/policies` — Policy Audit History tab showing chronological version revisions, administrative actor provenance, and reasons. | **Verified (489 KB)** |
| `05_admin_cancellations_fault_override_desktop.png` | Desktop (1280x900) | `/admin/cancellations` — Cancellations management view with policy snapshot cards and the interactive Fault Reclassification modal. | **Verified (738 KB)** |
| `06_admin_policies_mobile.png` | Mobile (390x844) | `/admin/policies` — Fully responsive mobile view of the Business Policy Engine with touch-friendly navigation tabs. | **Verified (194 KB)** |

All screenshots have been copied to the persistent artifact directory:  
`C:\Users\acer\.gemini\antigravity\brain\30fd5737-e168-4511-a71c-a8f15511eb09\screenshots/`

---

## 8. Summary of Files Created & Modified

### Backend:
- `backend/models/PlatformPolicy.js` *(Created)*: Platform cancellation policy schema and version history.
- `backend/models/Hotel.js` *(Modified)*: Added custom policy fields, Dharamshala service fee fields, and revision history.
- `backend/models/Booking.js` *(Modified)*: Added immutable snapshot fields, responsibility classification, and fault override audit fields.
- `backend/services/refundCalculationService.js` *(Created)*: Single authoritative refund service implementing boundary math, snapshot generation, and fault rules.
- `backend/routes/policy.routes.js` *(Created)*: Full administrative policy REST API for platform defaults, hotel custom policies, Dharamshala fees, and audit trails.
- `backend/routes/booking.routes.js` *(Modified)*: Injected snapshot generation into booking creation, refund calculation into cancellations, preview calculation endpoint, and fault override endpoint.
- `backend/utils/dharamshalaLifecycle.js` *(Modified)*: Added snapshot capture to Dharamshala request flow.
- `backend/routes/hotel.routes.js` *(Modified)*: Exposed custom policy and Dharamshala fee version in public hotel listings.
- `backend/server.js` *(Modified)*: Mounted `/api/policies` router.

### Frontend:
- `frontend/src/pages/admin/AdminBusinessPolicies.tsx` *(Created)*: 4-tab control center for platform policies, hotel overrides, Dharamshala fees, and audit history.
- `frontend/src/pages/admin/AdminLayout.tsx` *(Modified)*: Added "Business Policies" link (`/admin/policies`) with `Sliders` icon.
- `frontend/src/pages/admin/AdminCancellations.tsx` *(Modified)*: Added policy snapshot display, responsibility badges, and fault reclassification modal.
- `frontend/src/pages/user/BookingDetail.tsx` *(Modified)*: Displays booking snapshot cancellation policy and detailed refund status.
- `frontend/src/pages/RoomTypeDetail.tsx` *(Modified)*: Displays accurate pre-booking cancellation terms (30% advance deposit rule vs hotel custom policy vs platform default).
- `frontend/src/store/bookingStore.ts` *(Modified)*: Added policy snapshot and cancellation responsibility interfaces.
- `frontend/src/lib/seo.ts` *(Modified)*: Added SEO route metadata for `/admin/policies`, `/admin/cancellations`, and admin pages.
- `frontend/src/App.tsx` *(Modified)*: Registered lazy `/admin/policies` route.

---

## 9. Production Protection & Safety Confirmation

- **Production MongoDB Atlas:** **NEVER CONNECTED.** Checked and verified that production Atlas URI was never queried, imported, or touched.
- **Production Environment (`backend/.env`):** **UNTOUCHED.** All staging processes strictly operated against `backend/.env.staging` and local port `27018`.
- **Live Payments & Webhooks:** **ZERO LIVE TRANSACTIONS.** No live Razorpay API calls, captures, refunds, or payouts were executed.
- **External Notifications:** **ZERO EXTERNAL NOTIFICATIONS.** No real emails, SMS, WhatsApp messages, or OTPs were dispatched.
- **Git Repository:** **ZERO COMMITS / ZERO PUSHES.** Working directory changes from Phases 5.2–5.7.2 remain cleanly preserved.
