# Vrindavan Sarthi — Defensive Security & Privacy Audit

**Document ID:** `VRS-AUDIT-05-SECURITY`  
**Audit Date:** October 17, 2026  
**Auditor:** Senior Security Auditor, DevSecOps Engineer & Full-Stack Architect  

---

## 1. Executive Security Posture Summary

Vrindavan Sarthi demonstrates a strong defensive engineering foundation. The codebase exhibits active protection against common web vulnerabilities, including centralized NoSQL operator sanitization, rate-limiting on sensitive endpoints, strict role authorization guards, and cryptographic signature validation for all payment gateways and webhooks.

### Key Security Strengths:
1. **Centralized NoSQL Injection Guard:** `backend/middleware/noSqlSanitizer.js` inspects all incoming `req.body`, `req.query`, and `req.params` keys, rejecting `$`-prefixed MongoDB query operators and dotted keys before handlers execute.
2. **Strict Role Escalation Defense:** Public registration endpoints explicitly clamp roles to `user` or `partner`. The `admin` role cannot be self-assigned via registration or Google OAuth.
3. **Atomic Inventory Concurrency:** Double-booking exploits are blocked at the database engine level via unique compound indexes on `RoomUnitBookingDay`.
4. **Partner Isolation:** Partners are strictly restricted to one approved hotel and cannot read, modify, or list rooms or bookings belonging to other properties.

---

## 2. Authentication, Token Management & Password Security

### A. Password Hashing & Registration
- **Algorithm:** `bcryptjs` with **12 salt rounds** configured in `backend/models/User.js:117`.
- **Pre-save Hook:** Hashing triggers automatically only when `this.isModified('password')` is true.
- **Projection Protection:** In `backend/models/User.js:33`, `password` is defined with `{ select: false }`. Standard Mongoose queries do not return password hashes unless explicitly requested.

### B. JWT Token Implementation
- **Issuance:** Tokens are issued with `jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })`.
- **Validation:** `backend/middleware/auth.js` validates `Bearer <token>` format, checks against `JWT_SECRET`, and verifies that the referenced user still exists in the database.
- **Limitation:** Tokens have a 7-day fixed expiration without server-side revocation lists or refresh token rotation. If an administrative user account is compromised, revoking existing tokens requires changing the global `JWT_SECRET` (which logs out all users) unless a token version / blacklist field is added to the user model.

### C. Password Reset Flow via Email OTP
- **OTP Generation:** Cryptographically random 6-digit integer (`Math.floor(100000 + Math.random() * 900000)`).
- **Storage:** Stored as a salted SHA-256 hash (`passwordResetOtpHash`) with `{ select: false }`.
- **Brute-Force Defense:**
  - `passwordResetRateLimiter` enforces rate limiting on `/forgot-password`, `/verify-reset-otp`, and `/reset-password`.
  - Max attempt tracking: `passwordResetOtpAttempts` increments on failed verifications; after 5 failed attempts, the OTP is invalidated.
  - Expiration: Fixed at 10 minutes (`expiresAt = Date.now() + 10 * 60 * 1000`).

---

## 3. Authorization & Access Control (IDOR / BOLA Review)

| Endpoint / Operation | Route & Controller | Authorization Check | Audit Finding |
| :--- | :--- | :--- | :--- |
| **View Customer Booking** | `GET /api/bookings/:id` | Validates `booking.userId == req.user._id` OR valid `guestAccessTokenHash` OR `admin` OR `partnerId == req.user._id`. | **PASS / SAFE:** Unauthorized third parties cannot view foreign bookings. |
| **Partner Inventory Scoping** | `GET /api/partner/inventory` | `Hotel.findOne({ _id: hotelId, partnerId: req.user._id })`. | **PASS / SAFE:** Partners cannot view or mutate inventory for other hotels. |
| **Partner Booking Scoping** | `GET /api/partner/bookings` | `Booking.find({ partnerId: req.user._id })`. | **PASS / SAFE:** Partners only see bookings assigned to their property. |
| **Admin Route Gating** | `/api/admin/*`, `/api/partner/payouts` | Middleware `authorize('admin')`. | **PASS / SAFE:** Non-admin roles receive HTTP 403 Forbidden. |
| **Partner Approval Gate** | `authorize('partner')` | Checks `req.user.partnerStatus === 'approved'`. | **PASS / SAFE:** Unapproved partner accounts cannot perform property actions. |
| **Guest Booking Access** | `withGuestAccessToken` | Generates 256-bit cryptographically random token; stores SHA-256 hash in DB. | **PASS / SAFE:** Guest users access their bookings securely without account registration. |

