import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Car, Compass, IndianRupee, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import CarouselRow from '@/components/shared/CarouselRow';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { useSettingsStore } from '@/store/settingsStore';

type TourListItem = {
  _id: string;
  name: string;
  image: string;
  images?: string[];
  duration?: string;
  durationDays?: number;
  destination?: string;
  cabType?: string;
  pricePerPerson?: number;
  includes?: string[];
  placesCovered?: string[];
  rating?: number;
  location?: string;
};

const Tours = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyPhone = useSettingsStore((s) => s.settings.adminPhone);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [destination, setDestination] = useState('all');
  const [budget, setBudget] = useState('all');
  const [cabType, setCabType] = useState('all');
  const [duration, setDuration] = useState('all');
  const [tours, setTours] = useState<TourListItem[]>([]);
  const phoneDigits = companyPhone.replace(/\D/g, '');
  const whatsappDigits = phoneDigits;

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      // Show cached list instantly (if present) for perceived speed, then revalidate from API.
      try {
        const cached = localStorage.getItem('vvs_tours');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setTours(parsed);
        }
      } catch {
        // ignore
      }
      try {
        const res = await api.get('/tours', { params: { withImages: true } });
        const data = Array.isArray(res.data?.data) ? (res.data.data as TourListItem[]) : [];
        setTours(data);
        try {
          localStorage.setItem('vvs_tours', JSON.stringify(data));
        } catch {
          // ignore
        }
      } catch {
        setTours([]);
      }
    };

    void load();
    const unsub = subscribeAppEvent('listing:changed', () => void load());
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      unsub();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const destinations = Array.from(new Set(tours.map((t) => t.destination).filter(Boolean))) as string[];
  const cabTypes = Array.from(new Set(tours.map((t) => t.cabType).filter(Boolean))) as string[];
  const filtered = tours
    .filter((t) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return t.name.toLowerCase().includes(q)
        || String(t.destination || '').toLowerCase().includes(q)
        || (t.placesCovered || []).some((place) => place.toLowerCase().includes(q));
    })
    .filter((t) => destination === 'all' || t.destination === destination)
    .filter((t) => cabType === 'all' || t.cabType === cabType)
    .filter((t) => {
      if (duration === 'all') return true;
      const days = Number(t.durationDays || 1);
      return duration === '1' ? days === 1 : duration === '2' ? days === 2 : days >= 3;
    })
    .filter((t) => {
      const price = Number(t.pricePerPerson || 0);
      if (budget === 'all') return true;
      if (budget === '1500') return price <= 1500;
      if (budget === '2500') return price <= 2500;
      return price > 2500;
    });

  return (
    <div className="min-h-screen bg-[#fdfcf9] pt-16 sm:pt-20 pb-16 text-slate-800 overflow-x-clip w-full max-w-[100vw]">
      {/* Sticky Compact Search & Filter Bar */}
      <section className="sticky top-16 sm:top-20 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search yatra packages, places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 pl-9 pr-3 py-1.5 font-body text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            {/* Filter Dropdowns & WhatsApp */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="grid grid-cols-3 gap-1.5 flex-1 sm:flex sm:items-center">
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full sm:w-auto rounded-full border border-neutral-300 bg-neutral-50/80 px-2.5 py-1.5 font-body text-[11px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer truncate"
                >
                  <option value="all">Destinations</option>
                  {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full sm:w-auto rounded-full border border-neutral-300 bg-neutral-50/80 px-2.5 py-1.5 font-body text-[11px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer truncate"
                >
                  <option value="all">Duration</option>
                  <option value="1">1 Day</option>
                  <option value="2">2 Days</option>
                  <option value="3">3 Days</option>
                </select>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full sm:w-auto rounded-full border border-neutral-300 bg-neutral-50/80 px-2.5 py-1.5 font-body text-[11px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer truncate"
                >
                  <option value="all">Budget</option>
                  <option value="1500">Up to ₹1,500</option>
                  <option value="2500">Up to ₹2,500</option>
                  <option value="2501">Above ₹2,500</option>
                </select>
              </div>

              <a
                href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent('Radhe Radhe, I want to book a tour package with Vrindavan Sarthi.')}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-body text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs whitespace-nowrap shrink-0"
              >
                <MessageCircle size={13} className="text-emerald-700 shrink-0" />
                <span>WhatsApp Tour Desk</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-3.5 flex items-baseline justify-between gap-2">
          <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
            Darshan & Yatra Packages
          </h1>
          <span className="font-body text-xs font-semibold text-slate-500 shrink-0">
            {filtered.length} {filtered.length === 1 ? 'package' : 'packages'}
          </span>
        </div>
        {tours.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-heading text-2xl text-muted-foreground mb-2">No tours listed</p>
            <p className="font-body text-sm text-muted-foreground">Please check again soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="premium-focus-card mx-auto max-w-md p-6 text-center my-8">
            <p className="font-heading text-xl font-bold text-foreground">No tours found</p>
            <p className="mt-2 font-body text-sm text-muted-foreground">Reset filters or search for another destination.</p>
            <button
              type="button"
              onClick={() => {
                setSearchParams({});
                setDestination('all');
                setBudget('all');
                setCabType('all');
                setDuration('all');
              }}
              className="btn-emerald mt-5 rounded-lg px-5 py-2 text-sm"
            >
              Show All Tours
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <CarouselRow
              id="tours-row-1"
              title="Darshan Packages — Row 1"
              subtitle="Curated temple darshan and spiritual yatra itineraries"
              badge="First 4 Packages"
              icon={<Compass size={13} />}
              items={filtered.slice(0, 4)}
              renderItem={(tour) => (
                <ListingCard
                  key={tour._id}
                  image={tour.image}
                  images={tour.images}
                  name={tour.name}
                  location={tour.destination || ''}
                  price={tour.pricePerPerson}
                  priceLabel="/person"
                  rating={0}
                  reviewCount={0}
                  badge={tour.duration}
                  amenities={(tour.placesCovered || tour.includes || []).slice(0, 2)}
                  variant="tour"
                  ctaLabel="Plan tour"
                  onViewDetails={() => {
                    prefetchDetail('tours', tour._id, tour);
                    navigate(`/tours/${tour._id}`);
                  }}
                />
              )}
            />

            {filtered.length > 4 && (
              <CarouselRow
                id="tours-row-2"
                title="Darshan Packages — Row 2"
                subtitle="Special circumambulation and extended Braj yatras"
                badge="Remaining Packages"
                icon={<Compass size={13} />}
                items={filtered.slice(4)}
                renderItem={(tour) => (
                  <ListingCard
                    key={tour._id}
                    image={tour.image}
                    images={tour.images}
                    name={tour.name}
                    location={tour.destination || ''}
                    price={tour.pricePerPerson}
                    priceLabel="/person"
                    rating={0}
                    reviewCount={0}
                    badge={tour.duration}
                    amenities={(tour.placesCovered || tour.includes || []).slice(0, 2)}
                    variant="tour"
                    ctaLabel="Plan tour"
                    onViewDetails={() => {
                      prefetchDetail('tours', tour._id, tour);
                      navigate(`/tours/${tour._id}`);
                    }}
                  />
                )}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tours;
