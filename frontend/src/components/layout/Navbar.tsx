import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown, Hotel, MessageCircle, Building2, BedDouble, CarTaxiFront, MapPinned, ShoppingBag, PackageSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_LOGO_URL, COMPANY_NAME, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const navLinks = [
  { name: 'Hotel/Dharamshala', path: '/hotels', icon: Building2 },
  { name: 'Rooms', path: '/rooms', icon: BedDouble },
  { name: 'Taxi & Cab', path: '/cabs', icon: CarTaxiFront },
  { name: 'Tour Packages', path: '/tours', icon: MapPinned },
  { name: 'Shopping', path: '/shop', icon: ShoppingBag },
  { name: 'Track Order', path: '/track-order', icon: PackageSearch },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { shopEnabled, trackOrderEnabled } = useSettingsStore((s) => s.settings);
  const visibleNavLinks = navLinks.filter((link) => {
    if (link.path === '/shop') return shopEnabled;
    if (link.path === '/track-order') return trackOrderEnabled;
    return true;
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isHome = location.pathname === '/';
  const navBg = isHome && !scrolled
    ? 'border-transparent bg-white/0 shadow-none backdrop-blur-0'
    : 'nav-dark';

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg} ${scrolled ? 'border-brand-gold/40' : ''}`}>
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-5 xl:px-7">
          <div className="grid h-16 grid-cols-[1fr_auto] items-center gap-3 xl:h-[4.75rem] xl:grid-cols-[minmax(170px,0.45fr)_auto_minmax(160px,0.35fr)] xl:gap-4">
            <Link to="/" className="group flex min-w-0 items-center gap-2.5 xl:max-w-[124px]" aria-label={COMPANY_NAME}>
              <img
                src={APP_LOGO_URL}
                alt={COMPANY_NAME}
                className="h-12 w-12 shrink-0 rounded-full border border-brand-gold/45 object-cover shadow-[0_10px_22px_hsl(39_92%_56%_/_0.22)] transition-transform duration-300 group-hover:scale-105 xl:h-[4.15rem] xl:w-[4.15rem]"
              />
            </Link>

            <div className={`hidden items-center justify-center gap-1 rounded-full px-2 py-1.5 xl:flex ${
              isHome && !scrolled
                ? 'border border-black/10 bg-white/12 text-brand-black shadow-none backdrop-blur-[2px]'
                : 'border border-white/15 bg-white/10 shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.12),0_14px_35px_hsl(222_42%_10%_/_0.18)] backdrop-blur-xl'
            }`}>
              {visibleNavLinks.map((link) => {
                const Icon = link.icon;
                const active = location.pathname === link.path;
                return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 font-body text-[13px] font-bold tracking-wide transition-all duration-300 ${
                    active
                      ? 'bg-brand-gold text-brand-black shadow-[0_8px_20px_hsl(39_92%_56%_/_0.25)]'
                      : isHome && !scrolled
                        ? 'text-brand-black hover:bg-white/25 hover:text-brand-crimson'
                        : 'text-white/90 hover:bg-white/10 hover:text-brand-gold'
                  }`}
                >
                  <Icon size={15} />
                  {link.name}
                </Link>
                );
              })}
            </div>

            <div className="hidden min-w-0 items-center justify-end gap-2 xl:flex">
              {isAuthenticated && user ? (
                <>
                  <Link to="/bookings" className={`whitespace-nowrap font-body text-[13px] font-bold transition-colors ${isHome && !scrolled ? 'text-brand-black hover:text-brand-crimson' : 'text-white/90 hover:text-brand-gold'}`}>My Bookings</Link>
                  {shopEnabled && <Link to="/my-orders" className={`whitespace-nowrap font-body text-[13px] font-bold transition-colors ${isHome && !scrolled ? 'text-brand-black hover:text-brand-crimson' : 'text-white/90 hover:text-brand-gold'}`}>My Orders</Link>}
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`flex items-center gap-2 rounded-full px-2 py-1 font-body text-[13px] font-bold transition-colors ${
                        isHome && !scrolled
                          ? 'border border-brand-black/15 bg-white/20 text-brand-black hover:border-brand-black/35 hover:bg-white/35'
                          : 'border border-white/10 bg-white/5 text-white hover:border-brand-gold/35 hover:text-brand-gold'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isHome && !scrolled ? 'bg-brand-gold text-brand-black' : 'bg-brand-gold/20 text-brand-gold'}`}>
                        <span className="text-xs font-bold">{user.name.charAt(0)}</span>
                      </div>
                      <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                      <ChevronDown size={14} />
                    </button>
                    {dropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-card rounded-lg border border-border py-2 z-50">
                        <Link to="/profile" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-foreground hover:bg-muted transition-colors">
                          <User size={14} /> Profile
                        </Link>
                        <Link to="/bookings" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-foreground hover:bg-muted transition-colors">
                          <User size={14} /> My Bookings
                        </Link>
                        {shopEnabled && (
                          <Link to="/my-orders" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-foreground hover:bg-muted transition-colors">
                            <User size={14} /> My Orders
                          </Link>
                        )}
                        {user.role === 'partner' && (
                          <Link to="/partner" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-brand-gold hover:bg-muted transition-colors">
                            <Hotel size={14} /> Partner Panel
                          </Link>
                        )}
                        {user.role === 'admin' && (
                          <Link to="/admin" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-brand-crimson hover:bg-muted transition-colors">
                            Admin Panel
                          </Link>
                        )}
                        <div className="h-px bg-border my-1" />
                        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 font-body text-sm text-foreground hover:bg-muted transition-colors">
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/bookings" className={`whitespace-nowrap font-body text-[13px] font-bold transition-colors ${isHome && !scrolled ? 'text-brand-black hover:text-brand-crimson' : 'text-white/90 hover:text-brand-gold'}`}>My Bookings</Link>
                  <Link to="/login" className={`whitespace-nowrap font-body text-[13px] font-bold transition-colors ${isHome && !scrolled ? 'text-brand-black hover:text-brand-crimson' : 'text-white/90 hover:text-brand-gold'}`}>Login</Link>
                  <Link to="/contact" className="btn-gold inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-[13px]">
                    <MessageCircle size={15} /> Enquire
                  </Link>
                  <Link to="/register" className="btn-crimson whitespace-nowrap rounded-lg px-4 py-2 text-[13px]">Sign Up</Link>
                </>
              )}
            </div>

            <button onClick={() => setMobileOpen(!mobileOpen)} className="justify-self-end p-2 text-white xl:hidden" aria-label="Toggle menu">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto nav-dark px-5 pb-6 pt-[calc(4.5rem+env(safe-area-inset-top))] sm:px-8"
          >
            <button onClick={() => setMobileOpen(false)} className="premium-icon-button absolute right-4 top-4 h-10 w-10 text-foreground" aria-label="Close menu">
              <X size={20} />
            </button>
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.08] p-3">
              <img src={APP_LOGO_URL} alt="" className="h-10 w-10 rounded-full border border-brand-gold/35 object-cover" />
              <div className="min-w-0">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Vrindavan Sarthi</p>
                <p className="truncate font-body text-sm font-semibold text-white/90">Hotels, rooms, cabs and tours</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {visibleNavLinks.map((link, i) => (
                <motion.div key={link.path} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                  <Link to={link.path} className={`flex min-h-12 items-center justify-between rounded-lg border px-4 font-body text-base font-bold transition-colors ${location.pathname === link.path ? 'border-brand-gold/55 bg-brand-gold text-brand-black' : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/10'}`}>
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <div className="my-3 h-px bg-brand-gold/20" />
              <a href={`https://wa.me/${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-center">
                <MessageCircle size={18} /> WhatsApp Enquiry
              </a>
              {isAuthenticated && user ? (
                <>
                  <Link to="/profile" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-white">Profile</Link>
                  <Link to="/bookings" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-white">My Bookings</Link>
                  {shopEnabled && <Link to="/my-orders" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-white">My Orders</Link>}
                  {user.role === 'partner' && (
                    <Link to="/partner" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-brand-gold">Partner Panel</Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-brand-gold">Admin Panel</Link>
                  )}
                  <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left font-body text-sm font-semibold text-white">Sign Out</button>
                </>
              ) : (
                <>
                  <Link to="/bookings" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-white">My Bookings</Link>
                  <Link to="/login" className="rounded-lg px-3 py-2 font-body text-sm font-semibold text-white">Login</Link>
                  <Link to="/register" className="btn-crimson mt-2 rounded-lg px-6 py-3 text-center">Sign Up</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
