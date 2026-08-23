import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, MapPin, Phone, ShieldCheck, Users } from 'lucide-react';
import templeImg from '@/assets/images/temple-about.jpg';
import heroImg from '@/assets/images/hero-vrindavan.jpg';

const pillars = [
  { icon: ShieldCheck, title: 'Verified Stay Network', desc: 'Hotels, dharamshalas, rooms, cabs, and tours are reviewed before guests rely on them.' },
  { icon: MapPin, title: 'Local Braj Assistance', desc: 'Support across Vrindavan, Mathura, Govardhan, Barsana, Gokul, Nandgaon, and nearby pilgrimage routes.' },
  { icon: CheckCircle2, title: 'Transparent Booking Flow', desc: 'Guests see clear dates, payment status, terms, invoices, and support details without confusion.' },
  { icon: Clock, title: 'Responsive Support', desc: 'The team stays reachable for booking, payment, cancellation, check-in, and travel support.' },
];

const stats = [
  ['500+', 'Pilgrims assisted'],
  ['50+', 'Braj temple routes'],
  ['24x7', 'Support intent'],
  ['1 place', 'Stays, cabs, tours'],
];

const About = () => {
  return (
    <div className="pt-16">
      <section className="relative min-h-[560px] overflow-hidden">
        <img src={heroImg} alt="Vrindavan temple view" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-black/86 via-brand-black/58 to-transparent" />
        <div className="container relative mx-auto flex min-h-[560px] items-center px-4">
          <div className="max-w-3xl py-16 text-white">
            <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-brand-gold">About Vrindavan Sarthi</p>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Reliable pilgrimage travel support across Braj.
            </h1>
            <p className="mt-5 max-w-2xl font-body text-base leading-8 text-white/86">
              We help pilgrims find verified stays, practical transport, and guided local support so their energy stays focused on darshan, family, and devotion.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/hotels" className="btn-gold inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm">
                Explore Stays <ArrowRight size={16} />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/12 px-5 py-3 font-body text-sm font-semibold text-white backdrop-blur hover:bg-white/18">
                <Phone size={16} /> Contact Support
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-10 lg:py-14">
        <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-lg border border-border">
            <img src={templeImg} alt="Braj region temple architecture" className="aspect-[4/3] h-full w-full object-cover" loading="lazy" />
          </div>
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-brand-crimson">Our Work</p>
            <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              A practical bridge between pilgrims and trusted local services.
            </h2>
            <p className="mt-4 font-body text-sm leading-7 text-muted-foreground">
              Vrindavan Sarthi Enterprises brings verified hotels, dharamshalas, room inventory, cabs, tours, and support workflows into one dependable platform. We care about clear information, reachable people, and fewer last-minute surprises.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {stats.map(([value, label]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/35 p-4">
                  <p className="font-heading text-3xl font-bold text-brand-crimson">{value}</p>
                  <p className="mt-1 font-body text-xs font-semibold text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-royal-dark py-10 lg:py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-brand-crimson">How We Help</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground">Built for trust, clarity, and local care.</h2>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-gold/12 text-brand-crimson">
                  <item.icon size={21} />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-10 lg:py-14">
        <div className="container mx-auto px-4">
          <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[1fr_0.9fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-brand-crimson">Transparency</p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-foreground">Simple systems behind a smoother Braj visit.</h2>
              <p className="mt-4 font-body text-sm leading-7 text-muted-foreground">
                We keep booking status, payment verification, property policies, support details, and partner operations visible to the right people at the right time. Guests get confidence; partners get structured tools; admins get a clear ledger.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/rooms" className="btn-crimson inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm">
                  Browse Rooms <ArrowRight size={16} />
                </Link>
                <Link to="/cabs" className="rounded-lg border border-border bg-white px-5 py-3 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50">
                  View Cabs
                </Link>
              </div>
            </div>
            <div className="grid border-t border-border bg-muted/30 lg:border-l lg:border-t-0">
              {[
                ['Guest-first', 'Clear booking and support flow from search to check-in.'],
                ['Partner-ready', 'Inventory, payments, notices, bank details, and payout visibility.'],
                ['Admin-controlled', 'Approval, verification, cancellation, and settlement oversight.'],
              ].map(([title, desc]) => (
                <div key={title} className="border-b border-border p-5 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <Users size={18} className="mt-1 text-brand-gold" />
                    <div>
                      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
                      <p className="mt-1 font-body text-sm leading-6 text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
