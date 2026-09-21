import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BedDouble, CarFront, Heart, IndianRupee, MapPin, Route, Star, Users } from 'lucide-react';
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
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onViewDetails?: () => void;
  ctaLabel?: string;
  intervalMs?: number;
  variant?: 'default' | 'hotel' | 'room' | 'cab' | 'compact' | 'tour';
}

type CardKind = 'hotel' | 'room' | 'cab' | 'tour' | 'default';

const cardCopy: Record<CardKind, { fallbackBadge: string; context: string; emptyPrice: string; emptyPriceHelp: string; cta: string }> = {
  hotel: {
    fallbackBadge: 'Stay',
    context: 'Stay option',
    emptyPrice: 'Price on request',
    emptyPriceHelp: 'Contact support',
    cta: 'View rooms',
  },
  room: {
    fallbackBadge: 'Room',
    context: 'Room option',
    emptyPrice: 'Price on request',
    emptyPriceHelp: 'Contact support',
    cta: 'Select room',
  },
  cab: {
    fallbackBadge: 'Cab',
    context: 'Private transport',
    emptyPrice: 'Route-wise fare',
    emptyPriceHelp: 'See route details',
    cta: 'Book cab',
  },
  tour: {
    fallbackBadge: 'Tour',
    context: 'Curated journey',
    emptyPrice: 'Price on request',
    emptyPriceHelp: 'Contact support',
    cta: 'Explore tour',
  },
  default: {
    fallbackBadge: 'Listing',
    context: 'Listing option',
    emptyPrice: 'Price on request',
    emptyPriceHelp: 'Contact support',
    cta: 'View details',
  },
};

const getCardKind = (variant: ListingCardProps['variant'], ctaLabel: string, priceLabel: string): CardKind => {
  if (variant === 'hotel') return 'hotel';
  if (variant === 'tour') return 'tour';
  if (variant === 'cab' || ctaLabel.toLowerCase().includes('cab')) return 'cab';
  if (variant === 'room' || ctaLabel.toLowerCase().includes('room') || priceLabel.toLowerCase().includes('night')) return 'room';
  return 'default';
};

const badgeToneClass: Record<NonNullable<ListingCardProps['badgeColor']>, string> = {
  green: 'text-brand-green',
  saffron: 'text-brand-saffron',
  crimson: 'text-brand-crimson',
};

const VRSFavoriteButton = ({ name, isFavorite, onToggleFavorite }: { name: string; isFavorite: boolean; onToggleFavorite: () => void }) => (
  <button
    type="button"
    aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
    aria-pressed={isFavorite}
    onClick={(e) => {
      e.stopPropagation();
      onToggleFavorite();
    }}
    className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/[0.94] text-foreground shadow-[0_2px_8px_rgba(16,24,44,0.08)] transition-colors duration-200 ease-out hover:text-brand-crimson focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    <Heart size={18} className={isFavorite ? 'fill-brand-crimson text-brand-crimson' : undefined} />
  </button>
);

const VRSBadge = ({ children, tone, className = '' }: { children: ReactNode; tone?: ListingCardProps['badgeColor']; className?: string }) => (
  <span className={`inline-flex max-w-full items-center truncate rounded-full border border-white/70 bg-white/[0.94] px-3 py-1 font-body text-[11px] font-bold text-foreground shadow-[0_2px_8px_rgba(16,24,44,0.08)] ${tone ? badgeToneClass[tone] : ''} ${className}`}>
    {children}
  </span>
);

const VRSMetadataChip = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
  <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-border bg-secondary/55 px-2.5 font-body text-[12px] font-semibold text-foreground">
    {icon}
    <span className="truncate">{children}</span>
  </span>
);

const VRSRating = ({ rating, reviewCount }: { rating: number; reviewCount: number }) => {
  if (rating <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-body text-[12px] font-bold text-white">
      {rating.toFixed(1)}
      <Star size={12} className="fill-brand-gold text-brand-gold" />
      {reviewCount > 0 && <span className="font-medium text-white/80">- {reviewCount}</span>}
    </span>
  );
};

const VRSPrice = ({ kind, price, unit }: { kind: CardKind; price?: number; unit: string }) => {
  const copy = cardCopy[kind];
  const hasPrice = typeof price === 'number' && Number.isFinite(price) && price > 0;

  if (!hasPrice) {
    return (
      <div>
        <span className="font-body text-[15px] font-semibold text-foreground">{copy.emptyPrice}</span>
        <span className="mt-1 block font-body text-[12px] text-muted-foreground">{copy.emptyPriceHelp}</span>
      </div>
    );
  }

  return (
    <div>
      <span className="flex items-center font-body text-[22px] font-bold leading-none text-foreground">
        <IndianRupee size={18} />
        {price.toLocaleString('en-IN')}
      </span>
      <span className="mt-1 block font-body text-[13px] font-medium text-muted-foreground">{unit}</span>
    </div>
  );
};

