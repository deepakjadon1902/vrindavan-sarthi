import { useState } from 'react';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';

import hotel2 from '@/assets/images/hotel-2.jpg';

const allCabs = [
  { id: 1, name: 'Toyota Innova Crysta', location: 'Vrindavan ↔ Mathura', price: 1200, rating: 4.6, reviewCount: 178, image: hotel2, amenities: ['AC', '7 Seater', 'Music'], badge: '💰 Pay at Doorstep', priceLabel: '/trip' },
  { id: 2, name: 'Maruti Dzire', location: 'Vrindavan Local', price: 600, rating: 4.3, reviewCount: 312, image: hotel2, amenities: ['AC', '4 Seater'], badge: '💰 Pay at Doorstep', priceLabel: '/trip' },
  { id: 3, name: 'Tempo Traveller', location: 'Vrindavan ↔ Delhi', price: 5500, rating: 4.5, reviewCount: 89, image: hotel2, amenities: ['AC', '12 Seater', 'USB Charging'], badge: '💰 Pay at Doorstep', priceLabel: '/trip' },
  { id: 4, name: 'Auto Rickshaw', location: 'Vrindavan Local', price: 150, rating: 4.1, reviewCount: 567, image: hotel2, amenities: ['3 Seater'], badge: '💰 Pay at Doorstep', priceLabel: '/trip' },
];

const Cabs = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const filtered = allCabs.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle label="Transportation" title="Book a Cab in Vrindavan" subtitle="Reliable local and outstation cab services" />
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Search cabs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
          </div>
        </div>
      </section>

      {/* Cab fare policy banner */}
      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-6 text-center">
            <p className="font-heading text-xl font-semibold text-foreground mb-2">🚗 Cab Fare Policy</p>
            <p className="font-body text-sm text-muted-foreground">Fare is decided by the driver based on your destination and distance.</p>
            <p className="font-body text-sm text-muted-foreground mt-1">💳 Payment is made directly to the driver at your destination. No online payment required.</p>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((cab) => (
              <ListingCard key={cab.id} image={cab.image} name={cab.name} location={cab.location} price={cab.price} priceLabel={cab.priceLabel} rating={cab.rating} reviewCount={cab.reviewCount} amenities={cab.amenities} badge={cab.badge} badgeColor="green" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Cabs;
