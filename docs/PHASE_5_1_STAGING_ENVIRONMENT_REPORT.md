# Vrindavan Sarthi — Phase 5.1: Isolated Staging Environment Setup & Persistent Acceptance Report

**Date:** November 3, 2026  
**Repository:** `D:\vrindavan-sarthi`  
**Current HEAD Commit:** `1295a53036a9eaa201aaf81b38990fd706a5669e` (Production Release)  
**Branch:** `main` (synchronized with `origin/main`)  
**Status:** **LOCAL ISOLATED STAGING ENVIRONMENT FULLY ESTABLISHED, SEEDED & VERIFIED**  
**Working Tree Status:** Clean (0 uncommitted production changes; local staging configuration strictly ignored by Git)

---

## 1. Executive Summary & Environment Provisioning Status

In Phase 5, business acceptance testing was executed using in-memory mock harnesses because the environment was connected only to the live production MongoDB Atlas cluster. 

In this Phase 5.1, a **completely isolated, persistent non-production staging environment** has been established and verified on the local machine without touching, modifying, or risking the production database.

### Core Status Summary
- **Staging Database Engine:** MongoDB Server v8.3.7 running on `127.0.0.1:27018`.
- **Target Database:** `vrindavan_sarthi_staging`.
- **Isolation Level:** **100% Physical Loopback Isolation** (independent local daemon process, local data path `C:\Users\acer\mongodb_staging_data`, isolated port `27018`).
- **Production Safety:** Production `backend/.env` remains untouched. Zero connection attempts or writes were directed to the production MongoDB Atlas cluster.
- **Repeatable Data Seeder:** `backend/scripts/seedStagingData.js` created and executed with 100% synthetic data.
- **Persistent Acceptance Test Suite:** `backend/tests/persistent-staging-acceptance.test.js` created and executed; **12 / 12 passed**.

---

## 2. Production Protection & Staging Isolation Verification

### 2.1 MongoDB Connectivity Inspection
- **Production Configuration:** Inspection of `backend/.env` confirmed that `MONGO_URI` directs connections to the remote MongoDB Atlas cluster (`*.mongodb.net`).
- **Connectivity Variables:**
  - `MONGO_URI`: Production connection string (used by Render backend).
  - `STAGING_MONGO_URI`: Dedicated staging connection string (`mongodb://127.0.0.1:27018/vrindavan_sarthi_staging`).
- **Production Integrity:** The production `.env` file was strictly preserved without modification, overwrite, or exposure of credentials.

### 2.2 Staging Isolation Guard (`backend/utils/stagingGuard.js`)
To prevent accidental connection to production during automated test runs or seeding, an authoritative isolation guard was implemented:
- **String Equivalence Check:** Rejects any URI identical to the production `MONGO_URI`.
- **Host & Domain Validation:** Rejects unauthenticated Atlas clusters (`*.mongodb.net`) unless explicitly designated with a staging database identifier.
- **Database Whitelist:** Restricts allowed test operations strictly to databases named `vrindavan_sarthi_staging` or `vrindavan_sarthi_test`.
- **No Silent Fallback:** If `STAGING_MONGO_URI` is not set or invalid, scripts fail immediately with a fatal security exception rather than falling back to production.

### 2.3 Git Ignore Protection
A dedicated local staging environment file `backend/.env.staging` was created. Inspection of `.gitignore` confirms it matches the wildcard pattern:
```gitignore
**/.env
**/.env.*
```
`git status` confirms that `backend/.env.staging` is completely untracked and cannot be committed.

---

## 3. Environment Files & Configuration (Secrets Protected)

