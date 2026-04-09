import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Hotel, BedDouble, Car, Map, ClipboardList,
  Users, LogOut, Menu, X, Handshake, Settings, CreditCard,
} from 'lucide-react';
import { useState } from 'react';

const sidebarLinks = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Hotels', path: '/admin/hotels', icon: Hotel },
  { name: 'Rooms', path: '/admin/rooms', icon: BedDouble },
  { name: 'Cabs', path: '/admin/cabs', icon: Car },
  { name: 'Tours', path: '/admin/tours', icon: Map },
  { name: 'Partner Requests', path: '/admin/partner-requests', icon: Handshake },
  { name: 'Bookings', path: '/admin/bookings', icon: ClipboardList },
  { name: 'Payments', path: '/admin/payments', icon: CreditCard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getPendingCount = () => {
    try {
      const hotels = JSON.parse(localStorage.getItem('vvs_partner_hotels') || '[]');
      const rooms = JSON.parse(localStorage.getItem('vvs_partner_rooms') || '[]');
      const cabs = JSON.parse(localStorage.getItem('vvs_partner_cabs') || '[]');
      const tours = JSON.parse(localStorage.getItem('vvs_partner_tours') || '[]');
      return [...hotels, ...rooms, ...cabs, ...tours].filter((i: any) => i.approvalStatus === 'pending').length;
    } catch { return 0; }
  };
  const pendingCount = getPendingCount();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-muted">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-foreground text-primary-foreground flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-primary-foreground/10">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="text-xl">🦚</span>
            <span className="font-brand text-sm text-brand-gold">VrindavanSarthi</span>
          </Link>
          <p className="font-body text-xs text-primary-foreground/40 mt-1">Admin Panel</p>
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
                    ? 'bg-primary-foreground/10 text-brand-gold border-r-2 border-brand-gold'
                    : 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5'
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

        <div className="p-4 border-t border-primary-foreground/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
              <span className="text-brand-gold font-body text-xs font-bold">
                {user?.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-primary-foreground truncate">{user?.name}</p>
              <p className="font-body text-[10px] text-primary-foreground/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 font-body text-xs text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-foreground">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {sidebarLinks.find((l) => l.path === location.pathname)?.name || 'Admin'}
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

export default AdminLayout;
