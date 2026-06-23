import { useProductStore } from '@/store/productStore';
import {
  CheckCircle2, XCircle, Clock, IndianRupee, Eye, Package,
  Truck, ExternalLink, Link as LinkIcon, StickyNote,
  MapPin, User, Phone, Mail, Barcode,
} from 'lucide-react';
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

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'processing' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
  >('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingForm, setTrackingForm] = useState({
    orderStatus: 'processing' as
      | 'pending' | 'processing' | 'confirmed' | 'packed'
      | 'shipped' | 'delivered' | 'cancelled',
    courierName: '',
    awbNumber: '',
    trackingUrl: '',
    trackingNotes: '',
  });

  useEffect(() => { fetchAllOrders(); }, [fetchAllOrders]);

  const orders = useMemo(
    () => [...adminOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [adminOrders],
  );

  const filtered = useMemo(
    () => orders.filter((o) => statusFilter === 'all' || o.orderStatus === statusFilter),
    [orders, statusFilter],
  );

  const totalRevenue = orders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((s, o) => s + o.totalAmount, 0);

  const trackingOrder = orders.find((o) => o.id === trackingOrderId);

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

  const saveTracking = async () => {
    if (!trackingOrderId) return;
    if (
      (trackingForm.orderStatus === 'shipped' || trackingForm.orderStatus === 'delivered') &&
      !trackingForm.awbNumber.trim()
    ) {
      toast.error('AWB number is required after shipment');
      return;
    }
    const res = await updateOrderTracking(trackingOrderId, trackingForm);
    if (res.success) { toast.success('Tracking details updated'); setTrackingOrderId(null); }
    else toast.error(res.error || 'Tracking update failed');
  };

  const statusOptions = useMemo(
    () => [
      { value: 'pending',    label: 'Pending' },
      { value: 'processing', label: 'Processing' },
      { value: 'confirmed',  label: 'Confirmed' },
      { value: 'packed',     label: 'Packed' },
      { value: 'shipped',    label: 'Order Shipped' },
      { value: 'delivered',  label: 'Order Delivered' },
      { value: 'cancelled',  label: 'Cancelled' },
    ] as const,
    [],
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

  /** Payment status pill */
  const PaymentBadge = ({ status }: { status: string }) => {
    if (status === 'paid')
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-green-700">
          <CheckCircle2 size={11} /> Paid
        </span>
      );
    if (status === 'failed')
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-red-700">
          <XCircle size={11} /> Failed
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 font-body text-[11px] font-semibold text-amber-700">
        <Clock size={11} /> Pending
      </span>
    );
  };

  /**
   * Parses the raw shippingAddress string (comma-separated) into structured fields.
   * Expected backend format:
   *   "Name, State, City, Area/Landmark, Town/Village, Pincode, Phone, Email"
   */
  const parseAddress = (raw: string) => {
    if (!raw) return null;
    const p = raw.split(',').map((s) => s.trim());
    if (p.length >= 6) {
      return {
        name:    p[0] ?? '',
        state:   p[1] ?? '',
        city:    p[2] ?? '',
        area:    p[3] ?? '',
        town:    p[4] ?? '',
        pincode: p[5] ?? '',
        phone:   p[6] ?? '',
        email:   p[7] ?? '',
      };
    }
    return { raw };
  };

  /** Flipkart / Amazon–style delivery address card */
  const AddressCard = ({ raw }: { raw: string }) => {
    const addr = parseAddress(raw);
    if (!addr) return null;

    /* Fallback */
    if ('raw' in addr) {
      return (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5">
          <MapPin size={13} className="mt-0.5 shrink-0 text-brand-crimson" />
          <p className="font-body text-xs text-foreground">{addr.raw}</p>
        </div>
      );
    }

    const { name, state, city, area, town, pincode, phone, email } = addr;
    const addressLine = [area, town, city, state].filter(Boolean).join(', ');

    return (
      <div className="mt-3 rounded-lg border border-border bg-background/60 overflow-hidden">
        {/* Label bar */}
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 bg-muted/40">
          <MapPin size={11} className="text-brand-crimson" />
          <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Delivery Address
          </span>
        </div>

        <div className="px-3 py-2.5 space-y-2">
          {/* Recipient + pincode */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={12} className="shrink-0 text-muted-foreground" />
              <span className="font-heading text-sm font-semibold text-foreground truncate">{name}</span>
            </div>
            {pincode && (
              <span className="shrink-0 inline-flex items-center rounded-full border border-brand-gold/50 bg-brand-gold/10 px-2.5 py-0.5 font-body text-[11px] font-semibold text-brand-gold tracking-wide">
                {pincode}
              </span>
            )}
          </div>

          {/* Address line */}
          {addressLine && (
            <p className="font-body text-[12.5px] leading-relaxed text-muted-foreground pl-[20px]">
              {addressLine}
            </p>
          )}

          {/* Contact strip */}
          {(phone || email) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
              {phone && (
                <span className="flex items-center gap-1.5 font-body text-[11.5px] text-foreground">
                  <Phone size={11} className="text-muted-foreground" /> {phone}
                </span>
              )}
              {email && (
                <span className="flex items-center gap-1.5 font-body text-[11.5px] text-foreground">
                  <Mail size={11} className="text-muted-foreground" /> {email}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <IndianRupee size={20} className="text-brand-green" />, bg: 'bg-brand-green/10', label: 'Product Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}` },
          { icon: <Package size={20} className="text-brand-saffron" />, bg: 'bg-brand-saffron/10', label: 'Total Orders', value: orders.length },
          { icon: <Clock size={20} className="text-brand-crimson" />, bg: 'bg-brand-crimson/10', label: 'Pending', value: orders.filter((o) => o.orderStatus === 'pending').length },
        ].map(({ icon, bg, label, value }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
              <div>
                <p className="font-body text-xs text-muted-foreground">{label}</p>
                <p className="font-heading text-xl font-bold text-foreground">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${
              statusFilter === f
                ? 'bg-brand-crimson text-primary-foreground'
                : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {f} ({f === 'all' ? orders.length : orders.filter((o) => o.orderStatus === f).length})
          </button>
        ))}
      </div>

      {/* ── UPI viewer ── */}
      {selectedUpi && (
        <div className="bg-brand-cream border border-brand-gold/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-body text-xs text-muted-foreground">UPI Transaction ID</p>
            <p className="font-heading text-lg font-bold text-foreground">{selectedUpi}</p>
          </div>
          <button onClick={() => setSelectedUpi(null)} className="px-3 py-1 rounded-lg text-xs border border-border font-body hover:bg-muted">
            Close
          </button>
        </div>
      )}

      {/* ── Tracking panel ── */}
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
                onChange={(e) => setTrackingForm((f) => ({ ...f, orderStatus: e.target.value as typeof statusOptions[number]['value'] }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              >
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Courier partner</label>
              <input value={trackingForm.courierName} onChange={(e) => setTrackingForm((f) => ({ ...f, courierName: e.target.value }))} placeholder="Blue Dart, Delhivery, India Post…" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">AWB / docket number</label>
              <input value={trackingForm.awbNumber} onChange={(e) => setTrackingForm((f) => ({ ...f, awbNumber: e.target.value }))} placeholder="Enter AWB number" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Tracking link</label>
              <input value={trackingForm.trackingUrl} onChange={(e) => setTrackingForm((f) => ({ ...f, trackingUrl: e.target.value }))} placeholder="https://courier.example/track/…" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="lg:col-span-5">
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted-foreground">Customer note</label>
              <textarea value={trackingForm.trackingNotes} onChange={(e) => setTrackingForm((f) => ({ ...f, trackingNotes: e.target.value }))} rows={3} placeholder="Short update visible on public tracking page" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveTracking} className="btn-gold rounded-xl px-5 py-2.5 text-sm">Save Tracking</button>
            {trackingForm.trackingUrl.trim() && (
              <a href={trackingForm.trackingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
                <ExternalLink size={13} /> Open link
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Order list ── */}
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
            <div key={o.id} className="bg-card rounded-xl border border-border overflow-hidden">

              {/* ── Product header ── */}
              <div className="flex gap-4 px-4 pt-4 pb-3 border-b border-border">
                <div className="w-[60px] h-[60px] rounded-lg overflow-hidden shrink-0 border border-border">
                  <img src={o.productImage || '/placeholder.svg'} alt={o.productName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-[15px] font-semibold text-foreground leading-snug">{o.productName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-[11px] text-muted-foreground">
                    <span className="font-mono">{o.orderId}</span>
                    {o.trackingId && <><span>•</span><span>Track: {o.trackingId}</span></>}
                    <span>•</span>
                    <span>{o.userName}</span>
                    <span>•</span>
                    <span>{o.userPhone}</span>
                    <span>•</span>
                    <span>Qty: {o.quantity}</span>
                  </div>
                </div>
                <p className="font-heading text-[20px] font-bold text-brand-crimson shrink-0">
                  ₹{o.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>

              {/* ── Info grid: Payment + UPI + Courier + AWB + Note ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border border-b border-border">
                {/* Payment */}
                <div className="px-4 py-3 space-y-1">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Payment</p>
                  <PaymentBadge status={o.paymentStatus} />
                  {o.upiTransactionId && (
                    <button
                      onClick={() => setSelectedUpi(o.upiTransactionId!)}
                      className="flex items-center gap-1 font-body text-[11px] text-brand-gold hover:underline mt-1"
                    >
                      <Eye size={11} /> UPI: {o.upiTransactionId.slice(0, 12)}…
                    </button>
                  )}
                </div>

                {/* Courier */}
                <div className="px-4 py-3 space-y-1">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Courier</p>
                  <div className="flex items-center gap-1.5">
                    <Truck size={13} className="text-brand-crimson shrink-0" />
                    <span className="font-body text-[13px] text-foreground">{o.courierName || '—'}</span>
                  </div>
                </div>

                {/* AWB */}
                <div className="px-4 py-3 space-y-1">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">AWB / Docket</p>
                  <div className="flex items-center gap-1.5">
                    <Barcode size={13} className="text-brand-gold shrink-0" />
                    <span className="font-body text-[13px] font-mono text-foreground">{o.awbNumber || 'Pending'}</span>
                  </div>
                </div>

                {/* Note */}
                <div className="px-4 py-3 space-y-1">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Latest note</p>
                  <div className="flex items-start gap-1.5">
                    <StickyNote size={13} className="text-brand-saffron mt-0.5 shrink-0" />
                    <span className="font-body text-[12px] text-muted-foreground leading-snug line-clamp-2">
                      {o.trackingNotes || 'No update added'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Delivery address card ── */}
              <div className="px-4 py-3 border-b border-border">
                {o.shippingAddress
                  ? <AddressCard raw={o.shippingAddress} />
                  : (
                    <p className="font-body text-xs text-muted-foreground italic">No shipping address on file</p>
                  )
                }
              </div>

              {/* ── Action bar ── */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                {o.paymentStatus === 'pending' && (
                  <>
                    <button onClick={() => handleVerify(o.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 font-body text-xs font-semibold hover:bg-green-100">
                      <CheckCircle2 size={13} /> Verify payment
                    </button>
                    <button onClick={() => handleReject(o.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-body text-xs font-semibold hover:bg-red-100">
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}

                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">Shipping status</span>
                  <select
                    value={o.orderStatus}
                    onChange={async (e) => {
                      const status = e.target.value as typeof statusOptions[number]['value'];
                      const r = await updateOrderStatus(o.id, status);
                      if (r.success) toast.success('Order status updated');
                      else toast.error(r.error || 'Update failed');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background font-body text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => openTracking(o)}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-crimson px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground hover:bg-brand-crimson/90"
                  >
                    <Truck size={13} /> Manage shipping
                  </button>

                  {o.trackingUrl && (
                    <a
                      href={o.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open courier tracking link"
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
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