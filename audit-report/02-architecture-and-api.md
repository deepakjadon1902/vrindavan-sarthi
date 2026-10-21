# Vrindavan Sarthi — Architecture & API Inventory Audit

**Document ID:** `VRS-AUDIT-02-ARCH-API`  
**Audit Date:** October 17, 2026  
**Auditor:** Senior Software Architect & Full-Stack Engineer  

---

## 1. System Architecture Map

The Vrindavan Sarthi platform follows a decoupled multi-tier architecture spanning cloud edge routing, an Express API gateway, asynchronous BullMQ workers, MongoDB Atlas database, and native mobile notification listeners.

```mermaid
graph TB
    subgraph Client Layer
        WebUser[Web Guest / Customer<br/>Desktop & Mobile Browser]
        WebPartner[Property Partner<br/>Hotel / Dharamshala Manager]
        WebAdmin[Platform Admin<br/>Operations Dashboard]
        AndroidApp[Partner Android Companion<br/>Native Alarm & FCM Receiver]
    end

    subgraph Edge & Hosting Layer (Vercel)
        VercelEdge[Vercel CDN Edge<br/>HTTPS / Static Assets / SPA Router]
        VercelRewrite[Vercel Route Rewrite<br/>/api/* & /uploads/*]
    end

    subgraph Application Layer (Render)
        RenderAPI[Node.js + Express 4.21 API<br/>https://vrindavan-sarthi-gla3.onrender.com]
        RenderWorker[Node.js Background Worker<br/>BullMQ Queue Processors]
    end

    subgraph Data & Persistence Layer
        MongoDB[(MongoDB 7 Atlas Cluster<br/>Primary Datastore + Unique Lock Indexes)]
        Redis[(Redis 7 Cache & BullMQ Store<br/>Webhook Inbox / Refund / Expiration Queues)]
    end

    subgraph External Cloud Services
        RazorpayGateway[Razorpay Payment Gateway<br/>Orders, Webhooks, Signature Verification]
        CloudinaryCDN[Cloudinary Storage<br/>Hotel & Room Photo CDN]
        FirebaseFCM[Google Firebase FCM<br/>Partner Push Notifications]
        EmailSMS[Resend / SMTP / Twilio<br/>Transactional Email & SMS]
        EzeeChannel[eZee Channel Manager<br/>Gated / Staged PMS Integration]
    end

    WebUser -->|HTTPS| VercelEdge
    WebPartner -->|HTTPS| VercelEdge
    WebAdmin -->|HTTPS| VercelEdge
    AndroidApp -->|Direct API / HTTPS| RenderAPI
    FirebaseFCM -->|Push Wakeup| AndroidApp

    VercelEdge -->|SPA Static Bundle| WebUser
    VercelRewrite -->|Proxied /api/* Requests| RenderAPI

    RenderAPI -->|Mongoose ODM| MongoDB
    RenderAPI -->|Job Enqueue| Redis
    RenderWorker -->|Job Dequeue & Locks| Redis
    RenderWorker -->|State Mutex / Updates| MongoDB

    RenderAPI -->|Create Order / Verify| RazorpayGateway
    RazorpayGateway -->|Inbound Webhook| RenderAPI
    RenderAPI -->|Asset Upload| CloudinaryCDN
    RenderWorker -->|FCM Push Payload| FirebaseFCM
    RenderWorker -->|Transactional Mail| EmailSMS
    RenderWorker -.->|Gated Outbound Sync| EzeeChannel
```

---

## 2. Component Boundaries & Technologies

| Layer | Technology | Hosting / Environment | Verified Configuration |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | React 18.3.1, TypeScript 5.8, Vite 5.4, Tailwind CSS, TanStack Query 5.83, Zustand 5.0 | Vercel Edge | Configured via `frontend/vercel.json` with `/api/*` rewrites to Render. |
| **Backend API** | Node.js 18+, Express 4.21, Mongoose 8.7, Multer, compression, CORS | Render Web Service | Runs `node server.js`. Enforces NoSQL sanitization and route rate limits. |
| **Background Worker** | Node.js, BullMQ 6.3, Redis client 6.2 | Render Background Worker | Runs `node worker.js`. Processes webhooks, refunds, expirations, and notifications. |
| **Database** | MongoDB 7.0 (MongoDB Atlas) | Managed Atlas Cluster | Stores 29 Mongoose schemas. Enforces compound unique indexes for inventory locking. |
| **Queue / Cache** | Redis 7.0 | Managed Redis (Upstash / Redis Cloud) | Backing store for BullMQ; partitioned by `BULLMQ_PREFIX`. |
| **Media Storage** | Cloudinary v2 SDK | Cloudinary Cloud | Stores hotel, room, and setting images. Falls back to local `/uploads` if disabled. |
| **Mobile Companion** | Android Native (Java), Min SDK 26, Target SDK 34 | Android App Bundle | Companion app (`in.vrindavansarthi.alarm`) listening for FCM partner alarms. |