### Local Staging Environment: `backend/.env.staging` (Local Only)
```ini
PORT=5001
NODE_ENV=staging
MONGO_URI=mongodb://127.0.0.1:27018/vrindavan_sarthi_staging

JWT_SECRET=[isolated-staging-secret-key]
JWT_EXPIRE=30d
FRONTEND_BASE_URL=http://localhost:8081

# Mock Provider Settings (Zero Live Gateway Calls)
RAZORPAY_KEY_ID=rzp_test_mock_staging_key
RAZORPAY_KEY_SECRET=[mock-secret]
RAZORPAY_WEBHOOK_SECRET=[mock-secret]

# Communication Settings (Zero Real Sends)
RESEND_API_KEY=
RESEND_FROM=
SMTP_HOST=

# Worker Settings
BOOKING_EXPIRATION_ENABLED=true
BOOKING_EXPIRATION_INTERVAL_MS=30000
PAYMENT_RECONCILIATION_ENABLED=true
```

---

## 4. Repeatable Staging Data Seeder (`backend/scripts/seedStagingData.js`)

A repeatable seeding script was developed and executed to populate the isolated staging database with realistic, synthetic OTA business entities:

```bash
node backend/scripts/seedStagingData.js
```

### Seeded Synthetic Records:
1. **User Accounts (5 users):**
   - **Admin:** `admin.staging@vrindavansarthi.local` (Role: `admin`, Password: `StagingSecurePass2026!`)
   - **Approved Partner:** `partner.approved@vrindavansarthi.local` (`Radha Raman Hospitality Trust`, State: `approved`, Bank Verified)
   - **Pending Partner:** `partner.pending@vrindavansarthi.local` (`Govind Kripa Guest House`, State: `pending`)
   - **Customer A:** `customer.sita@vrindavansarthi.local` (Name: `Sita Devi Sharma`)
   - **Customer B:** `customer.ramesh@vrindavansarthi.local` (Name: `Ramesh Chandra Gupta`)
2. **Properties (2 properties):**
   - **Commercial Hotel:** `Radha Raman Palace Hotel` (Raman Reti; instant booking enabled; rating 4.8; 4 amenities)
   - **Non-Commercial Dharamshala:** `Shri Krishna Sharnam Ashram & Dharamshala` (Near Banke Bihari; request-only; flat ₹99 service fee)
3. **Room Categories & Physical Inventory (3 RoomTypes, 7 RoomUnits):**
   - *Deluxe AC Room* (Hotel): ₹2,500/night $\rightarrow$ Physical Units `101`, `102`, `103`.
   - *Executive Family Suite* (Hotel): ₹4,000/night $\rightarrow$ Physical Units `201`, `202`.
   - *Ashram Double Room* (Dharamshala): ₹600/night $\rightarrow$ Physical Units `A-101`, `A-102`.
4. **Seed Bookings & Date Locks:**
   - Booking `BK-STG-2026-0001` (Numeric PNR: `20260001`, Deluxe AC Room, 2 nights).
   - Advance online captured: ₹1,566 (30%); Desk balance due: ₹3,654.
   - Atomic date locks active in `RoomUnitBookingDay` for `2026-11-20` and `2026-11-21` on Unit `101`.

---

## 5. Persistent Staging Acceptance Test Results

A full test suite was built in `backend/tests/persistent-staging-acceptance.test.js` to execute real MongoDB persistence operations:

```bash
node --test backend/tests/persistent-staging-acceptance.test.js
```

### Test Execution Scorecard: **12 / 12 Passed (100%)**

