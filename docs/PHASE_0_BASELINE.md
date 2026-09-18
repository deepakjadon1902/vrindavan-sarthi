# Vrindavan Sarthi - Phase 0 Baseline And Dependency Map

Status: Phase 0 complete  
Scope: baseline architecture, dependency map, current risks, and next-phase boundaries  
Date: 2026-09-09

## Executive Baseline

Vrindavan Sarthi is a travel and hospitality marketplace for Braj services. The current application supports public browsing, user authentication, lodging bookings, cab booking requests, tours, products/orders, admin operations, and partner operations.

The strongest current foundation is the lodging inventory model:

```text
Partner
  -> one Hotel
     -> many RoomTypes
        -> many RoomUnits
           -> RoomUnitBookingDay reservation locks
           -> RoomUnitBlock manual blocks
```

The current one-partner-one-hotel business rule is implemented in `backend/routes/partner.routes.js` by rejecting a second `Hotel` for the authenticated partner.

## Technology Baseline

Frontend:

- React 18
- TypeScript
- Vite
- React Router
- Zustand
- TanStack Query
- Axios
- Tailwind CSS
- shadcn/Radix UI
- Framer Motion
- Vitest
- Playwright configuration

Backend:

- Node.js
- Express
- CommonJS JavaScript
- Mongoose
- MongoDB
- JWT
- bcryptjs
- multer
- Cloudinary SDK
- nodemailer
- compression
- CORS

Infrastructure and integrations confirmed from repository:

- Vercel frontend configuration in `frontend/vercel.json`
- Render backend rewrite target in `frontend/vercel.json`
- MongoDB via Mongoose
- Cloudinary optional image storage
- Razorpay server-side payment flow
- Resend or SMTP email
- SMS webhook or Twilio best-effort SMS
- Google OAuth

## Repository Map

```text
vrindavan-sarthi
  backend
    config
      db.js
      ensureIndexes.js
      seedAdmin.js
      seedTours.js
    middleware
      auth.js
      requestTiming.js
    models
      Booking.js
      Cab.js
      CabFare.js
      Hotel.js
      Order.js
      PartnerNotification.js
      Product.js
      Review.js
      RoomType.js
      RoomUnit.js
      RoomUnitBlock.js
      RoomUnitBookingDay.js
      Settings.js
      Tour.js
      User.js
    routes
      adminAnalytics.routes.js
      adminInventory.routes.js
      auth.routes.js
      booking.routes.js
      cab.routes.js
      cabFare.routes.js
      contact.routes.js
      hotel.routes.js
      inventory.routes.js
      order.routes.js
      partner.routes.js
      payment.routes.js
      product.routes.js
      review.routes.js
      roomType.routes.js
      seo.routes.js
      settings.routes.js
      tour.routes.js
      user.routes.js
    utils
      cloudinary.js
      customerMessages.js
      date.js
      email.js
      imageFields.js
      invoicePdf.js
      jobQueue.js
      publicImages.js
      sms.js
      waitlist.js
    server.js
  frontend
    public
    src
      components
      hooks
      lib
      pages
        admin
        partner
        user
      router
      store
      test
    vercel.json
    vite.config.ts
  scripts
  docker-compose.yml
```

## Runtime Dependency Map

```text
React pages
  -> Zustand stores / direct page API calls
  -> frontend/src/lib/api.ts
  -> /api proxy
  -> Express server.js
  -> route modules
  -> middleware/auth.js
  -> Mongoose models
  -> MongoDB
```

Payment and notification path:

```text
RoomType booking
  -> Booking
  -> RoomUnitBookingDay locks
  -> Razorpay order or manual UPI pending state
  -> Razorpay verify/webhook or partner/admin manual verification
  -> Booking paid/confirmed
  -> in-memory jobQueue
  -> email invoice / partner/admin notification
```

Partner ownership path:

```text
JWT user id
  -> User document
  -> role=partner and partnerStatus=approved
  -> Hotel.partnerId
  -> RoomType.partnerId
  -> RoomUnit.partnerId
  -> Booking.partnerId
```