---

## 3. Comprehensive API Route Inventory

The backend exposes **23 route controllers** registered in `backend/server.js`. The table below documents every route, authorization requirement, purpose, and audit assessment:

### A. Authentication & User Management (`/api/auth`, `/api/users`)
| Method | Route | Auth / Role | Input Summary | Purpose & Connected Service | Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Name, email, phone, password, role (`user`/`partner`), documents | Registers customer or property partner. | **PASS:** Role escalation prevented; admin role cannot be self-assigned. |
| `POST` | `/api/auth/login` | Public | Email/phone, password | Issues signed JWT token (7d expiry). | **PASS:** Protected by `authRateLimiter`. |
| `GET` | `/api/auth/me` | Bearer Token | None | Returns profile of authenticated user. | **PASS:** Masks password; sanitizes internal fields. |
| `PUT` | `/api/auth/me` | Bearer Token | Profile update payload | Updates name, phone, address, profile photo. | **PASS:** Role and partner status cannot be self-mutated. |
| `POST` | `/api/auth/forgot-password` | Public | Email address | Sends 6-digit password reset OTP. | **WARN:** If SMTP/Resend is not configured, logs OTP to console and returns success. |
| `POST` | `/api/auth/verify-reset-otp` | Public | Email, OTP code | Validates reset OTP with attempt limits. | **PASS:** Protected by attempt tracking and rate limiting. |
| `POST` | `/api/auth/reset-password` | Public | Email, OTP code, new password | Resets user password using verified OTP. | **PASS:** Hashes new password with bcrypt (12 rounds). |
| `GET` | `/api/auth/google` | Public | OAuth query params | Initiates Google OAuth redirection. | **PASS:** Validates state payload and redirect URL. |
| `GET` | `/api/auth/google/callback` | Public | Code, state | Completes Google OAuth verification. | **PASS:** Validates Google ID token audience server-side. |
| `GET` | `/api/users` | Admin | Query filters, pagination | Lists registered platform users. | **PASS:** Admin-only access verified. |
| `PUT` | `/api/users/:id/role` | Admin | Target role | Updates user role (admin/partner/user). | **PASS:** Admin authorization strictly enforced. |

---

### B. Hotel & Room Inventory Management (`/api/hotels`, `/api/room-types`, `/api/partner/inventory`, `/api/admin/inventory`)
| Method | Route | Auth / Role | Input Summary | Purpose & Connected Service | Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/hotels` | Public | Filters: location, type, query | Lists active, approved hotels & dharamshalas. | **PASS:** Only returns active, approved properties to public. |
| `GET` | `/api/hotels/:id` | Public | Hotel Mongo ID | Returns property details, rules, and images. | **PASS:** Validates ObjectId format to prevent cast errors. |
| `POST` | `/api/hotels` | Admin / Partner | Property details, amenities, map | Creates a new hotel or dharamshala listing. | **PASS:** Partners are restricted to one hotel per account. |
| `PUT` | `/api/hotels/:id` | Admin / Partner | Property updates, policies | Updates listing data and property terms. | **PASS:** Enforces partner ownership checks. |
| `GET` | `/api/room-types` | Public | `hotelId` query param | Lists bookable room categories for a hotel. | **PASS:** Returns occupancy limits and pricing. |
| `POST` | `/api/room-types` | Admin / Partner | Room details, base price, max adults | Adds room category under property. | **PASS:** Scoped to partner's approved hotel. |
| `GET` | `/api/partner/inventory/calendar` | Partner | `hotelId`, `month`, `year` | Returns date-wise room availability matrix. | **PASS:** Accurately reflects locked dates and blocks. |
| `POST` | `/api/partner/inventory/blocks` | Partner | `roomUnitId`, `startDate`, `endDate` | Manually blocks room dates for maintenance. | **PASS:** Prevents overlapping block conflicts. |
| `DELETE` | `/api/partner/inventory/blocks/:id` | Partner | Block Mongo ID | Removes maintenance block, restoring rooms. | **PASS:** Verified partner ownership validation. |

---

### C. Booking Engine & Reservation Lifecycle (`/api/bookings`)
| Method | Route | Auth / Role | Input Summary | Purpose & Connected Service | Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings/room-type` | Optional Auth / Guest | `hotelId`, `roomTypeId`, dates, guests, contact | Primary entry point for lodging bookings. | **IMPORTANT:** Submits booking as `pending_property_confirmation`. |
| `GET` | `/api/bookings/my` | Bearer Token | Pagination params | Returns authenticated user's bookings. | **PASS:** Scoped strictly to `userId: req.user._id`. |
| `GET` | `/api/bookings/:id` | Customer / Partner / Admin | Booking Mongo ID, access token | Fetches full booking details and voucher. | **PASS:** `sanitizeCustomerBooking` strips partner phone until confirmed. |
| `PUT` | `/api/bookings/:id/dharamshala/accept` | Admin / Partner | `paymentMode` (`pay_at_dharamshala`/`full_online`) | Accepts room request and locks `RoomUnitBookingDay`. | **PASS:** Locks inventory and transitions status. |
| `PUT` | `/api/bookings/:id/dharamshala/reject` | Admin / Partner | `reason` | Rejects booking request and releases holds. | **PASS:** Status transitions to `rejected_by_property`. |
| `PUT` | `/api/bookings/:id/cancel` | Customer / Admin | `reason`, `details` | Cancels confirmed booking; computes refund. | **PASS:** Enforces 12% deduction policy and creates `RefundOperation`. |
| `POST` | `/api/bookings/cab` | Authenticated User | Route, pickup time, vehicle, UPI ID | Submits cab reservation request. | **PASS:** Requires UPI transaction ID; desk-assisted. |

