import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import type { Booking } from '@/store/bookingStore';
import { CreditCard, CheckCircle2, XCircle, Clock, IndianRupee, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';

const PartnerPayments = () => {
  const { user } = useAuthStore();
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'room_type' | 'cab' | 'tour'>('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const bookings = [...partnerBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = bookings
    .filter((b) => statusFilter === 'all' || b.paymentStatus === statusFilter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);
  const { page, setPage, pageItems } = useRecordPagination(filtered, [statusFilter, typeFilter]);

  const getPrice = (b: Booking) => Number(b.checkoutSubtotal || b.totalAmount || 0);
  const getGross = (b: Booking) => Number(b.grossForHotel || (Number(b.baseAmount || 0) + Number(b.taxAmount || 0)) || getPrice(b));
  const getGatewayFee = (b: Booking) => Number(b.paymentGatewayFeeAmount || 0);
  const getCommissionAmount = (b: Booking) => Number(b.platformCommissionAmount || Math.round((getPrice(b) * Number(b.platformCommissionPercent || 0)) / 100));
  const getNetPayout = (b: Booking) => Number(b.partnerNetPayout ?? Math.max(0, getPrice(b) - getCommissionAmount(b)));
  const totalEarnings = bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + getNetPayout(b), 0);
  const pendingAmount = bookings.filter(b => b.paymentStatus === 'pending').reduce((s, b) => s + getNetPayout(b), 0);
  const payableBalance = bookings
    .filter((b) => b.paymentStatus === 'paid' && b.bookingStatus === 'checked_out' && b.payout_status !== 'settled')
    .reduce((s, b) => s + getNetPayout(b), 0);
  const payoutEligible = payableBalance >= 1000;

  const paymentIcon = (s: string) => {
    if (s === 'paid') return <CheckCircle2 size={14} className="text-brand-green" />;
    if (s === 'failed') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center"><IndianRupee size={20} className="text-brand-green" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Total Earnings</p><p className="font-heading text-xl font-bold text-foreground">₹{totalEarnings.toLocaleString('en-IN')}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-saffron/10 flex items-center justify-center"><Clock size={20} className="text-brand-saffron" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Pending</p><p className="font-heading text-xl font-bold text-foreground">₹{pendingAmount.toLocaleString('en-IN')}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><CreditCard size={20} className="text-brand-crimson" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Total Transactions</p><p className="font-heading text-xl font-bold text-foreground">{bookings.length}</p></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Payout Rule</p>
            <p className="font-heading text-lg font-semibold text-foreground">Bi-weekly payout cycles: Monday and Wednesday</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-2 text-right">
            <p className="font-body text-xs text-muted-foreground">Eligible checked-out balance</p>
            <p className="font-heading text-xl font-bold text-foreground">Rs. {payableBalance.toLocaleString('en-IN')}</p>
            <p className={`font-body text-xs font-semibold ${payoutEligible ? 'text-brand-green' : 'text-brand-saffron'}`}>
              {payoutEligible ? 'Eligible for next cycle' : 'Below Rs. 1,000 - rolls over'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'paid', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${statusFilter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? bookings.length : bookings.filter(b => b.paymentStatus === f).length})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', 'hotel', 'room', 'room_type', 'cab', 'tour'] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${typeFilter === t ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted text-muted-foreground'}`}>
            {t === 'room_type' ? 'room type' : t}
          </button>
        ))}
      </div>

      {selectedUpi && (
        <div className="bg-brand-cream border border-brand-gold/30 rounded-xl p-4 flex items-center justify-between">
          <div><p className="font-body text-xs text-muted-foreground">Payment Reference</p><p className="font-heading text-lg font-bold text-foreground">{selectedUpi}</p></div>
          <button onClick={() => setSelectedUpi(null)} className="px-3 py-1 rounded-lg text-xs border border-border font-body hover:bg-muted">Close</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CreditCard size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Payments</p>
          <p className="font-body text-sm text-muted-foreground">Payments for your listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body text-xs text-brand-crimson font-medium">{b.bookingId}</span>
                    <span className="font-body text-[10px] bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType}</span>
                  </div>
                  <p className="font-heading text-sm font-semibold text-foreground truncate">{b.itemName}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">{b.userName} • {b.userPhone}</p>
                  {(b.razorpayPaymentId || b.upiTransactionId) && (
                    <button onClick={() => setSelectedUpi((b.razorpayPaymentId || b.upiTransactionId)!)} className="flex items-center gap-1 font-body text-xs text-brand-gold hover:underline mt-1">
                      <Eye size={12} /> {b.razorpayPaymentId ? 'Razorpay' : 'UPI'} Ref: {(b.razorpayPaymentId || b.upiTransactionId || '').slice(0, 12)}...
                    </button>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-heading text-lg font-bold text-foreground">₹{getNetPayout(b).toLocaleString('en-IN')}</p>
                  <span className="flex items-center gap-1 font-body text-xs capitalize justify-end mt-1">
                    {paymentIcon(b.paymentStatus)} {b.paymentStatus}
                  </span>
                  <p className="font-body text-[10px] text-muted-foreground mt-1">
                    {b.paymentMethod === 'doorstep' ? 'Doorstep' : b.paymentProvider === 'razorpay' ? 'Razorpay' : 'Online'} - {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border border-brand-gold/20 bg-brand-cream/60 p-3 font-body text-xs">
                <div>
                  <span className="block text-muted-foreground">Gross Booking Amount</span>
                  <span className="font-semibold text-foreground">Rs. {getGross(b).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground">GST & Gateway Charges</span>
                  <span className="font-semibold text-destructive">- Rs. {(Number(b.taxAmount || 0) + getGatewayFee(b)).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Platform Commission ({Number(b.platformCommissionPercent || 0)}%)</span>
                  <span className="font-semibold text-destructive">- Rs. {getCommissionAmount(b).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Net Payable to Partner</span>
                  <span className="font-semibold text-brand-green">Rs. {getNetPayout(b).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
          <RecordPagination page={page} total={filtered.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};

export default PartnerPayments;

