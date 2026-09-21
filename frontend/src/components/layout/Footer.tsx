import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_LOGO_URL, COMPANY_ADDRESS_LINE, COMPANY_MAP_URL, COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const Footer = () => {
  const { settings } = useSettingsStore();

  const footerLinks = {
    explore: [
      { name: 'Hotels', path: '/hotels' },
      { name: 'Rooms', path: '/rooms' },
      { name: 'Cabs', path: '/cabs' },
      { name: 'Tours', path: '/tours' },
    ],
    travel: [
      { name: 'My Bookings', path: '/bookings' },
      { name: 'Profile', path: '/profile' },
      { name: 'Become Partner', path: '/register?role=partner' },
      { name: 'Track Order', path: '/track-order' },
    ],
    support: [
      { name: 'About Us', path: '/about' },
      { name: 'Contact Us', path: '/contact' },
      { name: 'Login / Register', path: '/login' },
    ],
    legal: [
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Cancellation Policy', path: '/cancellation-policy' },
    ],
  };

  return (
    <footer className="bg-brand-black text-primary-foreground">
      <div className="h-px bg-brand-gold/35" />

      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:grid-cols-3">
          <a href={`tel:${COMPANY_PHONE}`} className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 font-body text-sm text-white/76 transition-colors hover:text-brand-gold">
            <Phone size={18} className="text-brand-gold" /> Call for Braj booking
          </a>
          <a href={`https://wa.me/${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 font-body text-sm text-white/76 transition-colors hover:text-brand-gold">
            <MessageCircle size={18} className="text-brand-gold" /> WhatsApp enquiry
          </a>
          <a href={COMPANY_MAP_URL} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 font-body text-sm text-white/76 transition-colors hover:text-brand-gold">
            <MapPin size={18} className="text-brand-gold" /> {COMPANY_ADDRESS_LINE}
          </a>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          <div className="max-w-sm">
            <Link to="/" className="flex items-center gap-2 mb-3 w-fit">
              <img
                src={APP_LOGO_URL}
                alt={settings.siteName}
                className="h-9 w-9 rounded-full object-cover border border-brand-gold/30"
              />
              <span className="font-brand text-xl text-brand-gold">{settings.siteName}</span>
            </Link>
            <p className="font-heading italic text-primary-foreground/78 text-lg mb-3">
              {settings.motto}
            </p>
            <p className="font-body text-sm leading-6 text-primary-foreground/60">
              Hotels, rooms, cabs, tours, and sacred shopping for a smooth Braj pilgrimage.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-body text-sm font-bold uppercase tracking-[0.14em] text-brand-gold">Explore</h4>
            <ul className="space-y-2.5">
              {footerLinks.explore.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-body text-sm font-bold uppercase tracking-[0.14em] text-brand-gold">Travel</h4>
            <ul className="space-y-2.5">
              {footerLinks.travel.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-body text-sm font-bold uppercase tracking-[0.14em] text-brand-gold">Support</h4>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-body text-sm font-bold uppercase tracking-[0.14em] text-brand-gold">Legal</h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-8 pt-5 text-center">
          <p className="font-body text-sm text-primary-foreground/45">
            (c) 2026 {settings.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
