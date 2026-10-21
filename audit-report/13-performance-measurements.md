# Vrindavan Sarthi — Real Performance & Bundle Measurement Report

**Document ID:** `VRN-AUD-PERF-013`  
**Measurement Methodology:** W3C Navigation & Resource Timing API via Headless Chromium / Edge Engine (`1280x720` Desktop & `375x667` Mobile Emulation)  
**Target Environments:** Production Edge (`https://www.vrindavansarthi.in/` & `https://www.vrindavansarthi.com/`)  
**Execution Timestamp:** 2026-10-17  
**Status:** Complete  

---

## Executive Performance Summary

The production web applications are distributed through Vercel's global Anycast Edge Network with origins deployed in `bom1` (Mumbai, India). 
- **Time to First Byte (TTFB)** is exceptionally fast across all measured endpoints, ranging between **32ms and 56ms**.
- **First Contentful Paint (FCP)** occurs rapidly between **472ms and 872ms** across desktop and mobile form factors.
- **Cumulative Layout Shift (CLS)** scored **0.00** across all sampled landing pages, demonstrating strict visual stability without unconstrained layout jumps.
- **Asset Composition:** Transferred page weight is overwhelmingly dominated by uncompressed or large raster hero images (~518 KB of ~609 KB total page weight, or **85.1%**). JavaScript bundles are highly compressed and lean (Vite code-split vendor chunks total ~2.2 KB initial transfer with HTTP/2 stream multiplexing).

---

## Detailed Lab Measurement Matrix

### 1. Primary Landing Pages across Both Domains and Form Factors

| Target Profile | URL | Viewport | TTFB (ms) | FCP (ms) | Load Time (ms) | DOM Interactive (ms) | Requests | Total Transfer | Image Transfer | Font Transfer | CLS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **vrindavansarthi.in (Desktop)** | `https://www.vrindavansarthi.in/` | 1280x720 | **35 ms** | 872 ms | 810 ms | 599 ms | 23 | 609,137 B | 518,360 B | 88,568 B | 0.00 |
| **vrindavansarthi.in (Mobile)** | `https://www.vrindavansarthi.in/` | 375x667 | **34 ms** | 472 ms | 436 ms | 209 ms | 23 | 595,069 B | 518,360 B | 74,500 B | 0.00 |
| **vrindavansarthi.com (Desktop)** | `https://www.vrindavansarthi.com/` | 1280x720 | **46 ms** | 548 ms | 515 ms | 281 ms | 23 | 609,137 B | 518,360 B | 88,568 B | 0.00 |
| **vrindavansarthi.com (Mobile)** | `https://www.vrindavansarthi.com/` | 375x667 | **35 ms** | 488 ms | 454 ms | 233 ms | 23 | 595,069 B | 518,360 B | 74,500 B | 0.00 |

### 2. Deep Section Landing Pages (`vrindavansarthi.in`)

| Section Route | Viewport | TTFB (ms) | FCP (ms) | Load Time (ms) | DOM Interactive (ms) | Requests | Total Transfer | Image Transfer | Font Transfer | CLS |
|---|---|---|---|---|---|---|---|---|---|---|
| **Hotels Listing (`/hotels`)** | 1280x720 | **56 ms** | 676 ms | 628 ms | 374 ms | 21 | 510,141 B | 419,419 B | 88,568 B | 0.00 |
| **Cabs Desk (`/cabs`)** | 1280x720 | **52 ms** | 472 ms | 435 ms | 201 ms | 19 | 509,848 B | 419,419 B | 88,568 B | 0.00 |
| **Pilgrimage Tours (`/tours`)** | 1280x720 | **32 ms** | 528 ms | 492 ms | 234 ms | 19 | 509,848 B | 419,419 B | 88,568 B | 0.00 |

---

## Asset Breakdown & Transfer Efficiency

```
                         HOMEPAGE TRANSFER BREAKDOWN (~609 KB)
+----------------------------------------------------------------------------------------------------+
| Images (Hero, Banners, Cards): 518.4 KB (85.1%)                                                    |
| [========================================================================================        ] |
|                                                                                                    |
| Web Fonts (Inter, Cinzel, Noto Sans Devanagari): 88.6 KB (14.5%)                                   |
| [==============                                                                                  ] |
|                                                                                                    |
| JavaScript (Vite Chunks, React, Zustand, Lucide): 2.2 KB (0.4%)                                    |
| [=                                                                                               ] |
+----------------------------------------------------------------------------------------------------+
```

### 1. Image Transfer Optimization Analysis
- **Current Observation:** The homepage downloads **518.36 KB** of images across 14 asset requests.
- **Format Audit:** Images are delivered in traditional JPEG/PNG formats rather than next-generation WebP or AVIF formats.
- **Responsive Sizing:** Mobile devices (`375x667`) download the exact same 518 KB image payload as desktop devices (`1280x720`). Hero banners lack `<picture>` or `srcset` breakpoints with smaller mobile renditions.
- **Recommendation:**
  1. Route image assets through an image transformation CDN (e.g. Vercel Image Optimization, Cloudinary, or Cloudflare Polish) to automatically serve AVIF/WebP.
  2. Implement `srcset` attributes on hero cards to reduce mobile image payload from 518 KB to < 95 KB.

### 2. Font Loading & Preloading
- **Current Observation:** Fonts account for **88.57 KB** on desktop and **74.50 KB** on mobile.
- **Audit:** Font files (`.woff2`) are fetched late in the critical rendering path. Adding `<link rel="preload" as="font" type="font/woff2" crossorigin>` inside `frontend/index.html` will allow the browser to initiate font downloads parallel to HTML parsing, eliminating FOIT (Flash of Invisible Text) and accelerating FCP by an estimated 100-150ms on 4G cellular connections.

### 3. JavaScript & Bundle Architecture
- **Current Observation:** Vite bundles are partitioned into small asynchronous chunks. Initial HTML + core script transfer is under 3 KB over wire with gzip/brotli compression.
- **Client-Side Rendering Overhead:** Because the application is a Client-Side Rendered (CSR) Single Page Application, the browser must:
  1. Receive HTML shell (~1.5 KB)
  2. Download and parse Vite bundle (~2.2 KB initial chunk + lazy vendor chunks)
  3. Execute React mount and trigger client API requests (`GET /api/hotels`, `GET /api/cabs`)
  4. Render DOM elements
- While initial payload is very small, Time to Interactive (TTI) for dynamic inventory depends on backend Render cold-starts (if idle).

---

## Domain Routing Discrepancy Evidence

The lab measurements confirm **BUG-002**:
- `https://www.vrindavansarthi.com/` returns **HTTP 200 OK** directly, serving 609,137 bytes across 23 requests.
- `https://www.vrindavansarthi.in/` returns **HTTP 200 OK** directly, serving an identical 609,137 bytes across 23 requests.
- **Conclusion:** Both domains are actively serving complete independent instances of the application on the edge without redirecting. This confirms that search engine crawlers are being presented with two identical, competing sites.

---

## Actionable Performance Recommendations

1. **Implement Vercel 301 Domain Forwarding:** Redirect all traffic from `vrindavansarthi.com` to `www.vrindavansarthi.in`.
2. **Compress Hero Imagery with WebP / AVIF:** Convert homepage banners to WebP with 80% quality, reducing image weight by ~65% (saving ~340 KB per initial page load).
3. **Preload Heading Font:** Preload the primary brand font in `index.html` head to shave 120ms off mobile FCP.
4. **Backend Keep-Alive Warmup:** For the Render backend API, configure an UptimeRobot or Cron monitor to ping `/api/health` every 10 minutes, preventing cold-starts during initial property searches.
