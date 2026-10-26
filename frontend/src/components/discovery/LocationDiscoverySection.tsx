import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, ArrowRight, Compass } from 'lucide-react';

export interface LocationDiscoverySectionProps<T> {
  id: string;
  heading: string;
  subtitle?: string;
  distanceLabel?: string;
  viewAllUrl: string;
  viewAllCount?: number;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function LocationDiscoverySection<T extends { _id: string }>({
  id,
  heading,
  subtitle,
  distanceLabel,
  viewAllUrl,
  viewAllCount,
  items,
  renderItem,
  isLoading = false,
  emptyMessage = 'No verified properties currently available in this specific section.',
  className = '',
}: LocationDiscoverySectionProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const totalCount = viewAllCount ?? items.length;

  return (
    <section aria-labelledby={`heading-${id}`} className={`w-full py-4 sm:py-6 ${className}`}>
      {/* Section Header: Heading & View All on the same row */}
      <div className="flex items-center justify-between gap-3 mb-3.5 px-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 shrink-0">
              {id === 'near_me' ? <Compass size={14} /> : <MapPin size={14} />}
            </div>
            <h2
              id={`heading-${id}`}
              className="font-heading text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 truncate"
            >
              {heading}
            </h2>
            {distanceLabel && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 font-body text-[11px] font-bold text-emerald-800 shrink-0">
                {distanceLabel}
              </span>
            )}
            {totalCount > 0 && (
              <span className="hidden xs:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-semibold text-slate-600">
                {totalCount} {totalCount === 1 ? 'option' : 'options'}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="font-body text-xs sm:text-[13px] text-slate-500 mt-1 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* View all link aligned on the same row */}
        {totalCount > 0 && (
          <div className="shrink-0">
            <Link
              to={viewAllUrl}
              className="group inline-flex items-center gap-1 font-body text-xs sm:text-sm font-bold text-slate-900 hover:text-amber-800 transition-colors py-1 pl-2"
            >
              <span>View all</span>
              <span className="hidden sm:inline">({totalCount})</span>
              <ArrowRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-0.5 text-amber-800"
              />
            </Link>
          </div>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex gap-4 overflow-hidden pt-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[260px] sm:w-[280px] shrink-0 animate-pulse rounded-2xl bg-neutral-100 p-2.5 space-y-2.5"
            >
              <div className="aspect-[4/3] w-full rounded-xl bg-neutral-200" />
              <div className="h-4 w-3/4 rounded bg-neutral-200" />
              <div className="h-3 w-1/2 rounded bg-neutral-200" />
              <div className="h-4 w-1/3 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/70 bg-white/60 p-6 text-center max-w-md mx-auto">
          <p className="font-body text-xs sm:text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* Desktop Layout: Show up to 4 property cards in a clean responsive grid */}
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 pt-1">
            {items.slice(0, 4).map((item, idx) => (
              <div key={item._id || idx} className="w-full">
                {renderItem(item, idx)}
              </div>
            ))}
          </div>

          {/* Mobile Layout: Compact horizontal swipeable cards (2 cards per screen on mobile, 3 on tablet) */}
          <div
            className="md:hidden flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory w-full max-w-full px-0.5"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {items.map((item, idx) => (
              <div
                key={item._id || idx}
                className="w-[calc(50%-5px)] min-w-[calc(50%-5px)] max-w-[calc(50%-5px)] sm:w-[calc(33.333%-11px)] sm:min-w-[calc(33.333%-11px)] sm:max-w-[calc(33.333%-11px)] shrink-0 snap-start"
              >
                {renderItem(item, idx)}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default LocationDiscoverySection;
