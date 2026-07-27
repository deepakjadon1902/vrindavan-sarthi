import { useAuthStore } from '@/store/authStore';
import { useProductStore } from '@/store/productStore';
import { ShoppingBag, Package, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const MyOrders = () => {
  const { user } = useAuthStore();
  const { myOrders, fetchMyOrders, cancelOrder, isLoadingOrders } = useProductStore();
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchMyOrders();
  }, [fetchMyOrders, user]);

  const orders = useMemo(
    () => [...myOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [myOrders]
  );

  const statusIcon = (s: string) => {
    if (s === 'confirmed' || s === 'delivered') return <CheckCircle2 size={14} className="text-brand-green" />;
    if (s === 'shipped') return <Clock size={14} className="text-brand-gold" />;
    if (s === 'cancelled') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  const statusColor = (s: string) => {
    if (s === 'confirmed' || s === 'delivered') return 'bg-brand-green/10 text-brand-green';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'shipped') return 'bg-brand-gold/10 text-brand-gold';
    if (s === 'packed') return 'bg-brand-gold/10 text-brand-gold';
    if (s === 'processing') return 'bg-brand-saffron/10 text-brand-saffron';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  const submitCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) return toast.error('Cancellation reason is required');
    if (!cancelDetails.trim()) return toast.error('Cancellation details are required');
    const res = await cancelOrder(cancelOrderId, cancelReason.trim(), cancelDetails.trim());
    if (res.success) {
      toast.success('Order cancelled');
      setCancelOrderId('');
      setCancelReason('');
      setCancelDetails('');
    } else {
      toast.error(res.error || 'Cancel failed');
    }
  };

  return (
    <div className="pt-24 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Package size={28} className="text-brand-crimson" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">My Orders</h1>
            <p className="font-body text-xs text-muted-foreground">{orders.length} order(s)</p>
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <p className="font-body text-sm text-muted-foreground">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-heading text-xl text-foreground mb-2">No Orders Yet</p>
            <p className="font-body text-sm text-muted-foreground mb-6">Browse our shop to find something you'll love!</p>
            <Link to="/shop" className="btn-gold px-6 py-2.5 rounded-xl text-sm">Go to Shop</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cancelOrderId && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <h2 className="font-heading text-base font-semibold text-foreground mb-3">Cancel order</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm" />
                  <input value={cancelDetails} onChange={(e) => setCancelDetails(e.target.value)} placeholder="Full details for cancellation request" className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm" />
                </div>
                <p className="mt-3 font-body text-xs text-muted-foreground">A 12% cancellation charge will be deducted from the total payment. The remaining amount will be refundable.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={submitCancel} className="rounded-lg bg-destructive px-4 py-2 font-body text-xs text-primary-foreground">Submit Cancellation</button>
                  <button onClick={() => { setCancelOrderId(''); setCancelReason(''); setCancelDetails(''); }} className="rounded-lg border border-border px-4 py-2 font-body text-xs">Close</button>
                </div>
              </div>
            )}
            {orders.map((order) => (
              <div key={order.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={order.productImage || '/placeholder.svg'} alt={order.productName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-semibold text-foreground truncate">{order.productName}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/track-order?trackingId=${encodeURIComponent(order.trackingId || '')}`} className="font-body text-[10px] text-muted-foreground hover:underline">
                            {order.orderId}
                          </Link>
                          {order.trackingId && (
                            <Link to={`/track-order?trackingId=${encodeURIComponent(order.trackingId)}`} className="font-body text-[10px] text-brand-gold hover:underline">
                              Track: {order.trackingId}
                            </Link>
                          )}
                        </div>
                      </div>
                      <span className={`font-body text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0 flex items-center gap-1 ${statusColor(order.orderStatus)}`}>
                        {statusIcon(order.orderStatus)} {order.orderStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="font-body text-xs text-muted-foreground">Qty: {order.quantity}</span>
                      <span className="font-heading text-sm font-bold text-brand-crimson">₹{order.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="font-body text-[10px] text-muted-foreground">Subtotal: ₹{Number(order.subtotalAmount || order.productPrice * order.quantity).toLocaleString('en-IN')}</span>
                      <span className="font-body text-[10px] text-muted-foreground">Shipping: ₹{Number(order.shippingFee || 49).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="font-body text-[10px] text-muted-foreground">
                        Payment: <span className={order.paymentStatus === 'paid' ? 'text-brand-green' : order.paymentStatus === 'failed' ? 'text-destructive' : 'text-brand-saffron'}>{order.paymentStatus}</span>
                      </span>
                      <span className="font-body text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="font-body text-[10px] text-muted-foreground mt-1">Shipping: {order.shippingAddress}</p>
                    {order.orderStatus !== 'cancelled' && order.orderStatus !== 'shipped' && order.orderStatus !== 'delivered' && (
                      <button
                        onClick={() => {
                          setCancelOrderId(order.id);
                          setCancelReason('');
                          setCancelDetails('');
                        }}
                        className="mt-2 flex items-center gap-1 font-body text-[11px] text-destructive hover:underline"
                      >
                        <XCircle size={11} /> Cancel
                      </button>
                    )}
                    {order.orderStatus === 'cancelled' && order.cancellationReason && (
                      <p className="mt-2 font-body text-[10px] text-destructive">
                        Cancelled: {order.cancellationReason}. Refundable ₹{Number(order.refundableAmount || 0).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
