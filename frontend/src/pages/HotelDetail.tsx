// import { useEffect, useMemo, useState } from 'react';
// import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
// import { ArrowLeft, BedDouble, CalendarDays, MapPin, ShieldCheck, Star } from 'lucide-react';
// import ImageCarousel from '@/components/shared/ImageCarousel';
// import ListingCard from '@/components/shared/ListingCard';
// import { api } from '@/lib/api';
// import { getCachedListingItem, getPrefetchedDetail, prefetchDetail } from '@/lib/detailCache';

// type Hotel = {
//   _id: string;
//   name: string;
//   location?: string;
//   rating?: number;
//   image?: string;
//   images?: string[];
//   description?: string;
//   amenities?: string[];
//   googleMapLink?: string;
//   nearestTemple?: string;
//   reviewCount?: number;
//   petsAllowed?: boolean;
//   checkInTime?: string;
//   checkOutTime?: string;
//   taxEnabled?: boolean;
//   taxPercent?: number;
// };

// type RoomType = {
//   _id: string;
//   hotelId?: string;
//   name: string;
//   description?: string;
//   images?: string[];
//   amenities?: string[];
//   pricePerNight?: number;
//   maxAdults?: number;
//   maxChildren?: number;
//   totalCount?: number;
//   availableCount?: number;
//   hotel?: Hotel;
// };

// const getGoogleMapEmbedSrc = (value?: string) => {
//   const raw = String(value || '').trim();
//   if (!raw) return '';
//   if (raw.includes('/maps/embed')) return raw;

//   const coordinateMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
//   if (coordinateMatch) {
//     return `https://www.google.com/maps?q=${coordinateMatch[1]},${coordinateMatch[2]}&output=embed`;
//   }

//   try {
//     const url = new URL(raw);
//     if (url.hostname.includes('google') || url.hostname.includes('goo.gl')) {
//       return `https://www.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
//     }
//   } catch {
//     return `https://www.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
//   }

//   return '';
// };

// const sameId = (a?: string | null, b?: string | null) => String(a || '') === String(b || '');

// const HotelDetail = () => {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const location = useLocation();

//   const [hotel, setHotel] = useState<Hotel | null>(() => getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
//   const [isRoomsLoading, setIsRoomsLoading] = useState(false);
//   const [checkIn, setCheckIn] = useState('');
//   const [checkOut, setCheckOut] = useState('');

//   useEffect(() => {
//     const run = async () => {
//       if (!id) return;
//       const cached = getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null;
//       setIsLoading(true);
//       try {
//         const res = await api.get(`/hotels/${id}`);
//         setHotel(res.data?.data || null);
//       } catch (err: any) {
//         if (err?.response?.status === 404) {
//           try {
//             const cachedHotels = localStorage.getItem('vvs_hotels');
//             const parsed = cachedHotels ? JSON.parse(cachedHotels) : [];
//             if (Array.isArray(parsed)) {
//               localStorage.setItem('vvs_hotels', JSON.stringify(parsed.filter((h: Hotel) => h?._id !== id)));
//             }
//           } catch {
//             // ignore
//           }
//           setHotel(cached);
//         } else {
//           setHotel(cached);
//         }
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     void run();
//   }, [id]);

//   useEffect(() => {
//     const run = async () => {
//       if (!id) return;
//       setIsRoomsLoading(true);
//       try {
//         const params: Record<string, string> = {};
//         if (checkIn && checkOut) {
//           params.checkIn = checkIn;
//           params.checkOut = checkOut;
//         }
//         const res = await api.get(`/hotels/${id}/room-types`, { params });
//         let data = Array.isArray(res.data?.data) ? (res.data.data as RoomType[]) : [];

//         // Fallback to the global public room-type list so hotel detail stays aligned
//         // with the Rooms page if an older backend/proxy misses the hotel-specific route.
//         if (data.length === 0) {
//           try {
//             const fallbackRes = await api.get('/room-types', { params });
//             const fallbackData = Array.isArray(fallbackRes.data?.data) ? (fallbackRes.data.data as RoomType[]) : [];
//             data = fallbackData.filter((rt) => sameId(rt.hotelId, id) || sameId(rt.hotel?._id, id));
//           } catch {
//             // Keep the original empty hotel-specific result.
//           }
//         }

//         setRoomTypes(data);
//       } catch {
//         setRoomTypes([]);
//       } finally {
//         setIsRoomsLoading(false);
//       }
//     };
//     void run();
//   }, [id, checkIn, checkOut]);

