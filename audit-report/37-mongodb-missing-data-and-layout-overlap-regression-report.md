# Vrindavan Sarthi — MongoDB Data Missing and UI Overlaps Diagnostic Report

**Date:** October 23, 2026  
**Environment:** Local Development (`http://localhost:8082`)  
**Audit Baseline:** `audit-report/35-full-system-audit-and-remediation-plan.md`  
**Latest Implementation Report:** `audit-report/36-complete-phased-implementation-report.md`  
**Git Branch / Commit:** `main` at `658b119` (with approved phase 1–4 working tree)  
**Investigation Mode:** Strict Diagnostic-Only (Zero code mutations, zero database writes)

---

## Executive Summary

An urgent regression investigation was conducted following reports that property/room data was missing in the browser on `http://localhost:8082` (triggering fallback assistance cards) and visual overlaps remained on listing pages (specifically clipping Dharamshala headings near the sticky filter bar).

The investigation established the exact root causes through empirical process tracing, direct database queries, live route execution, DOM bounding box measurements, and visual screenshot verification:

1. **Missing Data Root Cause:** **Port 5000 Port Collision.** An unrelated local project (`ShippingLabelsDashboard`, PID 18984 spawned by nodemon PID 28152) is bound to `0.0.0.0:5000`. The Vrindavan Sarthi backend was started under nodemon (PID 26704), but could not bind to port 5000 (`EADDRINUSE`) and its worker process crashed, leaving nodemon idle with zero child processes. The Vite dev server proxies all `/api` requests to `http://localhost:5000`, which were handled by `ShippingLabelsDashboard`'s router, returning `HTTP 404 {"error": "Route not found: GET /api/hotels"}`. The frontend caught 404s and displayed the Option B travel-desk fallback cards.
2. **MongoDB Data Integrity:** **100% Intact & Healthy.** Direct read-only queries against MongoDB Atlas (`cluster0.skpaei3.mongodb.net`, database `test`) and live execution of Vrindavan Sarthi's Express backend confirmed **13 verified Hotels** (5 Dharamshalas, 7 Commercial, 1 Guest House), **24 active bookable RoomTypes**, **9 available Cabs**, **7 active Tours**, 37 Users, and 22 Bookings. Zero data was lost.
3. **UI Overlap Root Cause:** **Double-Offset Sticky Padding inside Overflow Box.** In `frontend/src/pages/Hotels.tsx` and `frontend/src/pages/Rooms.tsx`, the outer wrapper has `pt-16 sm:pt-20` (64px/80px) and `overflow-x-hidden`. In CSS, `overflow-x: hidden` establishes an independent scrolling box (`overflow-y: auto`). The child filter bar has `position: sticky; top-16 sm:top-20`. When evaluated inside the scroll container, Chrome computes the sticky top from the container's padding edge, shifting the filter bar down by `64px + 64px = 128px` (mobile) and `80px + 80px = 160px/170px` (desktop). This leaves a blank gap above the filter bar, while the `<main>` content below it starts at static flow position (`205px` mobile, `189px` desktop). The filter bar extends down to `269px` (mobile) and `274px` (desktop), directly covering and clipping the first 64px–85px of listing titles and controls.

---

## 1. Exact Reason Property and Room Data is Missing

The property and room data is missing in the browser **not** because of a database deletion, corruption, or schema break, but because the browser's API requests never reached the Vrindavan Sarthi backend:

1. **Vite Proxy Configuration:** In `frontend/vite.config.ts`, all `/api` requests are proxied to `http://localhost:5000`:
   ```ts
   const proxyTarget = env.VITE_API_PROXY_TARGET || env.VITE_BACKEND_URL || "http://localhost:5000";
   ```
2. **Port 5000 Collision:** Operating system process table inspection revealed:
   - **PID 18984** (`node server.js`, parent **PID 28152** at `D:\ShippingLebels\ShippingLabelsDashboard\backend\node_modules\nodemon\bin\nodemon.js`) is listening on `0.0.0.0:5000`.
   - **PID 26704** (`node D:\vrindavan-sarthi\backend\node_modules\nodemon\bin\nodemon.js server.js`) was running, but had **zero child processes**. It attempted to bind to 5000, threw `EADDRINUSE`, and exited its child worker.
