import { Link } from 'react-router-dom';

const footerLinks = {
  explore: [
    { name: 'Home', path: '/' },
    { name: 'Hotels', path: '/hotels' },
    { name: 'Rooms', path: '/rooms' },
    { name: 'Cabs', path: '/cabs' },
    { name: 'Tours', path: '/tours' },
  ],
  account: [
    { name: 'Login', path: '/login' },
    { name: 'Register', path: '/register' },
    { name: 'My Bookings', path: '/bookings' },
    { name: 'Profile', path: '/profile' },
  ],
  support: [
    { name: 'About Us', path: '/about' },
    { name: 'Contact Us', path: '/contact' },
    { name: 'Terms of Service', path: '/terms' },
    { name: 'Privacy Policy', path: '/privacy' },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground">
      {/* Golden top border */}
      <div className="h-1 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🦚</span>
              <span className="font-brand text-xl text-brand-gold">VrindavanSarthi</span>
            </div>
            <p className="font-heading italic text-primary-foreground/60 text-lg mb-6">
              Your Divine Guide to Vrindavan
            </p>
            <p className="font-body text-sm text-primary-foreground/50 leading-relaxed">
              Where Devotion Meets Comfort. Experience the sacred city of Lord Krishna with trusted hospitality.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {footerLinks.explore.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-primary-foreground/60 hover:text-brand-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-4">Account</h4>
            <ul className="space-y-2.5">
              {footerLinks.account.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-primary-foreground/60 hover:text-brand-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading text-lg text-brand-gold mb-4">Support</h4>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-primary-foreground/60 hover:text-brand-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-primary-foreground/10 mt-12 pt-8 text-center">
          <p className="font-body text-sm text-primary-foreground/40">
            © 2025 VrindavanSarthi. Crafted with ❤️ in the Land of Krishna, Vrindavan 🦚
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
