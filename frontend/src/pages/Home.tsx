import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  CarTaxiFront,
  MapPinned,
  Users,
  Shield,
  Clock,
  MapPin,
  ArrowRight,
  ShoppingBag,
  MessageCircle,
  BedDouble,
  CalendarDays,
  UserRound,
  BadgeCheck,
  Headphones,
  Landmark,
  Gift,
  Search,
  ShieldCheck,
  Star,
  Award,
  Phone,
  RefreshCw,
} from 'lucide-react';
import ListingCard from '@/components/shared/ListingCard';
import LocationDiscoverySection from '@/components/discovery/LocationDiscoverySection';
import OptimizedImage from '@/components/shared/OptimizedImage';
import { useProductStore } from '@/store/productStore';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';
import { useSettingsStore } from '@/store/settingsStore';
import { getPropertyTypeLabel, isDharamshalaType } from '@/lib/propertyTypes';
import { groupItemsIntoLocationSections } from '@/lib/geoDiscovery';
import hotelRoomBackdrop from '@/assets/images/hotel-1.jpg';
import templeInteriorBackdrop from '@/assets/images/temple-about.jpg';
import parikramaBackdrop from '@/assets/images/tour-1.jpg';

const heroImg = '/backgrounds/braj-govardhan-hero.jpeg';

const plannerServices = [
  { key: 'dharamshalas', label: 'Dharamshalas', path: '/hotels?type=dharamshala', type: 'dharamshala', icon: BedDouble },
  { key: 'hotels', label: 'Hotels', path: '/hotels?type=hotel', type: 'hotel', icon: Building2 },
  { key: 'home_stays', label: 'Home Stays', path: '/hotels?type=home_stay', type: 'home_stay', icon: Landmark },
  { key: 'cabs', label: 'Cabs & Taxis', path: '/cabs', icon: CarTaxiFront },
  { key: 'tours', label: 'Yatra Packages', path: '/tours', icon: Gift },
] as const;

type PlannerServiceKey = (typeof plannerServices)[number]['key'];

const brajDestinations = [
  {
    name: 'Vrindavan',
    tagline: 'Banke Bihari, ISKCON & Prem Mandir',
    query: 'Vrindavan',
    image: heroImg,
  },
  {
    name: 'Mathura',
    tagline: 'Shri Krishna Janmabhoomi & Yamuna Ghats',
    query: 'Mathura',
    image: templeInteriorBackdrop,
  },
  {
    name: 'Govardhan',
    tagline: 'Giriraj Parikrama, Mansi Ganga & Dan Ghati',
    query: 'Govardhan',
    image: heroImg,
  },
  {
    name: 'Barsana',
    tagline: 'Shri Radha Rani Mandir & Prem Sarovar',
    query: 'Barsana',
    image: parikramaBackdrop,
  },
  {
    name: 'Gokul',
    tagline: 'Raman Reti & Chaurasi Khamba',
    query: 'Gokul',
    image: hotelRoomBackdrop,
  },
];

const testimonials = [
  {
    name: 'Priya Sharma',
    location: 'Delhi',
    rating: 5,
    text: 'The room photos, temple distance, and final price were clear before payment. Check-in was smooth and support stayed available on WhatsApp.',
  },
  {
    name: 'Rajesh Kumar',
    location: 'Mumbai',
    rating: 5,
    text: 'Booked a Braj tour and cab together. The itinerary felt professional, pickup was on time, and every confirmation was easy to track.',
  },
  {
    name: 'Anita Devi',
    location: 'Jaipur',
    rating: 5,
    text: 'I liked the verified listing tag and the booking updates. It felt safer than calling random numbers for rooms near Vrindavan.',
  },
  {
    name: 'Saurabh Mehta',
    location: 'Ahmedabad',
    rating: 5,
    text: 'We needed two rooms near Banke Bihari Temple. The team confirmed availability quickly and the booking details were easy for my parents to understand.',
  },
];


const SectionSkeletonGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden shadow-sm">
        <div className="h-44 bg-neutral-200/70" />
        <div className="p-4 space-y-2.5">
          <div className="h-4 bg-neutral-200/80 rounded w-3/4" />
          <div className="h-3 bg-neutral-200/60 rounded w-1/2" />
          <div className="pt-2 flex justify-between items-center">
            <div className="h-5 bg-neutral-200/80 rounded w-1/3" />
            <div className="h-4 bg-neutral-200/60 rounded w-1/4" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SectionOptionBFallback = ({
  icon: Icon,
  title,
  description,
  onRetry,
  whatsappMessage,
  callLabel = 'Call Travel Desk',
}: {
  icon: any;
  title: string;
  description: string;
  onRetry?: () => void;
  whatsappMessage: string;
  callLabel?: string;
}) => {
  const adminPhone = useSettingsStore((s) => s.settings.adminPhone) || COMPANY_PHONE;
  const cleanPhone = String(adminPhone).replace(/\D/g, '') || COMPANY_PHONE_DIGITS;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-6 sm:p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
        <Icon size={24} />
      </div>
      <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md font-body text-xs sm:text-sm text-neutral-600 leading-relaxed">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-body text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
        >
          <MessageCircle size={15} />
          <span>Inquire via WhatsApp</span>
        </a>
        <a
          href={`tel:${cleanPhone}`}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors"
        >
          <Phone size={14} />
          <span>{callLabel}</span>
        </a>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 font-body text-xs font-semibold text-amber-800 hover:bg-amber-100/60 transition-colors"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const { products, fetchProducts } = useProductStore();
  const shopEnabled = useSettingsStore((s) => s.settings.shopEnabled);
  const [plannerService, setPlannerService] = useState<PlannerServiceKey>('dharamshalas');
  const [plannerQuery, setPlannerQuery] = useState('');
  const [plannerCheckIn, setPlannerCheckIn] = useState('');
  const [plannerCheckOut, setPlannerCheckOut] = useState('');
  const [plannerGuests, setPlannerGuests] = useState(1);
  const [plannerRooms, setPlannerRooms] = useState(1);
  const [hotels, setHotels] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [cabs, setCabs] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const featuredLimit = 8;

  const [hotelsLoading, setHotelsLoading] = useState(true);
  const [hotelsError, setHotelsError] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(false);
  const [cabsLoading, setCabsLoading] = useState(true);
  const [cabsError, setCabsError] = useState(false);
  const [toursLoading, setToursLoading] = useState(true);
  const [toursError, setToursError] = useState(false);

  const activePlanner = plannerServices.find((item) => item.key === plannerService) || plannerServices[0];

  const buildPlannerUrl = (service = activePlanner) => {
    const query = plannerQuery.trim();
    const params = new URLSearchParams();
    if ('type' in service && service.type) params.set('type', service.type);
    if (query) params.set('q', query);
    if (plannerCheckIn) params.set('checkIn', plannerCheckIn);
    if (plannerCheckOut) params.set('checkOut', plannerCheckOut);
    if (plannerGuests > 1) params.set('guests', String(plannerGuests));
    if (plannerRooms > 1 && ['dharamshalas', 'hotels', 'home_stays'].includes(service.key)) {
      params.set('rooms', String(plannerRooms));
    }
    const qs = params.toString();
    const basePath = service.path.split('?')[0];
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  const runPlannerSearch = () => {
    navigate(buildPlannerUrl());
  };

  // Group hotels into authentic location discovery sections
  const hotelDiscoverySections = useMemo(() => {
    return groupItemsIntoLocationSections(hotels, null, '/hotels');
  }, [hotels]);

    const fetchHotelsList = async () => {
    try {
      setHotelsLoading(true);
      setHotelsError(false);
      const res = await api.get('/hotels');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setHotels(data);
      try { localStorage.setItem('vvs_hotels', JSON.stringify(data)); } catch {}
    } catch {
      setHotelsError(true);
    } finally {
      setHotelsLoading(false);
    }
  };

  const fetchRoomsList = async () => {
    try {
      setRoomsLoading(true);
      setRoomsError(false);
      const res = await api.get('/room-types');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRoomTypes(data.slice(0, featuredLimit));
      try { localStorage.setItem('vvs_room_types', JSON.stringify(data)); } catch {}
    } catch {
      setRoomsError(true);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchCabsList = async () => {
    try {
      setCabsLoading(true);
      setCabsError(false);
      const res = await api.get('/cabs');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setCabs(data.slice(0, featuredLimit));
      try { localStorage.setItem('vvs_cabs', JSON.stringify(data)); } catch {}
    } catch {
      setCabsError(true);
    } finally {
      setCabsLoading(false);
    }
  };

  const fetchToursList = async () => {
    try {
      setToursLoading(true);
      setToursError(false);
      const res = await api.get('/tours', { params: { withImages: true } });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const active = data.filter((t: any) => t?.status === 'active').slice(0, featuredLimit);
      setTours(active);
      try { localStorage.setItem('vvs_tours', JSON.stringify(data)); } catch {}
    } catch {
      setToursError(true);
    } finally {
      setToursLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cachedHotels = localStorage.getItem('vvs_hotels');
      if (cachedHotels) {
        const parsed = JSON.parse(cachedHotels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHotels(parsed);
          setHotelsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedRooms = localStorage.getItem('vvs_room_types');
      if (cachedRooms) {
        const parsed = JSON.parse(cachedRooms);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoomTypes(parsed.slice(0, featuredLimit));
          setRoomsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedCabs = localStorage.getItem('vvs_cabs');
      if (cachedCabs) {
        const parsed = JSON.parse(cachedCabs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCabs(parsed.slice(0, featuredLimit));
          setCabsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedTours = localStorage.getItem('vvs_tours');
      if (cachedTours) {
        const parsed = JSON.parse(cachedTours);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTours(parsed.filter((t: any) => t?.status === 'active').slice(0, featuredLimit));
          setToursLoading(false);
        }
      }
    } catch {}

    void fetchHotelsList();
    void fetchRoomsList();
    void fetchCabsList();
    void fetchToursList();
    if (shopEnabled) void fetchProducts();

    const reloadAll = () => {
      void fetchHotelsList();
      void fetchRoomsList();
      void fetchCabsList();
      void fetchToursList();
    };

    const unsubListings = subscribeAppEvent('listing:changed', reloadAll);
    const onFocus = () => reloadAll();
    window.addEventListener('focus', onFocus);

    return () => {
      unsubListings();
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchProducts, shopEnabled]);

  const getRoomPrice = (roomType: any) => {
    if (roomType?.hotel?.showPrices === false) return undefined;
    const base = Number(roomType?.pricePerNight || 0);
    const hotel = roomType?.hotel || {};
    if (isDharamshalaType(hotel?.propertyType)) return undefined;
    if (!hotel?.taxEnabled) return base;
    const percent = hotel?.gstMode === 'automatic'
      ? base <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const getHotelStartingPrice = (hotel: any) => {
    if (hotel?.showPrices === false) return undefined;
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
    if (isDharamshalaType(hotel?.propertyType)) return undefined;
    if (!hotel?.taxEnabled) return base;
    const percent = hotel?.gstMode === 'automatic'
      ? base <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ===== HERO SECTION (CINEMATIC BRAJ DESTINATION WITH AIRBNB-GRADE SEARCH) ===== */}
      <section className="relative min-h-[580px] sm:min-h-[640px] flex items-center justify-center overflow-hidden pt-24 pb-16">
        {/* Background Image */}
        <OptimizedImage
          src={heroImg}
          alt="Sacred Govardhan and Braj Landscape"
          className="absolute inset-0 h-full w-full object-cover object-center"
          width={1600}
          height={897}
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
        />

        {/* Cinematic Readable Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/40 to-black/80" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 text-center">
          {/* Devotional Badge */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 backdrop-blur-md"
          >
            <MapPin size={14} className="text-amber-400" />
            <span className="font-body text-xs font-semibold text-white tracking-wide">
              Sacred Braj Pilgrimage Stays & Yatras
            </span>
          </motion.div>

          {/* Strong Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-heading text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-md max-w-4xl leading-tight"
          >
            Sacred Stays in Holy Braj
          </motion.h1>

          {/* Supporting Copy */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 max-w-xl font-body text-sm sm:text-base md:text-lg text-white/90 font-normal drop-shadow"
          >
            Verified dharamshalas, hotel rooms, cabs, and guided parikrama tours near Mathura & Vrindavan temples.
          </motion.p>

          {/* AIRBNB-GRADE COMPACT SEARCH EXPERIENCE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 w-full max-w-4xl"
          >
            {/* Compact Single-Line Horizontal Category Selector */}
            <div className="w-full max-w-full overflow-x-auto scrollbar-none mb-3 py-1">
              <div className="inline-flex items-center gap-2 sm:justify-center w-max min-w-full px-1">
                {plannerServices.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === plannerService;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (active) {
                          navigate(item.path);
                        } else {
                          setPlannerService(item.key);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full font-body text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all select-none shadow-xs ${
                        active
                          ? 'bg-white text-slate-900 shadow-md font-bold ring-2 ring-amber-500/40'
                          : 'bg-black/35 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/50 border border-white/20'
                      }`}
                    >
                      <Icon size={14} className={active ? 'text-amber-600 shrink-0' : 'text-amber-400 shrink-0'} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Unified Pill Search Console */}
            <div className="hidden sm:flex items-center bg-white rounded-full p-2 pl-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-neutral-200/80 divide-x divide-neutral-200 text-left">
              {/* Destination */}
              <div className="flex-1 pr-4">
                <label className="block font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Where in Braj
                </label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin size={15} className="text-amber-600 shrink-0" />
                  <input
                    value={plannerQuery}
                    onChange={(e) => setPlannerQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runPlannerSearch();
                    }}
                    placeholder="Vrindavan, Mathura, Govardhan..."
                    className="w-full bg-transparent font-body text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* Check In */}
              <div className="px-4">
                <label className="block font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Check in
                </label>
                <input
                  type="date"
                  value={plannerCheckIn}
                  onChange={(e) => setPlannerCheckIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="bg-transparent font-body text-xs font-semibold text-slate-800 outline-none cursor-pointer mt-0.5"
                />
              </div>

              {/* Check Out */}
              <div className="px-4">
                <label className="block font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Check out
                </label>
                <input
                  type="date"
                  value={plannerCheckOut}
                  onChange={(e) => setPlannerCheckOut(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  className="bg-transparent font-body text-xs font-semibold text-slate-800 outline-none cursor-pointer mt-0.5"
                />
              </div>

              {/* Guests & Rooms */}
              <div className="px-4">
                <label className="block font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Who
                </label>
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-800 mt-0.5">
                  <input
                    type="number"
                    min={1}
                    value={plannerGuests}
                    onChange={(e) => setPlannerGuests(Math.max(1, Number(e.target.value || 1)))}
                    className="w-8 bg-transparent font-bold outline-none"
                  />
                  <span className="text-slate-400">guests,</span>
                  <input
                    type="number"
                    min={1}
                    value={plannerRooms}
                    onChange={(e) => setPlannerRooms(Math.max(1, Number(e.target.value || 1)))}
                    className="w-8 bg-transparent font-bold outline-none"
                  />
                  <span className="text-slate-400">rms</span>
                </div>
              </div>

              {/* Search Action Button */}
              <div className="pl-2 pr-1">
                <button
                  type="button"
                  onClick={runPlannerSearch}
                  className="h-12 px-6 rounded-full bg-emerald-900 hover:bg-emerald-800 active:scale-95 text-white font-body text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
                >
                  <Search size={16} />
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Mobile Search Card */}
            <div className="sm:hidden bg-white rounded-2xl p-4 shadow-xl text-left space-y-3">
              <div>
                <label className="block font-body text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Destination in Braj
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
                  <MapPin size={16} className="text-amber-600" />
                  <input
                    value={plannerQuery}
                    onChange={(e) => setPlannerQuery(e.target.value)}
                    placeholder="Vrindavan, Mathura, Govardhan..."
                    className="w-full bg-transparent font-body text-sm font-semibold outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-body text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Check in
                  </label>
                  <input
                    type="date"
                    value={plannerCheckIn}
                    onChange={(e) => setPlannerCheckIn(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 font-body text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Check out
                  </label>
                  <input
                    type="date"
                    value={plannerCheckOut}
                    onChange={(e) => setPlannerCheckOut(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 font-body text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={runPlannerSearch}
                className="w-full rounded-xl bg-emerald-900 hover:bg-emerald-800 active:scale-98 py-3 font-body text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Search size={16} />
                <span>Search Braj Stays</span>
              </button>
            </div>

            {/* Subtle Inline Trust Strip (Single Row, Zero Clunky White Cards) */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-white/90 text-xs font-medium drop-shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-400" />
                Verified Temple Stays
              </span>
              <span className="hidden sm:inline text-white/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Award size={14} className="text-amber-400" />
                Zero Hidden Charges
              </span>
              <span className="hidden sm:inline text-white/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-amber-400" />
                15-Min Booking Hold
              </span>
              <span className="hidden sm:inline text-white/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} className="text-amber-400" />
                24/7 Braj Helpdesk
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== AIRBNB-GRADE HORIZONTAL CATEGORY NAVIGATION BAR ===== */}
      <section className="sticky top-16 sm:top-20 z-20 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_10px_rgba(15,23,42,0.03)] py-2.5 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 w-full max-w-full">
            {plannerServices.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-body text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 border border-neutral-200 bg-neutral-50/90 text-slate-800 hover:border-slate-900 hover:bg-white hover:text-slate-900 transition-all shadow-2xs"
                >
                  <Icon size={14} className="text-amber-600 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
            <Link
              to="/rooms"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-body text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 border border-neutral-200 bg-neutral-50/90 text-slate-800 hover:border-slate-900 hover:bg-white hover:text-slate-900 transition-all shadow-2xs"
            >
              <BedDouble size={14} className="text-amber-600 shrink-0" />
              <span className="whitespace-nowrap">Rooms</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 2. DESTINATION SHORTCUTS (EXPLORE SACRED BRAJ) ===== */}
      <section className="py-12 border-b border-neutral-100 bg-[#fdfcf9]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Explore Sacred Braj
              </h2>
              <p className="font-body text-sm text-neutral-500 mt-1">
                Select a holy destination to browse verified stays and temple proximity.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {brajDestinations.map((dest) => (
              <button
                key={dest.name}
                type="button"
                onClick={() => {
                  setPlannerQuery(dest.query);
                  navigate(`/hotels?q=${encodeURIComponent(dest.query)}`);
                }}
                className="group relative flex flex-col justify-end overflow-hidden rounded-2xl aspect-[4/3] p-3 text-left transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <img
                  src={dest.image}
                  alt={dest.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="relative z-10">
                  <h3 className="font-body text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {dest.name}
                  </h3>
                  <p className="font-body text-[11px] text-white/80 line-clamp-1">
                    {dest.tagline}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 3. LOCATION-WISE STAYS & ASHRAMS ===== */}
      <section className="py-10 sm:py-14 border-b border-neutral-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 font-body text-xs font-bold text-amber-900 mb-2">
                <ShieldCheck size={13} className="text-amber-700 shrink-0" />
                <span>100% Inspected & Verified Stays</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Verified Stays & Ashrams Across Braj
              </h2>
              <p className="font-body text-xs sm:text-sm text-neutral-500 mt-1">
                Explore inspected dharamshalas, hotel rooms, and ashram accommodations grouped by sacred temple proximity
              </p>
            </div>
            <Link
              to="/hotels"
              className="inline-flex items-center gap-1 font-body text-xs sm:text-sm font-bold text-slate-900 hover:text-amber-800 transition-colors py-1 shrink-0"
            >
              <span>Explore all stays ({hotels.length > 0 ? `${hotels.length}+` : 'all'})</span>
              <ArrowRight size={15} className="text-amber-700" />
            </Link>
          </div>

          {/* Location-Wise Discovery Sections */}
          {hotelsLoading && hotelDiscoverySections.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : hotelDiscoverySections.length > 0 ? (
            <div className="divide-y divide-neutral-200/70">
              {hotelDiscoverySections.map((section) => (
                <LocationDiscoverySection
                  key={section.id}
                  id={section.id}
                  heading={section.heading}
                  subtitle={section.subtitle}
                  distanceLabel={section.distanceLabel}
                  viewAllUrl={section.filterUrl}
                  viewAllCount={section.items.length}
                  items={section.items}
                  renderItem={(hotel) => (
                    <ListingCard
                      key={hotel._id}
                      variant="hotel"
                      image={hotel.image}
                      images={hotel.images}
                      name={hotel.name}
                      badge={getPropertyTypeLabel(hotel?.propertyType)}
                      location={hotel.location}
                      price={getHotelStartingPrice(hotel)}
                      priceLabel={
                        isDharamshalaType(hotel?.propertyType)
                          ? ''
                          : hotel?.taxEnabled
                          ? '/night incl. GST'
                          : '/night'
                      }
                      pricePlaceholder={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Contribution on confirmation'
                          : undefined
                      }
                      priceHelp={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Verified Ashram'
                          : undefined
                      }
                      rating={Number(hotel.rating || 0)}
                      reviewCount={Number(hotel.reviewCount || 0)}
                      amenities={hotel.amenities || []}
                      onViewDetails={() => {
                        prefetchDetail('hotels', hotel._id, hotel);
                        navigate(`/hotels/${hotel._id}`);
                      }}
                    />
                  )}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={Building2}
              title="Verified Accommodations in Braj"
              description="Looking for verified Dharamshalas, Ashrams or commercial hotels near Prem Mandir, Banke Bihari or ISKCON? Tap below to check direct room availability with our local desk."
              whatsappMessage="Hare Krishna, please help me check verified hotel and dharamshala room availability in Vrindavan."
              callLabel="Call Accommodations Desk"
              onRetry={fetchHotelsList}
            />
          )}
        </div>
      </section>

      {/* ===== 4. AVAILABLE ROOM TYPES (COMPACT MOBILE SWIPE & DESKTOP GRID) ===== */}
      <section className="py-7 sm:py-14 bg-[#faf8f5] border-t border-neutral-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4 sm:mb-6">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Browse Rooms & Configurations
              </h2>
              <p className="font-body text-xs sm:text-sm text-neutral-500 mt-1">
                Select AC Deluxe, Quad Family rooms, or Ashram accommodations with verified amenities
              </p>
            </div>
            <Link
              to="/rooms"
              className="inline-flex items-center gap-1 font-body text-xs sm:text-sm font-bold text-slate-900 hover:text-amber-800 transition-colors py-1 shrink-0"
            >
              <span>View all room types</span>
              <ArrowRight size={15} className="text-amber-700" />
            </Link>
          </div>

          {roomTypes.length > 0 ? (
            <>
              {/* Desktop Responsive Grid */}
              <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {roomTypes.map((roomType) => (
                  <ListingCard
                    key={roomType._id}
                    image={roomType?.images?.[0] || roomType?.hotel?.image}
                    images={roomType?.images?.length ? roomType.images : roomType?.hotel?.images}
                    name={roomType.name}
                    location={`${roomType?.hotel?.name || ''}${roomType?.hotel?.location ? ` • ${roomType.hotel.location}` : ''}`}
                    price={getRoomPrice(roomType)}
                    priceLabel={
                      isDharamshalaType(roomType?.hotel?.propertyType)
                        ? ''
                        : roomType?.hotel?.taxEnabled
                        ? '/night incl. GST'
                        : '/night'
                    }
                    pricePlaceholder={
                      isDharamshalaType(roomType?.hotel?.propertyType)
                        ? 'Contribution on confirmation'
                        : undefined
                    }
                    priceHelp={
                      isDharamshalaType(roomType?.hotel?.propertyType)
                        ? 'Verified Ashram'
                        : undefined
                    }
                    rating={0}
                    reviewCount={0}
                    amenities={roomType?.amenities || roomType?.hotel?.amenities || []}
                    meta={Number(roomType?.totalCount || 0) > 0 ? `${roomType.totalCount} rooms` : undefined}
                    badge={getPropertyTypeLabel(roomType?.hotel?.propertyType)}
                    variant="room"
                    onViewDetails={() => {
                      prefetchDetail('roomTypes', roomType._id, roomType);
                      navigate(`/room-types/${roomType._id}`);
                    }}
                  />
                ))}
              </div>

              {/* Mobile Swipeable Carousel (Compact swipeable cards) */}
              <div
                className="md:hidden flex gap-3 overflow-x-auto pb-2.5 pt-0.5 scrollbar-none snap-x snap-mandatory w-full max-w-full px-0.5"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {roomTypes.map((roomType) => (
                  <div
                    key={roomType._id}
                    className="w-[62vw] max-w-[245px] min-w-[215px] shrink-0 snap-start"
                  >
                    <ListingCard
                      image={roomType?.images?.[0] || roomType?.hotel?.image}
                      images={roomType?.images?.length ? roomType.images : roomType?.hotel?.images}
                      name={roomType.name}
                      location={`${roomType?.hotel?.name || ''}${roomType?.hotel?.location ? ` • ${roomType.hotel.location}` : ''}`}
                      price={getRoomPrice(roomType)}
                      priceLabel={
                        isDharamshalaType(roomType?.hotel?.propertyType)
                          ? ''
                          : roomType?.hotel?.taxEnabled
                          ? '/night incl. GST'
                          : '/night'
                      }
                      pricePlaceholder={
                        isDharamshalaType(roomType?.hotel?.propertyType)
                          ? 'Contribution on confirmation'
                          : undefined
                      }
                      priceHelp={
                        isDharamshalaType(roomType?.hotel?.propertyType)
                          ? 'Verified Ashram'
                          : undefined
                      }
                      rating={0}
                      reviewCount={0}
                      amenities={roomType?.amenities || roomType?.hotel?.amenities || []}
                      meta={Number(roomType?.totalCount || 0) > 0 ? `${roomType.totalCount} rooms` : undefined}
                      badge={getPropertyTypeLabel(roomType?.hotel?.propertyType)}
                      variant="room"
                      compact={true}
                      onViewDetails={() => {
                        prefetchDetail('roomTypes', roomType._id, roomType);
                        navigate(`/room-types/${roomType._id}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : roomsLoading ? (
            <SectionSkeletonGrid count={4} />
          ) : (
            <SectionOptionBFallback
              icon={BedDouble}
              title="Room Configurations Available upon Request"
              description="AC Deluxe, Family Quad suites, and Ashram donor rooms are available. Contact our coordinator to match your dates and party size."
              whatsappMessage="Hare Krishna, I want to check room types and family suite options in Vrindavan."
              callLabel="Call Reservations Desk"
              onRetry={fetchRoomsList}
            />
          )}
        </div>
      </section>

      {/* ===== 5. FIXED-FARE CABS & AIRPORT TRANSFERS ===== */}
      <section className="py-12 sm:py-16 border-t border-neutral-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Fixed-Fare Cabs & Temple Transfers
              </h2>
              <p className="font-body text-sm text-neutral-500 mt-1">
                Verified drivers for Delhi airport pickups, Mathura station transfers, and Govardhan Parikrama.
              </p>
            </div>
            <Link
              to="/cabs"
              className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-bold text-slate-900 hover:text-amber-800 transition-colors shrink-0"
            >
              <span>View all cabs</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {cabsLoading && cabs.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : cabs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
              {cabs.map((cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' • ') || 'Braj Region Routes'}
                  price={undefined}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, cab.capacity ? `${cab.capacity} Seater AC` : undefined].filter(Boolean) as string[]}
                  badge="30% Advance"
                  badgeColor="green"
                  variant="cab"
                  onViewDetails={() => {
                    prefetchDetail('cabs', cab._id, cab);
                    navigate(`/cabs/${cab._id}`);
                  }}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={CarTaxiFront}
              title="Fixed-Fare Cabs on Direct Booking"
              description="Delhi Airport pickups, Mathura Junction transfers, and Govardhan Parikrama cabs available with verified drivers."
              whatsappMessage="Hare Krishna, I need to book a fixed-fare cab for Braj travel / Delhi Airport."
              callLabel="Call Cab Desk"
              onRetry={fetchCabsList}
            />
          )}
        </div>
      </section>

      {/* ===== 6. GUIDED DARSHAN & PARIKRAMA YATRAS ===== */}
      <section className="py-12 sm:py-16 bg-[#faf8f5] border-t border-neutral-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Guided Darshan & Parikrama Yatras
              </h2>
              <p className="font-body text-sm text-neutral-500 mt-1">
                Well-organized spiritual itineraries with dedicated coordinators and hotel pickups.
              </p>
            </div>
            <Link
              to="/tours"
              className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-bold text-slate-900 hover:text-amber-800 transition-colors shrink-0"
            >
              <span>View all yatra plans</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {toursLoading && tours.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : tours.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
              {tours.map((tour) => (
                <ListingCard
                  key={tour._id}
                  image={tour.image}
                  images={tour.images}
                  name={tour.name}
                  location={tour.destination || 'Braj Mandal'}
                  price={tour.pricePerPerson}
                  priceLabel="/person"
                  rating={0}
                  reviewCount={0}
                  badge={tour.duration}
                  amenities={tour.includes || []}
                  variant="tour"
                  onViewDetails={() => {
                    prefetchDetail('tours', tour._id, tour);
                    navigate(`/tours/${tour._id}`);
                  }}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={MapPinned}
              title="Custom Yatra Plans with Dedicated Guide"
              description="Guided Braj Darshan, 84 Kos Parikrama, and temple itineraries organized with AC cab and hotel pickup."
              whatsappMessage="Hare Krishna, I would like to inquire about guided Yatra packages in Braj."
              callLabel="Call Yatra Coordinator"
              onRetry={fetchToursList}
            />
          )}
        </div>
      </section>

      {/* ===== 7. DEVOTIONAL ASSISTANCE BANNER (SINGLE ELEGANT WARM IVORY BANNER) ===== */}
      <section className="py-12 sm:py-16 border-t border-neutral-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-amber-200/80 bg-[#fdfaf5] p-8 sm:p-12 lg:p-14 relative overflow-hidden">
            <div className="max-w-2xl relative z-10">
              <span className="font-body text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100/80 px-3 py-1 rounded-full">
                Pilgrim Helpdesk & Coordination
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-slate-900 mt-4 leading-tight">
                Need guidance planning your Braj pilgrimage?
              </h2>
              <p className="font-body text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
                Our local team in Vrindavan and Govardhan assists yatris with temple darshan timings, senior citizen accommodations, parking access, and prompt booking verification.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${COMPANY_PHONE}`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-body text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
                >
                  <Phone size={16} />
                  <span>Call {COMPANY_PHONE}</span>
                </a>
                <a
                  href={`https://wa.me/${COMPANY_PHONE_DIGITS}?text=Jai%20Shree%20Krishna!%20Need%20assistance%20for%20Braj%20visit.`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-6 py-3 font-body text-sm font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle size={16} className="text-emerald-600" />
                  <span>WhatsApp Coordinator</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 8. GENUINE GUEST REVIEWS ===== */}
      <section className="py-12 sm:py-16 bg-[#faf8f5] border-t border-neutral-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-1 text-slate-900 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="fill-slate-900 text-slate-900" />
                ))}
                <span className="font-body text-sm font-bold ml-2">4.9 / 5 Guest Rating</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
                Loved by Braj Yatris
              </h2>
            </div>
            <span className="text-xs font-semibold text-neutral-400">
              Verified Pilgrims from Delhi, Mumbai, Jaipur & Ahmedabad
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl bg-white p-6 border border-neutral-200/80 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-0.5 text-slate-900 mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} size={12} className="fill-slate-900 text-slate-900" />
                    ))}
                  </div>
                  <p className="font-body text-sm text-slate-700 leading-relaxed">
                    "{t.text}"
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{t.name}</span>
                  <span className="text-neutral-400">{t.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
