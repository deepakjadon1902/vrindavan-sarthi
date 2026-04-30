import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { resolveBackendAssetUrl } from '@/lib/api';

interface ImageCarouselProps {
  images: string[];
  alt: string;
  /** Auto-swap interval in ms. Default 3500. */
  intervalMs?: number;
  /** Container height classes. */
  heightClass?: string;
  /** Show small clickable thumbnails below */
  showThumbnails?: boolean;
}

/**
 * Modern detail-page carousel:
 *  - Auto-advances on a timer.
 *  - On hover, the timer pauses and the active slide follows the mouse position
 *    horizontally (move pointer left ↔ right to swap).
 *  - Includes glass-style nav arrows, gradient overlay, and dot indicators.
 */
const ImageCarousel = ({
  images,
  alt,
  intervalMs = 3500,
  heightClass = 'h-72 md:h-[28rem]',
  showThumbnails = true,
}: ImageCarouselProps) => {
  const safe = (images && images.length > 0 ? images : ['/placeholder.svg']).map((img) => resolveBackendAssetUrl(img) || '/placeholder.svg');
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // Auto-advance when not hovering
  useEffect(() => {
    if (hovering || safe.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % safe.length);
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [hovering, safe.length, intervalMs]);

  // Hover-driven slide swap (mouse X position determines slide)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (safe.length <= 1 || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(0.999, Math.max(0, (e.clientX - left) / width));
    const idx = Math.floor(ratio * safe.length);
    if (idx !== active) setActive(idx);
  };

  const prev = () => setActive((i) => (i - 1 + safe.length) % safe.length);
  const next = () => setActive((i) => (i + 1) % safe.length);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={handleMouseMove}
        className={`relative ${heightClass} rounded-2xl overflow-hidden group glass-card`}
      >
        {/* Slides */}
        {safe.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${alt} ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
              i === active ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.svg')}
          />
        ))}

        {/* Glossy overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 glossy-sheen" />

        {/* Empty fallback */}
        {safe[0] === '/placeholder.svg' && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
            <ImageIcon size={48} />
          </div>
        )}

        {/* Arrows */}
        {safe.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-button flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-button flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Counter */}
        {safe.length > 1 && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full glass-chip font-body text-xs">
            {active + 1} / {safe.length}
          </div>
        )}

        {/* Dots */}
        {safe.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {safe.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Go to image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? 'w-6 bg-brand-gold shadow-[0_0_10px_hsl(var(--brand-gold))]' : 'w-1.5 bg-primary-foreground/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbnails && safe.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {safe.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                i === active ? 'ring-2 ring-brand-gold scale-105' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;