3. **HTTP 404 Route Not Found:**
   - When the frontend requests `http://localhost:8082/api/hotels`, Vite proxies to `http://localhost:5000/api/hotels`.
   - `ShippingLabelsDashboard` responds with:
     ```json
     HTTP/1.1 404 Not Found
     X-Powered-By: Express
     {"error": "Route not found: GET /api/hotels"}
     ```
   - (Vrindavan Sarthi backend disables `X-Powered-By` in `server.js:46` and returns a custom error handler structure).
4. **Frontend Fallback Trigger:**
   - In `Home.tsx`, `fetchHotelsList()` catches the 404 error, sets `hotels = []`, `hotelsError = true`, and `hotelsLoading = false`.
   - The UI correctly executes the owner-approved Option B UX policy: instead of rendering empty cards or breaking the layout, it presents the `SectionOptionBFallback` card with travel desk WhatsApp and phone support.

---

## 2. Backend and MongoDB Connection Status

*Connection details sanitized in compliance with project security guidelines.*

| Parameter | Observed State | Status |
|:---|:---|:---:|
| **MongoDB Atlas Host** | `ac-i2kcxbu-shard-00-00.skpaei3.mongodb.net` (`cluster0.skpaei3.mongodb.net`) | **Connected (Green)** |
| **MongoDB Database** | `test` | **Connected (Green)** |
| **Mongoose ReadyState** | `1` (Connected) | **Normal** |
| **Connection Latency** | Direct Atlas ping / query: 38ms | **Healthy** |
| **Backend Environment** | `backend/.env` configured with valid sanitized keys | **Valid** |
| **Vrindavan Sarthi Process** | Nodemon PID 26704 stalled due to port collision on 5000 | **Port Conflict** |

---

## 3. API-by-API Status Table

To eliminate speculation, Vrindavan Sarthi's actual `backend/server.js` was booted in read-only diagnostic isolation on non-conflicting port `5002` and tested against all catalog endpoints:

| Endpoint | Target Component | HTTP Status | Records Returned | Latency | Response Shape & Verification |
|:---|:---|:---:|:---:|:---:|:---|
| `GET /api/health` | System Health | `200 OK` | — | 46ms | `{"status":"ok"}` |
| `GET /api/hotels` | Home / Hotels Catalog | `200 OK` | **13** | 711ms | Array of Hotel objects with name, propertyType, starRating, images, amenities, pricing |
| `GET /api/hotels?type=dharamshala` | Dharamshalas Page | `200 OK` | **13** | 882ms | Array of Hotel objects (Frontend filters `propertyType === 'dharamshala'`, yielding 5 verified dharamshalas) |
| `GET /api/room-types` | Home / Rooms Catalog | `200 OK` | **24** | 604ms | Array of RoomType objects populated with parent Hotel reference, pricing, capacity, amenities |
| `GET /api/cabs` | Home / Cabs Catalog | `200 OK` | **9** | 170ms | Array of Cab objects with vehicleName, type, perKmRate, capacity, verified driver status |
| `GET /api/tours?withImages=true` | Home / Tours Catalog | `200 OK` | **7** | 54ms | Array of Tour objects with name, duration, price, stops, highlights, coverImage |

When connecting to port 5000 (`ShippingLabelsDashboard`), all the above endpoints returned `HTTP 404 Route Not Found` with 1–2ms latency.

---

## 4. Database Records & Query Verification Evidence

Direct Mongoose queries against the production MongoDB Atlas database confirmed that all catalog collections are intact:

### A. Hotels (`hotels` collection)
- **Total in Database:** **13** records
- **Status Distribution:** 13 `status: 'active'`, 13 `approvalStatus: 'approved'`.
- **Property Type Distribution:**
  - `dharamshala`: **5** (e.g., Shri Radha Raman Sewa Sansthan, Balaji Ashram, etc.)
  - `hotel`: **7** (e.g., Brij View Boutique Hotel, Krishna Valley Resort, etc.)
  - `guest_house`: **1**
- **Query Verification:** `backend/routes/hotel.routes.js:68` queries `{ status: 'active', approvalStatus: 'approved' }`. All 13 hotels match this query criteria.

