import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
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
  variant?: 'default' | 'hotel' | 'compact';
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
  badgeColor = 'saffron',
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
    return gallery.length > 0 ? gallery : [image || '/placeholder.svg'];
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

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border card-hover group min-w-0">
      <div
        className={`relative overflow-hidden ${
          variant === 'hotel' ? 'h-24 sm:h-32' : variant === 'compact' ? 'h-24 sm:h-32' : 'h-28 sm:h-36'
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
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out scale-105 group-hover:scale-110"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.svg')}
        />

        <div className="pointer-events-none absolute inset-0 glossy-sheen" />

        {badge && (
          <span
            className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-body font-semibold z-10 ${
              badgeColor === 'green'
                ? 'bg-brand-green text-primary-foreground'
                : badgeColor === 'crimson'
                  ? 'bg-brand-crimson text-primary-foreground'
                  : 'bg-brand-saffron text-primary-foreground'
            }`}
          >
            {badge}
          </span>
        )}

        {safeGallery.length > 1 && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full glass-chip text-[9px] sm:text-[10px] font-body z-10">
            {active + 1} / {safeGallery.length}
          </span>
        )}

        {safeGallery.length > 1 && (
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
      </div>

      <div className="p-2 sm:p-2.5">
        <h3
          className={`font-heading font-semibold text-foreground line-clamp-1 ${
            variant === 'default' ? 'text-sm sm:text-base' : 'text-[13px] sm:text-[15px]'
          }`}
        >
          {name}
        </h3>
        <p className={`font-body text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1 ${variant === 'default' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`}>
          {location}
        </p>
        {meta && <p className="font-body text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">{meta}</p>}

        <div className="flex items-center gap-1 mt-1 sm:gap-1.5 sm:mt-1.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={10}
                className={i < Math.floor(rating) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
              />
            ))}
          </div>
          <span className="font-body text-[10px] sm:text-xs text-muted-foreground">({reviewCount})</span>
        </div>

        {amenities && amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2 min-h-5">
            {amenities.slice(0, 3).map((a, index) => (
              <span
                key={a}
                className={`font-body text-[9px] sm:text-[11px] bg-secondary px-1.5 sm:px-2 py-0.5 rounded-full text-secondary-foreground line-clamp-1 ${
                  index > 1 ? 'hidden sm:inline-flex' : ''
                }`}
              >
                {a}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col items-stretch gap-1.5 mt-2 pt-2 border-t border-border sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:mt-2.5 sm:pt-2.5">
          {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
            <div>
              <span className="font-heading text-[13px] sm:text-base font-bold text-foreground">Rs. {price.toLocaleString('en-IN')}</span>
              <span className={`font-body text-muted-foreground ${variant === 'compact' ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>{priceLabel}</span>
            </div>
          ) : (
            <div />
          )}
          <button onClick={onViewDetails} className="btn-gold rounded-md font-body px-2 py-1.5 text-[10px] sm:px-2.5 sm:text-[11px] whitespace-nowrap">
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
