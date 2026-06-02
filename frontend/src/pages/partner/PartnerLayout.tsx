import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Hotel, BedDouble, LogOut, Menu, X, ClipboardList, CreditCard,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_LOGO_URL } from '@/lib/brand';

const sidebarLinks = [
  { name: 'Dashboard', path: '/partner', icon: LayoutDashboard },
  { name: 'My Hotels', path: '/partner/hotels', icon: Hotel },
  { name: 'Inventory', path: '/partner/inventory', icon: BedDouble },
  { name: 'My Listings', path: '/partner/listings', icon: ClipboardList },
  { name: 'Bookings', path: '/partner/bookings', icon: ClipboardList },
  { name: 'Payments', path: '/partner/payments', icon: CreditCard },
];

const PartnerLayout = () => {
  const { user, logout } = useAuthStore();
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const bookingCount = partnerBookings.length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex panel-shell">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 panel-sidebar flex flex-col border-r border-brand-gold/20 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-brand-gold/20">
          <div className="flex items-center gap-2">
            <img src={APP_LOGO_URL} alt={settings.siteName} className="h-8 w-8 rounded-full object-cover border border-brand-gold/30" />
            <span className="font-brand text-sm text-brand-gold">{settings.siteName}</span>
          </div>
          <p className="font-body text-xs text-white/55 mt-1">Partner Travel Desk</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.path;
            const isBookings = link.path === '/partner/bookings';
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 font-body text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-gold text-brand-black border-r-2 border-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <link.icon size={18} />
                {link.name}
                {isBookings && bookingCount > 0 && (
                  <span className="ml-auto bg-brand-saffron text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{bookingCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-gold/20">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
              <span className="text-brand-gold font-body text-xs font-bold">
                {user?.name?.charAt(0) || 'P'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-white truncate">{user?.name}</p>
              <p className="font-body text-[10px] text-white/55 truncate">{user?.businessName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 font-body text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="panel-hero min-h-20 border-b border-brand-gold/20 flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-foreground">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="font-heading text-2xl font-semibold text-white">
            {sidebarLinks.find((l) => l.path === location.pathname)?.name || 'Partner'}
          </h1>
          <div />
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PartnerLayout;
