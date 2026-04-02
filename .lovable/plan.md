## Plan

### Part 1: Frontend — Partner System
1. **Update auth types** — Add `partner` role, partner-specific fields (business name, GST, etc.)
2. **Update Register page** — Add role selection (User / Partner) with conditional partner fields
3. **Update authStore** — Handle partner registration
4. **Create Partner Dashboard** — `/partner` layout with sidebar
   - Partner Dashboard (stats)
   - Add Hotel page (detailed form with all info)
   - Add Room page (detailed form)
   - My Listings page (see status: pending/approved/rejected)
5. **Create Partner routes** — PartnerRoute guard, partner layout
6. **Admin Panel updates** — New "Partner Requests" page showing pending hotels/rooms for approval
   - Approve/Reject buttons with status tracking
   - View partner details
7. **Update listing pages** — Only show approved listings on main site

### Part 2: Backend — Node.js/Express/MongoDB (generated as files)
1. **Project structure** — Complete backend with models, routes, controllers, middleware
2. **Models**: User, Hotel, Room, Cab, Tour, Booking, Partner
3. **Auth**: JWT-based auth with role-based middleware (user/partner/admin)
4. **Routes**: Auth, Hotels, Rooms, Cabs, Tours, Bookings, Users, Partner
5. **Controllers**: Full CRUD with approval workflow
6. **Middleware**: Auth, role-check, error handling, image upload (multer)
7. **Config**: DB connection, env setup
8. **Update frontend API layer** — Create axios instance + API service files to connect to backend

### Part 3: Connect Frontend to Backend
1. Create `src/api/axios.ts` with interceptors
2. Create API service files for each entity
3. Update stores to use API calls instead of localStorage
4. Add environment variable for API URL