import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselRowProps<T> {
  id: string;
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function CarouselRow<T extends { _id: string }>({
  id,
  title,
  icon,
  subtitle,
  badge,
  items,
  renderItem,
  className = '',
}: CarouselRowProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const checkScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items, checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const scrollAmount = Math.max(280, el.clientWidth * 0.9);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Mouse drag support for desktop/testing
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = trackRef.current;
    if (!el) return;
    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = trackRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeftState - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby={`carousel-heading-${id}`} className={`w-full py-2.5 ${className}`}>
      {/* Row Header */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-800 shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id={`carousel-heading-${id}`}
                className="font-heading text-sm sm:text-base font-bold text-slate-900 truncate"
              >
                {title}
              </h2>
              {badge && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-body text-[10px] font-semibold text-slate-600">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="font-body text-xs text-slate-500 truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Status / Swipe Indicator & Navigation */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-body text-[11px] font-semibold text-slate-500">
            {items.length} {items.length === 1 ? 'option' : 'options'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label={`Scroll ${title} left`}
              className={`p-1 rounded-full border transition-colors ${
                canScrollLeft
                  ? 'border-neutral-300 bg-white hover:bg-neutral-50 text-slate-800 cursor-pointer shadow-2xs'
                  : 'border-neutral-200 bg-neutral-100/60 text-slate-300 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label={`Scroll ${title} right`}
              className={`p-1 rounded-full border transition-colors ${
                canScrollRight
                  ? 'border-neutral-300 bg-white hover:bg-neutral-50 text-slate-800 cursor-pointer shadow-2xs'
                  : 'border-neutral-200 bg-neutral-100/60 text-slate-300 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Flex Carousel Track */}
      <div className="w-full overflow-hidden">
        <div
          ref={trackRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex flex-nowrap gap-2.5 sm:gap-4 md:gap-5 overflow-x-auto pb-2.5 pt-1 scrollbar-none snap-x snap-mandatory w-full max-w-full px-0.5 touch-pan-x overscroll-x-contain ${
            isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {items.map((item, index) => (
            <div
              key={item._id || index}
              className="w-[calc(50%-5px)] min-w-[calc(50%-5px)] max-w-[calc(50%-5px)] sm:w-[calc(33.333%-11px)] sm:min-w-[calc(33.333%-11px)] sm:max-w-[calc(33.333%-11px)] lg:w-[calc(25%-15px)] lg:min-w-[calc(25%-15px)] lg:max-w-[calc(25%-15px)] shrink-0 snap-start"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CarouselRow;
