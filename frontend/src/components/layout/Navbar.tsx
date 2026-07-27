import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown, Hotel, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { APP_LOGO_URL, COMPANY_NAME, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const navLinks = [
  { name: 'Hotels', path: '/hotels' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Cabs', path: '/cabs' },
  { name: 'Tours', path: '/tours' },
  { name: 'Shop', path: '/shop' },
  { name: 'Track Order', path: '/track-order' },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

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

  const navBg = 'nav-dark';

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg} ${scrolled ? 'border-brand-gold/40' : ''}`}>
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-5 xl:px-7">
          <div className="grid h-16 grid-cols-[1fr_auto] items-center gap-3 xl:h-[4.75rem] xl:grid-cols-[minmax(250px,0.9fr)_auto_minmax(300px,0.9fr)] xl:gap-4">
            <Link to="/" className="group flex min-w-0 items-center gap-2.5 xl:max-w-[80px]" aria-label={COMPANY_NAME}>
              <img
                src={APP_LOGO_URL}
                alt={COMPANY_NAME}
                className="h-9 w-9 shrink-0 rounded-full border border-brand-gold/40 object-cover shadow-[0_10px_22px_hsl(39_92%_56%_/_0.22)] transition-transform duration-300 group-hover:scale-105 xl:h-10 xl:w-10"
              />
            </Link>

            <div className="hidden items-center justify-center gap-0.5 rounded-full border border-white/15 bg-white/10 px-1.5 py-1 shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.12),0_14px_35px_hsl(222_42%_10%_/_0.18)] backdrop-blur-xl xl:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative whitespace-nowrap rounded-full px-3 py-2 font-body text-[13px] font-semibold tracking-wide transition-all duration-300 ${
                    location.pathname === link.path ? 'bg-brand-gold text-brand-black shadow-[0_8px_20px_hsl(39_92%_56%_/_0.25)]' : 'text-white/90 hover:bg-white/10 hover:text-brand-gold'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="hidden min-w-0 items-center justify-end gap-2 xl:flex">
              {isAuthenticated && user ? (
                <>
                  <Link to="/bookings" className="whitespace-nowrap font-body text-[13px] font-semibold text-white/90 transition-colors hover:text-brand-gold">My Bookings</Link>
                  <Link to="/my-orders" className="whitespace-nowrap font-body text-[13px] font-semibold text-white/90 transition-colors hover:text-brand-gold">My Orders</Link>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-body text-[13px] text-white transition-colors hover:border-brand-gold/35 hover:text-brand-gold"
                    >
                      <div className="w-7 h-7 rounded-full bg-brand-gold/20 flex items-center justify-center">
                        <span className="text-brand-gold text-xs font-bold">{user.name.charAt(0)}</span>
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
                        <Link to="/my-orders" className="flex items-center gap-2 px-4 py-2 font-body text-sm text-foreground hover:bg-muted transition-colors">
                          <User size={14} /> My Orders
                        </Link>
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
                  <Link to="/bookings" className="whitespace-nowrap font-body text-[13px] font-semibold text-white/90 transition-colors hover:text-brand-gold">My Bookings</Link>
                  <Link to="/login" className="whitespace-nowrap font-body text-[13px] font-semibold text-white/90 transition-colors hover:text-brand-gold">Login</Link>
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
            className="fixed inset-0 z-[60] nav-dark flex flex-col pt-20 px-8"
          >
            <button onClick={() => setMobileOpen(false)} className="absolute top-5 right-5 text-white" aria-label="Close menu">
              <X size={28} />
            </button>
            <div className="flex flex-col gap-6">
              {navLinks.map((link, i) => (
                <motion.div key={link.path} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                  <Link to={link.path} className={`font-heading text-2xl tracking-wide ${location.pathname === link.path ? 'text-brand-gold' : 'text-white'}`}>
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <div className="h-px bg-brand-gold/20 my-4" />
              <a href={`https://wa.me/91${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="btn-gold px-6 py-3 rounded-lg text-center inline-flex items-center justify-center gap-2">
                <MessageCircle size={18} /> WhatsApp Enquiry
              </a>
              {isAuthenticated && user ? (
                <>
                  <Link to="/profile" className="font-body text-white text-lg">Profile</Link>
                  <Link to="/bookings" className="font-body text-white text-lg">My Bookings</Link>
                  <Link to="/my-orders" className="font-body text-white text-lg">My Orders</Link>
                  {user.role === 'partner' && (
                    <Link to="/partner" className="font-body text-brand-gold text-lg">Partner Panel</Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" className="font-body text-brand-gold text-lg">Admin Panel</Link>
                  )}
                  <button onClick={handleLogout} className="font-body text-white text-lg text-left">Sign Out</button>
                </>
              ) : (
                <>
                  <Link to="/bookings" className="font-body text-white text-lg">My Bookings</Link>
                  <Link to="/login" className="font-body text-white text-lg">Login</Link>
                  <Link to="/register" className="btn-crimson px-6 py-3 rounded-lg text-center mt-2">Sign Up</Link>
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
