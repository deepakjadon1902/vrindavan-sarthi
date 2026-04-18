import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hotel, BedDouble, Car, Map, Users, Shield, Clock, MapPin, ChevronDown, ArrowRight, ShoppingBag } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import TestimonialCard from '@/components/shared/TestimonialCard';
import { useProductStore } from '@/store/productStore';

import heroImg from '@/assets/images/hero-vrindavan.jpg';

const services = [
  { icon: Hotel, title: 'Hotels', desc: 'Verified hotels near sacred temples', link: '/hotels' },
  { icon: BedDouble, title: 'Rooms', desc: 'Budget to premium room options', link: '/rooms' },
  { icon: Car, title: 'Cabs', desc: 'Reliable local & outstation cabs', link: '/cabs' },
  { icon: Map, title: 'Tours', desc: 'Guided spiritual tour packages', link: '/tours' },
  { icon: ShoppingBag, title: 'Shop', desc: 'Sacred items & souvenirs', link: '/shop' },
];

const stats = [
  { label: 'Happy Pilgrims', value: '500+' },
  { label: 'Hotels Listed', value: '50+' },
  { label: 'Tour Packages', value: '30+' },
  { label: '24/7 Support', value: '✓' },
];

const testimonials = [
  { name: 'Priya Sharma', location: 'Delhi', rating: 5, text: 'VrindavanSarthi made our family trip to Vrindavan absolutely seamless. The hotel was right next to Banke Bihari Temple!' },
  { name: 'Rajesh Kumar', location: 'Mumbai', rating: 5, text: 'The guided temple tour was incredible. Our guide knew every story, every detail. A truly divine experience.' },
  { name: 'Anita Devi', location: 'Jaipur', rating: 4, text: 'Booked a cab and hotel through this platform. Everything was smooth and the prices were very reasonable.' },
];

const whyUs = [
  { icon: MapPin, title: 'Sacred Location', desc: 'Properties handpicked near the most sacred sites of Vrindavan' },
  { icon: Shield, title: 'Verified Listings', desc: 'Every hotel, room, and cab is personally verified for quality' },
  { icon: Clock, title: 'Easy Booking', desc: 'Book in under 2 minutes with instant confirmation' },
  { icon: Users, title: '24/7 Support', desc: 'Our team is always available to help during your sacred journey' },
];

