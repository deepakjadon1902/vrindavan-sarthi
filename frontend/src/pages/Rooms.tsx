import { useMemo, useState, useEffect } from 'react';
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
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // Optimistically show cache while revalidating.
      try {
        const cached = localStorage.getItem('vvs_room_types');
        if (cached && roomTypes.length === 0) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setRoomTypes(parsed);
        }
      } catch {
        // ignore
      }

      const params: any = {};
      if (checkIn && checkOut) {
        params.checkIn = checkIn;
        params.checkOut = checkOut;
      }

      // Retry a few times (backend may be restarting).
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await api.get('/room-types', { params });
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
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
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
  }, [checkIn, checkOut]);

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

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle label="Room Options" title="Browse Rooms" subtitle="Choose a room type, then book from the hotel page" />
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div>
              <label className="font-body text-xs text-muted-foreground">Check-in</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Check-out</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setCheckIn('');
                  setCheckOut('');
                }}
                className="w-full py-3 rounded-xl border border-border bg-card font-body text-sm hover:bg-muted transition-colors"
              >
                Clear Dates
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {roomTypes.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Rooms Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Room types will appear here once hotels are approved and inventory is added.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((rt: any) => (
                <ListingCard
                  key={rt._id}
                  image={rt?.images?.[0] || rt?.hotel?.image}
                  images={rt?.images?.length ? rt.images : rt?.hotel?.images}
                  name={rt.name}
                  location={`${rt?.hotel?.name || ''}${rt?.hotel?.location ? ` • ${rt.hotel.location}` : ''}`}
                  price={rt.pricePerNight}
                  priceLabel="/night"
                  rating={0}
                  reviewCount={0}
                  amenities={rt?.amenities || rt?.hotel?.amenities || []}
                  meta={
                    checkIn && checkOut
                      ? (Number(rt?.availableCount || 0) > 0 ? `${rt.availableCount} rooms left` : 'Fully booked')
                      : (Number(rt?.totalCount || 0) > 0 ? `${rt.totalCount} rooms` : undefined)
                  }
                  badge={checkIn && checkOut ? (Number(rt?.availableCount || 0) > 0 ? 'Available' : 'Sold out') : undefined}
                  badgeColor={checkIn && checkOut ? (Number(rt?.availableCount || 0) > 0 ? 'green' : 'crimson') : undefined}
                  onViewDetails={() => {
                    prefetchDetail('roomTypes', rt._id, rt);
                    const qs = new URLSearchParams();
                    if (checkIn) qs.set('checkIn', checkIn);
                    if (checkOut) qs.set('checkOut', checkOut);
                    navigate(`/room-types/${rt._id}?${qs.toString()}`);
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
