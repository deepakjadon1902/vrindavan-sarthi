import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle, Phone, Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
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
    <div className="pt-16">
      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle
            label="Transportation"
            title="Book a Cab Across Braj"
            subtitle="Reliable local and outstation cab services"
          />
          <div className="premium-toolbar mx-auto max-w-xl p-2">
            <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search cabs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="premium-field w-full pl-12 pr-4"
            />
            </div>
          </div>
        </div>
      </section>

      <section className="py-3">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="bg-brand-green/10 border border-brand-green/30 rounded-lg px-5 py-4 text-center">
            <p className="font-heading text-lg font-semibold text-foreground mb-1.5">Cab Fare Policy</p>
            <p className="font-body text-sm text-muted-foreground">
              Fare is fixed route-wise for the whole vehicle. A 30% online advance is required to confirm a request.
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Balance 70% is paid later after admin confirmation and driver assignment.
            </p>
          </div>
          <div className="mt-3 grid gap-3 rounded-lg border border-brand-gold/30 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">Book your cab directly</p>
              <p className="font-body text-sm text-muted-foreground">Share your pickup, drop, date, and passenger count on WhatsApp or call our travel desk.</p>
            </div>
            <a
              href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent('Radhe Radhe, I want to book a cab with Vrindavan Sarthi Enterprises.')}`}
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
          {cabs.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Cabs Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Cabs will appear here once listed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' • ') || ''}
                  price={0}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, `${cab.capacity} Seater`]}
                  badge="30% Advance"
                  badgeColor="green"
                  variant="compact"
                  onViewDetails={() => {
                    prefetchDetail('cabs', cab._id, cab);
                    navigate(`/cabs/${cab._id}`);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <div className="premium-focus-card col-span-full mx-auto max-w-md p-6 text-center">
                  <p className="font-heading text-xl font-bold text-foreground">No cabs found</p>
                  <p className="mt-2 font-body text-sm text-muted-foreground">Try a vehicle name or route such as Mathura, Barsana, or Agra.</p>
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="btn-gold mt-5 rounded-lg px-5 py-2 text-sm"
                  >
                    Show All Cabs
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

export default Cabs;
