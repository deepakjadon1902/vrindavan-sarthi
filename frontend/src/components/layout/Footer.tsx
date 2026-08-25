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
    account: [
      { name: 'Login / Register', path: '/login' },
      { name: 'Become Partner', path: '/register?role=partner' },
      { name: 'My Bookings', path: '/bookings' },
      { name: 'Profile', path: '/profile' },
    ],
    support: [
      { name: 'About Us', path: '/about' },
      { name: 'Contact Us', path: '/contact' },
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Cancellation Policy', path: '/cancellation-policy' },
    ],
  };

  return (
    <footer className="bg-brand-black text-primary-foreground">
      <div className="h-1 bg-gradient-to-r from-brand-saffron via-brand-gold to-brand-green" />

      <div className="container mx-auto px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-5 grid gap-2 rounded-lg border border-brand-gold/25 bg-white/5 p-2.5 md:grid-cols-3">
          <a href={`tel:${COMPANY_PHONE}`} className="flex items-center gap-3 rounded-md bg-white/5 px-4 py-3 text-sm text-white/80 hover:text-brand-gold transition-colors">
            <Phone size={18} className="text-brand-gold" /> Call for Braj booking
          </a>
          <a href={`https://wa.me/${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md bg-white/5 px-4 py-3 text-sm text-white/80 hover:text-brand-gold transition-colors">
            <MessageCircle size={18} className="text-brand-gold" /> WhatsApp enquiry
          </a>
          <a href={COMPANY_MAP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md bg-white/5 px-4 py-3 text-sm text-white/80 hover:text-brand-gold transition-colors">
            <MapPin size={18} className="text-brand-gold" /> {COMPANY_ADDRESS_LINE}
          </a>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3 w-fit">
              <img
                src={APP_LOGO_URL}
                alt={settings.siteName}
                className="h-9 w-9 rounded-full object-cover border border-brand-gold/30"
              />
              <span className="font-brand text-xl text-brand-gold">{settings.siteName}</span>
            </Link>
            <p className="font-heading italic text-primary-foreground/70 text-lg mb-3">
              {settings.motto}
            </p>
            <p className="font-body text-sm text-primary-foreground/55 leading-relaxed">
              Hotels, rooms, cabs, tours, and sacred shopping for a smooth Braj pilgrimage.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-3">Explore</h4>
            <ul className="space-y-2.5">
              {footerLinks.explore.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-3">Account</h4>
            <ul className="space-y-2.5">
              {footerLinks.account.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-3">Support</h4>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="font-body text-sm text-primary-foreground/65 hover:text-brand-gold transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-5 pt-4 text-center">
          <p className="font-body text-sm text-primary-foreground/45">
            (c) 2026 {settings.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
