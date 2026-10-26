import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MapPin, Star } from 'lucide-react';
import { resolveBackendAssetUrl } from '@/lib/api';
import { filterSafeGallery } from '@/lib/imageSanitizer';

export interface ListingCardProps {
  image: string;
  images?: string[];
  name: string;
  location: string;
  distance?: string;
  price?: number;
  priceLabel?: string;
  pricePlaceholder?: string;
  priceHelp?: string;
  rating: number;
  reviewCount?: number;
  badge?: string;
  badgeColor?: 'green' | 'saffron' | 'crimson';
  meta?: string;
  amenities?: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onViewDetails?: () => void;
  ctaLabel?: string;
  intervalMs?: number;
  variant?: 'default' | 'hotel' | 'room' | 'cab' | 'compact' | 'tour';
  compact?: boolean;
}

type CardKind = 'hotel' | 'room' | 'cab' | 'tour' | 'default';

const cardCopy: Record<CardKind, { fallbackBadge: string; context: string; emptyPrice: string; emptyPriceHelp: string; cta: string }> = {
  hotel: {
    fallbackBadge: 'Verified Stay',
    context: 'Verified Braj stay',
    emptyPrice: 'Contribution on confirmation',
    emptyPriceHelp: 'Confirmed after verification',
    cta: 'View Rooms & Tariff',
  },
  room: {
    fallbackBadge: 'Room Option',
    context: 'Room configuration',
    emptyPrice: 'Contribution on confirmation',
    emptyPriceHelp: 'Confirmed upon request',
    cta: 'Check Availability',
  },
  cab: {
    fallbackBadge: 'AC Cab',
    context: 'Private yatra transport',
    emptyPrice: '',
    emptyPriceHelp: '',
    cta: 'Confirm Cab Route',
  },
  tour: {
    fallbackBadge: 'Braj Yatra',
    context: 'Spiritual darshan package',
    emptyPrice: 'Fare upon itinerary',
    emptyPriceHelp: 'Includes coordinator',
    cta: 'View Yatra Plan',
  },
  default: {
    fallbackBadge: 'Listing',
    context: 'Braj listing',
    emptyPrice: 'Price on request',
    emptyPriceHelp: 'Contact helpline',
    cta: 'View Details',
  },
};

const getCardKind = (variant: ListingCardProps['variant'], ctaLabel?: string, priceLabel?: string): CardKind => {
  if (variant === 'hotel') return 'hotel';
  if (variant === 'tour') return 'tour';
  if (variant === 'cab' || (ctaLabel && ctaLabel.toLowerCase().includes('cab'))) return 'cab';
  if (variant === 'room' || (ctaLabel && ctaLabel.toLowerCase().includes('room')) || (priceLabel && priceLabel.toLowerCase().includes('night'))) return 'room';
  return 'default';
};

const badgeToneClass: Record<NonNullable<ListingCardProps['badgeColor']>, string> = {
  green: 'bg-emerald-900/80 text-white',
  saffron: 'bg-amber-800/80 text-white',
  crimson: 'bg-rose-900/80 text-white',
};

