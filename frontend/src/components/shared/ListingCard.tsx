import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { resolveBackendAssetUrl } from '@/lib/api';

interface ListingCardProps {
  image: string;
  /** Optional gallery — when provided, the card auto-rotates through these images. */
  images?: string[];
  name: string;
  location: string;
  price: number;
  priceLabel?: string;
  rating: number;
  reviewCount?: number;
  badge?: string;
  badgeColor?: 'green' | 'saffron';
  amenities?: string[];
  onViewDetails?: () => void;
  /** Auto-scroll interval in ms */
  intervalMs?: number;
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
  amenities,
  onViewDetails,
  intervalMs = 2800,
}: ListingCardProps) => {
  // Build full gallery: main image + extras (de-duplicated, placeholder filtered)
  const gallery = (() => {
    const all = [image, ...(images || [])].map((src) => resolveBackendAssetUrl(src)).filter(
      (src): src is string => Boolean(src) && src !== '/placeholder.svg'
    );
    return Array.from(new Set(all));
  })();
  const safeGallery = gallery.length > 0 ? gallery : [image || '/placeholder.svg'];

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

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border card-hover group">
      {/* Image carousel */}
      <div
        className="relative h-52 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {safeGallery.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={`${name} ${i + 1}`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
              i === active ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
            } group-hover:scale-110`}
            onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.svg')}
          />
        ))}

        {/* Glossy sheen */}
        <div className="pointer-events-none absolute inset-0 glossy-sheen" />

        {badge && (
          <span
            className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-body font-semibold z-10 ${
              badgeColor === 'green'
                ? 'bg-brand-green text-primary-foreground'
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
      <div className="p-5">
        <h3 className="font-heading text-xl font-semibold text-foreground line-clamp-1">{name}</h3>
        <p className="font-body text-sm text-muted-foreground mt-1">📍 {location}</p>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mt-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
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
          <div>
            <span className="font-heading text-2xl font-bold text-foreground">₹{price.toLocaleString('en-IN')}</span>
            <span className="font-body text-sm text-muted-foreground">{priceLabel}</span>
          </div>
          <button
            onClick={onViewDetails}
            className="btn-gold px-4 py-2 rounded-lg text-sm font-body"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
