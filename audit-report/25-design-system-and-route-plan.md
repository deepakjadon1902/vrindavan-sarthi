# Vrindavan Sarthi — Airbnb-Inspired Design System & Route Implementation Plan
**Document ID:** `VRISAR-PLAN-25`  
**Date:** October 2026  
**Author:** Principal Product Designer & Senior Frontend Architect  
**Status:** Approved Design System Specification & Implementation Plan  
**Target:** Clean, Usable, Premium Airbnb-Inspired UX for Vrindavan Sarthi

---

## 1. Design System Philosophy & Principles

The redesign fuses the world-class usability, spatial rhythm, and cognitive clarity of Airbnb with the warm, reverent cultural context of the sacred Braj pilgrimage region (Vrindavan, Mathura, Govardhan, Barsana, Gokul, Nandgaon).

### Core Principles
1. **Calm, High-Clarity Canvas:** Clean white (`#ffffff`) and soft warm porcelain (`#fcfbf9`) surfaces replace muddy dark gradients and over-decorated backgrounds. Content and property photography take center stage.
2. **Reverent Brand Harmony:** Deep devotional indigo-charcoal (`#111827`) provides crisp, accessible contrast for text. Sacred warm gold (`#b48a28` / `#c89b27`) and subtle saffron (`#ea580c` / `#d97706`) are reserved for verified badges, accents, and high-intent actions.
3. **Frictionless Spatial Rhythm:** Standardized padding scales (4px, 8px, 12px, 16px, 24px, 32px, 48px), consistent border radii (`rounded-2xl` for cards, `rounded-full` for search pills and chips), and subtle micro-elevations (`shadow-[0_2px_12px_rgba(0,0,0,0.06)]`).
4. **Radical Pricing & Landmark Transparency:** Always show exact nightly price, clear breakdown of taxes/convenience fee, and explicit temple distance (e.g., "600m from Banke Bihari Temple").
5. **Fail-Safe Booking Assurance:** Sticky reservation cards, authoritative status indicators, and clear countdown timers eliminate user anxiety during request approvals and payment holds.

---

## 2. Design Tokens & Visual Hierarchy

### 2.1 Color Tokens
```css
/* Color Palette Specifications */
:root {
  /* Surfaces */
  --surface-primary: #ffffff;
  --surface-secondary: #f8fafc;
  --surface-warm: #fcfbf9;
  --surface-accent: #fef7ea;
  
  /* Borders & Dividers */
  --border-subtle: #e2e8f0;
  --border-card: #e5e7eb;
  --border-focus: #b48a28;

  /* Typography / Foreground */
  --text-primary: #0f172a;       /* Slate 900: High-contrast headings and body */
  --text-secondary: #475569;     /* Slate 600: Subtitles, helper text */
  --text-muted: #94a3b8;         /* Slate 400: Placeholders, captions */
  --text-inverse: #ffffff;       /* Pure white on dark surfaces */

  /* Brand Accents (Braj Devotional Harmony) */
  --brand-gold: #b48a28;         /* Sacred warm gold: Badges, active highlights */
  --brand-gold-hover: #96701c;
  --brand-saffron: #d97706;      /* Dharamshala badge, temple icons */
  --brand-crimson: #991b1b;      /* Primary CTA button, urgency highlights */
  --brand-crimson-hover: #7f1d1d;
  --brand-charcoal: #1e293b;     /* Deep slate for footers and modals */

  /* Transaction & Status Colors */
  --status-success: #16a34a;     /* Verified, Confirmed, Paid */
  --status-warning: #d97706;     /* Pending partner approval, Hold expiring */
  --status-info: #0284c7;        /* Awaiting action, information */
  --status-danger: #dc2626;      /* Expired, Cancelled, Rejected */
}
```

### 2.2 Elevation & Shadow Layers
- **Elevation 0 (Flat):** `border border-border/80 bg-white` (Default cards and sections)
- **Elevation 1 (Card Rest):** `shadow-[0_2px_12px_rgba(15,23,42,0.06)]` (Listing cards, filter bars)
- **Elevation 2 (Floating / Hover):** `shadow-[0_8px_30px_rgba(15,23,42,0.12)] -translate-y-0.5` (Interactive search bars, hover state on listing cards)
- **Elevation 3 (Modal / Sticky Sheet):** `shadow-[0_20px_50px_rgba(15,23,42,0.20)]` (Sticky mobile checkout drawer, calendar popups)

