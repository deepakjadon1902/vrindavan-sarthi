import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, CalendarDays, MapPin, ShieldCheck, Star, Clock, Church, PawPrint, Wifi, Check, IndianRupee, Users, MessageCircle, Phone } from 'lucide-react';
import ImageCarousel from '@/components/shared/ImageCarousel';
import SimpleBookingPanel from '@/components/shared/SimpleBookingPanel';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail, prefetchDetail } from '@/lib/detailCache';
import SEO from '@/components/SEO';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';
import { PropertyTermsPreview, hasPropertyTermsText, normalizePropertyTerms, type PropertyTermsValue } from '@/components/shared/PropertyTerms';
import { getGoogleMapEmbedSrc, getGoogleMapNavigationUrl } from '@/lib/maps';
import { getPropertyTypeLabel, isDharamshalaType, type StayPropertyType } from '@/lib/propertyTypes';
import { useSettingsStore } from '@/store/settingsStore';

type Hotel = {
  _id: string;
  name: string;
  propertyType?: StayPropertyType;
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
  gstMode?: 'manual' | 'automatic';
  showPrices?: boolean;
  propertyTerms?: PropertyTermsValue;
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

const sameId = (a?: string | null, b?: string | null) => String(a || '') === String(b || '');
const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getNextDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date();
  date.setDate(date.getDate() + 1);
  return getLocalDateKey(date);
};

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const supportPhone = useSettingsStore((s) => s.settings.adminPhone);

  const [hotel, setHotel] = useState<Hotel | null>(() => getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [checkIn, setCheckIn] = useState(() => getLocalDateKey());
  const [checkOut, setCheckOut] = useState(() => getNextDateKey(getLocalDateKey()));

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

  const updateCheckIn = (value: string) => {
    setCheckIn(value);
    if (value && (!checkOut || checkOut <= value)) setCheckOut(getNextDateKey(value));
  };

  const getTaxInclusivePrice = (rt: RoomType) => {
    const base = Number(rt.pricePerNight || 0);
    const rtHotel = rt.hotel || hotel;
    if (isDharamshalaType(rtHotel?.propertyType)) return undefined;
    if (!rtHotel?.taxEnabled) return base;
    const percent = rtHotel.gstMode === 'automatic'
      ? base <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(rtHotel.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const mapEmbedSrc = getGoogleMapEmbedSrc({
    mapValue: hotel?.googleMapLink,
    name: hotel?.name,
    location: hotel?.location,
    nearestTemple: hotel?.nearestTemple,
  });
  const mapNavigationUrl = getGoogleMapNavigationUrl({
    mapValue: hotel?.googleMapLink,
    name: hotel?.name,
    location: hotel?.location,
    nearestTemple: hotel?.nearestTemple,
  });
  const propertyTerms = normalizePropertyTerms(hotel?.propertyTerms);
  const showPropertyTerms = propertyTerms.isActive && hasPropertyTermsText(propertyTerms);
  const propertyLabel = getPropertyTypeLabel(hotel?.propertyType);
  const showPrices = hotel?.showPrices !== false;
  const isDharamshalaProperty = isDharamshalaType(hotel?.propertyType);
  const hasPublicRoomPrice = (rt: RoomType) =>
    showPrices && !isDharamshalaType((rt.hotel || hotel)?.propertyType) && Number(rt.pricePerNight || 0) > 0;
  const hasBookingWorkflow = (rt: RoomType) => showPrices || isDharamshalaType((rt.hotel || hotel)?.propertyType);
  const hasAnyPublicPricedRoom = roomTypes.some(hasPublicRoomPrice);
  const hasAnyBookingWorkflowRoom = roomTypes.some(hasBookingWorkflow);
  const supportDigits = supportPhone.replace(/\D/g, '');
  const whatsappMessage = `Radhe Radhe, I want to book ${hotel?.name || 'this property'}${hotel?.location ? ` in ${hotel.location}` : ''}. Please share availability and price.`;
  const hotelDescription = truncate(hotel?.description || `${hotel?.name || `Verified ${propertyLabel.toLowerCase()}`} in ${hotel?.location || 'Braj'} with room booking support from Vrindavan Sarthi.`);
  const hotelJsonLd = hotel ? {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${absoluteUrl(`/hotels/${hotel._id}`)}#hotel`,
    name: hotel.name,
    description: hotelDescription,
    url: absoluteUrl(`/hotels/${hotel._id}`),
    image: allImages.map(absoluteAssetUrl).filter(Boolean),
    address: {
      '@type': 'PostalAddress',
      streetAddress: hotel.location || hotel.nearestTemple || 'Braj',
      addressLocality: 'Braj',
      addressRegion: 'Uttar Pradesh',
      addressCountry: 'IN',
    },
    amenityFeature: (hotel.amenities || []).map((amenity) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
    checkinTime: hotel.checkInTime || '12:00',
    checkoutTime: hotel.checkOutTime || '11:00',
    petsAllowed: Boolean(hotel.petsAllowed),
    aggregateRating: hotel.rating
      ? {
        '@type': 'AggregateRating',
        ratingValue: Number(hotel.rating),
        reviewCount: Math.max(1, Number(hotel.reviewCount || 1)),
      }
      : undefined,
  } : undefined;

  if (!isLoading && !hotel) {
    return (
      <div className="pt-20 pb-8 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Hotel not found</p>
        <Link to="/hotels" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">
          Back to Hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="braj-page min-h-screen pt-4 pb-10">
      {hotel && (
        <SEO
          title={`${hotel.name} ${propertyLabel} in ${hotel.location || 'Braj'}`}
          description={hotelDescription}
          image={allImages[0]}
          canonicalPath={`/hotels/${hotel._id}`}
          jsonLd={hotelJsonLd}
        />
      )}
      <div className="container mx-auto max-w-6xl px-4">

        {/* ── Back Button ── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-[13px] font-medium text-muted-foreground hover:text-foreground mb-3 mt-0 transition-colors group"
        >
          <span className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center group-hover:border-brand-gold/40 transition-colors">
            <ArrowLeft size={14} />
          </span>
          Back to Hotels
        </button>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_385px]">

          {/* ── LEFT COLUMN ── */}
          <div className="min-w-0 space-y-5">

            {/* Image Carousel */}
            <div className="overflow-hidden rounded-[1.35rem] border border-border/80 bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
              <ImageCarousel
                images={allImages}
                alt={hotel?.name || 'Hotel'}
                heightClass="aspect-[4/3] min-h-[250px] sm:aspect-[16/10] sm:min-h-[330px] lg:aspect-[16/9] lg:min-h-[390px] lg:max-h-[430px]"
              />
            </div>

            {/* Hotel Name + Meta */}
            <div className="overflow-hidden rounded-[1.25rem] border border-border/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="p-4 sm:p-5">
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground md:text-[30px]">
                  {isLoading ? 'Loading...' : hotel?.name}
                </h1>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
                  <span className="flex items-center gap-1.5 font-body text-[13px] text-muted-foreground">
                    <MapPin size={14} className="text-brand-crimson shrink-0" />
                    {hotel?.location || 'Braj'}
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
                <div className="mt-3 flex flex-wrap gap-2">
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

            {/* Room Types */}
            <div id="hotel-room-types" className="overflow-hidden rounded-[1.25rem] border border-border/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="border-b border-border bg-muted/25 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Available rooms</h2>
                    <p className="mt-0.5 font-body text-[13px] font-semibold text-foreground">
                      Select dates, then choose a room type.
                    </p>
                  </div>
                  {/* Date Pickers */}
                  <div className="grid grid-cols-2 gap-2 sm:w-72">
                    <div>
                      <label className="font-body text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Check-in</label>
                      <input
                        type="date"
                        min={getLocalDateKey()}
                        value={checkIn}
                        onChange={(e) => updateCheckIn(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background font-body text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="font-body text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">Check-out</label>
                      <input
                        type="date"
                        min={checkIn ? getNextDateKey(checkIn) : getLocalDateKey()}
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
                    <p className="font-body text-[13px] text-muted-foreground">Loading rooms...</p>
                  </div>
                ) : roomTypes.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                    <BedDouble size={30} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-body text-[13px] font-semibold text-foreground">No rooms listed yet</p>
                    <p className="font-body text-[12px] text-muted-foreground mt-1">No room types are listed for this hotel yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {roomTypes.map((rt) => {
                      const rtHotel = rt.hotel || hotel;
                      const roomShowsPrice = hasPublicRoomPrice(rt);
                      const roomUsesBookingWorkflow = hasBookingWorkflow(rt);
                      const availabilityText =
                        typeof rt.availableCount === 'number'
                          ? rt.availableCount > 0
                            ? `${rt.availableCount} rooms available`
                            : 'Fully booked'
                          : Number(rt.totalCount || 0) > 0
                            ? `${rt.totalCount} rooms`
                            : undefined;
                      const enrichedRoom = { ...rt, hotel: rtHotel };
                      const image = rt.images?.[0] || rtHotel?.image || '/placeholder.svg';
                      const amenities = (rt.amenities || rtHotel?.amenities || []).slice(0, 6);
                      const isAvailable = typeof rt.availableCount === 'number' ? rt.availableCount > 0 : true;
                      return (
                        <article
                          key={rt._id}
                          className="group overflow-hidden rounded-[1.15rem] border border-border/80 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold/45 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!roomUsesBookingWorkflow && supportDigits) {
                                window.open(`https://wa.me/${supportDigits}?text=${encodeURIComponent(`${whatsappMessage} Room type: ${rt.name}.`)}`, '_blank', 'noopener,noreferrer');
                                return;
                              }
                              prefetchDetail('roomTypes', rt._id, enrichedRoom);
                              navigate(roomDetailsUrl(rt._id));
                            }}
                            className="block w-full text-left"
                          >
                            <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                              <img
                                src={image}
                                alt={rt.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4">
                                <h3 className="font-display text-xl font-bold text-white">{rt.name}</h3>
                              </div>
                              <span className={`absolute right-3 top-3 rounded-full border border-white/70 bg-white/95 px-3 py-1 font-body text-xs font-semibold shadow-sm ${isAvailable ? 'text-brand-green' : 'text-brand-crimson'}`}>
                                {availabilityText || 'Check dates'}
                              </span>
                            </div>
                            <div className="space-y-3 p-4">
                              <div className="flex items-end justify-between gap-3">
                                <div>
                                  <p className="font-body text-[11px] font-semibold text-brand-green">
                                    {roomShowsPrice
                                      ? checkIn ? `Showing prices for ${checkIn}` : 'Select dates for live availability'
                                      : 'Call or WhatsApp for current availability'}
                                  </p>
                                  {roomShowsPrice ? (
                                    <div className="mt-3 flex items-baseline gap-1 text-foreground">
                                      <IndianRupee size={18} className="text-brand-gold" />
                                      <span className="font-display text-3xl font-bold">{Number(getTaxInclusivePrice(rt) || 0).toLocaleString('en-IN')}</span>
                                      <span className="font-body text-sm text-muted-foreground">/night</span>
                                    </div>
                                  ) : (
                                    <div className="mt-3">
                                      <span className="font-display text-2xl font-bold text-foreground">
                                        {isDharamshalaType(rtHotel?.propertyType) ? 'Contribution after acceptance' : 'Price on request'}
                                      </span>
                                      {isDharamshalaType(rtHotel?.propertyType) && (
                                        <span className="mt-1 block font-body text-xs font-medium text-muted-foreground">
                                          Shown only after the partner accepts your booking request.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-full border border-border bg-muted/55 px-4 py-2 text-center font-body text-xs font-semibold text-foreground">
                                  {availabilityText || 'Rooms listed'}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 border-y border-border py-3 font-body text-sm text-foreground">
                                <div className="flex items-center gap-2">
                                  <Users size={15} className="text-muted-foreground" />
                                  {rt.maxAdults || 1} Adults
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users size={15} className="text-muted-foreground" />
                                  {rt.maxChildren || 0} Children
                                </div>
                              </div>

                              {amenities.length > 0 && (
                                <div>
                                  <p className="mb-2 font-body text-sm font-bold text-foreground">Includes</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {amenities.map((amenity) => (
                                      <span key={amenity} className="flex items-start gap-2 font-body text-xs leading-5 text-muted-foreground">
                                        <Check size={13} className="mt-0.5 shrink-0 text-brand-gold" />
                                        {amenity}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-3 py-2 font-body text-xs text-muted-foreground">
                                Policies shown before payment.
                              </div>

                              {roomUsesBookingWorkflow ? (
                                <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6f5529] px-4 py-3 font-body text-sm font-bold text-white transition-colors group-hover:bg-[#5f471f]">
                                  <Check size={16} />
                                  {isDharamshalaType(rtHotel?.propertyType) ? 'Request Booking' : 'Select Room'}
                                </span>
                              ) : (
                                <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6f5529] px-4 py-3 font-body text-sm font-bold text-white transition-colors group-hover:bg-[#5f471f]">
                                  <MessageCircle size={16} />
                                  Enquire Now
                                </span>
                              )}
                            </div>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            {hotel?.description && (
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-6 py-3.5 bg-muted/30">
                  <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">About this {propertyLabel}</h2>
                </div>
                <div className="px-5 py-4">
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
                <div className="px-5 py-4">
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

            {showPropertyTerms && (
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-6 py-3.5 bg-muted/30">
                  <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Property Terms & Booking Policies</h2>
                  <p className="mt-1 font-body text-[12px] text-muted-foreground">
                    Active version {propertyTerms.currentVersion}. These policies apply to rooms under this hotel.
                  </p>
                </div>
                <div className="px-5 py-4">
                  <PropertyTermsPreview terms={propertyTerms} />
                </div>
              </div>
            )}



          </div>

          {/* ── RIGHT COLUMN (Sidebar) ── */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-[1.25rem] border border-border/80 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)] lg:sticky lg:top-24">

              {/* Sidebar Header */}
              <div className="border-b border-border bg-muted/25 px-5 py-4">
                <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{propertyLabel} details</h2>
              </div>

              <div className="px-5 py-4">
                <SimpleBookingPanel service={isDharamshalaProperty ? 'dharamshala' : 'stay'} />
              </div>

              {/* Details Table */}
              <div className="divide-y divide-border/60">
                <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <MapPin size={13} className="text-brand-crimson mt-0.5 shrink-0" />
                    <p className="font-body text-[12px] font-semibold text-muted-foreground">Location</p>
                  </div>
                  <p className="font-body text-[13px] font-medium text-foreground text-right">{hotel?.location || 'Braj'}</p>
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
                    <p className="font-body text-[12px] font-semibold text-muted-foreground">Nearest landmark</p>
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
                  <p className="mb-2 font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location map</p>
                  <iframe
                    title={`${hotel?.name || 'Hotel'} map`}
                    src={mapEmbedSrc}
                    className="h-44 w-full rounded-xl border border-border"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                  {mapNavigationUrl && (
                    <a
                      href={mapNavigationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-body text-xs font-bold text-foreground hover:border-brand-gold/50"
                    >
                      <MapPin size={13} />
                      Open in Google Maps
                    </a>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="px-5 pb-5 pt-4 border-t border-border">
                {hasAnyBookingWorkflowRoom ? (
                  <a
                    href="#hotel-room-types"
                    className="w-full inline-flex items-center justify-center gap-2 btn-gold px-4 py-3 rounded-xl text-[14px] font-semibold"
                  >
                    <BedDouble size={16} />
                    View Rooms
                  </a>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href={`https://wa.me/${supportDigits}?text=${encodeURIComponent(whatsappMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 btn-gold px-4 py-3 rounded-xl text-[14px] font-semibold"
                    >
                      <MessageCircle size={16} />
                      WhatsApp Booking
                    </a>
                    <a
                      href={`tel:${supportDigits}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-[14px] font-semibold text-foreground hover:border-brand-gold/50"
                    >
                      <Phone size={16} />
                      Call Booking
                    </a>
                  </div>
                )}
                <p className="mt-2.5 font-body text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <CalendarDays size={12} />
                  {hasAnyBookingWorkflowRoom ? (isDharamshalaProperty ? 'Request first. Contact details appear after confirmation.' : 'Choose a room type to continue booking.') : 'Prices and availability are confirmed before booking.'}
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
