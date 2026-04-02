import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Hotel, BedDouble, LogOut, Menu, X, ClipboardList,
} from 'lucide-react';
import { useState } from 'react';

const sidebarLinks = [
  { name: 'Dashboard', path: '/partner', icon: LayoutDashboard },
  { name: 'My Hotels', path: '/partner/hotels', icon: Hotel },
  { name: 'My Rooms', path: '/partner/rooms', icon: BedDouble },
  { name: 'My Listings', path: '/partner/listings', icon: ClipboardList },
];

const PartnerLayout = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-muted">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-foreground text-primary-foreground flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-primary-foreground/10">
          <Link to="/partner" className="flex items-center gap-2">
            <span className="text-xl">🦚</span>
            <span className="font-brand text-sm text-brand-gold">VrindavanSarthi</span>
          </Link>
          <p className="font-body text-xs text-primary-foreground/40 mt-1">Partner Panel</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.path;
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
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-foreground/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
              <span className="text-brand-gold font-body text-xs font-bold">
                {user?.name?.charAt(0) || 'P'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-primary-foreground truncate">{user?.name}</p>
              <p className="font-body text-[10px] text-primary-foreground/40 truncate">{user?.businessName}</p>
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