## Core Domain Dependencies

Authentication:

- Backend source of truth: `User` plus JWT.
- Frontend cache: persisted Zustand store `vvs-auth`.
- Middleware: `protect` resolves authenticated user, `authorize` checks role and approved partner status.

Partner and hotel ownership:

- Partner hotel submission uses authenticated `req.user._id`.
- Partner inventory routes query with `partnerId: req.user._id`.
- Admin inventory routes intentionally use global access.

Inventory:

- Physical rooms are `RoomUnit`.
- Manual blocking is `RoomUnitBlock`.
- Online reservation locks are `RoomUnitBookingDay`.
- The unique `RoomUnitBookingDay` index on `{ roomUnitId, date }` prevents double-booking the same physical room for the same UTC date.

Booking:

- Main safe lodging flow is `POST /api/bookings/room-type`.
- Legacy/generic booking flow is `POST /api/bookings`.
- Customer, partner, and admin reads use separate query scopes.

Payment:

- Manual UPI requires partner verification before admin verification for partner bookings.
- Razorpay uses server-created order, signature verification, amount/currency check, optional capture, and webhook update.

Cancellation:

- Cancellation sets booking/order status to cancelled, calculates a 12 percent deduction, stores refundable amount, releases room locks for lodging bookings, and sends best-effort email.
- Actual provider refund execution was not found.

## Frontend Route Dependency Map

Public:

- `/`, `/hotels`, `/hotels/:id`, `/rooms`, `/room-types/:id`, `/cabs`, `/cabs/:id`, `/tours`, `/tours/:id`, `/shop`, `/shop/:id`, `/track-order`, static policy/contact pages.

Customer:

- `/profile`, `/bookings`, `/bookings/:id`, `/my-orders`.

Partner:

- `/partner`
- `/partner/hotels`
- `/partner/cabs`
- `/partner/inventory`
- `/partner/listings`
- `/partner/bookings`
- `/partner/payments`
- `/partner/bank-details`
- `/partner/terms`
- `/partner/profile-settings`
- `/partner/communications`

Admin:

- `/admin`
- `/admin/hotels`
- `/admin/inventory`
- `/admin/cabs`
- `/admin/cab-fares`
- `/admin/tours`
- `/admin/partners`
- `/admin/partner-requests`
- `/admin/bookings`
- `/admin/payments`
- `/admin/partner-payouts`
- `/admin/products`
- `/admin/orders`
- `/admin/users`
- `/admin/settings`

## Backend API Dependency Map

Auth and users:

- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/google`
- `/api/auth/google/callback`
- `/api/auth/me`
- `/api/auth/me/partner-verification`
- `/api/auth/forgot-password`
- `/api/auth/verify-reset-otp`
- `/api/auth/reset-password`
- `/api/users`
- `/api/users/admin-credentials`
- `/api/users/:id`
- `/api/users/:id/partner-status`

Lodging:

- `/api/hotels`
- `/api/hotels/all`
- `/api/hotels/:id`
- `/api/hotels/:id/room-types`
- `/api/room-types`
- `/api/room-types/:id`
- `/api/room-types/:id/room-availability`
- `/api/room-types/:id/calendar`

Bookings and payments:

- `/api/bookings/room-type`
- `/api/bookings/cab`
- `/api/bookings`
- `/api/bookings/my`
- `/api/bookings/partner`
- `/api/bookings/all`
- `/api/bookings/:id`
- `/api/bookings/:id/cancel`
- `/api/bookings/:id/verify`
- `/api/bookings/:id/reject`
- `/api/bookings/:id/status`
- `/api/bookings/:id/partner-check-in`
- `/api/bookings/:id/partner-verify`
- `/api/bookings/:id/partner-reject`
- `/api/payments/razorpay/orders`
- `/api/payments/razorpay/verify`
- `/api/payments/razorpay/fail`
- `/api/payments/razorpay/webhook`
- `/api/payments/all`
- `/api/payments/partner`

Partner:

- `/api/partner/hotels`
- `/api/partner/cabs`
- `/api/partner/my-listings`
- `/api/partner/requests`
- `/api/partner/hotels/:id/status`
- `/api/partner/cabs/:id/status`
- `/api/partner/bank-details`
- `/api/partner/payouts`
- `/api/partner/payouts/:partnerId/settled`
- `/api/partner/notices`
- `/api/partner/notifications`
- `/api/partner/admin-notifications`

Inventory:

- `/api/partner/inventory/hotels/:hotelId/room-types`
- `/api/partner/inventory/room-types/:roomTypeId`
- `/api/partner/inventory/room-types/:roomTypeId/rooms`
- `/api/partner/inventory/rooms/:roomUnitId`
- `/api/partner/inventory/rooms/:roomUnitId/calendar`
- `/api/partner/inventory/rooms/:roomUnitId/blocks`
- `/api/partner/inventory/room-types/:roomTypeId/blocks`
- `/api/partner/inventory/blocks/:blockId`
- Same admin inventory pattern under `/api/admin/inventory`, globally scoped.

Other commerce and content:

- `/api/cabs`
- `/api/cab-fares`
- `/api/tours`
- `/api/products`
- `/api/orders`
- `/api/reviews`
- `/api/settings`
- `/api/contact`
- `/api/seo`
- `/api/admin/analytics`

## Phase 1 Dependency Boundary

Phase 1 should focus on security and partner ownership hardening only.

Recommended Phase 1 target areas:

- Close or restrict the generic `POST /api/bookings` path for lodging bookings that should use inventory locks.
- Add missing backend authorization consistency around any route that accepts IDs from clients.
- Add focused regression tests for partner isolation and booking ownership.
- Add auth/rate-limit hardening around login, OTP, and critical payment routes.
- Preserve current one-partner-one-hotel behavior.

Do not implement in Phase 1:

- Channel manager models.
- eZee adapter.
- Multi-hotel partner support.
- Full reservation modification engine.
- Refund automation.

## Known Current Risks

P0:

- `POST /api/bookings` can create lodging-like bookings without the physical-room lock flow used by `POST /api/bookings/room-type`.

P1:

- Very limited automated tests.
- In-memory background jobs and webhook side effects are not durable.
- Partner tour UI calls routes not found in backend.
- No full reservation modification engine.

P2:

- Availability calculations differ between some hotel and room-type endpoints.
- Refunds are calculated/stored but payment-provider refund execution was not found.
- Pricing, cancellation, terms, image normalization, and inventory logic are duplicated across route files.

P3:

- JWT is persisted in browser local storage.
- No meaningful rate limiting was found.
- Security headers such as Helmet were not found.

## Regression Anchors

The following behavior should remain stable while Phase 1 begins:

- Public hotel/room browsing still works.
- Partner cannot access unapproved partner-only APIs.
- Approved partner can manage only own hotel inventory.
- Admin can manage all platform data.
- `POST /api/bookings/room-type` still creates room locks.
- Razorpay verification still marks booking paid/confirmed.
- Manual UPI partner/admin verification still works.
- Cancellation still releases room locks.
- Vercel `/api` and `/uploads` rewrites still target backend.

## Evidence

Confirmed from:

- `backend/server.js`
- `backend/middleware/auth.js`
- `backend/models/User.js`
- `backend/models/Hotel.js`
- `backend/models/RoomType.js`
- `backend/models/RoomUnit.js`
- `backend/models/RoomUnitBookingDay.js`
- `backend/models/RoomUnitBlock.js`
- `backend/models/Booking.js`
- `backend/models/Order.js`
- `backend/routes/auth.routes.js`
- `backend/routes/partner.routes.js`
- `backend/routes/inventory.routes.js`
- `backend/routes/adminInventory.routes.js`
- `backend/routes/booking.routes.js`
- `backend/routes/payment.routes.js`
- `backend/routes/hotel.routes.js`
- `frontend/src/App.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/store/bookingStore.ts`
- `frontend/vercel.json`
- `docker-compose.yml`

## Phase 0 Result

Phase 0 establishes the baseline and dependency map. No behavior changes were made. The next safe phase is Phase 1: security and partner ownership hardening.
