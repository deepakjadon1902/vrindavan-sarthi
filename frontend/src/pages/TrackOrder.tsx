import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PackageSearch, Clock, CheckCircle2, XCircle, Truck, ExternalLink, PackageCheck } from 'lucide-react';
import { useProductStore, type Order } from '@/store/productStore';
import { toast } from 'sonner';

const statusSteps: Array<{ value: Order['orderStatus']; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

const statusRank: Record<Order['orderStatus'], number> = {
  pending: 0,
  processing: 1,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Pending';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const TrackOrder = () => {
  const location = useLocation();
  const { trackedOrder, isLoadingTrackedOrder, trackOrderById } = useProductStore();
  const [trackingId, setTrackingId] = useState('');

  const queryTrackingId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('trackingId') || '').trim();
  }, [location.search]);

  useEffect(() => {
    if (!queryTrackingId) return;
    setTrackingId(queryTrackingId);
    void trackOrderById(queryTrackingId);
  }, [queryTrackingId, trackOrderById]);

  const statusIcon = (status: Order['orderStatus']) => {
    if (status === 'delivered') return <CheckCircle2 size={15} className="text-brand-green" />;
    if (status === 'cancelled') return <XCircle size={15} className="text-destructive" />;
    if (status === 'shipped') return <Truck size={15} className="text-brand-gold" />;
    if (status === 'packed') return <PackageCheck size={15} className="text-brand-gold" />;
    if (status === 'confirmed') return <CheckCircle2 size={15} className="text-brand-saffron" />;
    return <Clock size={15} className="text-brand-saffron" />;
  };

  const handleTrack = async () => {
    const res = await trackOrderById(trackingId);
    if (!res.success) toast.error(res.error || 'Unable to track order');
  };

  const activeRank = trackedOrder ? statusRank[trackedOrder.orderStatus] : 0;
  const history = [...(trackedOrder?.statusHistory || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return (
    <div className="pt-24 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <PackageSearch size={28} className="text-brand-crimson" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Track Order</h1>
            <p className="font-body text-xs text-muted-foreground">Enter your 5-digit tracking ID</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
              placeholder="e.g. 12345"
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
            <button onClick={handleTrack} disabled={isLoadingTrackedOrder} className="btn-gold px-6 py-2.5 rounded-xl text-sm disabled:opacity-60">
              {isLoadingTrackedOrder ? 'Tracking...' : 'Track'}
            </button>
          </div>
        </div>

        {trackedOrder && (
          <div className="mt-6 space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-body text-xs text-muted-foreground">Order</p>
                  <p className="font-heading text-lg font-bold text-foreground truncate">{trackedOrder.orderId}</p>
                  <p className="font-body text-xs text-brand-gold">Tracking ID: {trackedOrder.trackingId}</p>
                </div>
                <span className="w-fit font-body text-xs px-3 py-1.5 rounded-full capitalize flex items-center gap-1 bg-secondary text-secondary-foreground">
                  {statusIcon(trackedOrder.orderStatus)} {trackedOrder.orderStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[96px_1fr]">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted">
                  <img src={trackedOrder.productImage || '/placeholder.svg'} alt={trackedOrder.productName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-base font-semibold text-foreground truncate">{trackedOrder.productName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Quantity</p>
                      <p className="font-body text-sm text-foreground">{trackedOrder.quantity}</p>
                    </div>
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Amount</p>
                      <p className="font-body text-sm text-foreground">Rs. {trackedOrder.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Payment</p>
                      <p className="font-body text-sm capitalize text-foreground">{trackedOrder.paymentStatus}</p>
                    </div>
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Placed</p>
                      <p className="font-body text-sm text-foreground">{formatDateTime(trackedOrder.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="font-body text-[10px] font-semibold text-muted-foreground">Courier partner</p>
                  <p className="mt-1 font-heading text-sm font-semibold text-foreground">{trackedOrder.courierName || 'Not assigned yet'}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] font-semibold text-muted-foreground">AWB / docket number</p>
                  <p className="mt-1 font-heading text-sm font-semibold text-foreground">{trackedOrder.awbNumber || 'Pending'}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] font-semibold text-muted-foreground">Courier tracking</p>
                  {trackedOrder.trackingUrl ? (
                    <a href={trackedOrder.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-body text-sm text-brand-gold hover:underline">
                      Open courier link <ExternalLink size={13} />
                    </a>
                  ) : (
                    <p className="mt-1 font-body text-sm text-muted-foreground">Link will appear after dispatch</p>
                  )}
                </div>
              </div>
              {trackedOrder.trackingNotes && (
                <div className="mt-4 rounded-lg border border-brand-gold/30 bg-brand-cream p-3">
                  <p className="font-body text-[10px] font-semibold text-muted-foreground">Latest update</p>
                  <p className="mt-1 font-body text-sm text-foreground">{trackedOrder.trackingNotes}</p>
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-heading text-base font-bold text-foreground">Shipment Progress</h2>
              {trackedOrder.orderStatus === 'cancelled' ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 font-body text-sm text-destructive">
                  <XCircle size={16} /> This order has been cancelled.
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-5">
                  {statusSteps.map((step, index) => {
                    const done = index <= activeRank;
                    return (
                      <div key={step.value} className={`rounded-lg border p-3 ${done ? 'border-brand-gold/50 bg-brand-gold/10' : 'border-border bg-background'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-brand-gold' : 'bg-muted-foreground/30'}`} />
                          <p className="font-body text-xs font-semibold text-foreground">{step.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-heading text-base font-bold text-foreground">Tracking History</h2>
              {history.length === 0 ? (
                <p className="mt-3 font-body text-sm text-muted-foreground">No detailed tracking updates yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((item, index) => (
                    <div key={`${item.status}-${item.createdAt || index}`} className="flex gap-3">
                      <div className="mt-0.5">{statusIcon(item.status)}</div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold capitalize text-foreground">{item.status}</p>
                        {item.note && <p className="font-body text-xs text-muted-foreground">{item.note}</p>}
                        <p className="mt-0.5 font-body text-[10px] text-muted-foreground">
                          {formatDateTime(item.createdAt)}{item.updatedByName ? ` by ${item.updatedByName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackOrder;
