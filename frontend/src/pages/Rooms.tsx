import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';

const Rooms = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // Optimistically show cache while revalidating.
      try {
        const cached = localStorage.getItem('vvs_room_types');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setRoomTypes(parsed);
        }
      } catch {
        // ignore
      }

      // Retry a few times (backend may be restarting).
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await api.get('/room-types');
          const data = Array.isArray(res.data?.data) ? res.data.data : [];
          setRoomTypes(data);
          try {
            localStorage.setItem('vvs_room_types', JSON.stringify(data));
          } catch {
            // ignore
          }
          return;
        } catch (e: any) {
          lastErr = e;
          const status = e?.response?.status;
          const isRetryable = status === 503 || !e?.response;
          if (!isRetryable) break;
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }

      const status = lastErr?.response?.status;
      const msg = lastErr?.response?.data?.message || lastErr?.message || 'Failed to load rooms.';
      if (status === 503) toast.error(msg);
      else if (status === 404) toast.error('Rooms API not found. Please restart backend server.');
      else toast.error(msg);
      setRoomTypes([]);
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

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter((rt: any) => {
      const name = String(rt?.name || '').toLowerCase();
      const hotelName = String(rt?.hotel?.name || '').toLowerCase();
      const location = String(rt?.hotel?.location || '').toLowerCase();
      return name.includes(q) || hotelName.includes(q) || location.includes(q);
    });
  }, [roomTypes, searchQuery]);

  const getTaxInclusivePrice = (rt: any) => {
    const base = Number(rt?.pricePerNight || 0);
    const hotel = rt?.hotel || {};
    if (!hotel?.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  return (
    <div className="pt-20">
      <section className="section-cream py-10 lg:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle label="Room Options" title="Browse Rooms" subtitle="Choose a room type, then book from the hotel page" />
          <div className="max-w-4xl mx-auto grid grid-cols-1 gap-3">
            <div className="relative md:col-span-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search by room type, hotel, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 lg:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          {roomTypes.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Rooms Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Room types will appear here once hotels are approved and inventory is added.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((rt: any) => (
                <ListingCard
                  key={rt._id}
                  image={rt?.images?.[0] || rt?.hotel?.image}
                  images={rt?.images?.length ? rt.images : rt?.hotel?.images}
                  name={rt.name}
                  location={`${rt?.hotel?.name || ''}${rt?.hotel?.location ? ` • ${rt.hotel.location}` : ''}`}
                  price={getTaxInclusivePrice(rt)}
                  priceLabel={rt?.hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                  rating={0}
                  reviewCount={0}
                  amenities={rt?.amenities || rt?.hotel?.amenities || []}
                  meta={Number(rt?.totalCount || 0) > 0 ? `${rt.totalCount} rooms` : undefined}
                  variant="compact"
                  ctaLabel="Book Room"
                  onViewDetails={() => {
                    prefetchDetail('roomTypes', rt._id, rt);
                    navigate(`/room-types/${rt._id}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Rooms;
