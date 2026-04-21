import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';

const Rooms = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/rooms');
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setRooms(data.filter((r: any) => r?.status === 'available'));
      } catch {
        setRooms([]);
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

  const filtered = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.hotelName.toLowerCase().includes(searchQuery.toLowerCase())
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
          {rooms.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-heading text-2xl text-muted-foreground mb-2">No Rooms Listed Yet</p>
              <p className="font-body text-sm text-muted-foreground">Rooms will appear here once the admin adds them.</p>
            </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((room) => (
                <ListingCard key={room._id} image={room.image} images={room.images} name={room.name} location={room.hotelName} price={room.pricePerNight} priceLabel="/night" rating={0} reviewCount={0} amenities={room.amenities || []} onViewDetails={() => navigate(`/rooms/${room._id}`)} />
                ))}
              </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Rooms;
