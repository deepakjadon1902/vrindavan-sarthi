import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';

const Hotels = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hotels, setHotels] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/hotels');
        setHotels(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setHotels([]);
      }
    };
    void run();
  }, []);

  const filtered = hotels.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle label="Stays in Vrindavan" title="Find Your Perfect Hotel" subtitle="Comfortable, verified stays near the most sacred sites" />
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Search hotels by name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {hotels.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Hotels Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Hotels will appear here once the admin adds them from the admin panel.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <p className="font-body text-muted-foreground text-sm">{filtered.length} hotels found</p>
                <select className="font-body text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
                  <option>Sort by: Recommended</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Rating: High to Low</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((hotel) => (
                  <ListingCard key={hotel._id} image={hotel.image} images={hotel.images} name={hotel.name} location={hotel.location} price={hotel.pricePerNight} rating={hotel.rating} reviewCount={0} amenities={hotel.amenities || []} onViewDetails={() => navigate(`/hotels/${hotel._id}`)} />
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
