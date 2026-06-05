import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';

type HotelListItem = {
  _id: string;
  name: string;
  location: string;
  rating: number;
  image: string;
  images?: string[];
  amenities?: string[];
  reviewCount?: number;
};

const Hotels = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hotels, setHotels] = useState<HotelListItem[]>([]);

  useEffect(() => {
    const load = async () => {
      // Show cached list instantly (if present) for perceived speed, then revalidate from API.
      try {
        const cached = localStorage.getItem('vvs_hotels');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setHotels(parsed);
        }
      } catch {
        // ignore
      }
      try {
        const res = await api.get('/hotels');
        const data = Array.isArray(res.data?.data) ? (res.data.data as HotelListItem[]) : [];
        setHotels(data);
        try {
          localStorage.setItem('vvs_hotels', JSON.stringify(data));
        } catch {
          // ignore
        }
      } catch {
        setHotels([]);
      }
    };

    void load();
    const unsub = subscribeAppEvent('listing:changed', () => void load());
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      unsub();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const filtered = hotels.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const removeHotelFromCache = (hotelId: string) => {
    setHotels((prev) => {
      const next = prev.filter((hotel) => hotel._id !== hotelId);
      try {
        localStorage.setItem('vvs_hotels', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openHotel = async (hotel: HotelListItem) => {
    prefetchDetail('hotels', hotel._id, hotel);
    try {
      const res = await api.get(`/hotels/${hotel._id}`);
      const freshHotel = res.data?.data || hotel;
      prefetchDetail('hotels', hotel._id, freshHotel);
      navigate(`/hotels/${hotel._id}`);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        removeHotelFromCache(hotel._id);
        toast.error('This hotel is no longer available. The list has been refreshed.');
        return;
      }
      navigate(`/hotels/${hotel._id}`);
    }
  };

  return (
    <div className="pt-20">
      <section className="section-cream py-10 lg:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle label="Stays in Vrindavan" title="Find Your Perfect Hotel" subtitle="Comfortable, verified stays near the most sacred sites" />
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input type="text" placeholder="Search hotels by name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 lg:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          {hotels.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Hotels Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Hotels will appear here once the admin adds them from the admin panel.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="font-body text-muted-foreground text-sm">{filtered.length} hotels found</p>
                <select className="font-body text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
                  <option>Sort by: Recommended</option>
                  <option>Rating: High to Low</option>
                </select>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filtered.map((hotel) => (
                  <ListingCard
                    key={hotel._id}
                    variant="hotel"
                    image={hotel.image}
                    images={hotel.images}
                    name={hotel.name}
                    location={hotel.location}
                    rating={hotel.rating}
                    reviewCount={hotel.reviewCount || 0}
                    amenities={hotel.amenities || []}
                    onViewDetails={() => void openHotel(hotel)}
                  />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-20">
                  <p className="font-heading text-2xl text-muted-foreground">No hotels found</p>
                  <p className="font-body text-sm text-muted-foreground mt-2">Try a different search term</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Hotels;