//   // Clean query params like checkIn/checkOut that may be deep-linked from legacy pages.
//   useEffect(() => {
//     const qs = new URLSearchParams(location.search);
//     let changed = false;
//     ['checkIn', 'checkOut', 'roomTypeId'].forEach((k) => {
//       if (qs.has(k)) {
//         qs.delete(k);
//         changed = true;
//       }
//     });
//     if (!changed) return;
//     const next = qs.toString();
//     navigate(`/hotels/${id}${next ? `?${next}` : ''}`, { replace: true });
//   }, [id, location.search, navigate]);

//   const allImages = useMemo(() => {
//     if (!hotel) return [];
//     return [hotel.image, ...(hotel.images || [])].filter(Boolean);
//   }, [hotel]);

//   const roomDetailsUrl = (roomTypeId: string) => {
//     const qs = new URLSearchParams();
//     if (checkIn) qs.set('checkIn', checkIn);
//     if (checkOut) qs.set('checkOut', checkOut);
//     const query = qs.toString();
//     return `/room-types/${roomTypeId}${query ? `?${query}` : ''}`;
//   };

//   const getTaxInclusivePrice = (rt: RoomType) => {
//     const base = Number(rt.pricePerNight || 0);
//     const rtHotel = rt.hotel || hotel;
//     if (!rtHotel?.taxEnabled) return base;
//     const percent = Math.min(50, Math.max(0, Number(rtHotel.taxPercent ?? 12)));
//     return Math.round(base + (base * percent) / 100);
//   };

//   const mapEmbedSrc = getGoogleMapEmbedSrc(hotel?.googleMapLink);

//   if (!isLoading && !hotel) {
//     return (
//       <div className="pt-20 pb-16 text-center min-h-screen bg-background">
//         <p className="font-heading text-2xl text-muted-foreground">Hotel not found</p>
//         <Link to="/hotels" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">
//           Back to Hotels
//         </Link>
//       </div>
//     );
//   }

//   return (
//     <div className="pt-20 pb-16 min-h-screen bg-background">
//       <div className="container mx-auto px-4 max-w-6xl">
//         <button
//           onClick={() => navigate(-1)}
//           className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors"
//         >
//           <ArrowLeft size={16} /> Back
//         </button>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           <div className="lg:col-span-2 space-y-6">
//             <div className="rounded-xl border border-border bg-card overflow-hidden">
//               <ImageCarousel images={allImages} alt={hotel?.name || 'Hotel'} />
//             </div>

//             <div className="rounded-xl border border-border bg-card p-5">
//               <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight">
//                 {isLoading ? 'Loading…' : hotel?.name}
//               </h1>

//               <div className="flex flex-wrap items-center gap-4 mt-2">
//                 <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
//                   <MapPin size={15} className="text-brand-crimson" />
//                   {hotel?.location || 'Vrindavan'}
//                 </span>

//                 <div className="flex items-center gap-2">
//                   <div className="flex items-center gap-0.5">
//                     {Array.from({ length: 5 }).map((_, i) => (
//                       <Star
//                         key={i}
//                         size={14}
//                         className={i < Math.floor(hotel?.rating || 0) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
//                       />
//                     ))}
//                   </div>
//                   <span className="font-body text-sm text-muted-foreground">
//                     {hotel?.rating ? Number(hotel.rating).toFixed(1) : 'New'}
//                   </span>
//                 </div>
//               </div>

//               <div className="mt-4 flex flex-wrap gap-2">
//                 <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-body text-foreground/80">
//                   <ShieldCheck size={14} className="text-brand-green" />
//                   Verified listing
//                 </span>
//                 {hotel?.petsAllowed && (
//                   <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-body text-foreground/80">
//                     Pets allowed
//                   </span>
//                 )}
//                 {hotel?.nearestTemple && (
//                   <span className="inline-flex items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-body text-foreground/80">
//                     Near {hotel.nearestTemple}
//                   </span>
//                 )}
//               </div>
//             </div>

//             {hotel?.description && (
//               <div className="rounded-xl border border-border bg-card p-5">
//                 <h2 className="font-heading text-base font-semibold text-foreground mb-2">About</h2>
//                 <p className="font-body text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
//               </div>
//             )}

//             {Array.isArray(hotel?.amenities) && hotel.amenities.length > 0 && (
//               <div className="rounded-xl border border-border bg-card p-5">
//                 <h2 className="font-heading text-base font-semibold text-foreground mb-3">Amenities</h2>
//                 <div className="flex flex-wrap gap-2">
//                   {hotel.amenities.map((a: string) => (
//                     <span
//                       key={a}
//                       className="font-body text-xs bg-secondary px-2.5 py-1 rounded-full text-secondary-foreground border border-border"
//                     >
//                       {a}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             )}

