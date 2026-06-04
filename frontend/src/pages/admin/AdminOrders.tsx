import { useProductStore } from '@/store/productStore';
import { CheckCircle2, XCircle, Clock, IndianRupee, Eye, Package, Truck, ExternalLink, Link as LinkIcon, StickyNote } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const AdminOrders = () => {
  const {
    adminOrders,
    fetchAllOrders,
    verifyOrderPayment,
    rejectOrderPayment,
    updateOrderStatus,
    updateOrderTracking,
    isLoadingOrders,
  } = useProductStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingForm, setTrackingForm] = useState({
    orderStatus: 'processing' as 'pending' | 'processing' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled',
    courierName: '',
    awbNumber: '',
    trackingUrl: '',
    trackingNotes: '',
  });

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
  const trackingOrder = orders.find((order) => order.id === trackingOrderId);

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

  const statusOptions = useMemo(
    () =>
      [
        { value: 'pending', label: 'Pending' },
        { value: 'processing', label: 'Processing' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'packed', label: 'Packed' },
        { value: 'shipped', label: 'Order Shipped' },
        { value: 'delivered', label: 'Order Delivered' },
        { value: 'cancelled', label: 'Cancelled' },
      ] as const,
    []
  );

  const openTracking = (order: typeof orders[number]) => {
    setTrackingOrderId(order.id);
    setTrackingForm({
      orderStatus: order.orderStatus,
      courierName: order.courierName || '',
      awbNumber: order.awbNumber || '',
      trackingUrl: order.trackingUrl || '',
      trackingNotes: order.trackingNotes || '',
    });
  };

  const saveTracking = async () => {
    if (!trackingOrderId) return;
    if ((trackingForm.orderStatus === 'shipped' || trackingForm.orderStatus === 'delivered') && !trackingForm.awbNumber.trim()) {
      toast.error('AWB number is required after shipment');
      return;
    }
    const res = await updateOrderTracking(trackingOrderId, trackingForm);
    if (res.success) {
      toast.success('Tracking details updated');
      setTrackingOrderId(null);
    } else {
      toast.error(res.error || 'Tracking update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center"><IndianRupee size={20} className="text-brand-green" /></div>
            <div><p className="font-body text-xs text-muted-foreground">Product Revenue</p><p className="font-heading text-xl font-bold text-foreground">₹{totalRevenue.toLocaleString('en-IN')}</p></div>
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
        {(['all', 'pending', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const).map((f) => (
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

      {trackingOrder && (
        <div className="bg-card rounded-xl border border-brand-gold/40 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-brand-crimson" />
                <h2 className="font-heading text-lg font-bold text-foreground">Shipment Tracking</h2>
              </div>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {trackingOrder.orderId} / Track ID {trackingOrder.trackingId || 'not generated'} / {trackingOrder.userName}
              </p>
            </div>
            <button onClick={() => setTrackingOrderId(null)} className="self-start rounded-lg border border-border px-3 py-1.5 font-body text-xs hover:bg-muted">
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Order status</label>
              <select
                value={trackingForm.orderStatus}
                onChange={(e) => setTrackingForm((form) => ({ ...form, orderStatus: e.target.value as typeof statusOptions[number]['value'] }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Courier partner</label>
              <input
                value={trackingForm.courierName}
                onChange={(e) => setTrackingForm((form) => ({ ...form, courierName: e.target.value }))}
                placeholder="Blue Dart, Delhivery, India Post..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">AWB / docket number</label>
              <input
                value={trackingForm.awbNumber}
                onChange={(e) => setTrackingForm((form) => ({ ...form, awbNumber: e.target.value }))}
                placeholder="Enter AWB number"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Tracking link</label>
              <input
                value={trackingForm.trackingUrl}
                onChange={(e) => setTrackingForm((form) => ({ ...form, trackingUrl: e.target.value }))}
                placeholder="https://courier.example/track/..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
            <div className="lg:col-span-5">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Customer note</label>
              <textarea
                value={trackingForm.trackingNotes}
                onChange={(e) => setTrackingForm((form) => ({ ...form, trackingNotes: e.target.value }))}
                rows={3}
                placeholder="Short update visible on public tracking page"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveTracking} className="btn-gold rounded-xl px-5 py-2.5 text-sm">
              Save Tracking
            </button>
            {trackingForm.trackingUrl.trim() && (
              <a href={trackingForm.trackingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
                <ExternalLink size={13} /> Open link
              </a>
            )}
          </div>
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
                      <p className="font-body text-[10px] text-muted-foreground">
                        {o.orderId}{o.trackingId ? ` â€¢ Track: ${o.trackingId}` : ''} â€¢ {o.userName} â€¢ {o.userPhone}
                      </p>
                    </div>
                    <p className="font-heading text-lg font-bold text-brand-crimson flex-shrink-0">₹{o.totalAmount.toLocaleString('en-IN')}</p>
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
                  <div className="mt-3 grid gap-2 rounded-lg border border-border bg-background/70 p-3 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-brand-crimson" />
                      <div className="min-w-0">
                        <p className="font-body text-[10px] text-muted-foreground">Courier</p>
                        <p className="truncate font-body text-xs text-foreground">{o.courierName || 'Not assigned'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon size={14} className="text-brand-gold" />
                      <div className="min-w-0">
                        <p className="font-body text-[10px] text-muted-foreground">AWB</p>
                        <p className="truncate font-body text-xs text-foreground">{o.awbNumber || 'Pending'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StickyNote size={14} className="text-brand-saffron" />
                      <div className="min-w-0">
                        <p className="font-body text-[10px] text-muted-foreground">Latest note</p>
                        <p className="truncate font-body text-xs text-foreground">{o.trackingNotes || 'No update added'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {o.paymentStatus === 'pending' && (
                      <>
                        <button onClick={() => handleVerify(o.id)} className="px-3 py-1 rounded bg-brand-green/10 text-brand-green font-body text-xs hover:bg-brand-green/20">Verify Payment</button>
                        <button onClick={() => handleReject(o.id)} className="px-3 py-1 rounded bg-destructive/10 text-destructive font-body text-xs hover:bg-destructive/20">Reject</button>
                      </>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <span className="font-body text-[10px] text-muted-foreground">Shipping Status</span>
                      <select
                        value={o.orderStatus}
                        onChange={async (e) => {
                          const status = e.target.value as typeof statusOptions[number]['value'];
                          const r = await updateOrderStatus(o.id, status);
                          if (r.success) toast.success('Order status updated');
                          else toast.error(r.error || 'Update failed');
                        }}
                        className="px-3 py-1 rounded-lg border border-border bg-background font-body text-xs"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => openTracking(o)} className="flex items-center gap-1 rounded-lg bg-brand-crimson px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-brand-crimson/90">
                        <Truck size={13} /> Manage Shipping
                      </button>
                      {o.trackingUrl && (
                        <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open courier tracking link">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
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
