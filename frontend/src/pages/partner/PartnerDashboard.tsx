import { Hotel, BedDouble, Car, Map, ClipboardList, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';

const HOTELS_KEY = 'vvs_partner_hotels';
const ROOMS_KEY = 'vvs_partner_rooms';
const CABS_KEY = 'vvs_partner_cabs';
const TOURS_KEY = 'vvs_partner_tours';

const PartnerDashboard = () => {
  const { user } = useAuthStore();
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();

  const getItems = (key: string) => {
    try {
      const d = localStorage.getItem(key);
      const all = d ? JSON.parse(d) : [];
      return all.filter((i: any) => i.partnerId === user?.id);
    } catch { return []; }
  };

  const hotels = getItems(HOTELS_KEY);
  const rooms = getItems(ROOMS_KEY);
  const cabs = getItems(CABS_KEY);
  const tours = getItems(TOURS_KEY);
  const allItems = [
    ...hotels.map((h: any) => ({ ...h, itemType: 'hotel' })),
    ...rooms.map((r: any) => ({ ...r, itemType: 'room' })),
    ...cabs.map((c: any) => ({ ...c, itemType: 'cab' })),
    ...tours.map((t: any) => ({ ...t, itemType: 'tour' })),
  ];

  const pending = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
  const approved = allItems.filter((i: any) => i.approvalStatus === 'approved').length;
  const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const bookings = partnerBookings;

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
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Hotels</span><Hotel size={18} className="text-brand-gold" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{hotels.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Rooms</span><BedDouble size={18} className="text-brand-saffron" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{rooms.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Cabs</span><Car size={18} className="text-brand-green" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{cabs.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Tours</span><Map size={18} className="text-brand-crimson" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{tours.length}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Pending</span><Clock size={18} className="text-brand-saffron" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{pending}</p>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-2"><span className="font-body text-xs text-muted-foreground">Bookings</span><ClipboardList size={18} className="text-brand-gold" /></div>
          <p className="font-heading text-2xl font-bold text-foreground">{bookings.length}</p>
        </div>
      </div>

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
            <p className="font-body text-xs text-muted-foreground mt-1">Check your listings page for details and resubmit after making changes.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
