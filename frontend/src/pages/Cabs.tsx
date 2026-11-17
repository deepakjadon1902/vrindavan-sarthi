import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, MessageCircle, Phone, Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import CarouselRow from '@/components/shared/CarouselRow';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { useSettingsStore } from '@/store/settingsStore';

type CabListItem = {
  _id: string;
  vehicleName: string;
  image: string;
  images?: string[];
  rating?: number;
  location?: string;
  routes?: string[];
  vehicleType?: string;
  capacity?: number;
};

const Cabs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyPhone = useSettingsStore((s) => s.settings.adminPhone);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [cabs, setCabs] = useState<CabListItem[]>([]);
  const phoneDigits = companyPhone.replace(/\D/g, '');
  const whatsappDigits = phoneDigits;

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      // Show cached list instantly (if present) for perceived speed, then revalidate from API.
      try {
        const cached = localStorage.getItem('vvs_cabs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setCabs(parsed);
        }
      } catch {
        // ignore
      }
      try {
        const res = await api.get('/cabs');
        const data = Array.isArray(res.data?.data) ? (res.data.data as CabListItem[]) : [];
        setCabs(data);
        try {
          localStorage.setItem('vvs_cabs', JSON.stringify(data));
        } catch {
          // ignore
        }
      } catch {
        setCabs([]);
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

  const filtered = cabs.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return c.vehicleName.toLowerCase().includes(q)
      || (c.routes || []).some((route) => route.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-[#fdfcf9] pt-16 sm:pt-20 pb-16 text-slate-800 overflow-x-clip w-full max-w-[100vw]">
      {/* Sticky Compact Search & Filter Bar */}
      <section className="sticky top-16 sm:top-20 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search cab by vehicle, route, or city..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  const p = new URLSearchParams(searchParams);
                  if (e.target.value.trim()) p.set('q', e.target.value);
                  else p.delete('q');
                  setSearchParams(p, { replace: true });
                }}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 pl-10 pr-4 py-2 font-body text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent('Radhe Radhe, I want to book a cab with Vrindavan Sarthi.')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 font-body text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <MessageCircle size={14} className="text-emerald-700" />
                <span>24/7 WhatsApp Booking</span>
              </a>
              <a
                href={`tel:${phoneDigits}`}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                <Phone size={13} className="text-slate-500" />
                <span>Travel Desk</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-3.5 flex items-baseline justify-between gap-2">
          <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
            Pilgrimage Cabs & Taxis
          </h1>
          <span className="font-body text-xs font-semibold text-slate-500 shrink-0">
            {filtered.length} {filtered.length === 1 ? 'vehicle' : 'vehicles'}
          </span>
        </div>
        {cabs.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-heading text-2xl text-muted-foreground mb-2">No cabs listed</p>
            <p className="font-body text-sm text-muted-foreground">Please check again soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="premium-focus-card mx-auto max-w-md p-6 text-center my-8">
            <p className="font-heading text-xl font-bold text-foreground">No cabs found</p>
            <p className="mt-2 font-body text-sm text-muted-foreground">Try a vehicle name or route such as Mathura, Barsana, or Agra.</p>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="btn-emerald mt-5 rounded-lg px-5 py-2 text-sm"
            >
              Show All Cabs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <CarouselRow
              id="cabs-row-1"
              title="Pilgrimage Cabs — Row 1"
              subtitle="Verified private AC cabs for temple darshan and local transfers"
              badge="First 4 Vehicles"
              icon={<Car size={13} />}
              items={filtered.slice(0, 4)}
              renderItem={(cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' · ') || ''}
                  price={undefined}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, cab.capacity ? `${cab.capacity} Seater AC` : undefined].filter(Boolean) as string[]}
                  badge="30% Advance"
                  badgeColor="green"
                  variant="cab"
                  ctaLabel="Confirm cab"
                  onViewDetails={() => {
                    prefetchDetail('cabs', cab._id, cab);
                    navigate(`/cabs/${cab._id}`);
                  }}
                />
              )}
            />

            {filtered.length > 4 && (
              <CarouselRow
                id="cabs-row-2"
                title="Pilgrimage Cabs — Row 2"
                subtitle="Comfortable tempo travellers, SUVs, and outstation vehicles"
                badge="Remaining Fleet"
                icon={<Car size={13} />}
                items={filtered.slice(4)}
                renderItem={(cab) => (
                  <ListingCard
                    key={cab._id}
                    image={cab.image}
                    images={cab.images}
                    name={cab.vehicleName}
                    location={cab.routes?.join(' · ') || ''}
                    price={undefined}
                    priceLabel=""
                    rating={0}
                    reviewCount={0}
                    amenities={[cab.vehicleType, cab.capacity ? `${cab.capacity} Seater AC` : undefined].filter(Boolean) as string[]}
                    badge="30% Advance"
                    badgeColor="green"
                    variant="cab"
                    ctaLabel="Confirm cab"
                    onViewDetails={() => {
                      prefetchDetail('cabs', cab._id, cab);
                      navigate(`/cabs/${cab._id}`);
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

export default Cabs;