const ListingCard = ({
  image,
  images,
  name,
  location,
  distance,
  price,
  priceLabel = '/night',
  pricePlaceholder,
  priceHelp,
  rating = 0,
  reviewCount = 0,
  badge,
  badgeColor,
  meta,
  amenities,
  isFavorite = false,
  onToggleFavorite,
  onViewDetails,
  ctaLabel,
  variant = 'compact',
  compact = false,
}: ListingCardProps) => {
  const safeGallery = useMemo(() => {
    const rawList = [image, ...(images || [])];
    const safeUrls = filterSafeGallery(rawList);
    const resolved = safeUrls.map((src) => resolveBackendAssetUrl(src));
    return resolved.length > 0 ? resolved : ['/placeholder.svg'];
  }, [image, images]);

  const [active, setActive] = useState(0);
  const kind = getCardKind(variant, ctaLabel, priceLabel);
  const copy = cardCopy[kind];
  const typeLabel = badge || (kind === 'hotel' ? 'Stay' : kind === 'cab' ? 'Cab' : kind === 'tour' ? 'Yatra' : '');
  const hasPrice = typeof price === 'number' && Number.isFinite(price) && price > 0;
  const unit = priceLabel || (kind === 'cab' ? 'per trip' : kind === 'tour' ? '/person' : '/night');

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActive((prev) => (prev === 0 ? safeGallery.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActive((prev) => (prev === safeGallery.length - 1 ? 0 : prev + 1));
  };

  // Consistent 4:3 image container matching Hotels/Rooms across all categories
  const imageContainerClass = 'aspect-[4/3]';
  const imageClass =
    kind === 'cab'
      ? 'h-full w-full object-cover object-[center_25%] transition-transform duration-500 ease-out group-hover:scale-105'
      : 'h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105';

  return (
    <article
      tabIndex={0}
      role="button"
      onClick={onViewDetails}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails?.();
        }
      }}
      className="group flex flex-col w-full text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-2xl"
    >
      {/* 1. Image Media Container */}
      <div className={`relative ${imageContainerClass} w-full overflow-hidden rounded-2xl bg-neutral-100`}>
        <img
          src={safeGallery[active] || '/placeholder.svg'}
          alt={`${name} photo ${active + 1}`}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.endsWith('/placeholder.svg')) {
              target.src = '/placeholder.svg';
            }
          }}
          className={imageClass}
        />

        {/* Top-Left Badge (Property Type, Cab Advance, or Tour Duration) */}
        {typeLabel && (
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 max-w-[70%]">
            <span
              className={`inline-flex items-center max-w-full truncate rounded-full px-2 py-0.5 font-body text-[10px] font-bold shadow-xs backdrop-blur-md ${
                badgeColor
                  ? badgeToneClass[badgeColor]
                  : 'bg-white/95 text-slate-800 border border-neutral-200/60'
              }`}
            >
              <span className="truncate">{typeLabel}</span>
            </span>
          </div>
        )}

        {/* Top-Right Badge: Genuine Rating (Star + Number on white pill) */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 font-body text-[10px] sm:text-[11px] font-bold text-slate-900 shadow-xs backdrop-blur-xs">
              <Star size={10} className="fill-amber-500 text-amber-500 shrink-0" />
              <span>{rating.toFixed(1)}</span>
            </span>
          </div>
        )}

        {/* Wishlist Heart on Top Right if provided and no rating */}
        {onToggleFavorite && (!rating || rating <= 0) && (
          <button
            type="button"
            aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full hover:scale-110 active:scale-90 transition-transform focus-visible:outline-none"
          >
            <Heart
              size={18}
              className={
                isFavorite
                  ? 'fill-rose-500 text-rose-500 drop-shadow-md'
                  : 'fill-black/30 stroke-white stroke-[2] drop-shadow-md hover:fill-black/45'
              }
            />
          </button>
        )}

        {/* Carousel Chevrons (Appear on Desktop Hover) */}
        {safeGallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 hover:bg-white transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 hover:bg-white transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Carousel Dots */}
        {safeGallery.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1 z-10 pointer-events-none">
            {safeGallery.slice(0, 5).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === active ? 'w-3 bg-white shadow-sm' : 'w-1.5 bg-white/60 shadow-sm'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Text Details Information Hierarchy */}
      <div className={`space-y-0.5 ${compact ? 'mt-1.5' : 'mt-2'}`}>
        {kind === 'cab' ? (
          /* Cabs: Vehicle name, service area, capacity/type, and actual fare only when available */
          <>
            <h3
              title={name}
              className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1 leading-snug"
            >
              {name}
            </h3>
            {location && (
              <p className="font-body text-[11px] font-medium text-neutral-500 flex items-center gap-1 line-clamp-1">
                <MapPin size={11} className="text-amber-800/80 shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            )}
            {amenities && amenities.length > 0 && (
              <p className="font-body text-[11px] text-neutral-400 line-clamp-1">
                {amenities.filter(Boolean).join(' · ')}
              </p>
            )}
            {hasPrice && (
              <p className="pt-0.5 font-body text-[13px] sm:text-[14px] font-bold text-slate-900 tracking-tight">
                ₹{price.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-neutral-500">{unit}</span>
              </p>
            )}
          </>
        ) : kind === 'tour' ? (
          /* Tours: Title, destination/covered places, and price */
          <>
            <h3
              title={name}
              className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1 leading-snug"
            >
              {name}
            </h3>
            {(location || (amenities && amenities.length > 0)) && (
              <p className="font-body text-[11px] font-medium text-neutral-500 flex items-center gap-1 line-clamp-1">
                <MapPin size={11} className="text-amber-800/80 shrink-0" />
                <span className="truncate">{location || amenities?.filter(Boolean).slice(0, 2).join(' · ')}</span>
              </p>
            )}
            {hasPrice && (
              <p className="pt-0.5 font-body text-[13px] sm:text-[14px] font-bold text-slate-900 tracking-tight">
                ₹{price.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-neutral-500">{unit}</span>
              </p>
            )}
          </>
        ) : (
          /* Hotels / Dharamshalas / Rooms (Exact 3-Line Structure):
             Line 1: Property name
             Line 2: Price for hotels OR Request-based message for dharamshalas
             Line 3: Short useful detail (location / distance / configuration) */
          <>
            <h3
              title={name || 'Stay in Braj'}
              className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1 leading-snug"
            >
              {name || 'Stay in Braj'}
            </h3>
            <div className={compact ? 'pt-0' : 'pt-0.5'}>
              {hasPrice ? (
                <p className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 tracking-tight line-clamp-1">
                  ₹{price.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-neutral-500">{unit}</span>
                </p>
              ) : (
                <p className="font-body text-xs font-semibold text-amber-900 line-clamp-1">
                  {pricePlaceholder || copy.emptyPrice}
                </p>
              )}
            </div>
            {(location || distance || (amenities && amenities.length > 0)) && (
              <p className="font-body text-[11px] font-medium text-neutral-500 flex items-center gap-1 line-clamp-1">
                <MapPin size={11} className="text-amber-800/80 shrink-0" />
                <span className="truncate">
                  {distance ? `${distance} · ${location || ''}` : location || amenities?.filter(Boolean).slice(0, 2).join(' · ')}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
};

export default ListingCard;
