import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { getBrajLocationName, sortBrajLocationNames, sortBrajLocationNamesForSearch } from '@/lib/brajLocations';

const Rooms = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      const q = searchQuery.trim();
      // Optimistically show cache while revalidating.
      if (!q) {
        try {
          const cached = localStorage.getItem('vvs_room_types');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setRoomTypes(parsed);
          }
        } catch {
          // ignore
        }
      }

      // Retry a few times (backend may be restarting).
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await api.get('/room-types', q ? { params: { q } } : undefined);
          const data = Array.isArray(res.data?.data) ? res.data.data : [];
          setRoomTypes(data);
          if (!q) {
            try {
              localStorage.setItem('vvs_room_types', JSON.stringify(data));
            } catch {
              // ignore
            }
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

    const timer = window.setTimeout(() => void load(), 180);
    const unsub = subscribeAppEvent('listing:changed', () => void load());
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timer);
      unsub();
      window.removeEventListener('focus', onFocus);
    };
  }, [searchQuery]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter((rt: any) => {
      const name = String(rt?.name || '').toLowerCase();
      const hotelName = String(rt?.hotel?.name || '').toLowerCase();
      const location = String(rt?.hotel?.location || '').toLowerCase();
      const locationName = getBrajLocationName(rt?.hotel?.location, rt?.hotel?.nearestTemple, rt?.hotel?.name).toLowerCase();
      return name.includes(q) || hotelName.includes(q) || location.includes(q) || locationName.includes(q);
    });
  }, [roomTypes, searchQuery]);

  const locationOptions = useMemo(
    () => Array.from(new Set(
      roomTypes.map((rt: any) => getBrajLocationName(rt?.hotel?.location, rt?.hotel?.nearestTemple, rt?.hotel?.name)).filter(Boolean)
    )).sort(sortBrajLocationNames).slice(0, 12),
    [roomTypes]
  );

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const roomType of filtered) {
      const locationName = getBrajLocationName(roomType?.hotel?.location, roomType?.hotel?.nearestTemple, roomType?.hotel?.name);
      map.set(locationName, [...(map.get(locationName) || []), roomType]);
    }
    const sortLocations = sortBrajLocationNamesForSearch(searchQuery);
    return Array.from(map.entries()).sort(([a], [b]) => sortLocations(a, b));
  }, [filtered, searchQuery]);

  const getTaxInclusivePrice = (rt: any) => {
    const base = Number(rt?.pricePerNight || 0);
    const hotel = rt?.hotel || {};
    if (!hotel?.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  return (
    <div className="pt-16">
      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle label="Room Options" title="Browse Rooms Across Braj" subtitle="Filter room types by property or location like Govardhan, Barsana, Mathura, Gokul, and Vrindavan" />
          <div className="premium-toolbar mx-auto grid max-w-4xl grid-cols-1 gap-3 p-2 transition-transform duration-200 hover:-translate-y-0.5">
            <div className="relative md:col-span-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search by room type, hotel, or location..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  setSearchParams(value.trim() ? { q: value } : {}, { replace: true });
                }}
                className="premium-field w-full pl-12 pr-4"
              />
            </div>
          </div>
          {locationOptions.length > 0 && (
            <div className="mx-auto mt-3 flex max-w-4xl flex-wrap justify-center gap-2">
              {locationOptions.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setSearchQuery(loc);
                    setSearchParams({ q: loc });
                  }}
                  className={`rounded-full border px-3 py-1.5 font-body text-[12px] font-semibold transition-colors ${
                    searchQuery.toLowerCase() === loc.toLowerCase()
                      ? 'border-brand-gold bg-brand-gold text-brand-black'
                      : 'border-border bg-card text-muted-foreground hover:border-brand-gold/60 hover:text-foreground'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          {roomTypes.length === 0 ? (
            <div className="premium-surface mx-auto max-w-lg p-8 text-center">
              <p className="font-heading text-2xl text-foreground mb-2">No Rooms Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Room types will appear here once hotels are approved and inventory is added.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-brand-gold/10 px-2 font-heading text-[13px] font-bold text-brand-gold">
                  {filtered.length}
                </span>
                <p className="font-body text-[13px] font-medium text-muted-foreground">
                  {filtered.length === 1 ? 'room type' : 'room types'} across {groupedByLocation.length} location{groupedByLocation.length === 1 ? '' : 's'}
                </p>
              </div>

              {groupedByLocation.map(([locationName, locationRoomTypes]) => {
                const dharamshalaCount = locationRoomTypes.filter((rt: any) => rt?.hotel?.propertyType === 'dharamshala').length;
                const hotelRoomCount = locationRoomTypes.length - dharamshalaCount;
                return (
                  <section key={locationName} className="space-y-3">
                    <div className="flex flex-col gap-2 border-b border-border/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="font-ui text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Braj Location</p>
                        <h2 className="font-heading text-2xl font-bold text-foreground">{locationName}</h2>
                      </div>
                      <p className="font-body text-xs font-semibold text-muted-foreground">
                        {locationRoomTypes.length} room type{locationRoomTypes.length === 1 ? '' : 's'}
                        {hotelRoomCount > 0 ? ` - ${hotelRoomCount} hotel room${hotelRoomCount === 1 ? '' : 's'}` : ''}
                        {dharamshalaCount > 0 ? ` - ${dharamshalaCount} dharamshala room${dharamshalaCount === 1 ? '' : 's'}` : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                      {locationRoomTypes.map((rt: any) => (
                        <ListingCard
                          key={rt._id}
                          image={rt?.images?.[0] || rt?.hotel?.image}
                          images={rt?.images?.length ? rt.images : rt?.hotel?.images}
                          name={rt.name}
                          location={`${rt?.hotel?.name || ''}${rt?.hotel?.location ? ` - ${rt.hotel.location}` : ''}`}
                          price={rt?.hotel?.propertyType === 'dharamshala' ? undefined : getTaxInclusivePrice(rt)}
                          priceLabel={rt?.hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                          rating={0}
                          reviewCount={0}
                          amenities={rt?.amenities || rt?.hotel?.amenities || []}
                          meta={Number(rt?.totalCount || 0) > 0 ? `${rt.totalCount} rooms` : undefined}
                          variant="compact"
                          badge={rt?.hotel?.propertyType === 'dharamshala' ? 'Dharamshala' : 'Hotel Room'}
                          ctaLabel={rt?.hotel?.propertyType === 'dharamshala' ? 'WhatsApp / Call' : 'Book Room'}
                          onViewDetails={() => {
                            prefetchDetail('roomTypes', rt._id, rt);
                            navigate(`/room-types/${rt._id}`);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {filtered.length === 0 && (
                <div className="premium-focus-card col-span-full mx-auto max-w-md p-6 text-center">
                  <p className="font-heading text-xl font-bold text-foreground">No rooms found</p>
                  <p className="mt-2 font-body text-sm text-muted-foreground">Try another hotel name, room type, or area.</p>
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="btn-gold mt-5 rounded-lg px-5 py-2 text-sm"
                  >
                    Show All Rooms
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

export default Rooms;
