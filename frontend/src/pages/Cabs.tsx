import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';

const Cabs = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [cabs, setCabs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/cabs');
        setCabs(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setCabs([]);
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

  const filtered = cabs.filter(
    (c) =>
      c.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.driverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Transportation"
            title="Book a Cab in Vrindavan"
            subtitle="Reliable local and outstation cab services"
          />
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search cabs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
            />
          </div>
        </div>
      </section>

      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-6 text-center">
            <p className="font-heading text-xl font-semibold text-foreground mb-2">🚗 Cab Fare Policy</p>
            <p className="font-body text-sm text-muted-foreground">
              Fare is decided by the driver based on your destination and distance.
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              💳 Payment is made directly to the driver at your destination. No online payment required.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {cabs.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Cabs Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Cabs will appear here once listed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' • ') || ''}
                  price={0}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, `${cab.capacity} Seater`]}
                  badge="💰 Pay at Doorstep"
                  badgeColor="green"
                  onViewDetails={() => navigate(`/cabs/${cab._id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Cabs;
