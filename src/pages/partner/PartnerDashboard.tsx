import { Hotel, BedDouble, ClipboardList, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';

const HOTELS_KEY = 'vvs_partner_hotels';
const ROOMS_KEY = 'vvs_partner_rooms';

const PartnerDashboard = () => {
  const { user } = useAuthStore();

  const getItems = (key: string) => {
    try {
      const d = localStorage.getItem(key);
      const all = d ? JSON.parse(d) : [];
      return all.filter((i: any) => i.partnerId === user?.id);
    } catch { return []; }
  };

  const hotels = getItems(HOTELS_KEY);
  const rooms = getItems(ROOMS_KEY);
  const allItems = [...hotels.map((h: any) => ({ ...h, itemType: 'hotel' })), ...rooms.map((r: any) => ({ ...r, itemType: 'room' }))];

  const pending = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
  const approved = allItems.filter((i: any) => i.approvalStatus === 'approved').length;
  const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;

  return (
    <div className="space-y-8">
      <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-6">
        <h2 className="font-heading text-xl font-semibold text-foreground">Welcome, {user?.name} 🙏</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {user?.businessName ? `Business: ${user.businessName}` : 'Manage your hotels and rooms from here'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-body text-sm text-muted-foreground">Total Hotels</span>
            <Hotel size={20} className="text-brand-gold" />
          </div>
          <p className="font-heading text-3xl font-bold text-foreground">{hotels.length}</p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-body text-sm text-muted-foreground">Total Rooms</span>
            <BedDouble size={20} className="text-brand-saffron" />
          </div>
          <p className="font-heading text-3xl font-bold text-foreground">{rooms.length}</p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-body text-sm text-muted-foreground">Pending Approval</span>
            <Clock size={20} className="text-brand-saffron" />
          </div>
          <p className="font-heading text-3xl font-bold text-foreground">{pending}</p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-body text-sm text-muted-foreground">Approved</span>
            <CheckCircle size={20} className="text-brand-green" />
          </div>
          <p className="font-heading text-3xl font-bold text-foreground">{approved}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/partner/hotels" className="bg-card rounded-xl p-8 border border-border card-hover text-center">
          <Hotel size={36} className="mx-auto mb-3 text-brand-gold" />
          <p className="font-heading text-lg font-semibold text-foreground">Add Hotel</p>
          <p className="font-body text-xs text-muted-foreground mt-1">List your hotel on VrindavanSarthi</p>
        </Link>
        <Link to="/partner/rooms" className="bg-card rounded-xl p-8 border border-border card-hover text-center">
          <BedDouble size={36} className="mx-auto mb-3 text-brand-gold" />
          <p className="font-heading text-lg font-semibold text-foreground">Add Room</p>
          <p className="font-body text-xs text-muted-foreground mt-1">Add rooms for your listed hotels</p>
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
