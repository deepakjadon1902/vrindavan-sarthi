import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown, Hotel, MessageCircle, Phone, ShieldCheck, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_LOGO_URL, COMPANY_NAME, COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';

interface NavLinkItem {
  name: string;
  path: string;
  badge?: string;
}

const navLinks: NavLinkItem[] = [
  { name: 'Stays', path: '/hotels' },
  { name: 'Dharamshalas', path: '/hotels?type=dharamshala', badge: 'Ashrams' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Cabs', path: '/cabs' },
  { name: 'Tours', path: '/tours' },
  { name: 'Explore Braj', path: '/about' },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { shopEnabled } = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location.pathname, location.search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isCurrentActive = (linkPath: string) => {
    if (linkPath.includes('?')) {
      return location.pathname + location.search === linkPath;
    }
    return location.pathname === linkPath && !location.search.includes('type=dharamshala');
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-neutral-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
            : 'bg-white/95 backdrop-blur-md border-neutral-200/70'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between gap-4">
            {/* Brand Logo & Name */}
            <Link to="/" className="group flex items-center gap-3 shrink-0" aria-label={COMPANY_NAME}>
              <img
                src={APP_LOGO_URL}
                alt={COMPANY_NAME}
                width={44}
                height={44}
                loading="eager"
                decoding="async"
                fetchpriority="high"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-amber-500/30 object-cover shadow-sm transition-transform duration-200 group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="font-brand text-lg sm:text-xl font-bold tracking-tight text-slate-900 group-hover:text-amber-800 transition-colors">
                  {COMPANY_NAME}
                </span>
                <span className="hidden sm:inline font-body text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                  Braj Pilgrimage Stays & Yatras
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links — Natural, balanced text links (NOT in a giant pill container) */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2">
              {navLinks.map((link) => {
                const active = isCurrentActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-sm font-semibold transition-all duration-150 ${
                      active
                        ? 'text-slate-900 font-bold bg-neutral-100'
                        : 'text-neutral-600 hover:text-slate-900 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{link.name}</span>
                    {link.badge && (
                      <span className="rounded-full bg-amber-100/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Action Cluster */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* WhatsApp / Call Helpdesk */}
              <a
                href={`https://wa.me/${COMPANY_PHONE_DIGITS}?text=Jai%20Shree%20Krishna!%20Need%20guidance%20with%20Braj%20stay.`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
                title="24/7 WhatsApp Pilgrimage Support"
              >
                <MessageCircle size={15} className="text-emerald-600 fill-emerald-600/20" />
                <span className="hidden md:inline">24/7 Help</span>
              </a>

              {/* My Bookings link */}
              <Link
                to="/bookings"
                className="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 font-body text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-neutral-50 transition-colors"
              >
                My Bookings
              </Link>

              {/* Airbnb-style User Menu Capsule */}
              <div className="relative user-menu-container hidden sm:block">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 rounded-full border border-neutral-300 bg-white py-1.5 pl-3 pr-2 shadow-sm hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  aria-label="User navigation menu"
                  aria-expanded={dropdownOpen}
                >
                  <Menu size={16} className="text-slate-600" />
                  {isAuthenticated && user ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white font-body text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-slate-500">
                      <User size={15} />
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-neutral-200 bg-white py-2 shadow-xl z-50 text-left"
                    >
                      {isAuthenticated && user ? (
                        <>
                          <div className="px-4 py-2 border-b border-neutral-100">
                            <p className="font-body text-xs text-slate-400">Signed in as</p>
                            <p className="font-body text-sm font-bold text-slate-900 truncate">{user.name}</p>
                            <p className="font-body text-[11px] text-slate-400 truncate">{user.phone || user.email}</p>
                          </div>

                          <div className="py-1">
                            <Link
                              to="/profile"
                              className="flex items-center gap-2.5 px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              Profile Settings
                            </Link>
                            <Link
                              to="/bookings"
                              className="flex items-center gap-2.5 px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              My Bookings
                            </Link>
                            {shopEnabled && (
                              <Link
                                to="/my-orders"
                                className="flex items-center gap-2.5 px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                              >
                                Sacred Store Orders
                              </Link>
                            )}
                          </div>

                          {(user.role === 'partner' || user.role === 'admin') && (
                            <div className="py-1 border-t border-neutral-100">
                              {user.role === 'partner' && (
                                <Link
                                  to="/partner"
                                  className="flex items-center gap-2.5 px-4 py-2 font-body text-sm font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
                                >
                                  <Hotel size={14} />
                                  Partner Portal
                                </Link>
                              )}
                              {user.role === 'admin' && (
                                <Link
                                  to="/admin"
                                  className="flex items-center gap-2.5 px-4 py-2 font-body text-sm font-semibold text-brand-crimson hover:bg-red-50 transition-colors"
                                >
                                  <ShieldCheck size={14} />
                                  Admin Dashboard
                                </Link>
                              )}
                            </div>
                          )}

                          <div className="pt-1 border-t border-neutral-100">
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-2.5 w-full text-left px-4 py-2 font-body text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <LogOut size={14} />
                              Sign Out
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="py-1">
                            <Link
                              to="/login"
                              className="flex items-center px-4 py-2 font-body text-sm font-bold text-slate-900 hover:bg-neutral-50 transition-colors"
                            >
                              Log in
                            </Link>
                            <Link
                              to="/register"
                              className="flex items-center px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              Sign up
                            </Link>
                          </div>
                          <div className="my-1 border-t border-neutral-100" />
                          <div className="py-1">
                            <Link
                              to="/bookings"
                              className="flex items-center px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              Find my booking
                            </Link>
                            <Link
                              to="/register?role=partner"
                              className="flex items-center px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              List your property
                            </Link>
                            <Link
                              to="/contact"
                              className="flex items-center px-4 py-2 font-body text-sm font-medium text-slate-700 hover:bg-neutral-50 transition-colors"
                            >
                              Help Center
                            </Link>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden inline-flex items-center justify-center rounded-full p-2 text-slate-700 hover:bg-neutral-100 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Clean Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute right-0 top-0 bottom-0 w-4/5 max-w-sm bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={APP_LOGO_URL}
                      alt={COMPANY_NAME}
                      className="h-9 w-9 rounded-full border border-amber-500/30 object-cover"
                    />
                    <div>
                      <p className="font-brand text-sm font-bold text-slate-900">{COMPANY_NAME}</p>
                      <p className="font-body text-[10px] text-slate-400 uppercase tracking-wide">Braj Travel Platform</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-neutral-100"
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="py-4 space-y-1">
                  <p className="px-3 pb-1 font-body text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Explore Braj
                  </p>
                  {navLinks.map((link) => {
                    const active = isCurrentActive(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 font-body text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-neutral-100 text-slate-900 font-bold'
                            : 'text-slate-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span>{link.name}</span>
                        {link.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>

                <div className="py-3 border-t border-neutral-100 space-y-1">
                  <p className="px-3 pb-1 font-body text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Account & Trips
                  </p>
                  <Link
                    to="/bookings"
                    className="flex items-center px-3.5 py-2 font-body text-sm font-semibold text-slate-700 hover:bg-neutral-50 rounded-xl"
                  >
                    My Bookings
                  </Link>
                  {isAuthenticated && (
                    <Link
                      to="/profile"
                      className="flex items-center px-3.5 py-2 font-body text-sm font-semibold text-slate-700 hover:bg-neutral-50 rounded-xl"
                    >
                      Profile Settings
                    </Link>
                  )}
                  {isAuthenticated && user?.role === 'partner' && (
                    <Link
                      to="/partner"
                      className="flex items-center px-3.5 py-2 font-body text-sm font-semibold text-amber-800 hover:bg-amber-50 rounded-xl"
                    >
                      Partner Portal
                    </Link>
                  )}
                  {isAuthenticated && user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="flex items-center px-3.5 py-2 font-body text-sm font-semibold text-brand-crimson hover:bg-red-50 rounded-xl"
                    >
                      Admin Panel
                    </Link>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <a
                  href={`https://wa.me/${COMPANY_PHONE_DIGITS}?text=Jai%20Shree%20Krishna!%20Need%20help.`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 font-body text-sm font-bold text-emerald-800"
                >
                  <MessageCircle size={18} className="text-emerald-600" />
                  WhatsApp Support (24/7)
                </a>

                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-neutral-200 px-4 py-2.5 font-body text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 font-body text-sm font-bold text-white shadow-sm"
                  >
                    <User size={16} />
                    Login / Sign Up
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