const VRSCardImage = ({ src, alt }: { src: string; alt: string }) => {
  const [readySrc, setReadySrc] = useState('');

  useEffect(() => {
    let active = true;
    const img = new Image();
    const id = window.setTimeout(() => {
      if (active) setReadySrc('');
    }, 900);

    setReadySrc('');
    img.decoding = 'async';
    img.onload = () => {
      if (!active) return;
      window.clearTimeout(id);
      setReadySrc(img.naturalWidth > 0 ? src : '');
    };
    img.onerror = () => {
      if (!active) return;
      window.clearTimeout(id);
      setReadySrc('');
    };
    img.src = src;

    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [src]);

  if (!readySrc) {
    return (
      <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-gold/10 via-white to-brand-crimson/10">
        <span className="px-5 text-center font-body text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Vrindavan Sarthi
        </span>
      </div>
    );
  }

  return (
    <img
      key={readySrc}
      src={readySrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="vrs-listing-image absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
    />
  );
};

const VRSCardMedia = ({
  active,
  badgeColor,
  gallery,
  imageRatio,
  isFavorite,
  name,
  onToggleFavorite,
  typeLabel,
  onPauseChange,
}: {
  active: number;
  badgeColor?: ListingCardProps['badgeColor'];
  gallery: string[];
  imageRatio: string;
  isFavorite: boolean;
  name: string;
  onToggleFavorite?: () => void;
  typeLabel: string;
  onPauseChange: (paused: boolean) => void;
}) => (
  <div
    className={`relative overflow-hidden bg-muted ${imageRatio}`}
    onMouseEnter={() => onPauseChange(true)}
    onMouseLeave={() => onPauseChange(false)}
  >
    <VRSCardImage src={gallery[active] || '/placeholder.svg'} alt={`${name} ${active + 1}`} />

    {typeLabel && (
      <div className="absolute left-3 top-3 z-10 max-w-[70%]">
        <VRSBadge tone={badgeColor}>{typeLabel}</VRSBadge>
      </div>
    )}
    {onToggleFavorite && <VRSFavoriteButton name={name} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />}

    {gallery.length > 1 && (
      <span className="absolute bottom-3 left-3 z-10 rounded-md bg-white/[0.94] px-2 py-1 font-body text-[10px] font-semibold text-foreground shadow-sm">
        {active + 1} / {gallery.length}
      </span>
    )}
  </div>
);

const VRSAmenities = ({ kind, items }: { kind: CardKind; items: string[] }) => {
  if (!items.length) return null;

  if (kind === 'cab') {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.slice(0, 2).map((item, index) => (
          <VRSMetadataChip key={`${item}-${index}`} icon={index === 0 ? <CarFront size={14} className="text-brand-saffron" /> : <Users size={14} className="text-brand-saffron" />}>
            {item}
          </VRSMetadataChip>
        ))}
      </div>
    );
  }

  if (kind === 'room') {
    return (
      <div className="mt-3 flex min-h-[30px] flex-wrap content-start gap-1.5">
        {items.slice(0, 3).map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/55 px-2 py-1 font-body text-[11px] font-semibold text-secondary-foreground">
            <BedDouble size={12} className="text-brand-saffron" />
            <span className="max-w-[9rem] truncate">{item}</span>
          </span>
        ))}
      </div>
    );
  }

  if (kind === 'tour') {
    return (
      <div className="mt-3 flex min-h-[30px] flex-wrap content-start gap-1.5">
        {items.slice(0, 3).map((item) => (
          <span key={item} className="max-w-full truncate rounded-full border border-border bg-secondary/55 px-2.5 py-1 font-body text-[11px] font-semibold text-secondary-foreground">
            {item}
          </span>
        ))}
        {items.length > 3 && (
          <span className="rounded-full border border-border bg-secondary/55 px-2.5 py-1 font-body text-[11px] font-semibold text-muted-foreground">
            +{items.length - 3} more
          </span>
        )}
      </div>
    );
  }

  return null;
};

interface VRSCardShellProps {
  kind: CardKind;
  gallery: string[];
  active: number;
  badgeColor?: ListingCardProps['badgeColor'];
  name: string;
  location: string;
  typeLabel: string;
  context: string;
  rating: number;
  reviewCount: number;
  meta?: string;
  amenities: string[];
  price?: number;
  priceUnit: string;
  actionLabel: string;
  imageRatio: string;
  cardMinHeight: string;
  isFavorite: boolean;
  onPauseChange: (paused: boolean) => void;
  onToggleFavorite?: () => void;
  onViewDetails?: () => void;
}

const VRSLocation = ({ kind, location }: { kind: CardKind; location: string }) => {
  if (!location.trim()) return null;

  return (
    <p className="mt-2 inline-flex min-h-5 items-start gap-1.5 font-body text-[13px] leading-5 text-muted-foreground">
      {kind === 'cab' ? <Route size={14} className="mt-0.5 shrink-0 text-brand-saffron" /> : <MapPin size={14} className="mt-0.5 shrink-0 text-brand-saffron" />}
      <span className="line-clamp-2">{location}</span>
    </p>
  );
};

