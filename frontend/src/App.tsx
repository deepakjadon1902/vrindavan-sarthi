import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProtectedRoute from "@/router/ProtectedRoute";
import AdminRoute from "@/router/AdminRoute";
import PartnerRoute from "@/router/PartnerRoute";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import ScrollToTop from "@/components/ScrollToTop";

const Home = lazy(() => import("@/pages/Home"));
const Hotels = lazy(() => import("@/pages/Hotels"));
const HotelDetail = lazy(() => import("@/pages/HotelDetail"));
const Rooms = lazy(() => import("@/pages/Rooms"));
const RoomTypeDetail = lazy(() => import("@/pages/RoomTypeDetail"));
const Cabs = lazy(() => import("@/pages/Cabs"));
const CabDetail = lazy(() => import("@/pages/CabDetail"));
const Tours = lazy(() => import("@/pages/Tours"));
const TourDetail = lazy(() => import("@/pages/TourDetail"));
const Shop = lazy(() => import("@/pages/Shop"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Register = lazy(() => import("@/pages/Register"));
const AuthGoogleCallback = lazy(() => import("@/pages/AuthGoogleCallback"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Profile = lazy(() => import("@/pages/user/Profile"));
const MyBookings = lazy(() => import("@/pages/user/MyBookings"));
const BookingDetail = lazy(() => import("@/pages/user/BookingDetail"));
const MyOrders = lazy(() => import("@/pages/user/MyOrders"));

const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const ManageHotels = lazy(() => import("@/pages/admin/ManageHotels"));
const ManageCabs = lazy(() => import("@/pages/admin/ManageCabs"));
const ManageCabFares = lazy(() => import("@/pages/admin/ManageCabFares"));
const ManageTours = lazy(() => import("@/pages/admin/ManageTours"));
const ManageBookings = lazy(() => import("@/pages/admin/ManageBookings"));
const AdminInventory = lazy(() => import("@/pages/admin/AdminInventory"));
const AdminPayments = lazy(() => import("@/pages/admin/AdminPayments"));
const ManageProducts = lazy(() => import("@/pages/admin/ManageProducts"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const ManageUsers = lazy(() => import("@/pages/admin/ManageUsers"));
const ManagePartnerRequests = lazy(() => import("@/pages/admin/ManagePartnerRequests"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));

const PartnerLayout = lazy(() => import("@/pages/partner/PartnerLayout"));
const PartnerDashboard = lazy(() => import("@/pages/partner/PartnerDashboard"));
const PartnerAddHotel = lazy(() => import("@/pages/partner/PartnerAddHotel"));
const PartnerInventory = lazy(() => import("@/pages/partner/PartnerInventory"));
const PartnerListings = lazy(() => import("@/pages/partner/PartnerListings"));
const PartnerBookings = lazy(() => import("@/pages/partner/PartnerBookings"));
const PartnerPayments = lazy(() => import("@/pages/partner/PartnerPayments"));

const queryClient = new QueryClient();

const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("adminView") === "1") {
      try {
        sessionStorage.setItem("vvs_admin_view", "1");
      } catch {
        // ignore
      }
    }
  }, [location.search]);

  const allowAdminView = (() => {
    const params = new URLSearchParams(location.search);
    if (params.get("adminView") === "1") return true;
    try {
      return sessionStorage.getItem("vvs_admin_view") === "1";
    } catch {
      return false;
    }
  })();

  if (isAuthenticated && user?.role === "partner") {
    return <Navigate to="/partner" replace />;
  }

  if (isAuthenticated && user?.role === "admin" && !allowAdminView) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="bg-royal-dark">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
};

const App = () => {
  const refreshSettings = useSettingsStore((s) => s.refreshSettings);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<div className="pt-24 pb-16 text-center font-body text-muted-foreground">Loading…</div>}>
            <Routes>
              <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
              <Route path="/hotels" element={<PublicLayout><Hotels /></PublicLayout>} />
              <Route path="/hotels/:id" element={<PublicLayout><HotelDetail /></PublicLayout>} />
              <Route path="/rooms" element={<PublicLayout><Rooms /></PublicLayout>} />
              {/* Room-type details are shown via Hotel page; keep legacy param route as redirect */}
              <Route path="/rooms/:id" element={<Navigate to="/rooms" replace />} />
              <Route path="/room-types/:id" element={<PublicLayout><RoomTypeDetail /></PublicLayout>} />
              <Route path="/cabs" element={<PublicLayout><Cabs /></PublicLayout>} />
              <Route path="/cabs/:id" element={<PublicLayout><CabDetail /></PublicLayout>} />
              <Route path="/tours" element={<PublicLayout><Tours /></PublicLayout>} />
              <Route path="/tours/:id" element={<PublicLayout><TourDetail /></PublicLayout>} />
              <Route path="/shop" element={<PublicLayout><Shop /></PublicLayout>} />
              <Route path="/shop/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />
              <Route path="/track-order" element={<PublicLayout><TrackOrder /></PublicLayout>} />
              <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
              <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
              <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
              <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />

              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/google/callback" element={<AuthGoogleCallback />} />

              <Route path="/profile" element={<ProtectedRoute><PublicLayout><Profile /></PublicLayout></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute><PublicLayout><MyBookings /></PublicLayout></ProtectedRoute>} />
              <Route path="/bookings/:id" element={<ProtectedRoute><PublicLayout><BookingDetail /></PublicLayout></ProtectedRoute>} />
              <Route path="/my-orders" element={<ProtectedRoute><PublicLayout><MyOrders /></PublicLayout></ProtectedRoute>} />

              <Route path="/partner" element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
                <Route index element={<PartnerDashboard />} />
                <Route path="hotels" element={<PartnerAddHotel />} />
                <Route path="inventory" element={<PartnerInventory />} />
                <Route path="listings" element={<PartnerListings />} />
                <Route path="bookings" element={<PartnerBookings />} />
                <Route path="payments" element={<PartnerPayments />} />
              </Route>

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="hotels" element={<ManageHotels />} />
                <Route path="inventory" element={<AdminInventory />} />
                <Route path="cabs" element={<ManageCabs />} />
                <Route path="cab-fares" element={<ManageCabFares />} />
                <Route path="tours" element={<ManageTours />} />
                <Route path="partner-requests" element={<ManagePartnerRequests />} />
                <Route path="bookings" element={<ManageBookings />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="products" element={<ManageProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="users" element={<ManageUsers />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