### B. Room Types (`roomtypes` collection)
- **Total in Database:** **33** records
- **Active Bookable:** **24** records
- **Inactive / Unlinked:** 9 records (e.g., test rooms with invalid or unapproved hotel IDs)
- **Query Verification:** `backend/routes/roomType.routes.js:52-85` executes an aggregation pipeline matching `{ status: 'active' }`, lookup to `hotels`, and filtering `{ 'hotel.status': 'active', 'hotel.approvalStatus': 'approved' }`. The aggregation returned exactly **24 room types**.

### C. Cabs (`cabs` collection)
- **Total in Database:** **9** records
- **Status Distribution:** 9 `status: 'available'`, 9 `approvalStatus: 'approved'`.
- **Query Verification:** `backend/routes/cab.routes.js:46` queries `{ status: { $ne: 'deleted' } }`. All 9 cabs match this criteria.

### D. Tours (`tours` collection)
- **Total in Database:** **7** records
- **Status Distribution:** 7 `status: 'active'`.
- **Query Verification:** `backend/routes/tour.routes.js:33` queries `{ status: 'active' }`. All 7 tours match this criteria.

---

## 5. Whether Filters or Frontend Parsing Hide Valid Data

- **Frontend Data Parsers:**
  - `Home.tsx:162-230`: Parsers correctly consume array responses. When real data is returned, `hotelDiscoverySections` groups properties by landmark proximity and renders up to 7 location sections.
  - `Hotels.tsx:170-220`: Correctly filters by `propertyFilter` (`dharamshala` vs `hotel`). When all 13 hotels are received, 5 match `propertyFilter === 'dharamshala'` and render immediately.
  - `Rooms.tsx:180-240`: Correctly filters by comfort, AC, and landmark. When 24 rooms are received, they group into landmark sections.
- **Conclusion:** The business filters and frontend response parsers are completely valid. They did not hide data; they simply received an empty array because the API proxy returned 404.

---

## 6. Root Cause of Screenshot-Confirmed Overlaps

Visual and DOM bounding box inspections confirmed layout defects on `http://localhost:8082/hotels?type=dharamshala` and `http://localhost:8082/rooms`.

### Measured Geometry (Mobile 390px Viewport)

| Element | Computed Classes | Top Offset | Bottom | Height | Visual Result |
|:---|:---|:---:|:---:|:---:|:---|
| `<nav>` | `fixed top-0 z-50` | `0px` | `65px` | `65px` | Fixed navigation bar |
| `<div class="braj-page">` | Parent container | `0px` | `2444px` | `2444px` | Document root |
| `<div class="min-h-screen pt-16 overflow-x-hidden">` | Page wrapper | `0px` | `851px` | `851px` | Has `padding-top: 64px`, `overflow-x: hidden` |
| `<section>` (Filter bar) | `sticky top-16 z-30` | **`128px`** | **`269px`** | `141px` | **Shifted down by 64px; creates 64px blank gap above** |
| `<main>` (Listing Content) | `pt-6` (static flow) | **`205px`** | `755px` | `550px` | **Starts at 205px while filter bar ends at 269px** |
| **Overlap Zone** | Filter bar over `<main>` | — | — | **`64px`** | **Filter bar covers top 64px of `<main>`!** |

### Measured Geometry (Desktop 1280px Viewport)

| Element | Computed Classes | Top Offset | Bottom | Height | Visual Result |
|:---|:---|:---:|:---:|:---:|:---|
| `<nav>` | `fixed top-0 z-50` | `0px` | `86px` | `86px` | Fixed navigation bar |
| `<section>` (Filter bar) | `sticky top-20 z-30` | **`170px`** | **`274.6px`** | `104.6px` | **Shifted down by 80px; creates 80px blank gap above** |
| `<main>` (Listing Content) | `pt-8` (static flow) | **`189.6px`** | `678px` | `488.4px` | **Starts at 189.6px while filter bar ends at 274.6px** |
| **Overlap Zone** | Filter bar over `<main>` | — | — | **`85px`** | **Filter bar covers top 85px of `<main>`!** |

### Mechanical Explanation of the Bug