//             <div id="hotel-room-types" className="rounded-xl border border-border bg-card p-5">
//               <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
//                 <div>
//                   <h2 className="font-heading text-lg font-semibold text-foreground">Room Types</h2>
//                   <p className="font-body text-sm text-muted-foreground">
//                     Choose from the rooms listed under this hotel.
//                   </p>
//                 </div>
//                 <div className="grid grid-cols-2 gap-2 sm:w-80">
//                   <div>
//                     <label className="font-body text-xs text-muted-foreground">Check-in</label>
//                     <input
//                       type="date"
//                       value={checkIn}
//                       onChange={(e) => setCheckIn(e.target.value)}
//                       className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
//                     />
//                   </div>
//                   <div>
//                     <label className="font-body text-xs text-muted-foreground">Check-out</label>
//                     <input
//                       type="date"
//                       value={checkOut}
//                       onChange={(e) => setCheckOut(e.target.value)}
//                       className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
//                     />
//                   </div>
//                 </div>
//               </div>

//               {isRoomsLoading ? (
//                 <div className="mt-5 rounded-lg border border-border bg-background p-6 text-center">
//                   <p className="font-body text-sm text-muted-foreground">Loading room types...</p>
//                 </div>
//               ) : roomTypes.length === 0 ? (
//                 <div className="mt-5 rounded-lg border border-border bg-background p-6 text-center">
//                   <BedDouble size={28} className="mx-auto mb-2 text-muted-foreground/50" />
//                   <p className="font-body text-sm text-muted-foreground">No room types are listed for this hotel yet.</p>
//                 </div>
//               ) : (
//                 <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
//                   {roomTypes.map((rt) => {
//                     const rtHotel = rt.hotel || hotel;
//                     const availabilityText =
//                       typeof rt.availableCount === 'number'
//                         ? rt.availableCount > 0
//                           ? `${rt.availableCount} available`
//                           : 'Fully booked'
//                         : Number(rt.totalCount || 0) > 0
//                           ? `${rt.totalCount} rooms`
//                           : undefined;
//                     const enrichedRoom = {
//                       ...rt,
//                       hotel: rtHotel,
//                     };
//                     return (
//                       <ListingCard
//                         key={rt._id}
//                         image={rt.images?.[0] || rtHotel?.image || '/placeholder.svg'}
//                         images={rt.images?.length ? rt.images : rtHotel?.images}
//                         name={rt.name}
//                         location={rtHotel?.name || 'Hotel room'}
//                         price={getTaxInclusivePrice(rt)}
//                         priceLabel={rtHotel?.taxEnabled ? '/night incl. GST' : '/night'}
//                         rating={rtHotel?.rating || 0}
//                         reviewCount={rtHotel?.reviewCount || 0}
//                         amenities={rt.amenities || rtHotel?.amenities || []}
//                         meta={availabilityText}
//                         variant="compact"
//                         ctaLabel="Book Room"
//                         onViewDetails={() => {
//                           prefetchDetail('roomTypes', rt._id, enrichedRoom);
//                           navigate(roomDetailsUrl(rt._id));
//                         }}
//                       />
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="lg:col-span-1">
//             <div className="rounded-xl border border-border bg-card p-5 sticky top-24">
//               <h2 className="font-heading text-base font-semibold text-foreground">Details</h2>

//               <div className="mt-3 space-y-3">
//                 <div className="flex items-start justify-between gap-3">
//                   <p className="font-body text-sm text-muted-foreground">Location</p>
//                   <p className="font-body text-sm text-foreground text-right">{hotel?.location || 'Vrindavan'}</p>
//                 </div>

//                 {typeof hotel?.checkInTime === 'string' && hotel.checkInTime && (
//                   <div className="flex items-start justify-between gap-3">
//                     <p className="font-body text-sm text-muted-foreground">Check-in</p>
//                     <p className="font-body text-sm text-foreground text-right">{hotel.checkInTime}</p>
//                   </div>
//                 )}
//                 {hotel?.nearestTemple && (
//                   <div className="flex items-start justify-between gap-3">
//                     <p className="font-body text-sm text-muted-foreground">Nearest landmark</p>
//                     <p className="font-body text-sm text-foreground text-right">Near {hotel.nearestTemple}</p>
//                   </div>
//                 )}
//                 {mapEmbedSrc && (
//                   <div className="pt-3 border-t border-border">
//                     <iframe
//                       title={`${hotel?.name || 'Hotel'} map`}
//                       src={mapEmbedSrc}
//                       className="h-44 w-full rounded-lg border border-border"
//                       loading="lazy"
//                       referrerPolicy="no-referrer-when-downgrade"
//                     />
//                   </div>
//                 )}

