import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Hotel,
  MapPin,
  BedDouble,
  Building2,
  ShieldCheck,
  X,
  Compass,
  ArrowLeft,
  MapPinOff,
  Landmark,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import ListingCard from '@/components/shared/ListingCard';
import LocationDiscoverySection from '@/components/discovery/LocationDiscoverySection';
import { useUserGeolocation } from '@/hooks/useUserGeolocation';
import {
  groupItemsIntoLocationSections,
  resolveItemCoordinates,
  calculateHaversineDistanceKm,
  formatDistanceKm,
  findLandmark,
  resolveItemLandmark,
  BRAJ_LANDMARK_REGISTRY,
} from '@/lib/geoDiscovery';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { getPropertyTypeLabel, isDharamshalaType, type StayPropertyType } from '@/lib/propertyTypes';

export type HotelListItem = {
  _id: string;
  name: string;
  propertyType?: StayPropertyType;
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
  gstMode?: 'manual' | 'automatic';
  showPrices?: boolean;
  googleMapLink?: string;
  latitude?: number;
  longitude?: number;
};

export const getHotelStartingPrice = (hotel: HotelListItem) => {
  if (hotel.showPrices === false) return undefined;
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
  if (isDharamshalaType(hotel.propertyType)) return undefined;
  if (!hotel.taxEnabled) return base;
  const percent = hotel.gstMode === 'automatic'
    ? base <= 7500 ? 5 : 18
    : Math.min(50, Math.max(0, Number(hotel.taxPercent ?? 12)));
  return Math.round(base + (base * percent) / 100);
};

const categoryTabs: { label: string; type: StayPropertyType | '' }[] = [
  { label: 'All Stays', type: '' },
  { label: 'Dharamshalas', type: 'dharamshala' },
  { label: 'Hotels', type: 'hotel' },
  { label: 'Home Stays', type: 'home_stay' },
  { label: 'Guest Houses', type: 'guest_house' },
];

