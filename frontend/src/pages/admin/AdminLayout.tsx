import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Hotel, BedDouble, Car, Map, ClipboardList,
  Users, LogOut, Menu, X, Handshake, Settings, CreditCard,
  Landmark,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { api, withAuth } from '@/lib/api';
import { APP_LOGO_URL } from '@/lib/brand';
import { getSessionCache, setSessionCache } from '@/lib/panelCache';

const sidebarLinks = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Hotels', path: '/admin/hotels', icon: Hotel },
  { name: 'Inventory', path: '/admin/inventory', icon: BedDouble },
  { name: 'Cabs', path: '/admin/cabs', icon: Car },
  { name: 'Cab Fares', path: '/admin/cab-fares', icon: ClipboardList },
  { name: 'Tours', path: '/admin/tours', icon: Map },
  { name: 'Partner Requests', path: '/admin/partner-requests', icon: Handshake },
  { name: 'Bookings', path: '/admin/bookings', icon: ClipboardList },
  { name: 'Payments', path: '/admin/payments', icon: CreditCard },
  { name: 'Partner Payouts', path: '/admin/partner-payouts', icon: Landmark },
  { name: 'Products', path: '/admin/products', icon: ClipboardList },
  { name: 'Orders', path: '/admin/orders', icon: ClipboardList },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout = () => {
  const { user, token, logout } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        const cached = getSessionCache<number>('vvs_admin_partner_pending_count', 30_000);
        if (typeof cached === 'number' && pendingCount === 0) setPendingCount(cached);
        const res = await api.get('/partner/requests', { ...withAuth(token), params: { limit: 600 } });
        const data = res.data?.data || {};
        const hotels = Array.isArray(data.hotels) ? data.hotels : [];
        const rooms = Array.isArray(data.rooms) ? data.rooms : [];
        const cabs = Array.isArray(data.cabs) ? data.cabs : [];
        const tours = Array.isArray(data.tours) ? data.tours : [];
        const all = [...hotels, ...rooms, ...cabs, ...tours];
        const next = all.filter((i: any) => i?.approvalStatus === 'pending').length;
        setPendingCount(next);
        setSessionCache('vvs_admin_partner_pending_count', next);
      } catch {
        setPendingCount(0);
      }
    };
    void run();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex panel-shell">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 panel-sidebar flex flex-col border-r border-brand-gold/20 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-brand-gold/20">
          <Link to="/admin" className="flex items-center gap-2">
            <img src={APP_LOGO_URL} alt={settings.siteName} className="h-8 w-8 rounded-full object-cover border border-brand-gold/30" />
            <span className="font-brand text-sm text-brand-gold">{settings.siteName}</span>
          </Link>
          <p className="font-body text-xs text-white/55 mt-1">Admin Travel Desk</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.path;
            const isPartnerReq = link.path === '/admin/partner-requests';
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
                {isPartnerReq && pendingCount > 0 && (
                  <span className="ml-auto bg-brand-saffron text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-gold/20">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
              <span className="text-brand-gold font-body text-xs font-bold">
                {user?.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-white truncate">{user?.name}</p>
              <p className="font-body text-[10px] text-white/55 truncate">{user?.email}</p>
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
            {sidebarLinks.find((l) => l.path === location.pathname)?.name || 'Admin'}
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="/?adminView=1"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-body border border-white/25 bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              View App
            </a>
            <span className="hidden sm:inline font-body text-xs text-white/75">{user?.email}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
