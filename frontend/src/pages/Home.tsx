import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, CarTaxiFront, MapPinned, Users, Shield, Clock, MapPin, ChevronDown, ArrowRight, ShoppingBag, MessageCircle, BedDouble, CalendarDays, UserRound, BadgeCheck, Headphones, Landmark, Gift } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import TestimonialCard from '@/components/shared/TestimonialCard';
import { useProductStore } from '@/store/productStore';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { COMPANY_PHONE_DIGITS } from '@/lib/brand';
import { useSettingsStore } from '@/store/settingsStore';

const heroImg = '/backgrounds/braj-govardhan-hero.jpeg';

const services = [
  {
    icon: Building2,
    title: 'Stay Near The Temples',
    desc: 'Verified hotels, dharamshalas, and rooms close to Banke Bihari, ISKCON, and Prem Mandir.',
    link: '/hotels',
    cta: 'Explore stays',
  },
  {
    icon: CarTaxiFront,
    title: 'Private Cab Support',
    desc: 'Fixed route-wise cab booking for Braj, Govardhan, Barsana, Gokul, airport transfers, and local darshan.',
    link: '/cabs',
    cta: 'View cabs',
  },
  {
    icon: MapPinned,
    title: 'Curated Braj Yatra',
    desc: 'Plan guided spiritual itineraries with destinations, duration, budget, and local travel support in one flow.',
    link: '/tours',
    cta: 'See packages',
  },
  {
    icon: ShoppingBag,
    title: 'Sacred Braj Shop',
    desc: 'Order devotional products, souvenirs, and pooja essentials with tracking and admin-verified payments.',
    link: '/shop',
    cta: 'Visit shop',
  },
];

const plannerServices = [
  { key: 'hotels', label: 'Dharamshalas', path: '/hotels', type: 'dharamshala', icon: BedDouble, hint: 'Book now' },
  { key: 'rooms', label: 'Hotels', path: '/hotels', type: 'hotel', icon: Building2, hint: 'Book now' },
  { key: 'cabs', label: 'Taxi & Cab', path: '/cabs', icon: CarTaxiFront, hint: 'Book now' },
  { key: 'tours', label: 'Tour Packages', path: '/tours', icon: Gift, hint: 'View' },
  { key: 'shop', label: 'Shopping', path: '/shop', icon: ShoppingBag, hint: 'Shop now' },
] as const;

type PlannerServiceKey = (typeof plannerServices)[number]['key'];

const stats = [
  { label: 'Happy Pilgrims', value: '500+' },
  { label: 'Hotels Listed', value: '50+' },
  { label: 'Tour Packages', value: '30+' },
  { label: 'Support Desk', value: '24/7' },
];

const trustItems = [
  { icon: BadgeCheck, title: 'Trusted Services', desc: 'Reliable and secure booking' },
  { icon: MapPinned, title: 'Many Choices', desc: 'Dharamshalas, hotels, taxis, and packages' },
  { icon: Headphones, title: '24x7 Support', desc: 'Always here to help you' },
  { icon: Landmark, title: 'Easy Braj Travel', desc: 'Simple, pleasant, and stress-free' },
];

const quickLocations = [
  { label: 'Govardhan', value: 'Govardhan' },
  { label: 'Barsana', value: 'Barsana' },
  { label: 'Gokul', value: 'Gokul' },
  { label: 'Mathura', value: 'Mathura' },
  { label: 'Vrindavan', value: 'Vrindavan' },
];

const testimonials = [
  { name: 'Priya Sharma', location: 'Delhi', rating: 5, text: 'Vrindavan Sarthi Enterprises made our family trip across Braj absolutely seamless. The hotel was right next to Banke Bihari Temple!' },
  { name: 'Rajesh Kumar', location: 'Mumbai', rating: 5, text: 'The guided temple tour was incredible. Our guide knew every story, every detail. A truly divine experience.' },
  { name: 'Anita Devi', location: 'Jaipur', rating: 4, text: 'Booked a cab and hotel through this platform. Everything was smooth and the prices were very reasonable.' },
];

const whyUs = [
  { icon: MapPin, title: 'Sacred Location', desc: 'Properties handpicked near the most sacred sites of Braj' },
  { icon: Shield, title: 'Verified Listings', desc: 'Every hotel, room, and cab is personally verified for quality' },
  { icon: Clock, title: 'Easy Booking', desc: 'Book in under 2 minutes with instant confirmation' },
  { icon: Users, title: '24/7 Support', desc: 'Our team is always available to help during your sacred journey' },
];

