import { useAuthStore } from '@/store/authStore';
import { useBookingStore, Booking } from '@/store/bookingStore';
import { ClipboardList, Calendar, User, Phone, Mail } from 'lucide-react';
import { useState } from 'react';

const PartnerBookings = () => {
  const { user } = useAuthStore();
  const { getBookingsByPartner } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed'>('all');

  const bookings = getBookingsByPartner(user?.id || '').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.bookingStatus === filter);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'completed') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'confirmed', 'cancelled', 'completed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.bookingStatus === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Bookings Yet</p>
          <p className="font-body text-sm text-muted-foreground">Bookings for your listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-20 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {b.itemImage && b.itemImage !== '/placeholder.svg' ? <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ClipboardList size={16} className="text-muted-foreground" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-body text-xs text-muted-foreground">{b.id}</p>
                      <h3 className="font-heading text-lg font-semibold text-foreground">{b.itemName}</h3>
                      <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-secondary-foreground capitalize">{b.bookingType}</span>
                    </div>
                    <span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${statusColor(b.bookingStatus)}`}>{b.bookingStatus}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 font-body text-xs">
                    <div className="flex items-center gap-1"><User size={12} className="text-muted-foreground" /><span>{b.userName}</span></div>
                    <div className="flex items-center gap-1"><Phone size={12} className="text-muted-foreground" /><span>{b.userPhone}</span></div>
                    <div className="flex items-center gap-1"><Mail size={12} className="text-muted-foreground" /><span className="truncate">{b.userEmail}</span></div>
                    {b.checkIn && <div className="flex items-center gap-1"><Calendar size={12} className="text-muted-foreground" /><span>{new Date(b.checkIn).toLocaleDateString()}</span></div>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 font-body text-xs text-muted-foreground">
                    {b.totalAmount > 0 && <span className="font-semibold text-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</span>}
                    <span>{b.paymentMethod === 'doorstep' ? '💰 Pay at Doorstep' : `💳 ${b.paymentStatus}`}</span>
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerBookings;
