import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PackageSearch, Clock, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { useProductStore } from '@/store/productStore';
import { toast } from 'sonner';

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

  const statusIcon = (s: string) => {
    if (s === 'delivered') return <CheckCircle2 size={14} className="text-brand-green" />;
    if (s === 'cancelled') return <XCircle size={14} className="text-destructive" />;
    if (s === 'shipped') return <Truck size={14} className="text-brand-gold" />;
    if (s === 'confirmed') return <CheckCircle2 size={14} className="text-brand-saffron" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  const handleTrack = async () => {
    const res = await trackOrderById(trackingId);
    if (!res.success) toast.error(res.error || 'Unable to track order');
  };

  return (
    <div className="pt-24 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <PackageSearch size={28} className="text-brand-crimson" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Track Order</h1>
            <p className="font-body text-xs text-muted-foreground">Enter your 5-digit tracking ID</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              inputMode="numeric"
              maxLength={5}
              placeholder="e.g. 12345"
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
            <button
              onClick={handleTrack}
              disabled={isLoadingTrackedOrder}
              className="btn-gold px-6 py-2.5 rounded-xl text-sm disabled:opacity-60"
            >
              {isLoadingTrackedOrder ? 'Tracking…' : 'Track'}
            </button>
          </div>
        </div>

        {trackedOrder && (
          <div className="mt-6 bg-card rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-xs text-muted-foreground">Order</p>
                <p className="font-heading text-lg font-bold text-foreground truncate">{trackedOrder.orderId}</p>
                {trackedOrder.trackingId && (
                  <p className="font-body text-xs text-brand-gold">Tracking ID: {trackedOrder.trackingId}</p>
                )}
              </div>
              <span className="font-body text-xs px-2.5 py-1 rounded-full capitalize flex items-center gap-1 bg-secondary text-secondary-foreground">
                {statusIcon(trackedOrder.orderStatus)} {trackedOrder.orderStatus}
              </span>
            </div>

            <div className="flex gap-4 mt-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <img src={trackedOrder.productImage || '/placeholder.svg'} alt={trackedOrder.productName} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-sm font-semibold text-foreground truncate">{trackedOrder.productName}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  Qty: {trackedOrder.quantity} • ₹{trackedOrder.totalAmount.toLocaleString('en-IN')}
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  Payment: <span className={trackedOrder.paymentStatus === 'paid' ? 'text-brand-green' : trackedOrder.paymentStatus === 'failed' ? 'text-destructive' : 'text-brand-saffron'}>{trackedOrder.paymentStatus}</span>
                </p>
                <p className="font-body text-[10px] text-muted-foreground mt-1">
                  Placed: {new Date(trackedOrder.createdAt).toLocaleString()}
                </p>
                <p className="font-body text-[10px] text-muted-foreground">
                  Updated: {new Date(trackedOrder.updatedAt || trackedOrder.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackOrder;
