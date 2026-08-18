// import { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { Search } from 'lucide-react';
// import { toast } from 'sonner';
// import SectionTitle from '@/components/shared/SectionTitle';
// import ListingCard from '@/components/shared/ListingCard';
// import { api } from '@/lib/api';
// import { subscribeAppEvent } from '@/lib/broadcast';
// import { prefetchDetail } from '@/lib/detailCache';

// type HotelListItem = {
//   _id: string;
//   name: string;
//   location: string;
//   rating: number;
//   image: string;
//   images?: string[];
//   amenities?: string[];
//   reviewCount?: number;
// };

// const Hotels = () => {
//   const navigate = useNavigate();
//   const [searchQuery, setSearchQuery] = useState('');
//   const [hotels, setHotels] = useState<HotelListItem[]>([]);

//   useEffect(() => {
//     const load = async () => {
//       // Show cached list instantly (if present) for perceived speed, then revalidate from API.
//       try {
//         const cached = localStorage.getItem('vvs_hotels');
//         if (cached) {
//           const parsed = JSON.parse(cached);
//           if (Array.isArray(parsed)) setHotels(parsed);
//         }
//       } catch {
//         // ignore
//       }
//       try {
//         const res = await api.get('/hotels');
//         const data = Array.isArray(res.data?.data) ? (res.data.data as HotelListItem[]) : [];
//         setHotels(data);
//         try {
//           localStorage.setItem('vvs_hotels', JSON.stringify(data));
//         } catch {
//           // ignore
//         }
//       } catch {
//         setHotels([]);
//       }
//     };

//     void load();
//     const unsub = subscribeAppEvent('listing:changed', () => void load());
//     const onFocus = () => void load();
//     window.addEventListener('focus', onFocus);
//     return () => {
//       unsub();
//       window.removeEventListener('focus', onFocus);
//     };
//   }, []);

//   const filtered = hotels.filter(h =>
//     h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     h.location.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const removeHotelFromCache = (hotelId: string) => {
//     setHotels((prev) => {
//       const next = prev.filter((hotel) => hotel._id !== hotelId);
//       try {
//         localStorage.setItem('vvs_hotels', JSON.stringify(next));
//       } catch {
//         // ignore
//       }
//       return next;
//     });
//   };

//   const openHotel = async (hotel: HotelListItem) => {
//     prefetchDetail('hotels', hotel._id, hotel);
//     try {
//       const res = await api.get(`/hotels/${hotel._id}`);
//       const freshHotel = res.data?.data || hotel;
//       prefetchDetail('hotels', hotel._id, freshHotel);
//       navigate(`/hotels/${hotel._id}`);
//     } catch (err: any) {
//       if (err?.response?.status === 404) {
//         removeHotelFromCache(hotel._id);
//         toast.error('This hotel is no longer available. The list has been refreshed.');
//         return;
//       }
//       navigate(`/hotels/${hotel._id}`);
//     }
//   };

//   return (
//     <div className="pt-20">
//       <section className="section-cream py-10 lg:py-16">
//         <div className="container mx-auto px-3 sm:px-4">
//           <SectionTitle label="Stays in Vrindavan" title="Find Your Perfect Hotel" subtitle="Comfortable, verified stays near the most sacred sites" />
//           <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
//             <div className="relative md:col-span-3">
//               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
//               <input type="text" placeholder="Search hotels by name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="py-10 lg:py-16">
//         <div className="container mx-auto px-3 sm:px-4">
//           {hotels.length === 0 ? (
//             <div className="text-center py-20">
//               <p className="font-heading text-2xl text-muted-foreground mb-2">No Hotels Listed Yet</p>
//               <p className="font-body text-sm text-muted-foreground">Hotels will appear here once the admin adds them from the admin panel.</p>
//             </div>
//           ) : (
//             <>
//               <div className="flex items-center justify-between mb-5">
//                 <p className="font-body text-muted-foreground text-sm">{filtered.length} hotels found</p>
//                 <select className="font-body text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
//                   <option>Sort by: Recommended</option>
//                   <option>Rating: High to Low</option>
//                 </select>
//               </div>
//               <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
//                 {filtered.map((hotel) => (
//                   <ListingCard
//                     key={hotel._id}
//                     variant="hotel"
//                     image={hotel.image}
//                     images={hotel.images}
//                     name={hotel.name}
//                     location={hotel.location}
//                     rating={hotel.rating}
//                     reviewCount={hotel.reviewCount || 0}
//                     amenities={hotel.amenities || []}
//                     onViewDetails={() => void openHotel(hotel)}
//                   />
//                 ))}
//               </div>
//               {filtered.length === 0 && (
//                 <div className="text-center py-20">
//                   <p className="font-heading text-2xl text-muted-foreground">No hotels found</p>
//                   <p className="font-body text-sm text-muted-foreground mt-2">Try a different search term</p>
//                 </div>
//               )}
//             </>
//           )}
//         </div>
//       </section>
//     </div>
//   );
// };

