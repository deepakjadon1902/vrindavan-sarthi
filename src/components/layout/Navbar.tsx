import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Hotels', path: '/hotels' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Cabs', path: '/cabs' },
  { name: 'Tours', path: '/tours' },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navBg = scrolled || !isHome
    ? 'glass-nav shadow-lg'
    : 'bg-transparent';

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg}`}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🦚</span>
              <span className="font-brand text-lg lg:text-xl text-brand-gold tracking-wider">
                VrindavanSarthi
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative font-body text-sm tracking-wide transition-colors duration-300 pb-1 ${
                    location.pathname === link.path
                      ? 'text-brand-gold'
                      : 'text-primary-foreground/80 hover:text-brand-gold'
                  }`}
                >
                  {link.name}
                  {location.pathname === link.path && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold rounded-full"
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="hidden lg:flex items-center gap-4">
              <Link
                to="/bookings"
                className="font-body text-sm text-primary-foreground/80 hover:text-brand-gold transition-colors"
              >
                My Bookings
              </Link>
              <Link
                to="/login"
                className="font-body text-sm text-primary-foreground/80 hover:text-brand-gold transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="btn-crimson px-5 py-2 rounded-lg text-sm"
              >
                Sign Up
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-primary-foreground p-2"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] glass-nav flex flex-col pt-20 px-8"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-5 text-primary-foreground"
              aria-label="Close menu"
            >
              <X size={28} />
            </button>

            <div className="flex flex-col gap-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link
                    to={link.path}
                    className={`font-heading text-2xl tracking-wide ${
                      location.pathname === link.path
                        ? 'text-brand-gold'
                        : 'text-primary-foreground/80'
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}

              <div className="h-px bg-brand-gold/20 my-4" />

              <Link to="/bookings" className="font-body text-primary-foreground/70 text-lg">
                My Bookings
              </Link>
              <Link to="/login" className="font-body text-primary-foreground/70 text-lg">
                Login
              </Link>
              <Link to="/register" className="btn-crimson px-6 py-3 rounded-lg text-center mt-2">
                Sign Up
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
