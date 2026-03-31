import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';

const Tours = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tours, setTours] = useState<any[]>([]);

  useEffect(() => {
    try {
      const data = localStorage.getItem('vvs_tours');
      if (data) setTours(JSON.parse(data).filter((t: any) => t.status === 'active'));
    } catch {}
  }, []);

  const filtered = tours.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle label="Spiritual Journeys" title="Explore Tour Packages" subtitle="Guided tours to experience the divine essence of Vrindavan" />
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Search tours..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
          </div>
        </div>
      </section>
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {tours.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Tours Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Tour packages will appear here once the admin adds them.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((tour) => (
                <ListingCard key={tour.id} image={tour.image} name={tour.name} location={tour.duration} price={tour.pricePerPerson} priceLabel="/person" rating={0} reviewCount={0} badge={tour.duration} amenities={tour.includes || []} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Tours;