### 2.3 Typography Matrix
| Style Class | Font Family | Size / Line-Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `font-brand` | Cinzel Decorative / Serif | 20px – 32px | 700 Bold | Platform logo and sacred monument titles |
| `font-heading` | DM Serif Display / Serif | 28px – 48px | 400 Regular | Hero statements, section titles, page titles |
| `font-body-title`| Manrope / Sans-serif | 16px – 20px | 700 Bold | Property names, section subheads, price tags |
| `font-body` | Manrope / Inter / Sans-serif | 14px – 15px | 500 Medium | Descriptions, amenities, guest review text |
| `font-caption` | Manrope / Sans-serif | 12px – 13px | 600 SemiBold| Metadata tags, temple distances, countdown timer |

---

## 3. Core Component Specifications

### 3.1 Unified Airbnb-Inspired Search Bar (`HeroSearchBar.tsx`)
A unified pill-shaped search console with 4 interactive segments:
1. **Destination in Braj:** Dropdown selector (Vrindavan, Mathura, Govardhan, Barsana, Gokul, Nandgaon).
2. **Check-in / Check-out:** Compact date range selector with quick "Tonight", "This Weekend", or custom date picking.
3. **Guests & Rooms:** Counter popover for Adults, Children, and Rooms.
4. **Stay Type:** Quick toggle between "All Stays", "Verified Dharamshalas", and "Hotels & Resorts".
- **CTA:** Circular or pill-shaped crimson search button with magnifying glass (`Search Braj Stays`).

### 3.2 Premium Listing Card (`ListingCard.tsx`)
- **Aspect Ratio:** 4:3 or 16:10 high-resolution image container with rounded-2xl overflow.
- **Media Controls:** Floating previous/next navigation buttons on hover; subtle dot indicators at bottom; smooth swipe on mobile touch.
- **Top Badges:** Floating Verified Host badge (`bg-white/95 text-emerald-800`), Dharamshala badge (`bg-amber-50 text-amber-900`), and Heart wishlist icon (`bg-white/90`).
- **Landmark Highlight:** Dedicated badge showing proximity to spiritual centers (`MapPin` icon + "450m to Prem Mandir").
- **Pricing Clarity:** Large bold price per night with Indian Rupee symbol (`₹1,850 / night`) plus small transparent note (`+ ₹222 taxes & fees` or `Inclusive of taxes`).

### 3.3 Navigation Header (`Navbar.tsx`)
- **Top Bar:** Fixed, crisp white background with subtle border (`border-b border-neutral-200/80 bg-white/95 backdrop-blur-md`).
- **Brand Identity:** Vrindavan Sarthi logo with sacred peacock motif + subtitle "Your Sacred Braj Companion".
- **Center Navigation:** Pill-shaped category links (`Stays`, `Dharamshalas`, `Cabs`, `Tours`, `Explore Braj`) with smooth indicator pills.
- **Right Action Cluster:** "My Bookings" quick link, 24/7 Braj Helpdesk WhatsApp icon, and user profile avatar dropdown with clean menu items.

### 3.4 Two-Column Booking & Reservation Detail Layout
- **Left Column (65% width):** Property photos, verified host details, check-in/out times, room configuration, guest details form, cancellation policy accordion.
- **Right Column (35% width, Sticky):**
  - Instant pricing summary (Tariff × Nights, Convenience fee, Taxes, Total).
  - Authoritative booking state banner with real-time countdown timer (`BookingCountdownTimer.tsx`).
  - Single primary action button (Razorpay Secure Checkout).
  - 100% Secure Payment & Free Cancellation guarantee badge.
- **Mobile Responsive Drawer:** Fixed bottom drawer on mobile viewports (< 768px) showing total price and "Pay Now" CTA for zero-scroll friction.

---

## 4. Prioritized Route Implementation Plan

| Phase | Priority | Target Routes & Files | Key Deliverables & Transformation |
| :--- | :--- | :--- | :--- |
| **Phase 1** | P0 | `Navbar.tsx`, `Footer.tsx` | Clean white header, pill links, profile dropdown, modern Braj footer with trust certifications. |
| **Phase 2** | P0 | `Home.tsx` | Airbnb-inspired hero search console, quick Braj destination chips, curated stays grid, sacred testimonial carousel. |
| **Phase 3** | P0 | `Hotels.tsx`, `ListingCard.tsx` | Clean filter pills, photo gallery cards, landmark distance badges, transparent per-night pricing. |
| **Phase 4** | P1 | `RoomTypeDetail.tsx`, `BookingDetail.tsx` | Two-column sticky booking view, mobile bottom checkout bar, prominent countdown timer. |
| **Phase 5** | P1 | `PartnerLayout.tsx`, `AdminLayout.tsx` | Responsive cards, clean table spacing, quick status pills. |
| **Phase 6** | P0 | Regression Verification | Complete backend test execution (`node --test`), frontend TypeScript compile (`tsc --noEmit`), production Vite build. |
