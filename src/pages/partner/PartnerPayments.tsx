import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { CreditCard, CheckCircle2, XCircle, Clock, IndianRupee } from 'lucide-react';
import { useState } from 'react';

const PartnerPayments = () => {
  const { user } = useAuthStore();
  const { getBookingsByPartner } = useBookingStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour'>('all');

  const bookings = getBookingsByPartner(user?.id || '').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = bookings
    .filter((b) => statusFilter === 'all' || b.paymentStatus === statusFilter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);

  const totalEarnings = bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0);
  const pendingAmount = bookings.filter(b => b.paymentStatus === 'pending').reduce((s, b) => s + b.totalAmount, 0);

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
              <p className="font-body text-xs text-muted-foreground">Total Earnings</p>
              <p className="font-heading text-xl font-bold text-foreground">₹{totalEarnings.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-saffron/10 flex items-center justify-center"><Clock size={20} className="text-brand-saffron" /></div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Pending</p>
              <p className="font-heading text-xl font-bold text-foreground">₹{pendingAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><CreditCard size={20} className="text-brand-crimson" /></div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Total Transactions</p>
              <p className="font-heading text-xl font-bold text-foreground">{bookings.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'paid', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${statusFilter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? bookings.length : bookings.filter(b => b.paymentStatus === f).length})
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

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CreditCard size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Payments</p>
          <p className="font-body text-sm text-muted-foreground">Payments for your listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body text-xs text-brand-crimson font-medium">{b.id}</span>
                    <span className="font-body text-[10px] bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType}</span>
                  </div>
                  <p className="font-heading text-sm font-semibold text-foreground truncate">{b.itemName}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">{b.userName} • {b.userPhone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-heading text-lg font-bold text-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</p>
                  <span className="flex items-center gap-1 font-body text-xs capitalize justify-end mt-1">
                    {paymentIcon(b.paymentStatus)} {b.paymentStatus}
                  </span>
                  <p className="font-body text-[10px] text-muted-foreground mt-1">
                    {b.paymentMethod === 'doorstep' ? '💰 Doorstep' : '💳 Online'} • {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerPayments;
