import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { resolveBackendAssetUrl } from '@/lib/api';

interface ListingCardProps {
  image: string;
  /** Optional gallery — when provided, the card auto-rotates through these images. */
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
  /** Auto-scroll interval in ms */
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
  intervalMs = 2800,
  variant = 'compact',
}: ListingCardProps) => {
  // Build full gallery: main image + extras (de-duplicated, placeholder filtered)
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

  // Only render the active image to avoid downloading the entire gallery for every card.
  // Prefetch the next image after first paint for smoother transitions.
  useEffect(() => {
    if (safeGallery.length <= 1) return;
    const next = safeGallery[(active + 1) % safeGallery.length];
    if (!next) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = next;
  }, [active, safeGallery]);

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border card-hover group">
      {/* Image carousel */}
      <div
        className={`relative overflow-hidden ${
          variant === 'hotel' ? 'h-48 sm:h-52' : variant === 'compact' ? 'h-40 sm:h-44' : 'h-44 sm:h-48'
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

        {/* Glossy sheen */}
        <div className="pointer-events-none absolute inset-0 glossy-sheen" />

        {badge && (
          <span
            className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-body font-semibold z-10 ${
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

        {/* Image counter */}
        {safeGallery.length > 1 && (
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full glass-chip text-[10px] font-body z-10">
            {active + 1} / {safeGallery.length}
          </span>
        )}

        {/* Dot indicators */}
        {safeGallery.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {safeGallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
                aria-label={`Show image ${i + 1}`}
                className={`h-1 rounded-full transition-all ${
                  i === active ? 'w-5 bg-brand-gold' : 'w-1.5 bg-primary-foreground/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={variant === 'compact' ? 'p-3' : 'p-4'}>
        <h3 className={`font-heading font-semibold text-foreground line-clamp-1 ${
          variant === 'hotel' ? 'text-base' : variant === 'compact' ? 'text-base' : 'text-lg'
        }`}>{name}</h3>
        <p className={`font-body text-muted-foreground mt-1 ${
          variant === 'hotel' ? 'text-xs' : variant === 'compact' ? 'text-xs' : 'text-sm'
        }`}>{location}</p>
        {meta && <p className="font-body text-xs text-muted-foreground mt-1">{meta}</p>}

        {/* Rating */}
        <div className="flex items-center gap-1.5 mt-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={13}
                className={i < Math.floor(rating) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
              />
            ))}
          </div>
          <span className="font-body text-xs text-muted-foreground">({reviewCount})</span>
        </div>

        {/* Amenities */}
        {amenities && amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {amenities.slice(0, 3).map((a) => (
              <span key={a} className="font-body text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-end justify-between mt-4 pt-4 border-t border-border">
          {typeof price === 'number' && Number.isFinite(price) && price > 0 ? (
            <div>
              <span className="font-heading text-2xl font-bold text-foreground">₹{price.toLocaleString('en-IN')}</span>
              <span className={`font-body text-muted-foreground ${variant === 'compact' ? 'text-xs' : 'text-sm'}`}>{priceLabel}</span>
            </div>
          ) : (
            <div />
          )}
          <button onClick={onViewDetails} className={`btn-gold rounded-lg font-body ${variant === 'compact' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-sm'}`}>
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
