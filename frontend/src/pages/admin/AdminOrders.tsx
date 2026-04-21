import { useProductStore } from '@/store/productStore';
import { CreditCard, CheckCircle2, XCircle, Clock, IndianRupee, Eye, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const AdminOrders = () => {
  const {
    adminOrders,
    fetchAllOrders,
    verifyOrderPayment,
    rejectOrderPayment,
    updateOrderStatus,
    isLoadingOrders,
  } = useProductStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);

  useEffect(() => {
    fetchAllOrders();
  }, [fetchAllOrders]);

  const orders = useMemo(
    () => [...adminOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [adminOrders]
  );

  const filtered = useMemo(
    () => orders.filter((o) => statusFilter === 'all' || o.orderStatus === statusFilter),
    [orders, statusFilter]
  );

  const totalRevenue = orders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalAmount, 0);

  const handleVerify = async (id: string) => {
    const res = await verifyOrderPayment(id);
    if (res.success) toast.success('Payment verified, order confirmed!');
    else toast.error(res.error || 'Verify failed');
  };

  const handleReject = async (id: string) => {
    const res = await rejectOrderPayment(id);
    if (res.success) toast.error('Payment rejected, order cancelled');
    else toast.error(res.error || 'Reject failed');
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
            <div><p className="font-body text-xs text-muted-foreground">Product Revenue</p><p className="font-heading text-xl font-bold text-foreground">â‚¹{totalRevenue.toLocaleString('en-IN')}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-saffron/10 flex items-center justify-center"><Package size={20} className="text-brand-saffron" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Total Orders</p><p className="font-heading text-xl font-bold text-foreground">{orders.length}</p></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><Clock size={20} className="text-brand-crimson" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Pending</p><p className="font-heading text-xl font-bold text-foreground">{orders.filter((o) => o.orderStatus === 'pending').length}</p></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${statusFilter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? orders.length : orders.filter((o) => o.orderStatus === f).length})
          </button>
        ))}
      </div>

      {selectedUpi && (
        <div className="bg-brand-cream border border-brand-gold/30 rounded-xl p-4 flex items-center justify-between">
          <div><p className="font-body text-xs text-muted-foreground">UPI Transaction ID</p><p className="font-heading text-lg font-bold text-foreground">{selectedUpi}</p></div>
          <button onClick={() => setSelectedUpi(null)} className="px-3 py-1 rounded-lg text-xs border border-border font-body hover:bg-muted">Close</button>
        </div>
      )}

      {isLoadingOrders ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">Loading Orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Orders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={o.productImage || '/placeholder.svg'} alt={o.productName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">{o.productName}</p>
                      <p className="font-body text-[10px] text-muted-foreground">{o.orderId} â€¢ {o.userName} â€¢ {o.userPhone}</p>
                    </div>
                    <p className="font-heading text-lg font-bold text-brand-crimson flex-shrink-0">â‚¹{o.totalAmount.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 font-body text-xs">{paymentIcon(o.paymentStatus)} {o.paymentStatus}</span>
                    {o.upiTransactionId && (
                      <button onClick={() => setSelectedUpi(o.upiTransactionId!)} className="flex items-center gap-1 font-body text-xs text-brand-gold hover:underline">
                        <Eye size={12} /> UPI: {o.upiTransactionId.slice(0, 10)}...
                      </button>
                    )}
                    <span className="font-body text-[10px] text-muted-foreground">Qty: {o.quantity} â€¢ ðŸ“¦ {o.shippingAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {o.paymentStatus === 'pending' && (
                      <>
                        <button onClick={() => handleVerify(o.id)} className="px-3 py-1 rounded bg-brand-green/10 text-brand-green font-body text-xs hover:bg-brand-green/20">Verify Payment</button>
                        <button onClick={() => handleReject(o.id)} className="px-3 py-1 rounded bg-destructive/10 text-destructive font-body text-xs hover:bg-destructive/20">Reject</button>
                      </>
                    )}
                    {o.orderStatus === 'confirmed' && (
                      <button onClick={async () => { const r = await updateOrderStatus(o.id, 'shipped'); if (r.success) toast.success('Marked as shipped'); else toast.error(r.error || 'Update failed'); }} className="px-3 py-1 rounded bg-brand-gold/10 text-brand-gold font-body text-xs hover:bg-brand-gold/20">Mark Shipped</button>
                    )}
                    {o.orderStatus === 'shipped' && (
                      <button onClick={async () => { const r = await updateOrderStatus(o.id, 'delivered'); if (r.success) toast.success('Marked as delivered'); else toast.error(r.error || 'Update failed'); }} className="px-3 py-1 rounded bg-brand-green/10 text-brand-green font-body text-xs hover:bg-brand-green/20">Mark Delivered</button>
                    )}
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

export default AdminOrders;

