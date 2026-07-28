import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { ClipboardList, Calendar, User, Phone, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import BookingFormDetails from '@/components/BookingFormDetails';

const PartnerBookings = () => {
  const { user } = useAuthStore();
  const {
    partnerBookings,
    fetchPartnerBookings,
    isLoading,
    partnerVerifyPayment,
    partnerRejectPayment,
    adminCancelBooking,
  } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'completed' | 'settled'>('all');
  const [expandedBookingId, setExpandedBookingId] = useState<string>('');
  const [cancelBookingId, setCancelBookingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const bookings = [...partnerBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.bookingStatus === filter);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'checked_in') return 'bg-blue-50 text-blue-700';
    if (s === 'checked_out') return 'bg-emerald-50 text-emerald-700';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'completed' || s === 'settled') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  const needsPartnerVerify = (b: any) =>
    b.paymentMethod === 'online' && b.paymentStatus === 'pending' && b.verificationStage === 'pending_partner';

  const handlePartnerVerify = async (id: string) => {
    const res = await partnerVerifyPayment(id);
    if (res.success) toast.success('Payment verified. Sent to admin for final verification.');
    else toast.error(res.error || 'Verify failed');
  };

  const handlePartnerReject = async (id: string) => {
    const res = await partnerRejectPayment(id);
    if (res.success) toast.success('Payment rejected');
    else toast.error(res.error || 'Reject failed');
  };

  const handlePartnerCancel = async () => {
    if (!cancelBookingId || !cancelReason.trim()) return toast.error('Cancellation reason is required');
    if (!cancelDetails.trim()) return toast.error('Cancellation details are required');
    const res = await adminCancelBooking(cancelBookingId, cancelReason.trim(), cancelDetails.trim());
    if (res.success) {
      toast.success('Booking cancelled and customer notified');
      setCancelBookingId('');
      setCancelReason('');
      setCancelDetails('');
    } else {
      toast.error(res.error || 'Cancel failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed', 'settled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${
              filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.bookingStatus === f).length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading bookings…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Bookings Yet</p>
          <p className="font-body text-sm text-muted-foreground">Bookings for your listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cancelBookingId && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex flex-col gap-3">
                <div className="font-body text-sm font-medium text-foreground">Cancel booking with customer message</div>
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Short reason sent to customer" className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm" />
                <textarea value={cancelDetails} onChange={(e) => setCancelDetails(e.target.value)} rows={3} placeholder="Details, refund timeline, and support note" className="resize-none rounded-lg border border-border bg-card px-3 py-2 font-body text-sm" />
                <p className="font-body text-[11px] text-muted-foreground">12% cancellation charge applies; remaining amount is refundable.</p>
                <div className="flex gap-2">
                  <button onClick={handlePartnerCancel} className="rounded-lg bg-destructive px-3 py-2 font-body text-xs text-primary-foreground">Confirm Cancel</button>
                  <button onClick={() => { setCancelBookingId(''); setCancelReason(''); setCancelDetails(''); }} className="rounded-lg border border-border px-3 py-2 font-body text-xs">Close</button>
                </div>
              </div>
            </div>
          )}
          {filtered.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-20 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                    <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ClipboardList size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-body text-xs text-muted-foreground">{b.bookingId}</p>
                      <h3 className="font-heading text-lg font-semibold text-foreground">{b.itemName}</h3>
                      <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-secondary-foreground capitalize">
                        {b.bookingType}
                      </span>
                    </div>
                    <span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${statusColor(b.bookingStatus)}`}>
                      {b.bookingStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 font-body text-xs">
                    <div className="flex items-center gap-1">
                      <User size={12} className="text-muted-foreground" />
                      <span>{b.userName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone size={12} className="text-muted-foreground" />
                      <span>{b.userPhone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail size={12} className="text-muted-foreground" />
                      <span className="truncate">{b.userEmail}</span>
                    </div>
                    {b.checkIn && (
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-muted-foreground" />
                        <span>{new Date(b.checkIn).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 font-body text-xs text-muted-foreground">
                    {b.totalAmount > 0 && (
                      <span className="font-semibold text-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</span>
                    )}
                    <span>{b.paymentMethod === 'doorstep' ? 'Pay at Doorstep' : `UPI ${b.paymentStatus}`}</span>
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>

                  <button
                    onClick={() => setExpandedBookingId((current) => (current === b.id ? '' : b.id))}
                    className="mt-3 px-3 py-1.5 rounded-lg text-xs font-body border border-border hover:bg-muted"
                  >
                    {expandedBookingId === b.id ? 'Hide Details' : 'View Details'}
                  </button>

                  {expandedBookingId === b.id && <BookingFormDetails booking={b} viewer="partner" />}

                  {b.bookingStatus !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setCancelBookingId(b.id);
                        setCancelReason('');
                        setCancelDetails('');
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-body bg-destructive/10 text-destructive hover:bg-destructive/15"
                    >
                      Cancel Booking
                    </button>
                  )}

                  {needsPartnerVerify(b) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handlePartnerVerify(b.id)}
                        className="px-4 py-2 rounded-lg text-xs font-body bg-brand-green text-primary-foreground hover:bg-brand-green/90"
                      >
                        Partner Verify Payment
                      </button>
                      <button
                        onClick={() => handlePartnerReject(b.id)}
                        className="px-4 py-2 rounded-lg text-xs font-body bg-destructive text-primary-foreground hover:bg-destructive/90"
                      >
                        Reject Payment
                      </button>
                      <span className="text-[11px] text-muted-foreground self-center">
                        After you verify, admin will do final verification.
                      </span>
                    </div>
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

export default PartnerBookings;
