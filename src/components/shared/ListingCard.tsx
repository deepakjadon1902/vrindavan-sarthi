import { Star } from 'lucide-react';

interface ListingCardProps {
  image: string;
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
}

const ListingCard = ({
  image,
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
}: ListingCardProps) => {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border card-hover group">
      {/* Image */}
      <div className="relative h-52 overflow-hidden">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {badge && (
          <span
            className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-body font-semibold ${
              badgeColor === 'green'
                ? 'bg-brand-green text-primary-foreground'
                : 'bg-brand-saffron text-primary-foreground'
            }`}
          >
            {badge}
          </span>
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