// export default Hotels;

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Hotel } from 'lucide-react';
import { toast } from 'sonner';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { getBrajLocationName, sortBrajLocationNames, sortBrajLocationNamesForSearch } from '@/lib/brajLocations';

type HotelListItem = {
  _id: string;
  name: string;
  propertyType?: 'hotel' | 'dharamshala';
  location: string;
  rating: number;
  image: string;
  images?: string[];
  amenities?: string[];
  nearestTemple?: string;
  reviewCount?: number;
  pricePerNight?: number;
  pricePerBed?: number;
  priceDoubleAC?: number;
  priceDoubleNonAC?: number;
  priceSingleAC?: number;
  priceSingleNonAC?: number;
  taxEnabled?: boolean;
  taxPercent?: number;
};

const Hotels = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const propertyFilter = searchParams.get('type') === 'dharamshala' ? 'dharamshala' : searchParams.get('type') === 'hotel' ? 'hotel' : '';
  const [hotels, setHotels] = useState<HotelListItem[]>([]);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      const q = searchQuery.trim();
      // Show cached list instantly (if present) for perceived speed, then revalidate from API.
      if (!q) {
        try {
          const cached = localStorage.getItem('vvs_hotels');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setHotels(parsed);
          }
        } catch {
          // ignore
        }
      }
      try {
        const res = await api.get('/hotels', q ? { params: { q } } : undefined);
        const data = Array.isArray(res.data?.data) ? (res.data.data as HotelListItem[]) : [];
        setHotels(data);
        if (!q) {
          try {
            localStorage.setItem('vvs_hotels', JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      } catch {
        setHotels([]);
      }
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

  const filtered = hotels.filter((h) => {
    if (propertyFilter && String(h.propertyType || 'hotel') !== propertyFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const locationName = getBrajLocationName(h.location, h.nearestTemple, h.name).toLowerCase();
    return h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || locationName.includes(q);
  });

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, HotelListItem[]>();
    for (const hotel of filtered) {
      const locationName = getBrajLocationName(hotel.location, hotel.nearestTemple, hotel.name);
      map.set(locationName, [...(map.get(locationName) || []), hotel]);
    }
    const sortLocations = sortBrajLocationNamesForSearch(searchQuery);
    return Array.from(map.entries()).sort(([a], [b]) => sortLocations(a, b));
  }, [filtered, searchQuery]);

  const locationOptions = useMemo(
    () => Array.from(new Set(
      hotels.map((h) => getBrajLocationName(h.location, h.nearestTemple, h.name)).filter(Boolean)
    )).sort(sortBrajLocationNames).slice(0, 12),
    [hotels]
  );

  const getHotelStartingPrice = (hotel: HotelListItem) => {
    const prices = [
      hotel.pricePerNight,
      hotel.pricePerBed,
      hotel.priceDoubleAC,
      hotel.priceDoubleNonAC,
      hotel.priceSingleAC,
      hotel.priceSingleNonAC,
    ]
      .map((price) => Number(price || 0))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return undefined;
    const base = Math.min(...prices);
    if (!hotel.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(hotel.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const removeHotelFromCache = (hotelId: string) => {
    setHotels((prev) => {
      const next = prev.filter((hotel) => hotel._id !== hotelId);
      try {
        localStorage.setItem('vvs_hotels', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openHotel = async (hotel: HotelListItem) => {
    prefetchDetail('hotels', hotel._id, hotel);
    try {
      const res = await api.get(`/hotels/${hotel._id}`);
      const freshHotel = res.data?.data || hotel;
      prefetchDetail('hotels', hotel._id, freshHotel);
      navigate(`/hotels/${hotel._id}`);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        removeHotelFromCache(hotel._id);
        toast.error('This hotel is no longer available. The list has been refreshed.');
        return;
      }
      navigate(`/hotels/${hotel._id}`);
    }
  };

  return (
    <div className="pt-16">

      <section className="section-cream relative overflow-hidden py-4 lg:py-5">
        <div className="container mx-auto px-4 sm:px-6 relative">
          <SectionTitle
            label="Stays Across Braj"
            title="Find Hotels & Dharamshalas Across Braj"
            subtitle="Search by Braj locations like Govardhan, Barsana, Mathura, Gokul, and Vrindavan"
          />

          <div className="premium-toolbar mx-auto mt-4 max-w-2xl p-2">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                size={20}
              />
              <input
                type="text"
                placeholder="Search by hotel name or location..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  const next = new URLSearchParams();
                  if (propertyFilter) next.set('type', propertyFilter);
                  if (value.trim()) next.set('q', value);
                  setSearchParams(next, { replace: true });
                }}
                className="premium-field w-full pl-12 pr-5"
              />
            </div>
          </div>
          {locationOptions.length > 0 && (
            <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
              {locationOptions.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setSearchQuery(loc);
                    const next = new URLSearchParams();
                    if (propertyFilter) next.set('type', propertyFilter);
                    next.set('q', loc);
                    setSearchParams(next);
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
        <div className="container mx-auto px-4 sm:px-6">

          {hotels.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
                <Hotel size={30} className="text-muted-foreground/40" />
              </div>
              <p className="font-heading text-2xl font-bold text-foreground mb-2">No Hotels Listed Yet</p>
              <p className="font-body text-[14px] text-muted-foreground max-w-sm">
                Hotels will appear here once the admin adds them from the admin panel.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-gold/10 text-brand-gold font-heading text-[13px] font-bold">
                    {filtered.length}
                  </span>
                  <p className="font-body text-[13px] text-muted-foreground font-medium">
                    {filtered.length === 1 ? 'stay found' : 'stays found'} across {groupedByLocation.length} location{groupedByLocation.length === 1 ? '' : 's'}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchParams({});
                      }}
                      className="rounded-full border border-border px-3 py-1 font-body text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                    >
                      Clear search
                    </button>
                  )}
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <SlidersHorizontal size={15} className="text-muted-foreground/50" />
                  <select className="w-full cursor-pointer rounded-lg border border-border bg-card px-3 py-2 font-body text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40 sm:w-auto">
                    <option>Recommended</option>
                    <option>Rating: High to Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-8">
                {groupedByLocation.map(([locationName, locationHotels]) => {
                  const hotelCount = locationHotels.filter((hotel) => hotel.propertyType !== 'dharamshala').length;
                  const dharamshalaCount = locationHotels.length - hotelCount;
                  return (
                    <section key={locationName} className="space-y-3">
                      <div className="flex flex-col gap-2 border-b border-border/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="font-ui text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">Braj Location</p>
                          <h2 className="font-heading text-2xl font-bold text-foreground">{locationName}</h2>
                        </div>
                        <p className="font-body text-xs font-semibold text-muted-foreground">
                          {locationHotels.length} stay{locationHotels.length === 1 ? '' : 's'}
                          {hotelCount > 0 ? ` - ${hotelCount} hotel${hotelCount === 1 ? '' : 's'}` : ''}
                          {dharamshalaCount > 0 ? ` - ${dharamshalaCount} dharamshala${dharamshalaCount === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                        {locationHotels.map((hotel) => (
                          <ListingCard
                            key={hotel._id}
                            variant="hotel"
                            image={hotel.image}
                            images={hotel.images}
                            name={hotel.name}
                            badge={hotel.propertyType === 'dharamshala' ? 'Dharamshala' : 'Hotel'}
                            location={hotel.location}
                            price={hotel.propertyType === 'dharamshala' ? undefined : getHotelStartingPrice(hotel)}
                            priceLabel={hotel.taxEnabled ? '/night incl. GST' : '/night'}
                            rating={Number(hotel.rating || 0)}
                            reviewCount={Number(hotel.reviewCount || 0)}
                            amenities={hotel.amenities || []}
                            onViewDetails={() => void openHotel(hotel)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Search size={24} className="text-muted-foreground/40" />
                  </div>
                  <p className="font-heading text-xl font-bold text-foreground">No hotels found</p>
                  <p className="font-body text-[13px] text-muted-foreground mt-1.5">
                    Try searching with a different name or location
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchParams({});
                    }}
                    className="mt-4 btn-gold rounded-lg px-5 py-2 font-body text-xs"
                  >
                    Show all hotels
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Hotels;
