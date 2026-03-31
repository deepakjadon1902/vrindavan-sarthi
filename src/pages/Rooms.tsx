import { useState } from 'react';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';

import hotel1 from '@/assets/images/hotel-1.jpg';
import hotel3 from '@/assets/images/hotel-3.jpg';

const allRooms = [
  { id: 1, name: 'Deluxe AC Room', location: 'Krishna Palace Heritage', price: 1299, rating: 4.4, reviewCount: 98, image: hotel1, amenities: ['AC', 'TV', 'Attached Bath'], priceLabel: '/night' },
  { id: 2, name: 'Standard Non-AC Room', location: 'Govind Niwas Inn', price: 499, rating: 3.9, reviewCount: 212, image: hotel3, amenities: ['Fan', 'Hot Water'], priceLabel: '/bed' },
  { id: 3, name: 'Premium Suite', location: 'Radha Garden Resort', price: 3499, rating: 4.8, reviewCount: 45, image: hotel1, amenities: ['AC', 'Balcony', 'Temple View'], priceLabel: '/night' },
  { id: 4, name: 'Dormitory Bed', location: 'Vrinda Bhavan', price: 299, rating: 3.7, reviewCount: 378, image: hotel3, amenities: ['Fan', 'Locker'], priceLabel: '/bed' },
];

const Rooms = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const filtered = allRooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle label="Room Options" title="Browse Available Rooms" subtitle="From budget beds to premium suites — find your comfort" />
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Search rooms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold" />
          </div>
        </div>
      </section>
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((room) => (
              <ListingCard key={room.id} image={room.image} name={room.name} location={room.location} price={room.price} priceLabel={room.priceLabel} rating={room.rating} reviewCount={room.reviewCount} amenities={room.amenities} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Rooms;