//                 {typeof hotel?.checkOutTime === 'string' && hotel.checkOutTime && (
//                   <div className="flex items-start justify-between gap-3">
//                     <p className="font-body text-sm text-muted-foreground">Check-out</p>
//                     <p className="font-body text-sm text-foreground text-right">{hotel.checkOutTime}</p>
//                   </div>
//                 )}
//               </div>

//               <div className="mt-5 pt-4 border-t border-border">
//                 <a href="#hotel-room-types" className="w-full inline-flex items-center justify-center btn-gold px-4 py-2.5 rounded-lg text-sm font-body">
//                   View Hotel Rooms
//                 </a>
//                 <p className="mt-2 font-body text-xs text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
//                   <CalendarDays size={13} />
//                   Book a specific room type from this hotel page.
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default HotelDetail;

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, CalendarDays, MapPin, ShieldCheck, Star, Clock, Church, PawPrint, Wifi } from 'lucide-react';
import ImageCarousel from '@/components/shared/ImageCarousel';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail, prefetchDetail } from '@/lib/detailCache';

type Hotel = {
  _id: string;
  name: string;
  location?: string;
  rating?: number;
  image?: string;
  images?: string[];
  description?: string;
  amenities?: string[];
  googleMapLink?: string;
  nearestTemple?: string;
  reviewCount?: number;
  petsAllowed?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  taxEnabled?: boolean;
  taxPercent?: number;
};

type RoomType = {
  _id: string;
  hotelId?: string;
  name: string;
  description?: string;
  images?: string[];
  amenities?: string[];
  pricePerNight?: number;
  maxAdults?: number;
  maxChildren?: number;
  totalCount?: number;
  availableCount?: number;
  hotel?: Hotel;
};

