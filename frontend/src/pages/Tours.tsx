import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Car, IndianRupee, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
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
  const whatsappDigits = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

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
    <div className="pt-16">
      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle label="Spiritual Journeys" title="Explore Tour Packages" subtitle="Guided tours to experience the divine essence of Braj" />
          <div className="premium-toolbar mx-auto grid max-w-5xl gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <input type="text" placeholder="Search tours" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="premium-field h-11 w-full pl-10 pr-3" />
            </div>
            <label className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Destination</option>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Budget</option>
                <option value="1500">Up to Rs. 1,500</option>
                <option value="2500">Up to Rs. 2,500</option>
                <option value="2501">Above Rs. 2,500</option>
              </select>
            </label>
            <label className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={cabType} onChange={(e) => setCabType(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Cab Type</option>
                {cabTypes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Duration</option>
                <option value="1">1 Day</option>
                <option value="2">2 Days</option>
                <option value="3">3 Days</option>
              </select>
            </label>
          </div>
        </div>
      </section>
      <section className="py-3">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="grid gap-3 rounded-lg border border-brand-gold/30 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">Book a tour with support</p>
              <p className="font-body text-sm text-muted-foreground">Tell us your travel date, group size, pickup point, and preferred Braj places.</p>
            </div>
            <a
              href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent('Radhe Radhe, I want to book a tour package with Vrindavan Sarthi Enterprises.')}`}
              target="_blank"
              rel="noreferrer"
              className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a
              href={`tel:${phoneDigits}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50"
            >
              <Phone size={16} /> Call
            </a>
          </div>
        </div>
      </section>
      <section className="py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          {tours.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Tours Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Tour packages will appear here once the admin adds them.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((tour) => (
                <ListingCard
                  key={tour._id}
                  image={tour.image}
                  images={tour.images}
                  name={tour.name}
                  location={tour.destination || tour.duration}
                  price={tour.pricePerPerson}
                  priceLabel="/person"
                  rating={0}
                  reviewCount={0}
                  badge={tour.duration}
                  amenities={(tour.placesCovered || tour.includes || []).slice(0, 2)}
                  variant="tour"
                  ctaLabel="Book Tour"
                  onViewDetails={() => {
                    prefetchDetail('tours', tour._id, tour);
                    navigate(`/tours/${tour._id}`);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <div className="premium-focus-card col-span-full mx-auto max-w-md p-6 text-center">
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
                    className="btn-gold mt-5 rounded-lg px-5 py-2 text-sm"
                  >
                    Show All Tours
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Tours;
