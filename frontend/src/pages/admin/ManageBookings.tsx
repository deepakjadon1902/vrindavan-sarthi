import { useBookingStore } from '@/store/bookingStore';
import { ClipboardList, Calendar, User, Phone, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';

const ManageBookings = () => {
  const { adminBookings, fetchAllBookings, isLoading } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour'>('all');

  useEffect(() => {
    void fetchAllBookings();
  }, [fetchAllBookings]);

  const bookings = [...adminBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = bookings
    .filter((b) => filter === 'all' || b.bookingStatus === filter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'completed') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['all', 'confirmed', 'cancelled', 'completed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.bookingStatus === f).length})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'hotel', 'room', 'cab', 'tour'] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${typeFilter === t ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading bookingsâ€¦</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Bookings</p>
          <p className="font-body text-sm text-muted-foreground">Bookings will appear here when users make reservations.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Booking ID</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">User</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Payment</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Partner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-xs text-brand-crimson font-medium">{b.bookingId}</td>
                  <td className="px-4 py-3"><span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType}</span></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground max-w-[200px] truncate">{b.itemName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{b.userName}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">{b.userPhone}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{b.totalAmount > 0 ? `₹${b.totalAmount.toLocaleString('en-IN')}` : 'Doorstep'}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell capitalize">{b.paymentMethod === 'doorstep' ? '💰 Doorstep' : `💳 ${b.paymentStatus}`}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${statusColor(b.bookingStatus)}`}>{b.bookingStatus}</span></td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{b.partnerName || 'Admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManageBookings;
