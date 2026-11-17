import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Phone, ShieldCheck, Heart, Clock, Award } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_LOGO_URL, COMPANY_ADDRESS_LINE, COMPANY_MAP_URL, COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const Footer = () => {
  const { settings } = useSettingsStore();

  const footerLinks = {
    explore: [
      { name: 'Hotels in Vrindavan', path: '/hotels' },
      { name: 'Verified Dharamshalas', path: '/hotels?type=dharamshala' },
      { name: 'Rooms & Stays', path: '/rooms' },
      { name: 'Braj Cabs & Taxis', path: '/cabs' },
      { name: 'Braj Darshan Tours', path: '/tours' },
      { name: 'Explore Braj Heritage', path: '/about' },
    ],
    travel: [
      { name: 'My Bookings', path: '/bookings' },
      { name: 'Guest Profile', path: '/profile' },
      { name: 'Become a Hotel/Cab Partner', path: '/register?role=partner' },
    ],
    support: [
      { name: 'About Vrindavan Sarthi', path: '/about' },
      { name: 'Contact & 24/7 Helpline', path: '/contact' },
      { name: 'Pilgrim Help Desk', path: '/contact' },
      { name: 'Login / Register', path: '/login' },
    ],
    legal: [
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Cancellation & Refund Policy', path: '/cancellation-policy' },
    ],
  };

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        {/* Top Quick-Contact Bar */}
        <div className="mb-12 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          <a
            href={`tel:${COMPANY_PHONE}`}
            className="group flex items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200 hover:border-amber-500/40 hover:bg-slate-900 min-w-0 w-full"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Phone size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-xs font-semibold text-slate-400">Direct Pilgrim Helpline</p>
              <p className="font-body text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                {COMPANY_PHONE}
              </p>
            </div>
          </a>

          <a
            href={`https://wa.me/${COMPANY_PHONE_DIGITS}?text=Jai%20Shree%20Krishna!%20I%20am%20looking%20for%20stay%20in%20Vrindavan.`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200 hover:border-emerald-500/40 hover:bg-slate-900 min-w-0 w-full"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <MessageCircle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-xs font-semibold text-slate-400">Instant WhatsApp Enquiry</p>
              <p className="font-body text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                Chat with Braj Coordinator
              </p>
            </div>
          </a>

          <a
            href={COMPANY_MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-200 hover:border-sky-500/40 hover:bg-slate-900 min-w-0 w-full"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-transform">
              <MapPin size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-xs font-semibold text-slate-400">Location in Holy Braj</p>
              <p className="font-body text-sm font-bold text-white truncate group-hover:text-sky-400 transition-colors">
                {COMPANY_ADDRESS_LINE}
              </p>
            </div>
          </a>
        </div>

        {/* 4 Main Footer Columns */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Mission Statement (2 cols on large screens) */}
          <div className="lg:col-span-2 pr-0 lg:pr-6">
            <Link to="/" className="inline-flex items-center gap-3 mb-4">
              <img
                src={APP_LOGO_URL}
                alt={settings.siteName}
                width={42}
                height={42}
                loading="lazy"
                decoding="async"
                className="h-10 w-10 rounded-full object-cover border border-amber-500/40"
              />
              <span className="font-brand text-2xl font-bold tracking-tight text-white">
                {settings.siteName}
              </span>
            </Link>

            <p className="font-heading italic text-amber-400/90 text-lg mb-3">
              "{settings.motto || 'Pilgrim comfort, transparent pricing, verified temple proximity.'}"
            </p>

            <p className="font-body text-sm leading-relaxed text-slate-400 mb-6 max-w-md">
              Vrindavan Sarthi is dedicated to simplifying pilgrimage across Vrindavan, Mathura, Govardhan, Barsana, and Gokul. We connect yatris with reviewed stays, transparent pricing, and trusted local transport.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1">
                <ShieldCheck size={14} className="text-emerald-400" /> Verified Listings
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1">
                <Award size={14} className="text-amber-400" /> Zero Hidden Charges
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1">
                <Clock size={14} className="text-sky-400" /> Fast Booking Hold
              </span>
            </div>
          </div>

          {/* Explore Links */}
          <div>
            <h4 className="font-body text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Explore Braj
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.explore.map((link) => (
                <li key={`${link.path}-${link.name}`}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pilgrim Travel & Partner Links */}
          <div>
            <h4 className="font-body text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Pilgrim Services
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.travel.map((link) => (
                <li key={`${link.path}-${link.name}`}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support & Legal */}
          <div>
            <h4 className="font-body text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Trust & Legal
            </h4>
            <ul className="space-y-2.5 mb-6">
              {footerLinks.legal.map((link) => (
                <li key={`${link.path}-${link.name}`}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="space-y-2.5 border-t border-slate-800 pt-4">
              {footerLinks.support.map((link) => (
                <li key={`${link.path}-${link.name}`}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="font-body text-xs text-slate-500">
            © {new Date().getFullYear()} {settings.siteName}. All rights reserved. Built for yatris across the sacred Braj Mandal.
          </p>
          <div className="flex items-center gap-1.5 font-body text-xs font-medium text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>100% Secure Payments via Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