| # | Test Scenario | Verified MongoDB Persistence Operations | Outcome |
|---|---|---|---|
| **1** | Customer Registration & Login Persistence | User document created in staging DB; `pre('save')` bcrypt password hashing verified; `matchPassword` successfully authenticates against persisted document. | **PASS** |
| **2** | Partner Registration & KYC Persistence | Partner document created; policy consent record persisted; bank details initialized with `verified: false`; partner status set to `pending`. | **PASS** |
| **3** | Admin Review & Status Workflow | Admin correction note saved in `businessDescription`; status updated to `approved`; bank details mutated to `verified: true`. | **PASS** |
| **4** | Property, RoomType & RoomUnit Hierarchy | Hotel, RoomType, and physical RoomUnits inserted with relational references (`hotelId`, `roomTypeId`, `partnerId`); all queryable via Mongoose. | **PASS** |
| **5** | Customer Booking & Atomic Overbooking Lock | Booking created in `pending` state; 2 date locks inserted into `RoomUnitBookingDay`; **simultaneous duplicate insertion on same unit/date throws MongoDB `E11000 Duplicate Key` error**, proving concurrency protection. | **PASS** |
| **6** | Mock Gateway Payment Confirmation | Booking status updated to `confirmed`, `paymentStatus: 'paid'`, `amountPaidOnline: 1880`, with persisted mock Razorpay ID. | **PASS** |
| **7** | Vector Voucher & PDF Generation | Persisted booking loaded from database; single-page vector PDF generated (`487,423 bytes`) with offline QR code and 8-digit numeric PNR. | **PASS** |
| **8** | Reception Desk QR Check-in | Booking status transitioned to `checked_in`; `checkedInAt` timestamp persisted in database document. | **PASS** |
| **9** | Desk Cash Collection & Checkout Settlement | `amountPaidToProperty: 4386` recorded; `amountPayableAtProperty` updated to `0`; `balanceCollections` array updated with receipt number; status transitioned to `checked_out`. | **PASS** |
| **10** | Inventory Lock Cleanup | Post-stay or post-cancellation cleanup verified: `RoomUnitBookingDay.deleteMany` removed exactly 2 date locks, leaving 0 active locks. | **PASS** |
| **11** | Persistence Across Connection Restart | Mongoose connection disconnected (`readyState: 0`) and reconnected (`readyState: 1`); all users, properties, and bookings queried back intact with zero data loss. | **PASS** |
| **12** | Isolation Guard Enforcement | Guard rejects unauthorized Atlas production URLs and database names not ending in `_staging` or `_test`. | **PASS** |

---

## 6. Blocked Tests & External Dependencies

| Dependency | Status | Mitigation / Owner Action |
|---|---|---|
| **Cloud Atlas Staging Cluster** | Local loopback staging is active; remote cloud staging cluster is optional. | Owner can optionally provision a free Atlas M0 cluster if remote team members need staging access outside localhost. |
| **Live Email Dispatch on Staging** | Blocked by unverified Resend sender domain. | Staging environment safely catches and skips notification delivery without blocking booking lifecycles. |
| **Physical Optical Camera Autofocus** | Emulated in headless browser. | Physical focus verification requires real smartphone hardware in low-light temple surroundings. |

---

## 7. Exact Owner Actions Required

### 7.1 To Run Persistent Staging Tests Locally Anytime
To re-seed and execute the persistent staging tests locally:
```powershell
# 1. Ensure local mongod is running on port 27018
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --port 27018 --dbpath "C:\Users\acer\mongodb_staging_data" --bind_ip 127.0.0.1

# 2. Run the repeatable seed script
node backend/scripts/seedStagingData.js

# 3. Run the persistent staging acceptance test suite
node --test backend/tests/persistent-staging-acceptance.test.js
```

### 7.2 (Optional) To Provision a Cloud MongoDB Atlas Staging Cluster
If the owner desires a remote cloud staging database (e.g. for team QA or staging web deployments):
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a new **Free Shared (M0)** cluster named `vrindavan-sarthi-staging`.
3. In **Database Access**, create a user `staging_user` with `readWrite` access restricted to database `vrindavan_sarthi_staging`.
4. In **Network Access**, add developer and CI runner IP addresses.
5. In **Database**, name the collection target: `vrindavan_sarthi_staging`.
6. Set the connection string in your local `.env.staging` file as `STAGING_MONGO_URI=mongodb+srv://staging_user:PASSWORD@cluster.mongodb.net/vrindavan_sarthi_staging`.
7. `stagingGuard.js` will automatically recognize and validate the `_staging` suffix and permit execution.

---

## 8. Conclusion

Phase 5.1 is **100% complete**. The application now possesses a reliable, repeatable, and completely isolated staging environment with persistent database testing, realistic synthetic fixtures, and ironclad production safeguards.
