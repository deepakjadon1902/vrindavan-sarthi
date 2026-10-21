# Vrindavan Sarthi — Owner Decisions & Access Requirements

**Document ID:** `VRS-AUDIT-11-DECISIONS`  
**Audit Date:** October 17, 2026  
**Auditor:** Senior Software Architect & Platform Consultant  

The following items cannot be inferred or finalized from codebase inspection alone. They require explicit business decisions, policy determinations, or external administrative credentials from the platform owner.

---

## 1. Commercial & Business Policy Decisions

### Decision 1: Instant Booking vs. Manual Request Flow for Commercial Hotels
- **Current Implementation:**  
  All room bookings (Hotels and Dharamshalas) enter `pending_property_confirmation`. The property manager must log in and manually accept within 30 minutes, or the booking expires. Guests cannot pay upfront.
- **Business Dilemma:**  
  While the request-first flow is customary for spiritual Dharamshalas (to screen pilgrims and manage donations), commercial hotel guests expect immediate confirmation. High drop-off is inevitable if hotel bookings require 30-minute manual approval.
- **Owner Decision Required:**  
  - **Option A (Recommended):** Enable **Instant Booking** for approved commercial hotels (customer pays upfront, room is locked immediately, booking is confirmed instantly). Reserve the **Request-First** flow strictly for Dharamshalas and homestays.
  - **Option B:** Maintain the universal request-first flow for all properties.

---

### Decision 2: Official Canonical Domain Strategy (.in vs. .com)
- **Current State:**  
  Both `www.vrindavansarthi.in` and `www.vrindavansarthi.com` serve HTTP 200 OK directly with duplicate content.
- **Owner Decision Required:**  
  - Confirm that `https://www.vrindavansarthi.in` is the primary canonical brand domain.
  - Authorize an edge-level permanent HTTP 301 redirect from `vrindavansarthi.com` and `www.vrindavansarthi.com` to `https://www.vrindavansarthi.in`.

---

### Decision 3: Cab and Tour Booking Model (Assisted vs. Direct Online)
- **Current Implementation:**  
  The frontend Cab and Tour pages calculate estimated fares and display a breakdown, but the call-to-action buttons redirect to WhatsApp (`wa.me`) or a direct telephone call (`tel:`).
- **Owner Decision Required:**  
  - **Option A (Recommended for current scale):** Retain WhatsApp/Phone assisted desk booking for cabs and tours, but formalize conversion tracking in analytics.
  - **Option B:** Upgrade Cab and Tour flows to full online self-serve checkout via Razorpay (requiring online driver dispatch and dynamic vehicle availability tracking).

---

### Decision 4: Partner Commission & Payment Gateway Fee Accounting
- **Current Implementation:**  
  - Hotel partner commission: 10% of base room tariff.
  - Dharamshala commission: 0%.
  - Payment gateway fee: 2% of room tariff, currently deducted from the partner's payout.
- **Owner Decision Required:**  
  1. Confirm whether the 2% Razorpay fee should be deducted from the hotel partner (current code) or absorbed by Vrindavan Sarthi from its 10% commission margin.
  2. Confirm whether 18% GST is charged to the partner on Vrindavan Sarthi's 10% commission invoice (B2B GST compliance).
  3. Authorize the correction of `partner.routes.js` to subtract cash collected at the desk (`balanceAtProperty`) from partner remittance balances.

---

### Decision 5: Standard Dharamshala Platform Service Fee
- **Current State:**  
  The codebase references ₹79 in `dharamshalaLifecycle.js`, while live production records for `Shri Giriraj Sewa Sadan` specify ₹99.
- **Owner Decision Required:**  
  Establish the fixed commercial platform service fee for Dharamshala reservations (e.g., flat ₹99 vs. flat ₹79 vs. 10% contribution fee).

---

## 2. External Dashboard & Administrative Access Required

To execute production hardening, SEO indexing, and infrastructure verification, the following specific credentials or dashboard permissions are required:

| Service | Specific Access / Information Needed | Purpose |
| :--- | :--- | :--- |
| **Vercel Dashboard** | Team or Project Admin access for `vrindavan-sarthi` | 1. Configure 301 domain redirect from `.com` to `.in`.<br/>2. Inspect deployment build logs and environment variables. |
| **Render Dashboard** | Service Admin access for `vrindavan-sarthi-gla3` | 1. Configure production `RESEND_API_KEY` & `RESEND_FROM`.<br/>2. Verify managed Redis URL and worker service status.<br/>3. Review server resource metrics and CPU/memory utilization. |
| **Google Search Console** | HTML Meta verification code or DNS TXT token | Replace placeholder `GOOGLE_SEARCH_CONSOLE_VERIFICATION_TOKEN` in `frontend/index.html`. |
| **Bing Webmaster Tools** | Meta verification code | Replace placeholder `BING_WEBMASTER_VERIFICATION_TOKEN` in `frontend/index.html`. |
| **MongoDB Atlas** | Atlas Project Viewer or Backup Operator | Verify continuous automated snapshots, point-in-time recovery (PITR), and network IP access lists. |
| **Razorpay Dashboard** | Webhook verification access | Confirm that `https://vrindavan-sarthi-gla3.onrender.com/api/payments/razorpay/webhook` is subscribed to `payment.captured`, `payment.failed`, and `refund.processed`. |
| **Transactional Email (Resend)** | Verified Domain API Key | Send real password reset OTPs and partner registration alarms without relying on console logs. |
| **Firebase Console (FCM)** | Firebase Service Account JSON | Enable native Android background push alarms for hotel partners when new booking requests arrive. |