---

### D. Payments, Razorpay & Settlements (`/api/payments`, `/api/payment`, `/api/partner/payouts`)
| Method | Route | Auth / Role | Input Summary | Purpose & Connected Service | Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/razorpay/orders` | Optional Auth / Guest | `bookingId`, guest access token | Creates Razorpay order for payable amount. | **PASS:** Re-computes payable amount server-side; blocks client price tampering. |
| `POST` | `/api/payments/razorpay/verify` | Optional Auth / Guest | Razorpay order ID, payment ID, signature | Verifies HMAC signature and captures payment. | **PASS:** Verifies signature and server-side capture status before confirmation. |
| `POST` | `/api/payments/razorpay/fail` | Optional Auth / Guest | `bookingId`, payment ID, status | Records failed or dismissed payment attempt. | **PASS:** Idempotently records failure state. |
| `POST` | `/api/payments/razorpay/webhook` | Public (Signed) | Razorpay webhook payload | Asynchronous payment capture/refund inbox. | **PASS:** Verifies `x-razorpay-signature` and records durable MongoDB inbox event. |
| `GET` | `/api/partner/payouts` | Admin | None | Generates partner settlement ledger. | **CRITICAL BUG (P0):** Formula omits deducting `balanceAtProperty` collected by hotel. |
| `PUT` | `/api/partner/payouts/:id/settled` | Admin | `isPaid: true`, note | Marks partner ledger as settled. | **WARN:** Enforces Monday/Wednesday cycle check; uses buggy payout sum. |

---

### E. Channel Manager, Cabs, Tours, Settings & Operational Routes
| Method | Route | Auth / Role | Input Summary | Purpose & Connected Service | Audit Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/channel/webhooks/:provider` | Public (Signed) | Inbound OTA event payload | Ingests channel manager booking/mod events. | **PASS:** Gated by `CHANNEL_WEBHOOK_SECRET`. |
| `GET` | `/api/channel/mappings` | Admin / Partner | Query filters | Lists room-type mappings to OTA channels. | **PASS:** Scoped to partner's properties. |
| `GET` | `/api/channel/providers/ezee/health` | Admin / Partner | `hotelId` | Checks connectivity to eZee PMS. | **PASS:** Correctly reports contract disabled until credentials provided. |
| `GET` | `/api/cabs` | Public | None | Lists available cab fleet. | **PASS:** Verified working. |
| `GET` | `/api/cab-fares` | Public | None | Lists active route fares. | **PASS:** Verified working. |
| `GET` | `/api/tours` | Public | None | Lists curated tour packages. | **PASS:** Verified working. |
| `GET` | `/api/settings` | Public | None | Fetches site settings (title, flags, contact). | **PASS:** Verified working; masks internal credentials. |
| `PUT` | `/api/settings` | Admin | Setting fields | Updates site configuration and tax defaults. | **PASS:** Admin-only authorization enforced. |
| `GET` | `/api/health` | Public | None | Lightweight liveness probe. | **PASS:** Returns `{"status":"ok"}` in <20ms. |
| `GET` | `/api/readiness` | Public | None | Deep readiness probe checking MongoDB/Redis. | **PASS:** Returns `200` when DB ready, `503` during disconnection. |