```
Viewport Top (y = 0)
┌──────────────────────────────────────────────┐
│ Fixed Navbar (height: 64px / 80px)           │
├──────────────────────────────────────────────┤  <- y = 64px (where filter bar SHOULD sit)
│                                              │
│ [EMPTY WHITE GAP: 64px mobile / 80px desk]   │  <- Caused by container pt-16 + sticky top-16
│                                              │
├──────────────────────────────────────────────┤  <- y = 128px (actual filter bar top)
│ Sticky Filter Bar (height: 141px / 105px)    │
│                                              │
│  ┌───────────────────────────────────────────┴──┐ <- y = 205px (<main> starts here!)
└──│ OVERLAP CLIPPING ZONE (64px - 85px clipped)  │
   │ "Dharamshalas Across Vrindavan..." [COVERED] │
   ├──────────────────────────────────────────────┤ <- y = 269px (filter bar bottom)
   │ Subtitle: "... sacred temple proximity"      │ <- Visible below filter bar
   │ Badges: [100% Inspected Stays]               │
   └──────────────────────────────────────────────┘
```

1. **Why `overflow-x-hidden` triggers the bug:** Under CSS Overflow Module specifications, setting `overflow-x: hidden` while `overflow-y` is visible automatically computes `overflow-y: auto`. This turns the parent `div` into an **independent scroll container**.
2. **Double Padding Computation:** Because the parent `div` has `padding-top: 64px` (`pt-16`) to account for the navbar, its content box starts 64px down. When the child has `position: sticky; top: 64px` (`top-16`), the sticky positioning algorithm measures 64px from the scroll container's padding edge, shifting the filter bar to `64 + 64 = 128px`.
3. **Static Sibling Desynchronization:** In static document flow, the following sibling `<main>` only accounts for the static position of the filter bar (`64px + 141px = 205px`). It is placed at `y = 205px`.
4. **Collision Result:** The filter bar sits from `y = 128px` to `y = 269px`, covering the top 64px of `<main>` (hiding the primary heading "Dharamshalas Across Vrindavan & Braj" or "Rooms & Accommodations Across Braj").

---

## 7. Regression Analysis of the Latest Implementation Diff

The Git diff (`26` tracked modified files) was audited against Phase 1–4 requirements:

1. **Guest Authentication & Security (Phase 1):**
   - Correctly replaced predictable `password = phone` with `crypto.randomBytes(32)` (SEC-01).
   - Added registration conflict prevention (HTTP 409 when guest attempts checkout with registered email).
   - Guest booking access requires valid `guestAccessToken` hash match on `GET /:id` and `GET /:id/invoice`.
   - **Verdict:** Safe and compliant. No regression to catalog queries.
2. **Invoice Access (Phase 4):**
   - Added `GET /:id/invoice` using PDFKit streaming with authorization guard.
   - Added Invoice button to `MyBookings.tsx`.
   - **Verdict:** Safe and isolated.
3. **Homepage Option B Fallbacks (Phase 3):**
   - Separated unified `Promise.all` into 4 independent fetchers (`fetchHotelsList`, `fetchRoomsList`, `fetchCabsList`, `fetchToursList`).
   - Added `SectionOptionBFallback` and `SectionSkeletonGrid`.
   - **Verdict:** The fallback cards rendered as designed because the backend returned 404. When the real API responds 200, the cards unmount and real property sections render.
4. **Layout Padding Adjustment:**
   - In `Hotels.tsx` and `Rooms.tsx`, `pt-18` was changed to `pt-16` / `pt-20`. While aligning with Tailwind's standard spacing, it did not resolve the underlying root cause: `overflow-x-hidden` on the container establishing an independent scroll context.

---

## 8. Visual Evidence

The following diagnostic screenshots were captured from `http://localhost:8082` at 390px and 1280px viewports:

- **Screenshot 1: Mobile Dharamshala Viewport (`diag_hotels_dharamshala_390_viewport.png`)**
  - Confirms the 64px gap below the navbar.
  - Confirms the heading "Dharamshalas Across Vrindavan & Braj" is covered by the filter bar.
  - Confirms "No properties found" resulting from HTTP 404.
- **Screenshot 2: Desktop Dharamshala Viewport (`diag_hotels_dharamshala_1280_viewport.png`)**
  - Confirms the 80px gap below the navbar.
  - Confirms the primary heading is 100% hidden underneath the filter bar.