const Hotels = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedLandmark, setSelectedLandmark] = useState(() => searchParams.get('landmark') || '');
  const [sortBy, setSortBy] = useState<'recommended' | 'rating' | 'price_asc'>('recommended');
  const typeParam = searchParams.get('type');
  const propertyFilter: StayPropertyType | '' =
    typeParam === 'dharamshala' || typeParam === 'hotel' || typeParam === 'home_stay' || typeParam === 'guest_house'
      ? typeParam
      : '';
  const [hotels, setHotels] = useState<HotelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Browser Geolocation
  const { coords, status: geoStatus, requestLocation, clearLocation, errorMessage: geoError } =
    useUserGeolocation();

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setSelectedLandmark(searchParams.get('landmark') || '');
  }, [searchParams]);

  useEffect(() => {
    if (geoError) toast.info(geoError);
  }, [geoError]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const q = searchQuery.trim();
      if (!q) {
        try {
          const cached = localStorage.getItem('vvs_hotels');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHotels(parsed);
              setIsLoading(false);
            }
          }
        } catch {
          // ignore
        }
      }
      try {
        const res = await api.get('/hotels', q ? { params: { q } } : undefined);
        const data = Array.isArray(res.data?.data) ? (res.data.data as HotelListItem[]) : [];
        setHotels(data);
        setIsLoading(false);
        if (!q) {
          try {
            localStorage.setItem('vvs_hotels', JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      } catch {
        setHotels([]);
        setIsLoading(false);
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

  const getListingDistance = (hotel: HotelListItem): string | undefined => {
    if (!coords) return undefined;
    const itemCoords = resolveItemCoordinates(hotel);
    if (!itemCoords) return undefined;
    const dist = calculateHaversineDistanceKm(
      coords.latitude,
      coords.longitude,
      itemCoords.latitude,
      itemCoords.longitude
    );
    return formatDistanceKm(dist);
  };

  const activeLandmarkObj = useMemo(() => {
    if (!selectedLandmark || selectedLandmark === 'near_me') return null;
    return findLandmark(selectedLandmark);
  }, [selectedLandmark]);

  const filtered = useMemo(() => {
    return hotels
      .filter((h) => {
        // 1. Property Type filter
        if (propertyFilter && String(h.propertyType || 'hotel') !== propertyFilter) return false;

        // 2. Text Search Query filter
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const matchName = h.name.toLowerCase().includes(q);
          const matchLoc = h.location.toLowerCase().includes(q);
          const matchTemple = String(h.nearestTemple || '').toLowerCase().includes(q);
          if (!matchName && !matchLoc && !matchTemple) return false;
        }

        // 3. Landmark Filter
        if (selectedLandmark) {
          if (selectedLandmark === 'near_me') {
            return true;
          }
          if (activeLandmarkObj) {
            const lm = resolveItemLandmark(h);
            return lm?.id === activeLandmarkObj.id;
          }
          const lmNormalized = selectedLandmark.toLowerCase().replace(/_/g, ' ');
          const temple = String(h.nearestTemple || '').toLowerCase();
          const location = String(h.location || '').toLowerCase();
          const hotelName = String(h.name || '').toLowerCase();
          return temple.includes(lmNormalized) || location.includes(lmNormalized) || hotelName.includes(lmNormalized);
        }

        return true;
      })
      .sort((a, b) => {
        if (selectedLandmark === 'near_me' && coords) {
          const coordsA = resolveItemCoordinates(a);
          const coordsB = resolveItemCoordinates(b);
          const distA = coordsA ? calculateHaversineDistanceKm(coords.latitude, coords.longitude, coordsA.latitude, coordsA.longitude) : 9999;
          const distB = coordsB ? calculateHaversineDistanceKm(coords.latitude, coords.longitude, coordsB.latitude, coordsB.longitude) : 9999;
          return distA - distB;
        }
        if (sortBy === 'rating') {
          return Number(b.rating || 0) - Number(a.rating || 0);
        }
        if (sortBy === 'price_asc') {
          const priceA = getHotelStartingPrice(a) || 999999;
          const priceB = getHotelStartingPrice(b) || 999999;
          return priceA - priceB;
        }
        return 0;
      });
  }, [hotels, propertyFilter, searchQuery, selectedLandmark, activeLandmarkObj, sortBy, coords]);

  // Group into location discovery sections for multi-section view
  const discoverySections = useMemo(() => {
    // When in multi-section view, use hotels filtered by propertyFilter
    let base = hotels;
    if (propertyFilter) {
      base = base.filter((h) => String(h.propertyType || 'hotel') === propertyFilter);
    }
    return groupItemsIntoLocationSections(base, coords, '/hotels');
  }, [hotels, propertyFilter, coords]);

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
        toast.error('This stay is no longer available. The list has been refreshed.');
        return;
      }
      navigate(`/hotels/${hotel._id}`);
    }
  };

  const handleCategorySelect = (type: StayPropertyType | '') => {
    const next = new URLSearchParams(searchParams);
    if (type) next.set('type', type);
    else next.delete('type');
    const qs = next.toString();
    navigate(qs ? `/hotels?${qs}` : '/hotels', { replace: true });
  };

  const handleLandmarkSelect = (lm: string) => {
    setSelectedLandmark(lm);
    const next = new URLSearchParams(searchParams);
    if (lm) next.set('landmark', lm);
    else next.delete('landmark');
    const qs = next.toString();
    navigate(qs ? `/hotels?${qs}` : '/hotels', { replace: true });
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedLandmark('');
    clearLocation();
    navigate('/hotels');
  };

  // Determine current presentation mode
  const isDedicatedLandmarkView = Boolean(selectedLandmark);
  const isTextSearchView = Boolean(searchQuery && !selectedLandmark);
  const isMultiSectionView = !selectedLandmark && !searchQuery;

  // Responsive page heading and subtitle
  const { pageHeading, pageSubtitle } = useMemo(() => {
    const typeLabel = propertyFilter ? categoryTabs.find((t) => t.type === propertyFilter)?.label || 'Stays' : 'Stays';
    if (selectedLandmark === 'near_me') {
      return {
        pageHeading: `${typeLabel} Near Your Location`,
        pageSubtitle: coords
          ? `Showing verified ${typeLabel.toLowerCase()} ranked by genuine GPS proximity to you`
          : `Enable device location to see ${typeLabel.toLowerCase()} ordered by authentic distance`,
      };
    }
    if (activeLandmarkObj) {
      return {
        pageHeading: `${typeLabel} Near ${activeLandmarkObj.name}`,
        pageSubtitle: `Showing all ${filtered.length} verified accommodations in ${activeLandmarkObj.subtitle}`,
      };
    }
    if (selectedLandmark) {
      return {
        pageHeading: `${typeLabel} Near ${selectedLandmark.replace(/_/g, ' ')}`,
        pageSubtitle: `Showing all ${filtered.length} matching verified accommodations across Braj`,
      };
    }
    if (searchQuery) {
      return {
        pageHeading: `Search Results for "${searchQuery}"`,
        pageSubtitle: `Showing ${filtered.length} matching verified ${typeLabel.toLowerCase()}`,
      };
    }
    return {
      pageHeading: `${propertyFilter ? categoryTabs.find((t) => t.type === propertyFilter)?.label || 'Stays' : 'Stays'} Across Vrindavan & Braj`,
      pageSubtitle: 'Explore inspected dharamshalas, hotel rooms, and ashram accommodations grouped by sacred temple proximity',
    };
  }, [selectedLandmark, activeLandmarkObj, propertyFilter, searchQuery, filtered.length, coords]);

  return (
    <div className="min-h-screen bg-[#fdfcf9] pt-16 sm:pt-20 pb-16 text-slate-800 overflow-x-clip w-full max-w-[100vw]">
      {/* ===== AIRBNB-INSPIRED FILTER & SEARCH BAR ===== */}
      <section className="border-b border-neutral-200/80 bg-white sticky top-16 sm:top-20 z-30 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-md overflow-x-clip max-w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
          {/* Row 1: Category Filter Tabs & Compact Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Category Filter Tabs: Compact Single-Line Horizontal Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none w-full lg:w-auto">
              {categoryTabs.map((tab) => {
                const active = propertyFilter === tab.type;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => handleCategorySelect(tab.type)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-body text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-neutral-100/70'
                    }`}
                  >
                    {tab.type === 'dharamshala' ? (
                      <BedDouble size={13} className={active ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} />
                    ) : (
                      <Building2 size={13} className={active ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} />
                    )}
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Compact Search & Sort Row */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-72">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by hotel, area, temple..."
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    const next = new URLSearchParams(searchParams);
                    if (value.trim()) next.set('q', value);
                    else next.delete('q');
                    setSearchParams(next, { replace: true });
                  }}
                  className="w-full rounded-full border border-neutral-300 bg-slate-50/80 pl-9 pr-8 py-1.5 font-body text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      const next = new URLSearchParams(searchParams);
                      next.delete('q');
                      setSearchParams(next, { replace: true });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sorting */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-full border border-neutral-300 bg-slate-50/80 pl-3 pr-8 py-1.5 font-body text-xs font-semibold text-slate-700 outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
                >
                  <option value="recommended">Recommended</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price_asc">Price: Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Landmark & GPS Quick Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 border-t border-neutral-100 w-full max-w-full">
            {/* GPS "Near Me" Action Button */}
            {geoStatus === 'granted' ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 font-body text-xs font-bold shrink-0 shadow-xs">
                <Check size={13} className="text-emerald-700 shrink-0" />
                <span className="whitespace-nowrap">Near Your Location</span>
                <button
                  type="button"
                  onClick={() => {
                    clearLocation();
                    if (selectedLandmark === 'near_me') handleLandmarkSelect('');
                  }}
                  className="ml-0.5 rounded-full p-0.5 text-emerald-700 hover:bg-emerald-200"
                  aria-label="Clear location filter"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  requestLocation();
                  handleLandmarkSelect('near_me');
                }}
                disabled={geoStatus === 'requesting'}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-bold shrink-0 transition-all ${
                  geoStatus === 'requesting'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : 'bg-white text-slate-800 border border-neutral-300 hover:border-amber-700 hover:bg-amber-50/50 shadow-xs'
                }`}
              >
                <Compass
                  size={13}
                  className={geoStatus === 'requesting' ? 'animate-spin text-amber-700 shrink-0' : 'text-amber-700 shrink-0'}
                />
                <span className="whitespace-nowrap">{geoStatus === 'requesting' ? 'Locating...' : 'Near Me (GPS)'}</span>
              </button>
            )}

            <div className="h-4 w-px bg-neutral-200 shrink-0 mx-0.5" />

            {/* All Braj Pill */}
            <button
              type="button"
              onClick={() => handleLandmarkSelect('')}
              className={`rounded-full px-3 py-1 font-body text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                !selectedLandmark
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-neutral-100/80 text-slate-700 hover:bg-neutral-200/70'
              }`}
            >
              All Braj Dham
            </button>

            {/* Primary Braj Landmark Quick Chips */}
            {BRAJ_LANDMARK_REGISTRY.map((landmark) => {
              const isSelected =
                selectedLandmark.toLowerCase() === landmark.id.toLowerCase() ||
                selectedLandmark.toLowerCase() === landmark.name.toLowerCase();
              return (
                <button
                  key={landmark.id}
                  type="button"
                  onClick={() => handleLandmarkSelect(isSelected ? '' : landmark.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-body text-xs whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-amber-800 text-white font-bold shadow-xs'
                      : 'bg-neutral-100/80 text-slate-700 hover:bg-neutral-200/70 font-medium'
                  }`}
                >
                  <MapPin size={11} className={isSelected ? 'text-amber-200 shrink-0' : 'text-slate-400 shrink-0'} />
                  <span className="whitespace-nowrap">{landmark.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== LISTINGS CONTENT SECTION ===== */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Breadcrumb / Back button when dedicated landmark or search view is active */}
        {(isDedicatedLandmarkView || isTextSearchView) && (
          <nav aria-label="Breadcrumb" className="mb-3 scroll-mt-36">
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="group inline-flex items-center gap-1.5 font-body text-xs font-bold text-amber-900 hover:text-amber-700 transition-colors py-1"
            >
              <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>Back to all Braj discovery sections</span>
            </button>
          </nav>
        )}

        {/* Results Header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {pageHeading}
            </h1>
            <p className="font-body text-xs sm:text-[13px] font-medium text-slate-500 mt-0.5">
              {pageSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck size={14} className="text-emerald-600" />
              100% Inspected Stays
            </span>
          </div>
        </div>

        {/* Listings Display */}
        {isLoading && hotels.length === 0 ? (
          <div className="space-y-8">
            {[1, 2].map((n) => (
              <div key={n} className="space-y-3">
                <div className="h-6 w-48 rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex gap-4 overflow-hidden">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-[260px] sm:w-[280px] shrink-0 animate-pulse rounded-2xl bg-white p-3 space-y-3 border border-neutral-200/60"
                    >
                      <div className="aspect-[4/3] w-full rounded-xl bg-neutral-200" />
                      <div className="h-4 w-3/4 rounded bg-neutral-200" />
                      <div className="h-3 w-1/2 rounded bg-neutral-200" />
                      <div className="h-4 w-1/3 rounded bg-neutral-200" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Dedicated Useful Empty State (No Silent Fallback) */
          isDedicatedLandmarkView ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm my-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-4">
                <MapPinOff size={28} />
              </div>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-slate-900">
                No accommodations currently listed near{' '}
                {activeLandmarkObj?.name || selectedLandmark.replace(/_/g, ' ')}
              </h3>
              <p className="font-body text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                We are actively inspecting and onboarding verified dharamshalas, ashram stays, and hotels in this sacred area. All listings undergo strict hygiene and safety verification.
              </p>

              <div className="mt-6 pt-5 border-t border-neutral-100">
                <p className="font-body text-xs font-semibold text-slate-700 mb-3">
                  Explore verified accommodations in nearby Braj locations:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLandmarkSelect('prem_mandir')}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:border-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    Near Prem Mandir (5 stays)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLandmarkSelect('iskcon')}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:border-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    Near ISKCON Temple (1 stay)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLandmarkSelect('mathura_junction')}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:border-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    Near Mathura Junction (6 stays)
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="rounded-full bg-slate-900 px-5 py-2 font-body text-xs font-bold text-white hover:bg-slate-800 shadow-sm transition-colors"
                >
                  View All Braj Discovery Sections
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center max-w-lg mx-auto shadow-sm my-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 mb-4">
                <Search size={28} />
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900">No properties found</h3>
              <p className="font-body text-sm text-slate-500 mt-1">
                We couldn't find any stays matching "{searchQuery}". Try selecting another Braj area or clearing your filter.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="rounded-full bg-slate-900 px-5 py-2 font-body text-xs font-bold text-white hover:bg-slate-800"
                >
                  Clear all filters
                </button>
                <button
                  type="button"
                  onClick={() => handleLandmarkSelect('prem_mandir')}
                  className="rounded-full border border-neutral-300 px-4 py-2 font-body text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  Near Prem Mandir
                </button>
                <button
                  type="button"
                  onClick={() => handleLandmarkSelect('mathura_junction')}
                  className="rounded-full border border-neutral-300 px-4 py-2 font-body text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  Near Mathura Junction
                </button>
              </div>
            </div>
          )
        ) : isMultiSectionView ? (
          /* Multi-Section Location-Wise Discovery View (Default Airbnb-Grade Experience) */
          <div className="divide-y divide-neutral-200/70">
            {discoverySections.map((section) => (
              <LocationDiscoverySection
                key={section.id}
                id={section.id}
                heading={section.heading}
                subtitle={section.subtitle}
                distanceLabel={section.distanceLabel}
                viewAllUrl={section.filterUrl}
                viewAllCount={section.items.length}
                items={section.items}
                renderItem={(hotel) => (
                  <ListingCard
                    key={hotel._id}
                    variant="hotel"
                    image={hotel.image}
                    images={hotel.images}
                    name={hotel.name}
                    badge={getPropertyTypeLabel(hotel.propertyType)}
                    location={hotel.location}
                    distance={getListingDistance(hotel)}
                    price={getHotelStartingPrice(hotel)}
                    priceLabel={
                      isDharamshalaType(hotel.propertyType)
                        ? ''
                        : hotel.taxEnabled
                        ? '/night incl. GST'
                        : '/night'
                    }
                    pricePlaceholder={
                      isDharamshalaType(hotel.propertyType)
                        ? 'Contribution on confirmation'
                        : undefined
                    }
                    priceHelp={
                      isDharamshalaType(hotel.propertyType)
                        ? 'Confirmed upon request'
                        : undefined
                    }
                    rating={Number(hotel.rating || 0)}
                    reviewCount={Number(hotel.reviewCount || 0)}
                    amenities={hotel.amenities || []}
                    onViewDetails={() => void openHotel(hotel)}
                  />
                )}
              />
            ))}
          </div>
        ) : (
          /* Dedicated Filtered Grid View (For Dedicated Landmark View or Direct Search) */
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="font-body text-xs font-semibold text-slate-500">
                Showing {filtered.length} {filtered.length === 1 ? 'property' : 'properties'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
              {filtered.map((hotel) => (
                <ListingCard
                  key={hotel._id}
                  variant="hotel"
                  image={hotel.image}
                  images={hotel.images}
                  name={hotel.name}
                  badge={getPropertyTypeLabel(hotel.propertyType)}
                  location={hotel.location}
                  distance={getListingDistance(hotel)}
                  price={getHotelStartingPrice(hotel)}
                  priceLabel={
                    isDharamshalaType(hotel.propertyType)
                      ? ''
                      : hotel.taxEnabled
                      ? '/night incl. GST'
                      : '/night'
                  }
                  pricePlaceholder={
                    isDharamshalaType(hotel.propertyType)
                      ? 'Contribution on confirmation'
                      : undefined
                  }
                  priceHelp={
                    isDharamshalaType(hotel.propertyType)
                      ? 'Confirmed upon request'
                      : undefined
                  }
                  rating={Number(hotel.rating || 0)}
                  reviewCount={Number(hotel.reviewCount || 0)}
                  amenities={hotel.amenities || []}
                  onViewDetails={() => void openHotel(hotel)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Hotels;
