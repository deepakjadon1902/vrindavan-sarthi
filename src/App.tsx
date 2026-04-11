import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Hotels from "@/pages/Hotels";
import HotelDetail from "@/pages/HotelDetail";
import Rooms from "@/pages/Rooms";
import RoomDetail from "@/pages/RoomDetail";
import Cabs from "@/pages/Cabs";
import CabDetail from "@/pages/CabDetail";
import Tours from "@/pages/Tours";
import TourDetail from "@/pages/TourDetail";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/user/Profile";
import MyBookings from "@/pages/user/MyBookings";
import MyOrders from "@/pages/user/MyOrders";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ManageHotels from "@/pages/admin/ManageHotels";
import ManageRooms from "@/pages/admin/ManageRooms";
import ManageCabs from "@/pages/admin/ManageCabs";
import ManageTours from "@/pages/admin/ManageTours";
import ManageBookings from "@/pages/admin/ManageBookings";
import ManageUsers from "@/pages/admin/ManageUsers";
import ManagePartnerRequests from "@/pages/admin/ManagePartnerRequests";
import AdminSettings from "@/pages/admin/AdminSettings";
import ManageProducts from "@/pages/admin/ManageProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import PartnerLayout from "@/pages/partner/PartnerLayout";
import PartnerDashboard from "@/pages/partner/PartnerDashboard";
import PartnerAddHotel from "@/pages/partner/PartnerAddHotel";
import PartnerAddRoom from "@/pages/partner/PartnerAddRoom";
import PartnerAddCab from "@/pages/partner/PartnerAddCab";
import PartnerAddTour from "@/pages/partner/PartnerAddTour";
import PartnerListings from "@/pages/partner/PartnerListings";
import PartnerBookings from "@/pages/partner/PartnerBookings";
import PartnerPayments from "@/pages/partner/PartnerPayments";
import AdminPayments from "@/pages/admin/AdminPayments";
import BookingDetail from "@/pages/user/BookingDetail";
import ProtectedRoute from "@/router/ProtectedRoute";
import AdminRoute from "@/router/AdminRoute";
import PartnerRoute from "@/router/PartnerRoute";

const queryClient = new QueryClient();

const PublicLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    <main>{children}</main>
    <Footer />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/hotels" element={<PublicLayout><Hotels /></PublicLayout>} />
          <Route path="/hotels/:id" element={<PublicLayout><HotelDetail /></PublicLayout>} />
          <Route path="/rooms" element={<PublicLayout><Rooms /></PublicLayout>} />
          <Route path="/rooms/:id" element={<PublicLayout><RoomDetail /></PublicLayout>} />
          <Route path="/cabs" element={<PublicLayout><Cabs /></PublicLayout>} />
          <Route path="/cabs/:id" element={<PublicLayout><CabDetail /></PublicLayout>} />
          <Route path="/tours" element={<PublicLayout><Tours /></PublicLayout>} />
          <Route path="/tours/:id" element={<PublicLayout><TourDetail /></PublicLayout>} />
          <Route path="/shop" element={<PublicLayout><Shop /></PublicLayout>} />
          <Route path="/shop/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
          <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/profile" element={<ProtectedRoute><PublicLayout><Profile /></PublicLayout></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><PublicLayout><MyBookings /></PublicLayout></ProtectedRoute>} />
          <Route path="/bookings/:id" element={<ProtectedRoute><PublicLayout><BookingDetail /></PublicLayout></ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute><PublicLayout><MyOrders /></PublicLayout></ProtectedRoute>} />

          <Route path="/partner" element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
            <Route index element={<PartnerDashboard />} />
            <Route path="hotels" element={<PartnerAddHotel />} />
            <Route path="rooms" element={<PartnerAddRoom />} />
            <Route path="cabs" element={<PartnerAddCab />} />
            <Route path="tours" element={<PartnerAddTour />} />
            <Route path="listings" element={<PartnerListings />} />
            <Route path="bookings" element={<PartnerBookings />} />
            <Route path="payments" element={<PartnerPayments />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="hotels" element={<ManageHotels />} />
            <Route path="rooms" element={<ManageRooms />} />
            <Route path="cabs" element={<ManageCabs />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