const Home = () => {
  const navigate = useNavigate();
  const { products } = useProductStore();
  const [hotels, setHotels] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);

  const featuredProducts = products.filter(p => p.inStock).slice(0, 4);

  useEffect(() => {
    try {
      const hData = localStorage.getItem('vvs_hotels');
      if (hData) setHotels(JSON.parse(hData).filter((h: any) => h.status === 'active').slice(0, 3));
      const tData = localStorage.getItem('vvs_tours');
      if (tData) setTours(JSON.parse(tData).filter((t: any) => t.status === 'active').slice(0, 3));
    } catch {}
  }, []);

  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <img src={heroImg} alt="Vrindavan temples at sunset" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/50 to-foreground/80" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="font-body text-sm tracking-[0.3em] uppercase text-brand-gold mb-4">
            ✦ Vrindavan, Mathura, UP ✦
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="font-brand text-4xl md:text-6xl lg:text-7xl text-brand-gold mb-4 leading-tight">
            VrindavanSarthi
          </motion.h1>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="font-heading italic text-2xl md:text-3xl text-primary-foreground/90 mb-3">
            Your Divine Guide to Vrindavan
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="font-body text-primary-foreground/60 text-sm md:text-base tracking-wider mb-10">
            Hotels • Rooms • Cabs • Tours — All in One Place
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/hotels" className="btn-gold px-8 py-3.5 rounded-xl text-base font-semibold">Explore Now →</Link>
            <Link to="/tours" className="px-8 py-3.5 rounded-xl text-base font-body font-semibold border-2 border-primary-foreground/30 text-primary-foreground hover:border-brand-gold hover:text-brand-gold transition-all">View Tours</Link>
          </motion.div>
        </div>
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ChevronDown className="text-brand-gold" size={28} />
        </motion.div>
      </section>

      {/* ===== STATS ===== */}
      <section className="bg-primary py-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-3xl md:text-4xl font-bold text-brand-gold">{stat.value}</p>
                <p className="font-body text-sm text-primary-foreground/80 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Our Services" title="Everything You Need in Vrindavan" subtitle="From comfortable stays to guided temple tours, we've got your sacred journey covered" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <Link key={service.title} to={service.link} className="bg-card rounded-xl p-8 text-center border border-border card-hover group">
                <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-brand-gold/20 transition-colors">
                  <service.icon className="text-brand-gold" size={28} />
                </div>
                <h3 className="font-heading text-xl font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="font-body text-sm text-muted-foreground">{service.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED HOTELS ===== */}
      <section className="section-cream py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Featured Stays" title="Handpicked Hotels in Vrindavan" subtitle="Comfortable and affordable stays near the most sacred temples" />
          {hotels.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map((hotel) => (
                  <ListingCard key={hotel.id} image={hotel.image} images={hotel.images} name={hotel.name} location={hotel.location} price={hotel.pricePerNight} rating={hotel.rating} reviewCount={0} amenities={hotel.amenities || []} onViewDetails={() => navigate(`/hotels/${hotel.id}`)} />
                ))}
              </div>
              <div className="text-center mt-10">
                <Link to="/hotels" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Hotels <ArrowRight size={18} /></Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="font-body text-muted-foreground mb-4">No hotels listed yet. Check back soon!</p>
              <Link to="/hotels" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Hotels <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED TOURS ===== */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Spiritual Journeys" title="Popular Tour Packages" subtitle="Experience the divine essence of Vrindavan with our guided tours" />
          {tours.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tours.map((tour) => (
                  <ListingCard key={tour.id} image={tour.image} name={tour.name} location={tour.duration} price={tour.pricePerPerson} priceLabel="/person" rating={0} reviewCount={0} badge={tour.duration} amenities={tour.includes || []} onViewDetails={() => navigate(`/tours/${tour.id}`)} />
                ))}
              </div>
              <div className="text-center mt-10">
                <Link to="/tours" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Tours <ArrowRight size={18} /></Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="font-body text-muted-foreground mb-4">No tours listed yet. Check back soon!</p>
              <Link to="/tours" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Tours <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED PRODUCTS (Shop) ===== */}
      {featuredProducts.length > 0 && (
        <section className="py-16 lg:py-24 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 rounded-full bg-brand-gold/15 blur-3xl" />
          <div className="container mx-auto px-4 relative">
            <SectionTitle label="Divine Shop" title="Sacred Souvenirs from Vrindavan" subtitle="Take a piece of Vrindavan's blessings home with you" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((p) => (
                <Link key={p.id} to={`/shop/${p.id}`} className="glass-panel rounded-2xl overflow-hidden water-hover group">
                  <div className="h-48 overflow-hidden relative">
                    <img src={p.images[0] || '/placeholder.svg'} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 glossy-sheen pointer-events-none" />
                    <span className="absolute top-2 left-2 glass-chip px-2 py-0.5 rounded-full font-body text-[10px] capitalize">{p.category}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-base font-semibold text-foreground truncate">{p.name}</h3>
                    <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-display text-lg font-bold text-brand-crimson">₹{p.price.toLocaleString('en-IN')}</span>
                      <span className="font-body text-[10px] text-brand-green font-medium flex items-center gap-1"><ShoppingBag size={11} />Buy</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link to="/shop" className="metallic-gold px-8 py-3 rounded-xl inline-flex items-center gap-2 font-semibold">Visit Shop <ArrowRight size={18} /></Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== WHY US ===== */}
      <section className="section-cream py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Why Choose Us" title="Your Trusted Companion in Vrindavan" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyUs.map((item) => (
              <div key={item.title} className="text-center p-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="text-primary" size={24} />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="font-body text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <SectionTitle label="Testimonials" title="What Our Pilgrims Say" subtitle="Real experiences from real devotees" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <TestimonialCard key={t.name} {...t} avatar="" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-saffron to-primary" />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-primary-foreground mb-4">Begin Your Sacred Journey Today</h2>
          <p className="font-body text-primary-foreground/80 mb-8 max-w-xl mx-auto">Book your stay, cab, or temple tour in Vrindavan with complete peace of mind</p>
          <Link to="/hotels" className="btn-gold px-10 py-4 rounded-xl text-lg inline-flex items-center gap-2">Get Started <ArrowRight size={20} /></Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
