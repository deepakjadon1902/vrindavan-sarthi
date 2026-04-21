import { Hotel, BedDouble, Car, Map, ClipboardList, Clock, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, withAuth } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';

const PartnerDashboard = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<{ hotels: any[]; rooms: any[]; cabs: any[]; tours: any[] }>({
    hotels: [],
    rooms: [],
    cabs: [],
    tours: [],
  });

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/partner/my-listings', withAuth(token));
        const data = res.data?.data || {};
        setListings({
          hotels: Array.isArray(data.hotels) ? data.hotels : [],
          rooms: Array.isArray(data.rooms) ? data.rooms : [],
          cabs: Array.isArray(data.cabs) ? data.cabs : [],
          tours: Array.isArray(data.tours) ? data.tours : [],
        });
      } finally {
        setIsLoading(false);
      }
    };
    void run();

    const unsub = subscribeAppEvent('listing:changed', () => void run());
    return unsub;
  }, [token]);

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const allItems = useMemo(
    () => [...listings.hotels, ...listings.rooms, ...listings.cabs, ...listings.tours],
    [listings]
  );

  const pending = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
  const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;

  return (
    <div className="space-y-8">
      <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-6">
        <h2 className="font-heading text-xl font-semibold text-foreground">Welcome, {user?.name} 🙏</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {user?.businessName ? `Business: ${user.businessName}` : 'Manage your listings from here'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Hotels</span>
            <Hotel size={18} className="text-brand-gold" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{listings.hotels.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Rooms</span>
            <BedDouble size={18} className="text-brand-saffron" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{listings.rooms.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Cabs</span>
            <Car size={18} className="text-brand-green" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{listings.cabs.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Tours</span>
            <Map size={18} className="text-brand-crimson" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{listings.tours.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Pending</span>
            <Clock size={18} className="text-brand-saffron" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{pending}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-xs text-muted-foreground">Bookings</span>
            <ClipboardList size={18} className="text-brand-gold" />
          </div>
          <p className="font-heading text-2xl font-bold text-foreground">{partnerBookings.length}</p>
        </div>
      </div>

      {isLoading && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="font-body text-xs text-muted-foreground">Refreshing listings…</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/partner/hotels" className="bg-card rounded-xl p-6 border border-border card-hover text-center">
          <Hotel size={32} className="mx-auto mb-2 text-brand-gold" />
          <p className="font-heading text-sm font-semibold text-foreground">Add Hotel</p>
        </Link>
        <Link to="/partner/rooms" className="bg-card rounded-xl p-6 border border-border card-hover text-center">
          <BedDouble size={32} className="mx-auto mb-2 text-brand-saffron" />
          <p className="font-heading text-sm font-semibold text-foreground">Add Room</p>
        </Link>
        <Link to="/partner/cabs" className="bg-card rounded-xl p-6 border border-border card-hover text-center">
          <Car size={32} className="mx-auto mb-2 text-brand-green" />
          <p className="font-heading text-sm font-semibold text-foreground">Add Cab</p>
        </Link>
        <Link to="/partner/tours" className="bg-card rounded-xl p-6 border border-border card-hover text-center">
          <Map size={32} className="mx-auto mb-2 text-brand-crimson" />
          <p className="font-heading text-sm font-semibold text-foreground">Add Tour</p>
        </Link>
      </div>

      {rejected > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={20} className="text-destructive mt-0.5" />
          <div>
            <p className="font-body text-sm font-medium text-foreground">{rejected} listing(s) rejected</p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Check your listings page for details and resubmit after making changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
