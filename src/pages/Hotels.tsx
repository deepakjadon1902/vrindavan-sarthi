import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';

import hotel1 from '@/assets/images/hotel-1.jpg';
import hotel2 from '@/assets/images/hotel-2.jpg';
import hotel3 from '@/assets/images/hotel-3.jpg';

const allHotels = [
  { id: 1, name: 'Krishna Palace Heritage', location: 'Near Banke Bihari Temple', price: 2499, rating: 4.5, reviewCount: 128, image: hotel1, amenities: ['AC', 'WiFi', 'Parking'] },
  { id: 2, name: 'Radha Garden Resort', location: 'Parikrama Marg', price: 1899, rating: 4.2, reviewCount: 89, image: hotel2, amenities: ['AC', 'Restaurant', 'Garden'] },
  { id: 3, name: 'Govind Niwas Inn', location: 'Near ISKCON Temple', price: 999, rating: 4.0, reviewCount: 214, image: hotel3, amenities: ['WiFi', 'Hot Water', 'TV'] },
  { id: 4, name: 'Yamuna View Hotel', location: 'Yamuna Bank Road', price: 3199, rating: 4.7, reviewCount: 67, image: hotel1, amenities: ['AC', 'Pool', 'Spa'] },
  { id: 5, name: 'Vrinda Bhavan Guest House', location: 'Loi Bazaar', price: 699, rating: 3.8, reviewCount: 345, image: hotel3, amenities: ['Fan', 'Hot Water'] },
  { id: 6, name: 'Shyam Residency', location: 'Near Prem Mandir', price: 1599, rating: 4.3, reviewCount: 156, image: hotel2, amenities: ['AC', 'WiFi', 'Temple View'] },
];

const Hotels = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = allHotels.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-20">
      {/* Header */}
      <section className="section-cream py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Stays in Vrindavan"
            title="Find Your Perfect Hotel"
            subtitle="Comfortable, verified stays near the most sacred sites"
          />
          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search hotels by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold"
            />
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
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
              <ListingCard
                key={hotel.id}
                image={hotel.image}
                name={hotel.name}
                location={hotel.location}
                price={hotel.price}
                rating={hotel.rating}
                reviewCount={hotel.reviewCount}
                amenities={hotel.amenities}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground">No hotels found</p>
              <p className="font-body text-sm text-muted-foreground mt-2">Try a different search term</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Hotels;