const getGoogleMapEmbedSrc = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('/maps/embed')) return raw;

  const coordinateMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordinateMatch) {
    return `https://www.google.com/maps?q=${coordinateMatch[1]},${coordinateMatch[2]}&output=embed`;
  }

  try {
    const url = new URL(raw);
    if (url.hostname.includes('google') || url.hostname.includes('goo.gl')) {
      return `https://www.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
    }
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
  }

  return '';
};

const sameId = (a?: string | null, b?: string | null) => String(a || '') === String(b || '');

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [hotel, setHotel] = useState<Hotel | null>(() => getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      const cached = getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null;
      setIsLoading(true);
      try {
        const res = await api.get(`/hotels/${id}`);
        setHotel(res.data?.data || null);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          try {
            const cachedHotels = localStorage.getItem('vvs_hotels');
            const parsed = cachedHotels ? JSON.parse(cachedHotels) : [];
            if (Array.isArray(parsed)) {
              localStorage.setItem('vvs_hotels', JSON.stringify(parsed.filter((h: Hotel) => h?._id !== id)));
            }
          } catch {
            // ignore
          }
          setHotel(cached);
        } else {
          setHotel(cached);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsRoomsLoading(true);
      try {
        const params: Record<string, string> = {};
        if (checkIn && checkOut) {
          params.checkIn = checkIn;
          params.checkOut = checkOut;
        }
        const res = await api.get(`/hotels/${id}/room-types`, { params });
        let data = Array.isArray(res.data?.data) ? (res.data.data as RoomType[]) : [];

        if (data.length === 0) {
          try {
            const fallbackRes = await api.get('/room-types', { params });
            const fallbackData = Array.isArray(fallbackRes.data?.data) ? (fallbackRes.data.data as RoomType[]) : [];
            data = fallbackData.filter((rt) => sameId(rt.hotelId, id) || sameId(rt.hotel?._id, id));
          } catch {
            // Keep the original empty hotel-specific result.
          }
        }

        setRoomTypes(data);
      } catch {
        setRoomTypes([]);
      } finally {
        setIsRoomsLoading(false);
      }
    };
    void run();
  }, [id, checkIn, checkOut]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    let changed = false;
    ['checkIn', 'checkOut', 'roomTypeId'].forEach((k) => {
      if (qs.has(k)) {
        qs.delete(k);
        changed = true;
      }
    });
    if (!changed) return;
    const next = qs.toString();
    navigate(`/hotels/${id}${next ? `?${next}` : ''}`, { replace: true });
  }, [id, location.search, navigate]);

  const allImages = useMemo(() => {
    if (!hotel) return [];
    return [hotel.image, ...(hotel.images || [])].filter(Boolean);
  }, [hotel]);

  const roomDetailsUrl = (roomTypeId: string) => {
    const qs = new URLSearchParams();
    if (checkIn) qs.set('checkIn', checkIn);
    if (checkOut) qs.set('checkOut', checkOut);
    const query = qs.toString();
    return `/room-types/${roomTypeId}${query ? `?${query}` : ''}`;
  };

  const getTaxInclusivePrice = (rt: RoomType) => {
    const base = Number(rt.pricePerNight || 0);
    const rtHotel = rt.hotel || hotel;
    if (!rtHotel?.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(rtHotel.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const mapEmbedSrc = getGoogleMapEmbedSrc(hotel?.googleMapLink);

  if (!isLoading && !hotel) {
    return (
      <div className="pt-20 pb-16 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Hotel not found</p>
        <Link to="/hotels" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">
          Back to Hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* ── Back Button ── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-[13px] font-medium text-muted-foreground hover:text-foreground mb-6 mt-5 transition-colors group"
        >
          <span className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center group-hover:border-brand-gold/40 transition-colors">
            <ArrowLeft size={14} />
          </span>
          Back to Hotels
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Image Carousel */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <ImageCarousel images={allImages} alt={hotel?.name || 'Hotel'} />
            </div>

            {/* Hotel Name + Meta */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="p-6">
                <h1 className="font-heading text-2xl md:text-[28px] font-bold text-foreground leading-tight">
                  {isLoading ? 'Loading…' : hotel?.name}
                </h1>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
                  <span className="flex items-center gap-1.5 font-body text-[13px] text-muted-foreground">
                    <MapPin size={14} className="text-brand-crimson shrink-0" />
                    {hotel?.location || 'Vrindavan'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          className={i < Math.floor(hotel?.rating || 0) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/25'}
                        />
                      ))}
                    </div>
                    <span className="font-body text-[12px] text-muted-foreground font-medium">
                      {hotel?.rating ? Number(hotel.rating).toFixed(1) : 'New'}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-body font-semibold text-emerald-700">
                    <ShieldCheck size={12} className="text-emerald-600" /> Verified Listing
                  </span>
                  {hotel?.petsAllowed && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-body font-semibold text-foreground/70">
                      <PawPrint size={12} /> Pets Allowed
                    </span>
                  )}
                  {hotel?.nearestTemple && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/8 px-3 py-1 text-[11px] font-body font-semibold text-foreground/70">
                      <Church size={12} className="text-brand-gold" /> Near {hotel.nearestTemple}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* About */}
            {hotel?.description && (
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-6 py-3.5 bg-muted/30">
                  <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">About this Hotel</h2>
                </div>
                <div className="px-6 py-5">
                  <p className="font-body text-[14px] text-muted-foreground leading-relaxed">{hotel.description}</p>
                </div>
              </div>
            )}

            {/* Amenities */}
            {Array.isArray(hotel?.amenities) && hotel.amenities.length > 0 && (
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-6 py-3.5 bg-muted/30">
                  <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Amenities</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="flex flex-wrap gap-2">
                    {hotel.amenities.map((a: string) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1.5 font-body text-[12px] font-medium bg-muted/60 border border-border px-3 py-1.5 rounded-xl text-foreground/80"
                      >
                        <Wifi size={11} className="text-muted-foreground/50" />
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Room Types */}
            <div id="hotel-room-types" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4 bg-muted/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Room Types</h2>
                    <p className="font-body text-[13px] text-foreground font-semibold mt-0.5">
                      Choose from the rooms listed under this hotel
                    </p>
                  </div>
                  {/* Date Pickers */}
                  <div className="grid grid-cols-2 gap-2 sm:w-72">
                    <div>
                      <label className="font-body text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Check-in</label>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background font-body text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="font-body text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Check-out</label>
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background font-body text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {isRoomsLoading ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                    <BedDouble size={30} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-body text-[13px] text-muted-foreground">Loading room types…</p>
                  </div>
                ) : roomTypes.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                    <BedDouble size={30} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-body text-[13px] font-semibold text-foreground">No rooms listed yet</p>
                    <p className="font-body text-[12px] text-muted-foreground mt-1">No room types are listed for this hotel yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {roomTypes.map((rt) => {
                      const rtHotel = rt.hotel || hotel;
                      const availabilityText =
                        typeof rt.availableCount === 'number'
                          ? rt.availableCount > 0
                            ? `${rt.availableCount} available`
                            : 'Fully booked'
                          : Number(rt.totalCount || 0) > 0
                            ? `${rt.totalCount} rooms`
                            : undefined;
                      const enrichedRoom = { ...rt, hotel: rtHotel };
                      return (
                        <ListingCard
                          key={rt._id}
                          image={rt.images?.[0] || rtHotel?.image || '/placeholder.svg'}
                          images={rt.images?.length ? rt.images : rtHotel?.images}
                          name={rt.name}
                          location={rtHotel?.name || 'Hotel room'}
                          price={getTaxInclusivePrice(rt)}
                          priceLabel={rtHotel?.taxEnabled ? '/night incl. GST' : '/night'}
                          rating={0}
                          reviewCount={0}
                          amenities={rt.amenities || rtHotel?.amenities || []}
                          meta={availabilityText}
                          variant="compact"
                          ctaLabel="Book Room"
                          onViewDetails={() => {
                            prefetchDetail('roomTypes', rt._id, enrichedRoom);
                            navigate(roomDetailsUrl(rt._id));
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN (Sidebar) ── */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden sticky top-24">

              {/* Sidebar Header */}
              <div className="border-b border-border px-5 py-4 bg-muted/30">
                <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Hotel Details</h2>
              </div>

              {/* Details Table */}
              <div className="divide-y divide-border/60">
                <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <MapPin size={13} className="text-brand-crimson mt-0.5 shrink-0" />
                    <p className="font-body text-[12px] font-semibold text-muted-foreground">Location</p>
                  </div>
                  <p className="font-body text-[13px] font-medium text-foreground text-right">{hotel?.location || 'Vrindavan'}</p>
                </div>

                {typeof hotel?.checkInTime === 'string' && hotel.checkInTime && (
                  <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-2 shrink-0">
                      <Clock size={13} className="text-brand-gold mt-0.5 shrink-0" />
                      <p className="font-body text-[12px] font-semibold text-muted-foreground">Check-in</p>
                    </div>
                    <p className="font-body text-[13px] font-medium text-foreground text-right">{hotel.checkInTime}</p>
                  </div>
                )}

                {typeof hotel?.checkOutTime === 'string' && hotel.checkOutTime && (
                  <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-2 shrink-0">
                      <Clock size={13} className="text-muted-foreground/60 mt-0.5 shrink-0" />
                      <p className="font-body text-[12px] font-semibold text-muted-foreground">Check-out</p>
                    </div>
                    <p className="font-body text-[13px] font-medium text-foreground text-right">{hotel.checkOutTime}</p>
                  </div>
                )}

                {hotel?.nearestTemple && (
                  <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-2 shrink-0">
                      <Church size={13} className="text-brand-gold mt-0.5 shrink-0" />
                      <p className="font-body text-[12px] font-semibold text-muted-foreground">Nearest Landmark</p>
                    </div>
                    <p className="font-body text-[13px] font-medium text-foreground text-right">Near {hotel.nearestTemple}</p>
                  </div>
                )}

                {hotel?.petsAllowed && (
                  <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-2 shrink-0">
                      <PawPrint size={13} className="text-muted-foreground/60 mt-0.5 shrink-0" />
                      <p className="font-body text-[12px] font-semibold text-muted-foreground">Pets</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-body text-[11px] font-bold text-emerald-700">
                      Allowed
                    </span>
                  </div>
                )}
              </div>

              {/* Map */}
              {mapEmbedSrc && (
                <div className="px-5 pb-4 pt-3 border-t border-border">
                  <p className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Location Map</p>
                  <iframe
                    title={`${hotel?.name || 'Hotel'} map`}
                    src={mapEmbedSrc}
                    className="h-44 w-full rounded-xl border border-border"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}

              {/* CTA */}
              <div className="px-5 pb-5 pt-4 border-t border-border">
                <a
                  href="#hotel-room-types"
                  className="w-full inline-flex items-center justify-center gap-2 btn-gold px-4 py-3 rounded-xl text-[14px] font-semibold"
                >
                  <BedDouble size={16} />
                  View Hotel Rooms
                </a>
                <p className="mt-2.5 font-body text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <CalendarDays size={12} />
                  Book a specific room type from this hotel page.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HotelDetail;