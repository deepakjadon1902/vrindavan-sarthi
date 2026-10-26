import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  BedDouble,
  ShieldCheck,
  X,
  LayoutGrid,
  Rows3,
  ArrowLeft,
  Compass,
  MapPinOff,
} from 'lucide-react';
import { toast } from 'sonner';
import ListingCard from '@/components/shared/ListingCard';
import LocationDiscoverySection from '@/components/discovery/LocationDiscoverySection';
import DiscoveryLocationBar from '@/components/discovery/DiscoveryLocationBar';
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
import { getPropertyTypeLabel, isDharamshalaType } from '@/lib/propertyTypes';

const Rooms = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedLandmark, setSelectedLandmark] = useState(() => searchParams.get('landmark') || '');
  const [acFilter, setAcFilter] = useState<'all' | 'ac' | 'non_ac'>(() => {
    const ac = searchParams.get('ac');
    return ac === 'ac' || ac === 'non_ac' ? ac : 'all';
  });
  const [viewMode, setViewMode] = useState<'sections' | 'grid'>('sections');
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Browser Geolocation
  const { coords, status: geoStatus, requestLocation, clearLocation, errorMessage: geoError } =
    useUserGeolocation();

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setSelectedLandmark(searchParams.get('landmark') || '');
    const ac = searchParams.get('ac');
    setAcFilter(ac === 'ac' || ac === 'non_ac' ? ac : 'all');
  }, [searchParams]);

  useEffect(() => {
    if (geoError) {
      toast.info(geoError);
    }
  }, [geoError]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const q = searchQuery.trim();
      if (!q) {
        try {
          const cached = localStorage.getItem('vvs_room_types');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setRoomTypes(parsed);
              setIsLoading(false);
            }
          }
        } catch {
          // ignore
        }
      }

      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await api.get('/room-types', q ? { params: { q } } : undefined);
          const data = Array.isArray(res.data?.data) ? res.data.data : [];
          setRoomTypes(data);
          setIsLoading(false);
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
      setIsLoading(false);
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

  // Tax inclusive pricing formula
  const getTaxInclusivePrice = (rt: any) => {
    const base = Number(rt?.pricePerNight || 0);
    const hotel = rt?.hotel || {};
    if (hotel?.showPrices === false) return undefined;
    if (isDharamshalaType(hotel?.propertyType)) return undefined;
    if (!hotel?.taxEnabled) return base;
    const percent =
      hotel?.gstMode === 'automatic'
        ? base <= 7500
          ? 5
          : 18
        : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  // Distance computation from user GPS coords
  const getListingDistance = (rt: any): string | undefined => {
    if (!coords) return undefined;
    const itemCoords = resolveItemCoordinates(rt);
    if (!itemCoords) return undefined;
    const dist = calculateHaversineDistanceKm(
      coords.latitude,
      coords.longitude,
      itemCoords.latitude,
      itemCoords.longitude
    );
    return formatDistanceKm(dist);
  };

  // Resolve active landmark object from registry
  const activeLandmarkObj = useMemo(() => {
    if (!selectedLandmark || selectedLandmark === 'near_me') return null;
    return findLandmark(selectedLandmark);
  }, [selectedLandmark]);

  // Filtered room types based on search, landmark, and AC comfort
  const filtered = useMemo(() => {
    let result = roomTypes;

    // 1. Filter by text search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((rt: any) => {
        const name = String(rt?.name || '').toLowerCase();
        const hotelName = String(rt?.hotel?.name || '').toLowerCase();
        const location = String(rt?.hotel?.location || '').toLowerCase();
        const temple = String(rt?.hotel?.nearestTemple || '').toLowerCase();
        return (
          name.includes(q) ||
          hotelName.includes(q) ||
          location.includes(q) ||
          temple.includes(q)
        );
      });
    }

    // 2. Filter by landmark
    if (selectedLandmark) {
      if (selectedLandmark === 'near_me') {
        if (coords) {
          result = result
            .map((rt: any) => {
              const itemCoords = resolveItemCoordinates(rt);
              const dist = itemCoords
                ? calculateHaversineDistanceKm(
                    coords.latitude,
                    coords.longitude,
                    itemCoords.latitude,
                    itemCoords.longitude
                  )
                : 9999;
              return { rt, dist };
            })
            .sort((a, b) => a.dist - b.dist)
            .map((entry) => entry.rt);
        }
      } else if (activeLandmarkObj) {
        result = result.filter((rt: any) => {
          const lm = resolveItemLandmark(rt);
          return lm?.id === activeLandmarkObj.id;
        });
      } else {
        const lmNormalized = selectedLandmark.toLowerCase().replace(/_/g, ' ');
        result = result.filter((rt: any) => {
          const temple = String(rt?.hotel?.nearestTemple || '').toLowerCase();
          const location = String(rt?.hotel?.location || '').toLowerCase();
          const hotelName = String(rt?.hotel?.name || '').toLowerCase();
          return (
            temple.includes(lmNormalized) ||
            location.includes(lmNormalized) ||
            hotelName.includes(lmNormalized)
          );
        });
      }
    }

    // 3. Filter by AC / Non-AC comfort
    if (acFilter === 'ac') {
      result = result.filter((rt: any) => {
        const name = String(rt?.name || '').toLowerCase();
        const amenities = (rt?.amenities || []).map((a: string) => String(a).toLowerCase());
        return name.includes('ac') || amenities.includes('ac');
      });
    } else if (acFilter === 'non_ac') {
      result = result.filter((rt: any) => {
        const name = String(rt?.name || '').toLowerCase();
        return name.includes('non') || !name.includes('ac');
      });
    }

    return result;
  }, [roomTypes, searchQuery, selectedLandmark, activeLandmarkObj, acFilter, coords]);

  // Group items into location discovery sections (for multi-section view)
  const discoverySections = useMemo(() => {
    // In multi-section view, group unfiltered roomTypes (or comfort-filtered if applied)
    let base = roomTypes;
    if (acFilter === 'ac') {
      base = base.filter((rt: any) => {
        const name = String(rt?.name || '').toLowerCase();
        const amenities = (rt?.amenities || []).map((a: string) => String(a).toLowerCase());
        return name.includes('ac') || amenities.includes('ac');
      });
    } else if (acFilter === 'non_ac') {
      base = base.filter((rt: any) => {
        const name = String(rt?.name || '').toLowerCase();
        return name.includes('non') || !name.includes('ac');
      });
    }
    return groupItemsIntoLocationSections(base, coords, '/rooms');
  }, [roomTypes, coords, acFilter]);

  const handleLandmarkSelect = (lm: string) => {
    setSelectedLandmark(lm);
    const newParams = new URLSearchParams(searchParams);
    if (lm) {
      newParams.set('landmark', lm);
    } else {
      newParams.delete('landmark');
    }
    const qs = newParams.toString();
    navigate(qs ? `/rooms?${qs}` : '/rooms', { replace: true });
  };

  const handleAcFilterSelect = (val: 'all' | 'ac' | 'non_ac') => {
    setAcFilter(val);
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'all') {
      newParams.set('ac', val);
    } else {
      newParams.delete('ac');
    }
    const qs = newParams.toString();
    navigate(qs ? `/rooms?${qs}` : '/rooms', { replace: true });
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedLandmark('');
    setAcFilter('all');
    clearLocation();
    navigate('/rooms');
  };

  // Determine current presentation mode
  const isDedicatedLandmarkView = Boolean(selectedLandmark);
  const isTextSearchView = Boolean(searchQuery && !selectedLandmark);
  const isMultiSectionView = !selectedLandmark && !searchQuery && viewMode === 'sections';

  // Compute responsive headings reflecting current location / filter state
  const { pageHeading, pageSubtitle } = useMemo(() => {
    if (selectedLandmark === 'near_me') {
      return {
        pageHeading: 'Rooms Near Your Location',
        pageSubtitle: coords
          ? `Showing verified accommodations ranked by genuine GPS proximity to you`
          : 'Enable device location to see rooms ordered by authentic distance from your current position',
      };
    }
    if (activeLandmarkObj) {
      return {
        pageHeading: `Rooms Near ${activeLandmarkObj.name}`,
        pageSubtitle: `Showing all ${filtered.length} verified accommodations in ${activeLandmarkObj.subtitle}`,
      };
    }
    if (selectedLandmark) {
      const formatted = selectedLandmark.replace(/_/g, ' ');
      return {
        pageHeading: `Rooms Near ${formatted}`,
        pageSubtitle: `Showing all ${filtered.length} matching room options across Braj Dham`,
      };
    }
    if (searchQuery) {
      return {
        pageHeading: `Search Results for "${searchQuery}"`,
        pageSubtitle: `Showing ${filtered.length} matching verified Braj room options`,
      };
    }
    return {
      pageHeading: 'Rooms & Accommodations Across Braj',
      pageSubtitle:
        'Explore inspected hotels, dharamshalas & ashram stays grouped by sacred temple proximity',
    };
  }, [selectedLandmark, activeLandmarkObj, searchQuery, filtered.length, coords]);

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16 sm:pt-20 pb-20 text-slate-900 overflow-x-clip w-full max-w-[100vw]">
      {/* Sticky Compact Header & Controls Bar */}
      <section className="sticky top-16 sm:top-20 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_10px_rgba(15,23,42,0.03)] overflow-x-clip max-w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
          {/* Top Search Input & Action Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search stays near Prem Mandir, ISKCON, Mathura..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  const p = new URLSearchParams(searchParams);
                  if (value.trim()) p.set('q', value);
                  else p.delete('q');
                  setSearchParams(p, { replace: true });
                }}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 pl-10 pr-9 py-2 font-body text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    const p = new URLSearchParams(searchParams);
                    p.delete('q');
                    setSearchParams(p, { replace: true });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right Controls: Verified Badge & View Mode Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Verified Braj Stays</span>
              </span>

              {/* View Mode Toggle (Only visible in default discovery view) */}
              {!isDedicatedLandmarkView && !isTextSearchView && (
                <div className="flex items-center rounded-full border border-neutral-200 bg-neutral-100 p-0.5 text-slate-600">
                  <button
                    type="button"
                    onClick={() => setViewMode('sections')}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                      viewMode === 'sections'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                    aria-label="Location Sections View"
                  >
                    <Rows3 size={13} />
                    <span className="hidden xs:inline">Sections</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                    aria-label="Grid View"
                  >
                    <LayoutGrid size={13} />
                    <span className="hidden xs:inline">Grid</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Location Bar with GPS and Landmark Quick Chips */}
          <DiscoveryLocationBar
            geoStatus={geoStatus}
            onRequestLocation={() => {
              requestLocation();
              handleLandmarkSelect('near_me');
            }}
            onClearLocation={() => {
              clearLocation();
              if (selectedLandmark === 'near_me') {
                handleLandmarkSelect('');
              }
            }}
            selectedLandmark={selectedLandmark}
            onSelectLandmark={handleLandmarkSelect}
            acFilter={acFilter}
            onSelectAcFilter={handleAcFilterSelect}
            totalResultsCount={filtered.length}
          />
        </div>
      </section>

      {/* Main Discoverable Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7">
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

        {/* Compact Page Title Strip */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {pageHeading}
            </h1>
            <p className="font-body text-xs sm:text-[13px] font-medium text-slate-500 mt-0.5">
              {pageSubtitle}
            </p>
          </div>
          {(searchQuery || selectedLandmark || acFilter !== 'all' || coords) && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="self-start sm:self-auto font-body text-xs font-bold text-amber-900 hover:text-amber-700 underline underline-offset-2"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Dynamic Content Views */}
        {isLoading && roomTypes.length === 0 ? (
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
        ) : isDedicatedLandmarkView && selectedLandmark === 'near_me' && !coords ? (
          /* GPS Location Prompt Card (when user clicked Near Me but has not granted GPS) */
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm my-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-4">
              <Compass size={28} className="text-amber-700" />
            </div>
            <h3 className="font-heading text-lg sm:text-xl font-bold text-slate-900">
              Device Location Access Required
            </h3>
            <p className="font-body text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              To rank accommodations by genuine distance from your current position, please allow browser location access. We never store or track your location.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={requestLocation}
                disabled={geoStatus === 'requesting'}
                className="inline-flex items-center gap-2 rounded-full bg-amber-800 px-5 py-2 font-body text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Compass size={14} className={geoStatus === 'requesting' ? 'animate-spin' : ''} />
                <span>{geoStatus === 'requesting' ? 'Locating...' : 'Enable Location Access'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="rounded-full border border-neutral-300 bg-white px-5 py-2 font-body text-xs font-bold text-slate-800 hover:bg-neutral-50 transition-colors"
              >
                Explore Temple Stays
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Useful Empty State (Never falls back silently to unfiltered rooms) */
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
                    Near Prem Mandir (10 stays)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLandmarkSelect('iskcon')}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:border-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    Near ISKCON Temple (2 stays)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLandmarkSelect('mathura_junction')}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:border-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    Near Mathura Junction (10 stays)
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
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center max-w-md mx-auto shadow-sm my-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-3.5">
                <BedDouble size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                No matching room options found
              </h3>
              <p className="font-body text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                We couldn't find available rooms matching your current filter criteria.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-4 rounded-full bg-slate-900 px-5 py-2 font-body text-xs font-bold text-white hover:bg-slate-800 shadow-sm"
              >
                Show all Braj rooms
              </button>
            </div>
          )
        ) : isMultiSectionView ? (
          /* Location-Wise Discovery Sections (Default Airbnb-Inspired Discovery View) */
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
                renderItem={(rt) => (
                  <ListingCard
                    key={rt._id}
                    image={rt?.images?.[0] || rt?.hotel?.image}
                    images={rt?.images?.length ? rt.images : rt?.hotel?.images}
                    name={rt.name}
                    location={
                      rt?.hotel?.name
                        ? `${rt.hotel.name} · ${rt?.hotel?.location || ''}`
                        : rt?.hotel?.location || 'Braj Stay'
                    }
                    distance={getListingDistance(rt)}
                    price={getTaxInclusivePrice(rt)}
                    priceLabel={
                      isDharamshalaType(rt?.hotel?.propertyType)
                        ? ''
                        : rt?.hotel?.taxEnabled
                        ? '/night incl. GST'
                        : '/night'
                    }
                    pricePlaceholder={
                      isDharamshalaType(rt?.hotel?.propertyType)
                        ? 'Contribution on confirmation'
                        : undefined
                    }
                    priceHelp={
                      isDharamshalaType(rt?.hotel?.propertyType)
                        ? 'Confirmed upon request'
                        : undefined
                    }
                    rating={Number(rt?.hotel?.rating || 0)}
                    reviewCount={Number(rt?.hotel?.reviewCount || 0)}
                    amenities={rt?.amenities || rt?.hotel?.amenities || []}
                    meta={Number(rt?.totalCount || 0) > 0 ? `${rt.totalCount} rooms` : undefined}
                    variant="room"
                    badge={getPropertyTypeLabel(rt?.hotel?.propertyType)}
                    ctaLabel="Check Availability"
                    onViewDetails={() => {
                      prefetchDetail('roomTypes', rt._id, rt);
                      navigate(`/room-types/${rt._id}`);
                    }}
                  />
                )}
              />
            ))}
          </div>
        ) : (
          /* Dedicated Filtered Grid View (For View All Landmark Destination or Direct Search) */
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="font-body text-xs font-semibold text-slate-500">
                Showing {filtered.length} {filtered.length === 1 ? 'room option' : 'room options'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
              {filtered.map((rt: any) => (
                <ListingCard
                  key={rt._id}
                  image={rt?.images?.[0] || rt?.hotel?.image}
                  images={rt?.images?.length ? rt.images : rt?.hotel?.images}
                  name={rt.name}
                  location={
                    rt?.hotel?.name
                      ? `${rt.hotel.name} · ${rt?.hotel?.location || ''}`
                      : rt?.hotel?.location || 'Braj Stay'
                  }
                  distance={getListingDistance(rt)}
                  price={getTaxInclusivePrice(rt)}
                  priceLabel={
                    isDharamshalaType(rt?.hotel?.propertyType)
                      ? ''
                      : rt?.hotel?.taxEnabled
                      ? '/night incl. GST'
                      : '/night'
                  }
                  pricePlaceholder={
                    isDharamshalaType(rt?.hotel?.propertyType)
                      ? 'Contribution on confirmation'
                      : undefined
                  }
                  priceHelp={
                    isDharamshalaType(rt?.hotel?.propertyType)
                      ? 'Confirmed upon request'
                      : undefined
                  }
                  rating={Number(rt?.hotel?.rating || 0)}
                  reviewCount={Number(rt?.hotel?.reviewCount || 0)}
                  amenities={rt?.amenities || rt?.hotel?.amenities || []}
                  meta={Number(rt?.totalCount || 0) > 0 ? `${rt.totalCount} rooms` : undefined}
                  variant="room"
                  badge={getPropertyTypeLabel(rt?.hotel?.propertyType)}
                  ctaLabel="Check Availability"
                  onViewDetails={() => {
                    prefetchDetail('roomTypes', rt._id, rt);
                    navigate(`/room-types/${rt._id}`);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Rooms;
