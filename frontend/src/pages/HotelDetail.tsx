import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, ShieldCheck, Star } from 'lucide-react';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';

type Hotel = {
  _id: string;
  name: string;
  location?: string;
  rating?: number;
  image?: string;
  images?: string[];
  description?: string;
  amenities?: string[];
  partnerName?: string;
  petsAllowed?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
};

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [hotel, setHotel] = useState<Hotel | null>(() => getPrefetchedDetail<Hotel>('hotels', id) || getCachedListingItem<Hotel>('hotels', id) || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/hotels/${id}`);
        setHotel(res.data?.data || null);
      } catch {
        setHotel(null);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id]);

  // Clean query params like checkIn/checkOut that may be deep-linked from legacy pages.
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    let changed = false;
    ['checkIn', 'checkOut', 'roomTypeId'].forEach((k) => {
      if (qs.has(k)) {
        qs.delete(k);
        changed = true;
      }
    });
    if (!changed) return;
    const next = qs.toString();
    navigate(`/hotels/${id}${next ? `?${next}` : ''}`, { replace: true });
  }, [id, location.search, navigate]);

  const allImages = useMemo(() => {
    if (!hotel) return [];
    return [hotel.image, ...(hotel.images || [])].filter(Boolean);
  }, [hotel]);

  if (!isLoading && !hotel) {
    return (
      <div className="pt-20 pb-16 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Hotel not found</p>
        <Link to="/hotels" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">
          Back to Hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <ImageCarousel images={allImages} alt={hotel?.name || 'Hotel'} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h1 className="font-heading text-2xl md:text-3xl font-semibold text-foreground leading-tight">
                {isLoading ? 'Loading…' : hotel?.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                  <MapPin size={15} className="text-brand-crimson" />
                  {hotel?.location || 'Vrindavan'}
                </span>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.floor(hotel?.rating || 0) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
                      />
                    ))}
                  </div>
                  <span className="font-body text-sm text-muted-foreground">
                    {hotel?.rating ? Number(hotel.rating).toFixed(1) : 'New'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-body text-foreground/80">
                  <ShieldCheck size={14} className="text-brand-green" />
                  Verified listing
                </span>
                {hotel?.petsAllowed && (
                  <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-body text-foreground/80">
                    Pets allowed
                  </span>
                )}
              </div>
            </div>

            {hotel?.description && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-heading text-base font-semibold text-foreground mb-2">About</h2>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
              </div>
            )}

            {Array.isArray(hotel?.amenities) && hotel.amenities.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-heading text-base font-semibold text-foreground mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a: string) => (
                    <span
                      key={a}
                      className="font-body text-xs bg-secondary px-2.5 py-1 rounded-full text-secondary-foreground border border-border"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-5 sticky top-24">
              <h2 className="font-heading text-base font-semibold text-foreground">Details</h2>

              <div className="mt-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-body text-sm text-muted-foreground">Location</p>
                  <p className="font-body text-sm text-foreground text-right">{hotel?.location || 'Vrindavan'}</p>
                </div>

                {hotel?.partnerName && (
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm text-muted-foreground">Listed by</p>
                    <p className="font-body text-sm text-foreground text-right">{hotel.partnerName}</p>
                  </div>
                )}

                {typeof hotel?.checkInTime === 'string' && hotel.checkInTime && (
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm text-muted-foreground">Check-in</p>
                    <p className="font-body text-sm text-foreground text-right">{hotel.checkInTime}</p>
                  </div>
                )}

                {typeof hotel?.checkOutTime === 'string' && hotel.checkOutTime && (
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm text-muted-foreground">Check-out</p>
                    <p className="font-body text-sm text-foreground text-right">{hotel.checkOutTime}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-border">
                <Link to="/rooms" className="w-full inline-flex items-center justify-center btn-gold px-4 py-2.5 rounded-lg text-sm font-body">
                  View Rooms
                </Link>
                <p className="mt-2 font-body text-xs text-muted-foreground text-center">
                  Booking is currently disabled for hotels. Details only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelDetail;
