import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Heart, MapPin, Star } from 'lucide-react';
import { resolveBackendAssetUrl } from '@/lib/api';

interface ListingCardProps {
  image: string;
  images?: string[];
  name: string;
  location: string;
  price?: number;
  priceLabel?: string;
  rating: number;
  reviewCount?: number;
  badge?: string;
  badgeColor?: 'green' | 'saffron' | 'crimson';
  meta?: string;
  amenities?: string[];
  onViewDetails?: () => void;
  ctaLabel?: string;
  intervalMs?: number;
  variant?: 'default' | 'hotel' | 'compact' | 'tour';
}

const ListingCard = ({
  image,
  images,
  name,
  location,
  price,
  priceLabel = '/night',
  rating,
  reviewCount = 0,
  badge,
  meta,
  amenities,
  onViewDetails,
  ctaLabel = 'View Details',
  intervalMs = 2800,
  variant = 'compact',
}: ListingCardProps) => {
  const safeGallery = useMemo(() => {
    const all = [image, ...(images || [])]
      .map((src) => resolveBackendAssetUrl(src))
      .filter((src): src is string => Boolean(src) && src !== '/placeholder.svg');
    const gallery = Array.from(new Set(all));
    return gallery.length > 0 ? gallery : ['/placeholder.svg'];
  }, [image, images]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused || safeGallery.length <= 1) return;
    intervalRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % safeGallery.length);
    }, intervalMs);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [paused, safeGallery.length, intervalMs]);

  useEffect(() => {
    if (safeGallery.length <= 1) return;
    const next = safeGallery[(active + 1) % safeGallery.length];
    if (!next) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = next;
  }, [active, safeGallery]);

  const ratingLabel = rating >= 4.5 ? 'Wonderful' : rating >= 4 ? 'Very Good' : rating >= 3 ? 'Good' : 'Trusted';
  const isHotelCard = variant === 'hotel';
  const isRoomCard = !isHotelCard && (ctaLabel.toLowerCase().includes('room') || priceLabel.toLowerCase().includes('night'));
  const isStayCard = isHotelCard || isRoomCard;
  const typeLabel = badge || (isHotelCard ? 'Hotel' : isRoomCard ? 'Room' : meta || 'Listing');

  return (
    <div
      onClick={onViewDetails}
      role={onViewDetails ? 'button' : undefined}
      tabIndex={onViewDetails ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onViewDetails) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails();
        }
      }}
      className={`premium-tilt-card group min-w-0 overflow-hidden rounded-lg border bg-white transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${onViewDetails ? 'cursor-pointer' : ''} ${
        isStayCard
          ? 'border-border shadow-[0_2px_12px_rgba(15,23,42,0.10)] hover:border-border hover:shadow-[0_10px_28px_rgba(15,23,42,0.16)]'
          : 'border-border/90 shadow-[0_10px_26px_rgba(15,23,42,0.07)] hover:border-brand-gold/45 hover:shadow-[0_18px_42px_rgba(15,23,42,0.13)]'
      } ${variant === 'tour' ? 'h-auto' : 'h-full'}`}
    >
      <div
        className={`relative overflow-hidden bg-muted ${
          isStayCard ? 'aspect-[16/10] sm:aspect-[4/3]' : variant === 'tour' ? 'aspect-[16/11]' : 'aspect-[16/11]'
        }`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <img
          key={`${safeGallery[active] || ''}-${active}`}
          src={safeGallery[active]}
          alt={`${name} ${active + 1}`}
          loading="lazy"
          decoding="async"
          className="premium-depth-image absolute inset-0 h-full w-full object-cover object-center"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.svg')}
        />

        {!isStayCard && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent opacity-80" />}

        <button
          type="button"
          aria-label={`Save ${name}`}
          onClick={(e) => e.stopPropagation()}
          className="premium-icon-button absolute right-2.5 top-2.5 z-10 h-9 w-9 hover:text-brand-crimson"
        >
          <Heart size={18} />
        </button>

        {!isStayCard && safeGallery.length > 1 && (
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-white/95 text-[10px] font-body font-semibold text-foreground shadow-sm z-10">
            {active + 1} / {safeGallery.length}
          </span>
        )}

        {!isStayCard && safeGallery.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {safeGallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(i);
                }}
                aria-label={`Show image ${i + 1}`}
                className={`h-1 rounded-full transition-all ${
                  i === active ? 'w-4 bg-brand-gold' : 'w-1.5 bg-primary-foreground/60'
                }`}
              />
            ))}
          </div>
        )}

        {isStayCard && safeGallery.length > 1 && (
          <span className="absolute bottom-2 left-2 z-10 rounded-md bg-white/95 px-2 py-1 font-body text-[10px] font-semibold text-foreground shadow-sm">
            {active + 1} / {safeGallery.length}
          </span>
        )}
      </div>

      <div className={`premium-depth-content flex flex-1 flex-col ${isStayCard ? 'p-3.5 sm:p-3' : 'p-3.5'}`}>
        <div className="mb-1 flex min-h-5 items-center gap-1.5">
          <span className={`font-body text-[11px] ${isStayCard ? 'font-medium normal-case tracking-normal text-muted-foreground' : 'font-semibold uppercase tracking-[0.08em] text-muted-foreground'}`}>
            {typeLabel}{isRoomCard && meta ? ` - ${meta}` : ''}
          </span>
          {rating > 0 && (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(5, Math.max(1, Math.round(rating))) }).map((_, i) => (
                <Star key={i} size={11} className="fill-brand-gold text-brand-gold" />
              ))}
            </span>
          )}
        </div>
        <h3
          className="font-body text-base font-bold leading-snug text-foreground line-clamp-2 sm:text-[15px]"
        >
          {name}
        </h3>
        <p className={`mt-1 inline-flex items-start gap-1.5 font-body text-xs leading-snug text-muted-foreground ${isStayCard ? 'line-clamp-1' : 'line-clamp-2'}`}>
          {!isStayCard && <MapPin size={12} className="mt-0.5 shrink-0 text-brand-saffron" />} <span>{location || 'Braj'}</span>
        </p>

        {(rating > 0 || reviewCount > 0) && (
          <div className={`${isStayCard ? 'mt-2 flex items-start gap-2' : 'mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/45 p-2'}`}>
            <span className={`inline-flex h-6 min-w-8 items-center justify-center rounded-sm px-1.5 font-body text-xs font-bold text-white ${isStayCard ? 'bg-primary' : 'bg-brand-green'}`}>
              {rating > 0 ? rating.toFixed(1) : 'New'}
            </span>
            <span className="font-body text-xs leading-tight text-muted-foreground">
              <span className={isStayCard ? 'block font-medium text-foreground' : ''}>{rating > 0 ? ratingLabel : 'New'}</span>
              {reviewCount > 0 ? <span className={isStayCard ? 'block' : ''}>{isStayCard ? `${reviewCount} reviews` : ` - ${reviewCount} reviews`}</span> : null}
            </span>
          </div>
        )}

        {!isStayCard && amenities && amenities.length > 0 && (
          <div className="mt-2 flex min-h-[24px] flex-wrap content-start gap-1 overflow-hidden">
            {amenities.slice(0, 2).map((a) => (
              <span
                key={a}
                className="max-w-full truncate rounded-md border border-border bg-secondary/70 px-2 py-1 font-body text-[10px] text-secondary-foreground"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        <div className={`${variant === 'tour' ? 'mt-3' : 'mt-auto'} ${isStayCard ? 'flex items-end justify-between gap-3 pt-3' : 'flex flex-col items-stretch gap-1.5 pt-2.5'}`}>
          {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
            <div className="ml-auto text-right">
              <span className="font-body text-[11px] text-muted-foreground">Starting from</span>
              <span className="ml-1 font-body text-[17px] font-bold text-foreground sm:text-base"> Rs. {price.toLocaleString('en-IN')}</span>
              {priceLabel && !isStayCard && <span className="font-body text-[11px] text-muted-foreground"> {priceLabel}</span>}
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.();
            }}
            className={`${isStayCard ? 'sr-only' : 'inline-flex'} items-center justify-center gap-1 rounded-md border border-brand-gold/50 bg-brand-gold/10 px-3 py-2.5 font-body text-xs font-bold text-foreground transition-colors hover:bg-brand-gold`}
          >
            {ctaLabel} <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
