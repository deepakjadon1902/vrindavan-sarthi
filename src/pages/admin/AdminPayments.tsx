import { useBookingStore } from '@/store/bookingStore';
import { useProductStore } from '@/store/productStore';
import { CreditCard, CheckCircle2, XCircle, Clock, IndianRupee, Eye } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const AdminPayments = () => {
  const { getAllBookings, verifyPayment, rejectPayment } = useBookingStore();
  const { getAllOrders, verifyOrderPayment, rejectOrderPayment } = useProductStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour' | 'product'>('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);

  const allBookings = getAllBookings().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const allOrders = getAllOrders().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  type UnifiedPayment = {
    id: string; type: string; itemName: string; userName: string; userPhone: string;
    amount: number; method: string; paymentStatus: string; partnerName?: string;
    upiTxnId?: string; date: string; source: 'booking' | 'order';
  };

  const unified: UnifiedPayment[] = [
    ...allBookings.map(b => ({
      id: b.id, type: b.bookingType, itemName: b.itemName, userName: b.userName, userPhone: b.userPhone,
      amount: b.totalAmount, method: b.paymentMethod, paymentStatus: b.paymentStatus,
      partnerName: b.partnerName, upiTxnId: b.upiTransactionId, date: b.createdAt, source: 'booking' as const,
    })),
    ...allOrders.map(o => ({
      id: o.id, type: 'product', itemName: o.productName, userName: o.userName, userPhone: o.userPhone,
      amount: o.totalAmount, method: 'online', paymentStatus: o.paymentStatus,
      upiTxnId: o.upiTransactionId, date: o.createdAt, source: 'order' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = unified
    .filter((p) => statusFilter === 'all' || p.paymentStatus === statusFilter)
    .filter((p) => typeFilter === 'all' || p.type === typeFilter);

  const totalRevenue = unified.filter(p => p.paymentStatus === 'paid').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = unified.filter(p => p.paymentStatus === 'pending').reduce((s, p) => s + p.amount, 0);

  const handleVerify = (p: UnifiedPayment) => {
    if (p.source === 'booking') verifyPayment(p.id);
    else verifyOrderPayment(p.id);
    toast.success('Payment verified & booking confirmed!');
  };

  const handleReject = (p: UnifiedPayment) => {
    if (p.source === 'booking') rejectPayment(p.id);
    else rejectOrderPayment(p.id);
    toast.error('Payment rejected & booking cancelled');
  };

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
            <div><p className="font-body text-xs text-muted-foreground">Total Revenue</p><p className="font-heading text-xl font-bold text-foreground">₹{totalRevenue.toLocaleString('en-IN')}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-saffron/10 flex items-center justify-center"><Clock size={20} className="text-brand-saffron" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Pending Payments</p><p className="font-heading text-xl font-bold text-foreground">₹{pendingAmount.toLocaleString('en-IN')}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><CreditCard size={20} className="text-brand-crimson" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Total Transactions</p><p className="font-heading text-xl font-bold text-foreground">{unified.length}</p></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'paid', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${statusFilter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? unified.length : unified.filter(p => p.paymentStatus === f).length})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', 'hotel', 'room', 'cab', 'tour', 'product'] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${typeFilter === t ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {selectedUpi && (
        <div className="bg-brand-cream border border-brand-gold/30 rounded-xl p-4 flex items-center justify-between">
          <div><p className="font-body text-xs text-muted-foreground">User's UPI Transaction ID</p><p className="font-heading text-lg font-bold text-foreground">{selectedUpi}</p></div>
          <button onClick={() => setSelectedUpi(null)} className="px-3 py-1 rounded-lg text-xs border border-border font-body hover:bg-muted">Close</button>
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">User</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">UPI Txn ID</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Partner</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-xs text-brand-crimson font-medium">{p.id}</td>
                  <td className="px-4 py-3"><span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize">{p.type}</span></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground max-w-[180px] truncate">{p.itemName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{p.userName}</td>
                  <td className="px-4 py-3 font-body text-sm font-semibold text-foreground">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {p.upiTxnId ? (
                      <button onClick={() => setSelectedUpi(p.upiTxnId!)} className="flex items-center gap-1 font-body text-xs text-brand-gold hover:underline">
                        <Eye size={12} /> {p.upiTxnId.slice(0, 8)}...
                      </button>
                    ) : <span className="font-body text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 font-body text-xs capitalize">{paymentIcon(p.paymentStatus)} {p.paymentStatus}</span></td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{p.partnerName || 'Admin'}</td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {p.paymentStatus === 'pending' ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleVerify(p)} className="px-2 py-1 rounded bg-brand-green/10 text-brand-green font-body text-[10px] hover:bg-brand-green/20 transition-colors">Verify</button>
                        <button onClick={() => handleReject(p)} className="px-2 py-1 rounded bg-destructive/10 text-destructive font-body text-[10px] hover:bg-destructive/20 transition-colors">Reject</button>
                      </div>
                    ) : <span className="font-body text-[10px] text-muted-foreground">—</span>}
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