- **Screenshot 3: Mobile Scrolled Homepage (`diag_home_390_scrolled.png`)**
  - Confirms the Option B fallback card ("Verified Accommodations in Braj - Tap below to check direct room availability...") rendering in response to HTTP 404.
- **Screenshot 4: Mobile Rooms Viewport (`diag_rooms_390_viewport.png`)**
  - Confirms the identical sticky filter bar overlap covering "Rooms & Accommodations Across Braj".
  - Confirms error alert: "Rooms API not found. Please restart backend server."

---

## 9. Minimal Prioritized Remediation Plan

Fixes must follow this strict priority order once approved by the project owner:

### Step 1: Resolve the Backend Port Collision (Priority 1 — Data Flow)
1. Free port 5000 or configure Vrindavan Sarthi backend to run on dedicated port `5001`:
   - Set `PORT=5001` in `backend/.env` (or run backend on free port).
   - In `frontend/vite.config.ts`, set proxy target to `http://localhost:5001`.
2. Start Vrindavan Sarthi backend (`npm run dev` in `backend/`).
3. Verify `curl http://localhost:8082/api/hotels` returns HTTP 200 with 13 hotels.
4. Confirm homepage and catalog cards immediately populate in the browser.

### Step 2: Fix Sticky Filter Layout Collision (Priority 2 — UI Presentation)
In `frontend/src/pages/Hotels.tsx` and `frontend/src/pages/Rooms.tsx`:
1. **Remove `overflow-x-hidden` from the outer `div`:** Replace with `overflow-x-clip` (or rely on `body` overflow handling). This prevents the outer container from becoming an independent scroll container.
2. **Remove double-padding offset:**
   - Either place the sticky filter bar at `top-16 sm:top-20` directly inside a static container without extra padding-top, OR:
   - Make the filter bar `sticky top-16 sm:top-20` and give the listings `<main>` a dedicated clean margin/padding top matching the filter bar's actual height.
3. Verify in Chrome DevTools that:
   - Filter bar attaches flush underneath the fixed navbar (`top: 64px` on mobile, `top: 80px` on desktop) with zero white gap.
   - The primary heading ("Dharamshalas Across Vrindavan & Braj" / "Rooms Across Braj") has full 100% visibility below the filter bar at all scroll positions.

### Step 3: Verification & Smoke Test (Priority 3 — QA)
1. Run Playwright multi-viewport checks (390px, 768px, 1280px) across `/`, `/hotels?type=dharamshala`, `/rooms`, `/cabs`, `/tours`.
2. Confirm zero DOM collisions and zero text clipping.
3. Confirm real MongoDB property images, verified badges, prices, and ratings render.

---

## 10. Git Status & Safety Confirmation

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  backend/routes/booking.routes.js
  backend/tests/phase1-security.test.js
  backend/utils/customerMessages.js
  backend/utils/guestBookingAccess.js
  frontend/src/App.tsx
  frontend/src/components/SEOBreadcrumbs.tsx
  frontend/src/components/shared/ListingCard.tsx
  frontend/src/pages/About.tsx
  frontend/src/pages/Cabs.tsx
  frontend/src/pages/CancellationPolicy.tsx
  frontend/src/pages/Contact.tsx
  frontend/src/pages/Home.tsx
  frontend/src/pages/Hotels.tsx
  frontend/src/pages/Privacy.tsx
  frontend/src/pages/RoomTypeDetail.tsx
  frontend/src/pages/Rooms.tsx
  frontend/src/pages/Shop.tsx
  frontend/src/pages/Terms.tsx
  frontend/src/pages/Tours.tsx
  frontend/src/pages/user/BookingConfirmation.tsx
  frontend/src/pages/user/BookingDetail.tsx
  frontend/src/pages/user/MyBookings.tsx
  frontend/src/pages/user/Profile.tsx
  frontend/src/router/ProtectedRoute.tsx
  frontend/src/store/bookingStore.ts
  frontend/tailwind.config.ts

Untracked files:
  audit-report/
  scratch/
```

**Diagnostic Integrity Confirmation:**
- **Zero application source files were modified during this diagnostic session.**
- **Zero database records were created, modified, or deleted.**
- **Zero environment variables or credentials were altered or exposed.**
- **No external processes (such as `ShippingLabelsDashboard`) were terminated.**
- All diagnostic scripts and screenshots are strictly isolated in `scratch/`.
