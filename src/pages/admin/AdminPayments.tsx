import { useBookingStore, Booking } from '@/store/bookingStore';
import { CreditCard, CheckCircle2, XCircle, Clock, IndianRupee, Filter } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const AdminPayments = () => {
  const { getAllBookings, bookings } = useBookingStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour'>('all');

  const allBookings = getAllBookings().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = allBookings
    .filter((b) => statusFilter === 'all' || b.paymentStatus === statusFilter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);

  const totalRevenue = allBookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0);
  const pendingAmount = allBookings.filter(b => b.paymentStatus === 'pending').reduce((s, b) => s + b.totalAmount, 0);

  const handleVerify = (id: string) => {
    const store = useBookingStore.getState();
    const updated = store.bookings.map(b => b.id === id ? { ...b, paymentStatus: 'paid' as const } : b);
    useBookingStore.setState({ bookings: updated });
    toast.success('Payment verified successfully');
  };

  const handleReject = (id: string) => {
    const store = useBookingStore.getState();
    const updated = store.bookings.map(b => b.id === id ? { ...b, paymentStatus: 'failed' as const } : b);
    useBookingStore.setState({ bookings: updated });
    toast.error('Payment marked as failed');
  };

  const paymentIcon = (s: string) => {
    if (s === 'paid') return <CheckCircle2 size={14} className="text-brand-green" />;
    if (s === 'failed') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center"><IndianRupee size={20} className="text-brand-green" /></div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Total Revenue</p>
              <p className="font-heading text-xl font-bold text-foreground">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-saffron/10 flex items-center justify-center"><Clock size={20} className="text-brand-saffron" /></div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Pending Payments</p>
              <p className="font-heading text-xl font-bold text-foreground">₹{pendingAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><CreditCard size={20} className="text-brand-crimson" /></div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Total Transactions</p>
              <p className="font-heading text-xl font-bold text-foreground">{allBookings.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'paid', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${statusFilter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? allBookings.length : allBookings.filter(b => b.paymentStatus === f).length})
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CreditCard size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Payments</p>
          <p className="font-body text-sm text-muted-foreground">Payment records will appear here.</p>
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
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Partner</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-xs text-brand-crimson font-medium">{b.id}</td>
                  <td className="px-4 py-3"><span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType}</span></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground max-w-[180px] truncate">{b.itemName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{b.userName}</td>
                  <td className="px-4 py-3 font-body text-sm font-semibold text-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-body text-xs capitalize">{b.paymentMethod === 'doorstep' ? '💰 Doorstep' : '💳 Online'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 font-body text-xs capitalize">
                      {paymentIcon(b.paymentStatus)} {b.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{b.partnerName || 'Admin'}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {b.paymentStatus === 'pending' ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleVerify(b.id)} className="px-2 py-1 rounded bg-brand-green/10 text-brand-green font-body text-[10px] hover:bg-brand-green/20 transition-colors">Verify</button>
                        <button onClick={() => handleReject(b.id)} className="px-2 py-1 rounded bg-destructive/10 text-destructive font-body text-[10px] hover:bg-destructive/20 transition-colors">Reject</button>
                      </div>
                    ) : (
                      <span className="font-body text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
