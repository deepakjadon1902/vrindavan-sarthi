
## Plan: Extended Partner System, Admin Settings & UPI Payments

### 1. Partner Lists Cabs & Tours
- Add `PartnerAddCab.tsx` and `PartnerAddTour.tsx` pages with detailed forms
- Update `PartnerLayout.tsx` sidebar with Cabs & Tours links
- Update `PartnerListings.tsx` to show cabs & tours alongside hotels/rooms
- Update backend `partner.routes.js` to handle cab/tour submissions with approval workflow
- Update backend models (`Cab.js`, `Tour.js`) to include partner fields (partnerId, partnerName, approvalStatus, etc.)
- Update `ManagePartnerRequests.tsx` to show cab & tour requests too
- Update `PartnerBookings.tsx` to include cab & tour bookings

### 2. Partner Panel Restriction
- Partners see only the Partner Dashboard (not the main public site navbar)
- `PartnerLayout.tsx` gets its own full-screen layout without public Navbar/Footer
- After partner login, redirect to `/partner/dashboard` always

### 3. Admin Settings Page
- Create `AdminSettings.tsx` with sections:
  - **Branding**: Logo URL, site name, motto/tagline
  - **UPI Payment**: UPI ID for QR code generation
  - **Legal**: Terms of Service & Privacy Policy (rich text editors)
- Create `settingsStore.ts` (Zustand + persist) to store settings
- Backend: Create `Settings` model and `settings.routes.js`
- Connect footer, navbar, terms page, privacy page to read from settings store

### 4. UPI QR Code Payment
- When user books hotel/room/tour, show UPI QR code with correct amount
- QR generated from admin's UPI ID (from settings)
- Show all UPI apps (Google Pay, PhonePe, Paytm, BHIM, etc.)
- User confirms payment → booking saved with payment details
- For cabs: keep "Pay at Doorstep" (no online payment)

### 5. Booking Flow Updates
- Booking details saved to both admin panel (all bookings) and partner panel (their listings only)
- Include payment method, transaction reference, amount in booking record

### Files to create:
- `src/pages/partner/PartnerAddCab.tsx`
- `src/pages/partner/PartnerAddTour.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/store/settingsStore.ts`
- `backend/models/Settings.js`
- `backend/routes/settings.routes.js`

### Files to modify:
- `src/pages/partner/PartnerLayout.tsx` - add cab/tour nav, full-screen layout
- `src/pages/partner/PartnerListings.tsx` - show cabs & tours
- `src/pages/partner/PartnerBookings.tsx` - include cab/tour bookings
- `src/pages/admin/AdminLayout.tsx` - add Settings link
- `src/pages/admin/ManagePartnerRequests.tsx` - cab/tour requests
- `src/store/authStore.ts` - redirect partner after login
- `src/App.tsx` - new routes
- `src/components/layout/Navbar.tsx` - read branding from settings
- `src/components/layout/Footer.tsx` - read from settings
- `src/pages/Terms.tsx` & `src/pages/Privacy.tsx` - read from settings
- `backend/models/Cab.js` & `backend/models/Tour.js` - add partner fields
- `backend/routes/partner.routes.js` - cab/tour endpoints
- `backend/server.js` - add settings routes
- Booking components - add UPI QR payment
