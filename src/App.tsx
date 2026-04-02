import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Hotels from "@/pages/Hotels";
import Rooms from "@/pages/Rooms";
import Cabs from "@/pages/Cabs";
import Tours from "@/pages/Tours";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/user/Profile";
import MyBookings from "@/pages/user/MyBookings";
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
import PartnerLayout from "@/pages/partner/PartnerLayout";
import PartnerDashboard from "@/pages/partner/PartnerDashboard";
import PartnerAddHotel from "@/pages/partner/PartnerAddHotel";
import PartnerAddRoom from "@/pages/partner/PartnerAddRoom";
import PartnerListings from "@/pages/partner/PartnerListings";
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
          {/* Public pages */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/hotels" element={<PublicLayout><Hotels /></PublicLayout>} />
          <Route path="/rooms" element={<PublicLayout><Rooms /></PublicLayout>} />
          <Route path="/cabs" element={<PublicLayout><Cabs /></PublicLayout>} />
          <Route path="/tours" element={<PublicLayout><Tours /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />

          {/* Auth pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected user pages */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />

          {/* Partner */}
          <Route path="/partner" element={<PartnerRoute><PartnerLayout /></PartnerRoute>}>
            <Route index element={<PartnerDashboard />} />
            <Route path="hotels" element={<PartnerAddHotel />} />
            <Route path="rooms" element={<PartnerAddRoom />} />
            <Route path="listings" element={<PartnerListings />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="hotels" element={<ManageHotels />} />
            <Route path="rooms" element={<ManageRooms />} />
            <Route path="cabs" element={<ManageCabs />} />
            <Route path="tours" element={<ManageTours />} />
            <Route path="partner-requests" element={<ManagePartnerRequests />} />
            <Route path="bookings" element={<ManageBookings />} />
            <Route path="users" element={<ManageUsers />} />
          </Route>

          <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