const Home = () => {
  const navigate = useNavigate();
  const { products, fetchProducts } = useProductStore();
  const shopEnabled = useSettingsStore((s) => s.settings.shopEnabled);
  const [plannerService, setPlannerService] = useState<PlannerServiceKey>('hotels');
  const [plannerQuery, setPlannerQuery] = useState('');
  const [plannerCheckIn, setPlannerCheckIn] = useState('');
  const [plannerCheckOut, setPlannerCheckOut] = useState('');
  const [plannerGuests, setPlannerGuests] = useState(1);
  const [plannerRooms, setPlannerRooms] = useState(1);
  const [hotels, setHotels] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [cabs, setCabs] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const featuredLimit = 4;

  const visibleServices = shopEnabled ? services : services.filter((service) => service.link !== '/shop');
  const visiblePlannerServices = shopEnabled ? plannerServices : plannerServices.filter((service) => service.key !== 'shop');
  const serviceGridClass = visibleServices.length >= 4
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'
    : 'mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
  const featuredProducts = shopEnabled ? products.filter(p => p.inStock).slice(0, 4) : [];
  const activePlanner = visiblePlannerServices.find((item) => item.key === plannerService) || visiblePlannerServices[0];

  const buildPlannerUrl = (service = activePlanner) => {
    const query = plannerQuery.trim();
    const params = new URLSearchParams();
    if ('type' in service && service.type) params.set('type', service.type);
    if (query && service.key !== 'shop') params.set('q', query);
    if (plannerCheckIn && service.key !== 'shop') params.set('checkIn', plannerCheckIn);
    if (plannerCheckOut && service.key !== 'shop') params.set('checkOut', plannerCheckOut);
    if (plannerGuests > 1 && service.key !== 'shop') params.set('guests', String(plannerGuests));
    if (plannerRooms > 1 && (service.key === 'hotels' || service.key === 'rooms')) params.set('rooms', String(plannerRooms));
    const qs = params.toString();
    return `${service.path}${qs ? `?${qs}` : ''}`;
  };

  const runPlannerSearch = () => {
    navigate(buildPlannerUrl());
  };

  useEffect(() => {
    if (!shopEnabled && plannerService === 'shop') setPlannerService('hotels');
  }, [plannerService, shopEnabled]);

  useEffect(() => {
    const loadListings = async () => {
      // Show cached lists fast (if any), but always revalidate from API so new listings reflect quickly.
      try {
        const cachedHotels = localStorage.getItem('vvs_hotels');
        if (cachedHotels) setHotels(JSON.parse(cachedHotels).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedRooms = localStorage.getItem('vvs_room_types');
        if (cachedRooms) setRoomTypes(JSON.parse(cachedRooms).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedCabs = localStorage.getItem('vvs_cabs');
        if (cachedCabs) setCabs(JSON.parse(cachedCabs).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedTours = localStorage.getItem('vvs_tours');
        if (cachedTours) setTours(JSON.parse(cachedTours).filter((t: any) => t?.status === 'active').slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }

      const [hotelsRes, roomsRes, cabsRes, toursRes] = await Promise.allSettled([
        api.get('/hotels'),
        api.get('/room-types'),
        api.get('/cabs'),
        api.get('/tours', { params: { withImages: true } }),
      ]);

      if (hotelsRes.status === 'fulfilled') {
        const data = Array.isArray(hotelsRes.value.data?.data) ? hotelsRes.value.data.data : [];
        setHotels(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_hotels', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setHotels([]);

      if (roomsRes.status === 'fulfilled') {
        const data = Array.isArray(roomsRes.value.data?.data) ? roomsRes.value.data.data : [];
        setRoomTypes(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_room_types', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setRoomTypes([]);

      if (cabsRes.status === 'fulfilled') {
        const data = Array.isArray(cabsRes.value.data?.data) ? cabsRes.value.data.data : [];
        setCabs(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_cabs', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setCabs([]);

      if (toursRes.status === 'fulfilled') {
        const data = Array.isArray(toursRes.value.data?.data) ? toursRes.value.data.data : [];
        const active = data.filter((t: any) => t?.status === 'active').slice(0, featuredLimit);
        setTours(active);
        try { localStorage.setItem('vvs_tours', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setTours([]);
    };

    if (shopEnabled) void fetchProducts();
    void loadListings();

    const unsubListings = subscribeAppEvent('listing:changed', () => void loadListings());
    const unsubProducts = subscribeAppEvent('product:changed', () => {
      if (shopEnabled) void fetchProducts();
    });
    const onFocus = () => {
      void loadListings();
      if (shopEnabled) void fetchProducts();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      unsubListings();
      unsubProducts();
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchProducts, shopEnabled]);

  const getRoomPrice = (roomType: any) => {
    const base = Number(roomType?.pricePerNight || 0);
    const hotel = roomType?.hotel || {};
    if (!hotel?.taxEnabled) return base;
    const percent = hotel?.gstMode === 'automatic'
      ? base <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const getHotelStartingPrice = (hotel: any) => {
    const prices = [
      hotel?.pricePerNight,
      hotel?.pricePerBed,
      hotel?.priceDoubleAC,
      hotel?.priceDoubleNonAC,
      hotel?.priceSingleAC,
      hotel?.priceSingleNonAC,
    ]
      .map((price) => Number(price || 0))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return undefined;
    const base = Math.min(...prices);
    if (!hotel?.taxEnabled) return base;
    const percent = hotel?.gstMode === 'automatic'
      ? base <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  return (
    <div>

      {/* ===== HERO ===== */}
      <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden pb-7 pt-24 sm:min-h-[720px] lg:min-h-[690px] lg:pt-20">
        <img src={heroImg} alt="Govardhan hill and Braj sunset view" className="absolute inset-x-0 -top-[10%] h-[114%] w-full object-cover object-bottom" width={1600} height={897} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-brand-black/82" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/30 to-transparent" />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.24em] text-brand-black drop-shadow-[0_1px_10px_hsl(0_0%_100%_/_0.65)] sm:text-xs"
          >
            Braj Mandal, Uttar Pradesh
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
            className="mb-3 font-heading text-5xl font-bold leading-none text-brand-black drop-shadow-[0_2px_16px_hsl(0_0%_100%_/_0.62)] sm:text-6xl md:text-7xl lg:text-8xl"
          >
            Vrindavan Sarthi
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="mb-1 max-w-4xl font-heading text-2xl font-extrabold leading-tight text-brand-black drop-shadow-[0_2px_14px_hsl(0_0%_100%_/_0.85)] md:text-3xl"
          >
            Trusted hotel, dharamshala, and room booking across Braj
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="mb-5 max-w-3xl font-body text-sm font-extrabold leading-6 text-brand-black drop-shadow-[0_2px_12px_hsl(0_0%_100%_/_0.82)] md:text-base"
          >
            Find verified stays near temples in Govardhan, Barsana, Gokul, Mathura, Vrindavan, and the wider Braj area.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15 }}
            className="travel-search-panel mt-3 w-full max-w-[930px] overflow-hidden rounded-lg border border-brand-gold/25 bg-brand-black/88 text-left shadow-2xl backdrop-blur-xl"
          >
            <div className={`grid ${visiblePlannerServices.length >= 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} border-b border-white/12`}>
              {visiblePlannerServices.map((item) => {
                const Icon = item.icon;
                const active = item.key === plannerService;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPlannerService(item.key);
                      navigate(buildPlannerUrl(item));
                    }}
                    className={`min-h-[76px] border-r border-white/12 px-3 py-3 text-center transition-all last:border-r-0 ${
                      active
                        ? 'bg-black/28 text-brand-gold'
                        : 'text-white hover:bg-white/8 hover:text-brand-gold'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2 font-body text-[12px] font-extrabold uppercase tracking-[0.02em]">
                      <Icon size={24} className={active ? 'text-brand-saffron' : 'text-brand-saffron'} /> {item.label}
                    </span>
                    <span className="mt-1 block font-body text-[11px] font-semibold text-white/80">{item.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-px bg-border/70 p-2.5 lg:grid-cols-[1.45fr_0.7fr_0.7fr_0.9fr_auto]">
              <label className="relative block bg-white">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <input
                  value={plannerQuery}
                  onChange={(e) => setPlannerQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  placeholder="Search city, area, or property"
                  className="h-14 w-full bg-white pl-11 pr-3 font-body text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-gold/35"
                />
              </label>
              <label className="relative block bg-white">
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="date"
                  value={plannerCheckIn}
                  onChange={(e) => setPlannerCheckIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="h-14 w-full bg-white pl-11 pr-3 font-body text-[13px] font-semibold text-muted-foreground outline-none transition focus:ring-2 focus:ring-brand-gold/35"
                  aria-label="Check in"
                />
              </label>
              <label className="relative block bg-white">
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="date"
                  value={plannerCheckOut}
                  onChange={(e) => setPlannerCheckOut(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="h-14 w-full bg-white pl-11 pr-3 font-body text-[13px] font-semibold text-muted-foreground outline-none transition focus:ring-2 focus:ring-brand-gold/35"
                  aria-label="Check out"
                />
              </label>
              <label className="relative grid h-14 grid-cols-2 gap-px bg-border/70">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="number"
                  min={1}
                  value={plannerGuests}
                  onChange={(e) => setPlannerGuests(Math.max(1, Number(e.target.value || 1)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="min-w-0 bg-white pl-9 pr-2 font-body text-[13px] font-semibold text-muted-foreground outline-none transition focus:ring-2 focus:ring-brand-gold/35"
                  aria-label="Guests"
                />
                <input
                  type="number"
                  min={1}
                  value={plannerRooms}
                  onChange={(e) => setPlannerRooms(Math.max(1, Number(e.target.value || 1)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="min-w-0 bg-white px-2 font-body text-[13px] font-semibold text-muted-foreground outline-none transition focus:ring-2 focus:ring-brand-gold/35"
                  aria-label="Rooms"
                />
              </label>
              <button
                type="button"
                onClick={runPlannerSearch}
                className="h-14 bg-brand-saffron px-6 font-body text-sm font-extrabold text-white transition hover:bg-brand-crimson"
              >
                Search
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-gold/20 bg-brand-black/72 px-3.5 py-3">
              <div className="flex flex-wrap gap-2">
                {quickLocations.map((location) => (
                  <button key={location.value} type="button" onClick={() => setPlannerQuery(location.value)} className="inline-flex min-h-8 items-center rounded-full border border-white/55 bg-white/10 px-3.5 py-1 font-body text-[12px] font-extrabold text-white shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.16)] transition hover:border-brand-gold hover:bg-brand-gold/18 hover:text-white">
                    {location.label}
                  </button>
                ))}
              </div>
              <a href={`https://wa.me/${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-gold/45 bg-brand-gold/12 px-3.5 py-1 font-body text-xs font-extrabold text-white transition hover:bg-brand-gold/20">
                <MessageCircle size={14} /> WhatsApp Help
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="mt-4 grid w-full max-w-[930px] overflow-hidden rounded-lg border border-white/12 bg-brand-black/70 text-left backdrop-blur-lg sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-white/8 text-brand-gold">
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-body text-[12px] font-extrabold text-white">{item.title}</p>
                    <p className="font-body text-[11px] leading-4 text-white/70">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
        <motion.div
          animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 md:block"
        >
          <ChevronDown className="text-brand-gold" size={28} />
        </motion.div>
      </section>

      {/* ===== STATS ===== */}
      <section className="bg-brand-black py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={stat.label} className={`text-center py-2 ${i !== stats.length - 1 ? 'md:border-r md:border-white/10' : ''}`}>
                <p className="font-heading text-3xl md:text-4xl font-bold text-brand-gold">{stat.value}</p>
                <p className="font-body text-sm text-white/60 mt-1 tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== JOURNEY CARDS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Travel Desk"
            title="Plan The Complete Braj Journey"
            subtitle="Useful booking paths, verified information, and local support arranged around how travellers actually decide."
          />
          <div className={serviceGridClass}>
            {visibleServices.map((service) => (
              <Link
                key={service.title}
                to={service.link}
                className="travel-card group flex min-h-[170px] flex-col rounded-lg border border-border/70 p-4 text-left hover:border-brand-gold/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-saffron/12 group-hover:bg-brand-saffron/20 transition-colors">
                    <service.icon className="text-brand-saffron" size={22} />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 font-body text-[11px] font-bold text-muted-foreground">
                    Verified flow
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold leading-tight text-foreground">{service.title}</h3>
                <p className="mt-2 flex-1 font-body text-sm leading-relaxed text-muted-foreground">{service.desc}</p>
                <span className="mt-3 inline-flex items-center gap-2 font-body text-sm font-bold text-brand-crimson">
                  {service.cta} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED HOTELS ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/hotel-room.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-white/75" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle
            label="Featured Stays"
            title="Handpicked Hotels & Dharamshalas in Braj"
            subtitle="Comfortable and affordable stays near the most sacred temples"
          />
          {hotels.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {hotels.map((hotel) => (
                  <ListingCard
                    key={hotel._id}
                    variant="hotel"
                    image={hotel.image}
                    images={hotel.images}
                    name={hotel.name}
                    badge={hotel?.propertyType === 'dharamshala' ? 'Dharamshala' : 'Hotel'}
                    location={hotel.location}
                    price={hotel?.propertyType === 'dharamshala' ? undefined : getHotelStartingPrice(hotel)}
                    priceLabel={hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                    rating={Number(hotel.rating || 0)}
                    reviewCount={Number(hotel.reviewCount || 0)}
                    amenities={hotel.amenities || []}
                    onViewDetails={() => {
                      prefetchDetail('hotels', hotel._id, hotel);
                      navigate(`/hotels/${hotel._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/hotels" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Hotels <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No hotels listed yet. Check back soon!</p>
              <Link to="/hotels" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Hotels <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED ROOMS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Room Options"
            title="Browse Rooms"
            subtitle="Choose comfortable room types from verified Braj hotels and dharamshalas"
          />
          {roomTypes.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {roomTypes.map((roomType) => (
                  <ListingCard
                    key={roomType._id}
                    image={roomType?.images?.[0] || roomType?.hotel?.image}
                    images={roomType?.images?.length ? roomType.images : roomType?.hotel?.images}
                    name={roomType.name}
                    location={`${roomType?.hotel?.name || ''}${roomType?.hotel?.location ? ` - ${roomType.hotel.location}` : ''}`}
                    price={roomType?.hotel?.propertyType === 'dharamshala' ? undefined : getRoomPrice(roomType)}
                    priceLabel={roomType?.hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                    rating={0}
                    reviewCount={0}
                    amenities={roomType?.amenities || roomType?.hotel?.amenities || []}
                    meta={Number(roomType?.totalCount || 0) > 0 ? `${roomType.totalCount} rooms` : undefined}
                    badge={roomType?.hotel?.propertyType === 'dharamshala' ? 'Dharamshala' : undefined}
                    ctaLabel={roomType?.hotel?.propertyType === 'dharamshala' ? 'WhatsApp / Call' : 'Book Room'}
                    onViewDetails={() => {
                      prefetchDetail('roomTypes', roomType._id, roomType);
                      navigate(`/room-types/${roomType._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/rooms" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Rooms <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No rooms listed yet. Check back soon!</p>
              <Link to="/rooms" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Rooms <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED CABS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Transportation"
            title="Available Cabs"
            subtitle="Reliable cabs listed by verified partners"
          />
          {cabs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cabs.map((cab) => (
                  <ListingCard
                    key={cab._id}
                    image={cab.image}
                    images={cab.images}
                    name={cab.vehicleName}
                    location={cab.routes?.join(' - ') || ''}
                    price={0}
                    priceLabel=""
                    rating={0}
                    reviewCount={0}
                    amenities={[cab.vehicleType, `${cab.capacity} Seater`]}
                    badge="30% Advance"
                    badgeColor="green"
                    onViewDetails={() => {
                      prefetchDetail('cabs', cab._id, cab);
                      navigate(`/cabs/${cab._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/cabs" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Cabs <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No cabs listed yet. Check back soon!</p>
              <Link to="/cabs" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Cabs <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED TOURS ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/parikrama.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-14" />
        <div className="absolute inset-0 bg-white/80" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle
            label="Spiritual Journeys"
            title="Popular Tour Packages"
            subtitle="Experience the divine essence of Braj with our guided tours"
          />
          {tours.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tours.map((tour) => (
                  <ListingCard
                    key={tour._id}
                    image={tour.image}
                    images={tour.images}
                    name={tour.name}
                    location={tour.duration}
                    price={tour.pricePerPerson}
                    priceLabel="/person"
                    rating={0}
                    reviewCount={0}
                    badge={tour.duration}
                    amenities={tour.includes || []}
                    onViewDetails={() => {
                      prefetchDetail('tours', tour._id, tour);
                      navigate(`/tours/${tour._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/tours" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Tours <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No tours listed yet. Check back soon!</p>
              <Link to="/tours" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Tours <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED PRODUCTS (Shop) ===== */}
      {featuredProducts.length > 0 && (
        <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
          <div className="container mx-auto px-4 relative">
            <SectionTitle
              label="Divine Shop"
              title="Sacred Souvenirs from Braj"
              subtitle="Take a piece of Braj's blessings home with you"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/shop/${p.id}`}
                  className="premium-surface overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 group"
                >
                  <div className="aspect-[4/3] overflow-hidden relative bg-white">
                    <img
                      src={p.images[0] || '/placeholder.svg'}
                      alt={p.name}
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-2 left-2 rounded-full border border-white/60 bg-white/95 px-2.5 py-1 font-body text-[10px] capitalize font-semibold text-foreground shadow-sm">
                      {p.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-[15px] font-bold text-foreground truncate">{p.name}</h3>
                    <p className="font-body text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-display text-[17px] font-extrabold text-brand-crimson">
                        Rs. {p.price.toLocaleString('en-IN')}
                      </span>
                      <span className="font-body text-[11px] text-brand-green font-semibold flex items-center gap-1">
                        <ShoppingBag size={12} /> Buy
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-4">
              <Link to="/shop" className="btn-gold px-8 py-3.5 rounded-lg inline-flex items-center gap-2 font-semibold text-[15px]">
                Visit Shop <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== WHY US ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/temple-interior.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-white/80" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle label="Why Choose Us" title="Your Trusted Companion in Braj" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyUs.map((item) => (
              <div
                key={item.title}
                className="text-center p-5 rounded-lg border border-border/50 bg-card/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/16 group-hover:scale-105 transition-all duration-200">
                  <item.icon className="text-primary" size={24} />
                </div>
                <h3 className="font-heading text-[17px] font-bold text-foreground mb-2">{item.title}</h3>
                <p className="font-body text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Testimonials"
            title="What Our Pilgrims Say"
            subtitle="Real experiences from real devotees"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard key={t.name} {...t} avatar="" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRUST STORY BANNER ===== */}
      <section className="relative overflow-hidden bg-background py-6 lg:py-8">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_hsl(222_42%_10%_/_0.08)]">
            <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
              <div className="relative min-h-[320px] overflow-hidden p-6 sm:p-8 lg:p-10">
                <img
                  src={heroImg}
                  alt="Govardhan and Braj landscape"
                  className="absolute -top-[12%] left-0 h-[114%] w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-brand-black/76" />
                <div className="relative max-w-2xl">
                  <p className="mb-3 font-body text-[11px] font-bold uppercase tracking-[0.22em] text-brand-crimson">
                    Our Dream
                  </p>
                  <h2 className="mb-4 font-heading text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                    To make every Braj visit feel guided, honest, and cared for.
                  </h2>
                  <p className="font-body text-[14px] leading-7 text-white sm:text-[15px]">
                    Vrindavan Sarthi Enterprises was created to bring hotels, dharamshalas, rooms, cabs, tours{shopEnabled ? ', and sacred products' : ''} across Braj into one dependable place. Our motivation is simple: pilgrims should spend their energy on darshan, family, and devotion, not on confusion, hidden details, or last-minute uncertainty.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/about" className="btn-gold inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold">
                      Know Our Story <ArrowRight size={16} />
                    </Link>
                    <Link to="/contact" className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50 hover:text-brand-crimson">
                      Talk to Support <MessageCircle size={16} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-0 border-t border-border bg-white lg:border-l lg:border-t-0">
                {[
                  { icon: Shield, title: 'Verified Before Listing', desc: `Hotels, room types, cabs, tours${shopEnabled ? ', and products' : ''} are reviewed before customers rely on them.` },
                  { icon: Clock, title: 'Clear Booking Flow', desc: 'Dates, prices, payment status, invoices, and support details stay visible in a clean structure.' },
                  { icon: Users, title: 'Human Help When Needed', desc: 'For enquiry, booking support, order support, or payment help, users can reach the team directly.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 border-b border-border p-5 last:border-b-0 sm:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/12 text-brand-crimson">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-heading text-[16px] font-bold text-foreground">{item.title}</h3>
                      <p className="mt-1 font-body text-[13px] leading-6 text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid border-t border-border bg-muted/30 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Stays', value: 'Temple-side verified options' },
                { label: 'Rooms', value: 'Room inventory with availability' },
                { label: 'Cabs & Tours', value: 'Braj travel planning support' },
                ...(shopEnabled ? [{ label: 'Shop', value: 'Tracked devotional orders' }] : []),
              ].map((item) => (
                <div key={item.label} className="border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-brand-crimson">{item.label}</p>
                  <p className="mt-1 font-body text-[13px] font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
