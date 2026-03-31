import { useState } from 'react';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';

import tour1 from '@/assets/images/tour-1.jpg';
import heroImg from '@/assets/images/hero-vrindavan.jpg';
import hotel2 from '@/assets/images/hotel-2.jpg';

const allTours = [
  { id: 1, name: 'Sacred Temples Trail', location: '7 Major Temples', price: 1499, rating: 4.8, reviewCount: 312, image: tour1, badge: '6 Hours', amenities: ['Guide', 'Transport', 'Lunch'] },
  { id: 2, name: 'Vrindavan Heritage Walk', location: 'Old Vrindavan', price: 799, rating: 4.6, reviewCount: 178, image: hotel2, badge: '3 Hours', amenities: ['Guide', 'Snacks'] },
  { id: 3, name: 'Mathura-Vrindavan Full Day', location: 'Mathura + Vrindavan', price: 2999, rating: 4.9, reviewCount: 445, image: heroImg, badge: 'Full Day', amenities: ['Guide', 'AC Cab', 'Meals'] },
  { id: 4, name: 'Evening Aarti Experience', location: 'Yamuna Ghat', price: 599, rating: 4.7, reviewCount: 289, image: tour1, badge: '2 Hours', amenities: ['Guide', 'Flowers'] },
  { id: 5, name: 'Holi Festival Special', location: 'Vrindavan & Barsana', price: 4999, rating: 5.0, reviewCount: 156, image: heroImg, badge: '2 Days', amenities: ['Guide', 'Stay', 'Meals', 'Colors'] },
];

const Tours = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const filtered = allTours.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.location.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((tour) => (
              <ListingCard key={tour.id} image={tour.image} name={tour.name} location={tour.location} price={tour.price} priceLabel="/person" rating={tour.rating} reviewCount={tour.reviewCount} badge={tour.badge} amenities={tour.amenities} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Tours;
