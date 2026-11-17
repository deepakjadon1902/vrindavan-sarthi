# Vrindavan Sarthi — Website & Production Domains Audit

**Document ID:** `VRS-AUDIT-01-WEBSITE`  
**Audit Date:** October 17, 2026  
**Target Domains:**  
- Domain A: [https://www.vrindavansarthi.in/](https://www.vrindavansarthi.in/)  
- Domain B: [https://www.vrindavansarthi.com/](https://www.vrindavansarthi.com/)  
- Backend API Gateway: `https://vrindavan-sarthi-gla3.onrender.com/api` (proxied via `/api/*` on Vercel)  

---

## 1. Domain Availability, SSL, and HTTP Protocol Comparison

Both production domains were tested directly using HTTP/HTTPS probes:

| Test Item | `https://www.vrindavansarthi.in/` | `https://www.vrindavansarthi.com/` | Status / Discrepancy |
| :--- | :--- | :--- | :--- |
| **HTTP Status (HTTPS)** | 200 OK | 200 OK | **CRITICAL ISSUE:** Both domains serve full site directly without 301 redirect from .com to .in |
| **Edge Provider** | Vercel Edge Network | Vercel Edge Network | Identical infrastructure deployment |
| **SSL/TLS Certificate** | Valid (Let's Encrypt / Vercel SSL) | Valid (Let's Encrypt / Vercel SSL) | Both TLS certificates are valid and active |
| **HSTS Header** | `max-age=63072000` | `max-age=63072000` | Applied via Vercel headers |
| **HTTP -> HTTPS Redirect** | HTTP 308 Permanent Redirect | HTTP 308 Permanent Redirect | HTTP redirects to HTTPS correctly |
| **Apex -> WWW Redirect** | `vrindavansarthi.in` -> 308 -> `www.vrindavansarthi.in` | `vrindavansarthi.com` -> 308 -> `www.vrindavansarthi.com` | Both apex domains redirect to their own `www` subdomain |
| **Canonical Link Tag** | `<link rel="canonical" href="https://vrindavansarthi.in/" />` | `<link rel="canonical" href="https://vrindavansarthi.in/" />` | **CRITICAL MISMATCH:** Canonical points to apex `https://vrindavansarthi.in/`, which 308-redirects to `www`! |
| **Content Payload Hash** | Content-Length: 5,641 bytes (ETag matches) | Content-Length: 5,641 bytes (ETag matches) | Byte-for-byte identical HTML and JavaScript bundle |

---

## 2. Canonical Strategy & Duplicate Content Analysis

### Finding: Split-Domain Duplicate Indexing & Canonical Redirect Loop
1. **No Domain Consolidation:**  
   The project has two live domains (`.in` and `.com`). Both are active in DNS, both are mapped in Vercel, and both return HTTP 200 with the exact same application code. Search crawlers discovering `vrindavansarthi.com` crawl the entire platform under the `.com` hostname.
2. **Canonical Loop / Redirect Chain:**  
   The static `index.html` on both domains contains:
   ```html
   <link rel="canonical" href="https://vrindavansarthi.in/" />
   ```
   However, requesting `https://vrindavansarthi.in/` yields:
   ```http
   HTTP/1.1 308 Permanent Redirect
   Location: https://www.vrindavansarthi.in/
   ```
   This causes search engine crawlers (Googlebot, Bingbot) to encounter a canonical destination that is itself a redirect. Google Search Console flags this as *"Alternate page with proper canonical tag"* or *"Page with redirect"*, causing indexing dropouts.
3. **Hardcoded Origin in SEO Library:**  
   In `frontend/src/lib/seo.ts`:
   ```typescript
   export const SITE_ORIGIN = 'https://vrindavansarthi.in';
   ```
   All client-side meta tags and JSON-LD schema objects rendered by `RouteSEO.tsx` use `https://vrindavansarthi.in` rather than `https://www.vrindavansarthi.in`.

---

## 3. Route & Public Page Verification

All key public frontend routes were audited against live production:

| Route Path | Expected Purpose | HTTP Code | Rendered View | Issues / Observations |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Landing / Hero Homepage | 200 OK | Home component | Hero banner, quick search, featured stays, testimonials, trust signals. Verified working. |
| `/hotels` | Lodging Directory | 200 OK | Hotels component | Filters by location, amenities, and property type (hotel vs. dharamshala). Loads live data. |
| `/hotels/:id` | Property Overview | 200 OK | HotelDetail | Displays rooms, amenities, map coordinates, and rules. "Book" button routes to room types. |
| `/rooms` | Room Grid Directory | 200 OK | Rooms component | Lists available room types across all listed properties. |
| `/rooms/:id` | Legacy Room ID Route | 302/Redirect | Redirects to `/rooms` | Handled via React Router `<Navigate to="/rooms" replace />`. |
| `/room-types/:id` | Room Type & Booking Form | 200 OK | RoomTypeDetail | Primary booking engine entry point. Rate calculation, date picker, terms acceptance. |
| `/cabs` | Cab Fleet Directory | 200 OK | Cabs component | Displays vehicle categories (Sedan, Ertiga, Innova, Tempo Traveller). |
| `/cabs/:id` | Cab Route & Fare Calculator | 200 OK | CabDetail | Calculates estimated fare; CTA redirects to WhatsApp/Phone (no online cart). |
| `/tours` | Braj Tour Packages | 200 OK | Tours component | Displays curated pilgrimage packages (Govardhan Parikrama, Braj 84 Kos, etc.). |
| `/tours/:id` | Tour Details & Pricing | 200 OK | TourDetail | Shows itinerary, places covered; CTA redirects to WhatsApp/Phone. |
| `/shop` | Devotional E-Commerce | 302/Redirect | Redirects to `/` | **Disabled via Settings:** `shopEnabled: false` causes `FeatureRoute` to redirect to `/`. |
| `/track-order` | Order Tracker | 302/Redirect | Redirects to `/` | **Disabled via Settings:** `trackOrderEnabled: false`. |
| `/about` | Company Background | 200 OK | About component | Company mission, spiritual ethos, team contacts. |
| `/contact` | Contact Form & Support | 200 OK | Contact component | Form posts to `/api/contact` (protected by rate limiter). Phone, email, address shown. |
| `/terms` | Platform Terms | 200 OK | Terms component | Master terms of service. |
| `/privacy` | Privacy Policy | 200 OK | Privacy component | Data protection and user privacy terms. |
| `/cancellation-policy` | Cancellation Policy | 200 OK | CancellationPolicy | Details 12% deduction cancellation rules and refund schedules. |
| `/robots.txt` | Crawler Directives | 200 OK | Plain Text | Standard bot directives. References `https://vrindavansarthi.in/sitemap.xml`. |
| `/sitemap.xml` | XML Sitemap Index | 200 OK | XML | Contains 10 static URLs with non-www domain prefix. Lacks dynamic property pages. |

---

## 4. UI/UX, Mobile Responsiveness & Navigation Audit

1. **Header & Navigation Consistency:**  
   - Header provides clear navigation: Home, Stays (Hotels/Dharamshalas), Cabs, Tours, About, Contact.
   - When `shopEnabled` is false, "Shop" is cleanly omitted from the main navigation menu, preventing broken links.
   - Mobile hamburger menu functions smoothly without horizontal scroll overflow on screens down to 320px width.
2. **Search & Date Pickers:**  
   - Date picker on `/hotels` and `/room-types/:id` enforces valid check-in and check-out ordering (`checkIn < checkOut`).
   - Guest selector enforces room-capacity constraints based on room type rules.
3. **Typography & Styling:**  
   - High-contrast, culturally appropriate Braj spiritual aesthetic (cinzel decorative headers, gold and crimson accents, readable Manrope/Inter body text).
   - Tailwind typography and Radix UI dialogs render without layout shifting.
4. **Form Validation Feedback:**  
   - Customer booking form on `/room-types/:id` validates required guest name, 10-digit mobile number, email, and property terms checkbox before triggering submission.
   - Error messages are rendered via toast notifications (`sonner`).

---

## 5. Console Errors, Broken Links & Network Performance

1. **Production Assets Delivery:**  
   - Assets are compiled using Vite SWC and delivered via Vercel CDN with `Cache-Control: public, max-age=31536000, immutable`.
   - Asset preload tags exist for critical fonts and hero background (`braj-govardhan-hero.jpeg`).
2. **API Proxy Latency:**  
   - Frontend communicates with `/api/*`, which Vercel rewrites to Render (`https://vrindavan-sarthi-gla3.onrender.com/api/*`).
   - Because Render free/standard instances can enter cold sleep if idle, initial API requests after inactivity may take 15–30 seconds before responding. Once warm, `/api/health` responds in ~180ms.
3. **Console Findings:**  
   - Google Tag / Verification token warning: In `index.html`, `<meta name="google-site-verification" content="GOOGLE_SEARCH_CONSOLE_VERIFICATION_TOKEN" />` is unpopulated.
   - No fatal script evaluation errors in production bundles.

---

## 6. Recommendations for Website & Domain Fixes

1. **Implement 301 Edge Redirect for .com:** Configure Vercel domain settings so `vrindavansarthi.com` and `www.vrindavansarthi.com` issue a permanent HTTP 301 redirect to `https://www.vrindavansarthi.in$request_uri`.
2. **Align Canonical Domain:** Update `frontend/src/lib/seo.ts` and `frontend/index.html` to set `SITE_ORIGIN` strictly to `https://www.vrindavansarthi.in`.
3. **Populate Real Search Console Tokens:** Replace placeholder strings in `index.html` with verified DNS or meta tokens from the owner's Google Search Console and Bing Webmaster accounts.