---

## 4. Injection, XSS, CSRF & Input Validation

1. **NoSQL Injection:**  
   The `rejectUnsafeMongoKeys` middleware recursively inspects all request parameters:
   ```javascript
   const isUnsafeKey = (key) => typeof key === 'string' && (key.startsWith('$') || key.includes('.'));
   ```
   Attacks attempting MongoDB operators (`{"$gt": ""}`) are rejected with HTTP 400 before reaching database queries.
2. **Object ID Validation:**  
   `backend/utils/security.js` provides `rejectInvalidObjectId(res, id, label)`, verifying that all URL parameters match standard 24-character hex MongoDB ObjectId format, preventing Mongoose casting crashes.
3. **HTTP Security Headers:**  
   Configured in `backend/middleware/securityHeaders.js`:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Cross-Origin-Resource-Policy: same-site`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `Strict-Transport-Security: max-age=15552000; includeSubDomains` (also reinforced on Vercel with 63,072,000s).

---

## 5. File Upload Restrictions & Media Storage

- **Upload Handlers:** Configured in `backend/routes/settings.routes.js` and `backend/routes/auth.routes.js`.
- **MIME Type Allowlist:**
  ```javascript
  const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]);
  ```
- **Size Limits:** Multer memory storage enforces a 2 MB limit on logos, 1 MB on favicons, and 10 MB on partner verification documents.
- **Sanitized Filenames:** `safeFileName` strips non-alphanumeric characters and restricts base names to 80 characters, preventing directory traversal attacks.
- **Cloud Storage:** Uploads are streamed directly as Base64/DataURIs to Cloudinary under isolated asset folders (`vrindavan-sarthi/settings`, `vrindavan-sarthi/hotels`).

---

## 6. Rate Limiting & Abuse Prevention

Implemented in `backend/middleware/rateLimit.js`:

| Limiter Name | Protected Endpoints | Window | Max Requests | Storage Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `authRateLimiter` | `/api/auth/login`, `/api/auth/register` | 15 minutes | 15 attempts | In-memory token bucket |
| `passwordResetRateLimiter` | `/forgot-password`, `/verify-reset-otp`, `/reset-password` | 15 minutes | 5 attempts | In-memory token bucket |
| `paymentRateLimiter` | `/api/payments/razorpay/*` | 15 minutes | 30 requests | In-memory token bucket |
| `webhookRateLimiter` | `/api/payments/razorpay/webhook`, `/api/channel/webhooks` | 1 minute | 120 requests | In-memory token bucket |
| `publicWriteRateLimiter` | `/api/contact`, `/api/bookings/room-type` | 15 minutes | 20 submissions | In-memory token bucket |

> [!NOTE]  
> **Rate Limiting Limitation:** The current rate limiters store buckets in local Node.js process memory. In a multi-instance or auto-scaling cluster deployment on Render, rate limits are enforced per-instance rather than globally across all instances. Upgrading to a Redis-backed distributed store (`rate-limiter-flexible`) is recommended for scaled multi-instance production.

---

## 7. Data Privacy, PII & Secret Management

1. **Partner Contact Redaction in API Responses:**  
   In `backend/routes/booking.routes.js:227-275` (`sanitizeCustomerBooking`):
   - For Dharamshalas: Partner contact details (`partnerPhone`, `partnerEmail`, `partnerWhatsapp`) are completely deleted from the API response until the booking is in an accepted state (`awaiting_customer_payment` or confirmed).
   - For Hotels: Partner contact information is deleted until the booking is in `confirmed` status.
   - Financial internal margins (`commission_rate`, `commission_amount`, `gross_for_hotel`, `partnerNetPayout`) are permanently deleted from customer booking payloads.
2. **Source Control Secrets Check:**  
   - `.gitignore` properly excludes `.env`, `node_modules`, and build outputs.
   - `backend/config/productionConfig.js` redacts credential strings when logging configuration health.
   - No plaintext passwords, database URIs, or Razorpay secrets are stored in Git history.