const VRSCardFooter = ({
  kind,
  price,
  priceUnit,
  actionLabel,
  onViewDetails,
}: Pick<VRSCardShellProps, 'kind' | 'price' | 'priceUnit' | 'actionLabel' | 'onViewDetails'>) => (
  <div className="mt-auto pt-4">
    <div>
      <VRSPrice kind={kind} price={price} unit={priceUnit} />
    </div>

    <button
      type="button"
      onClick={onViewDetails}
      className="vrs-card-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-body text-[14px] font-bold text-primary-foreground transition-colors duration-200 ease-out hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
    >
      {actionLabel}
      <ArrowRight size={15} />
    </button>
  </div>
);

const VRSCardShell = ({
  kind,
  gallery,
  active,
  badgeColor,
  name,
  location,
  typeLabel,
  context,
  rating,
  reviewCount,
  meta,
  amenities,
  price,
  priceUnit,
  actionLabel,
  imageRatio,
  cardMinHeight,
  isFavorite,
  onPauseChange,
  onToggleFavorite,
  onViewDetails,
}: VRSCardShellProps) => (
  <article
    className={`vrs-listing-card group flex min-w-0 self-start overflow-hidden rounded-2xl border border-border bg-white shadow-[0_4px_16px_rgba(16,24,44,0.06)] transition-all duration-200 ease-out hover:border-brand-gold/45 hover:shadow-[0_8px_24px_rgba(16,24,44,0.09)] ${cardMinHeight}`}
  >
    <div className="flex w-full flex-col">
      <VRSCardMedia
        active={active}
        badgeColor={badgeColor}
        gallery={gallery}
        imageRatio={imageRatio}
        isFavorite={isFavorite}
        name={name}
        onToggleFavorite={onToggleFavorite}
        typeLabel={typeLabel}
        onPauseChange={onPauseChange}
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
          {rating > 0 ? (
            <VRSRating rating={rating} reviewCount={reviewCount} />
          ) : (
            <span className="font-body text-[12px] font-semibold text-muted-foreground">{context}</span>
          )}
          {kind === 'room' && meta && <span className="font-body text-[12px] font-semibold text-muted-foreground">{meta}</span>}
        </div>

        <h3 className="line-clamp-2 font-body text-[17px] font-semibold leading-snug text-foreground">{name || 'Listing'}</h3>
        <VRSLocation kind={kind} location={location} />
        <VRSAmenities kind={kind} items={amenities} />
        <VRSCardFooter kind={kind} price={price} priceUnit={priceUnit} actionLabel={actionLabel} onViewDetails={onViewDetails} />
      </div>
    </div>
  </article>
);

type SpecializedCardProps = Omit<VRSCardShellProps, 'kind'>;

const VRSHotelCard = (props: SpecializedCardProps) => <VRSCardShell {...props} kind="hotel" />;
const VRSRoomCard = (props: SpecializedCardProps) => <VRSCardShell {...props} kind="room" />;
const VRSCabCard = (props: SpecializedCardProps) => <VRSCardShell {...props} kind="cab" />;
const VRSTourCard = (props: SpecializedCardProps) => <VRSCardShell {...props} kind="tour" />;
const VRSDefaultCard = (props: SpecializedCardProps) => <VRSCardShell {...props} kind="default" />;

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
  badgeColor,
  meta,
  amenities,
  isFavorite = false,
  onToggleFavorite,
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

  const kind = getCardKind(variant, ctaLabel, priceLabel);
  const copy = cardCopy[kind];
  const typeLabel = badge || copy.fallbackBadge;
  const visibleAmenities = (amenities || []).filter(Boolean).slice(0, kind === 'tour' ? 4 : 3);
  const imageRatio = kind === 'hotel' || kind === 'tour' ? 'aspect-[16/10]' : 'aspect-[16/9]';
  const cardMinHeight =
    kind === 'hotel'
      ? 'min-h-[410px]'
      : kind === 'tour'
        ? 'min-h-[400px]'
        : kind === 'cab'
          ? 'min-h-[330px]'
          : kind === 'room'
            ? 'min-h-[390px]'
            : 'min-h-[360px]';
  const actionLabel = kind === 'hotel' || kind === 'cab' || kind === 'tour' ? copy.cta : ctaLabel || copy.cta;
  const priceUnit = priceLabel || (kind === 'cab' ? 'per trip' : kind === 'tour' ? '/person' : '/night');

  const shellProps: SpecializedCardProps = {
    gallery: safeGallery,
    active,
    badgeColor,
    name,
    location,
    typeLabel,
    context: copy.context,
    rating,
    reviewCount,
    meta,
    amenities: visibleAmenities,
    price,
    priceUnit,
    actionLabel,
    imageRatio,
    cardMinHeight,
    isFavorite,
    onPauseChange: setPaused,
    onToggleFavorite,
    onViewDetails,
  };

  if (kind === 'hotel') return <VRSHotelCard {...shellProps} />;
  if (kind === 'room') return <VRSRoomCard {...shellProps} />;
  if (kind === 'cab') return <VRSCabCard {...shellProps} />;
  if (kind === 'tour') return <VRSTourCard {...shellProps} />;
  return <VRSDefaultCard {...shellProps} />;
};

export default ListingCard;
