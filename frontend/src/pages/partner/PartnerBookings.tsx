import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { ClipboardList, Calendar, User, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import BookingFormDetails from '@/components/BookingFormDetails';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';
import { formatBookingStatus, formatBookingStatusFilter } from '@/lib/bookingStatus';

const PartnerBookings = () => {
  const { user } = useAuthStore();
  const {
    partnerBookings,
    fetchPartnerBookings,
    isLoading,
    partnerVerifyPayment,
    partnerRejectPayment,
    adminCancelBooking,
    partnerCheckIn,
    acceptDharamshalaRequest,
    rejectDharamshalaRequest,
    markDharamshalaNoShow,
    completeDharamshalaBooking,
  } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'pending_property_confirmation' | 'awaiting_customer_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'completed' | 'settled' | 'expired' | 'payment_failed' | 'rejected_by_property' | 'expired_property_no_response'>('all');
  const [expandedBookingId, setExpandedBookingId] = useState<string>('');
  const [cancelBookingId, setCancelBookingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [checkInBookingId, setCheckInBookingId] = useState('');
  const [guestSignature, setGuestSignature] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const bookings = [...partnerBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.bookingStatus === filter);
  const { page, setPage, pageItems } = useRecordPagination(filtered, [filter]);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'pending_property_confirmation' || s === 'awaiting_customer_payment') return 'bg-brand-saffron/10 text-brand-saffron';
    if (s === 'checked_in') return 'bg-blue-50 text-blue-700';
    if (s === 'checked_out') return 'bg-emerald-50 text-emerald-700';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'expired' || s === 'payment_failed' || s === 'rejected_by_property' || s === 'expired_property_no_response') return 'bg-destructive/10 text-destructive';
    if (s === 'completed' || s === 'settled') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  const needsPartnerVerify = (b: any) =>
    b.paymentMethod === 'online' && b.paymentProvider !== 'razorpay' && b.paymentStatus === 'pending' && b.verificationStage === 'pending_partner';
  const canPartnerCheckIn = (b: any) =>
    ['hotel', 'room', 'room_type'].includes(String(b.bookingType || '')) &&
    (b.paymentStatus === 'paid' || b.paymentStatus === 'not_required') &&
    b.bookingStatus === 'confirmed';
  const canDecideDharamshala = (b: any) =>
    String(b.propertyType || '').toLowerCase() === 'dharamshala' &&
    b.bookingStatus === 'pending_property_confirmation';

  const handleAcceptDharamshala = async (id: string, paymentMode: 'pay_at_dharamshala' | 'full_online') => {
    const res = await acceptDharamshalaRequest(id, paymentMode);
    if (res.success) {
      toast.success(
        paymentMode === 'full_online'
          ? 'Request accepted. Customer will pay the online amount shown for this booking.'
          : 'Request accepted. Customer will pay any online platform fee now and contribution at check-in.'
      );
    }
    else toast.error(res.error || 'Accept failed');
  };

  const handleRejectDharamshala = async (id: string) => {
    const reason = window.prompt('Reason for rejecting this request:') || '';
    if (!reason.trim()) return toast.error('Rejection reason is required');
    const res = await rejectDharamshalaRequest(id, reason.trim());
    if (res.success) toast.success('Request rejected');
    else toast.error(res.error || 'Reject failed');
  };

  const handleNoShow = async (id: string) => {
    const reason = window.prompt('No-show note:') || 'Guest did not arrive';
    const res = await markDharamshalaNoShow(id, reason.trim() || 'Guest did not arrive');
    if (res.success) toast.success('Booking marked no-show');
    else toast.error(res.error || 'No-show update failed');
  };

  const handleCompleteDharamshala = async (id: string) => {
    const res = await completeDharamshalaBooking(id, 'Stay completed');
    if (res.success) toast.success('Booking marked completed');
    else toast.error(res.error || 'Complete failed');
  };

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

  const handlePartnerCheckIn = async () => {
    if (!checkInBookingId) return;
    if (!guestSignature.trim()) return toast.error('Guest full name / digital signature is required');
    const res = await partnerCheckIn(checkInBookingId, guestSignature.trim());
    if (res.success) {
      const checkedAt = res.data?.checkedInAt
        ? new Date(res.data.checkedInAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
        : new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      toast.success(`Checked In: ${checkedAt}`);
      setCheckInBookingId('');
      setGuestSignature('');
    } else {
      toast.error(res.error || 'Check-in failed');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(['all', 'pending_property_confirmation', 'awaiting_customer_payment', 'confirmed', 'checked_in', 'checked_out', 'expired', 'payment_failed', 'rejected_by_property', 'expired_property_no_response', 'cancelled', 'completed', 'settled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-9 shrink-0 rounded-lg px-3 py-2 font-body text-[11px] font-medium capitalize transition-colors sm:px-4 sm:text-sm ${
              filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {formatBookingStatusFilter(f)} ({f === 'all' ? bookings.length : bookings.filter((b) => b.bookingStatus === f).length})
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
        <div className="space-y-3 sm:space-y-4">
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
          {checkInBookingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
              <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
                <h3 className="font-heading text-xl font-semibold text-foreground">Mark Guest Checked-In</h3>
                <p className="mt-1 font-body text-sm text-muted-foreground">
                  Enter the guest full name as a digital signature. The system timestamp will be saved automatically.
                </p>
                <label className="mt-4 block">
                  <span className="font-body text-xs font-semibold text-muted-foreground">Guest Full Name (Digital Signature)</span>
                  <input
                    value={guestSignature}
                    onChange={(e) => setGuestSignature(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm"
                    placeholder="Guest full name"
                    autoFocus
                  />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => { setCheckInBookingId(''); setGuestSignature(''); }} className="rounded-lg border border-border px-4 py-2 font-body text-xs">
                    Cancel
                  </button>
                  <button onClick={handlePartnerCheckIn} className="rounded-lg bg-blue-600 px-4 py-2 font-body text-xs font-semibold text-white">
                    Submit Check-In
                  </button>
                </div>
              </div>
            </div>
          )}
          {pageItems.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
              <div className="flex gap-3 sm:gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-16 sm:w-20">
                  {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                    <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ClipboardList size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] text-muted-foreground sm:text-xs">{b.bookingId}</p>
                      <h3 className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground sm:text-lg">{b.itemName}</h3>
                      <span className="mt-1 inline-flex rounded bg-secondary px-2 py-0.5 font-body text-[10px] capitalize text-secondary-foreground sm:text-xs">
                        {b.bookingType}
                      </span>
                    </div>
                    <span className={`w-fit rounded-full px-2 py-1 font-body text-[10px] capitalize sm:text-xs ${statusColor(b.bookingStatus)}`}>
                      {formatBookingStatus(b.bookingStatus)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 font-body text-[11px] sm:grid-cols-2 sm:gap-3 sm:text-xs md:grid-cols-4">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <User size={12} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{b.userName || '-'}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Phone size={12} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{b.userPhone || '-'}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Mail size={12} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{b.userEmail}</span>
                    </div>
                    {b.checkIn && (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Calendar size={12} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{new Date(b.checkIn).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 font-body text-xs text-muted-foreground">
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>

                  {b.checkedInAt && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-body text-xs text-blue-800">
                      Checked In: {new Date(b.checkedInAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      {b.guestDigitalSignature ? ` - Signed by ${b.guestDigitalSignature}` : ''}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedBookingId((current) => (current === b.id ? '' : b.id))}
                      className="min-h-9 flex-1 rounded-lg border border-border px-3 py-1.5 font-body text-xs hover:bg-muted sm:flex-none"
                    >
                      {expandedBookingId === b.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {!['cancelled', 'expired', 'payment_failed', 'checked_out', 'settled'].includes(b.bookingStatus) && (
                      <button
                        onClick={() => {
                          setCancelBookingId(b.id);
                          setCancelReason('');
                          setCancelDetails('');
                        }}
                        className="min-h-9 flex-1 rounded-lg bg-destructive/10 px-3 py-1.5 font-body text-xs text-destructive hover:bg-destructive/15 sm:flex-none"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>

                  {expandedBookingId === b.id && <BookingFormDetails booking={b} viewer="partner" />}

                  {canPartnerCheckIn(b) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setCheckInBookingId(b.id);
                        setGuestSignature(b.customerFullName || b.userName || '');
                      }}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-body text-xs font-semibold text-white hover:bg-blue-700 sm:flex-none"
                    >
                      <CheckCircle2 size={13} />
                      Mark Guest Checked-In
                    </button>
                    {String(b.propertyType || '').toLowerCase() === 'dharamshala' && (
                      <button
                        onClick={() => handleNoShow(b.id)}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 font-body text-xs font-semibold text-destructive hover:bg-destructive/15 sm:flex-none"
                      >
                        Mark No-show
                      </button>
                    )}
                    </div>
                  )}

                  {canDecideDharamshala(b) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAcceptDharamshala(b.id, 'full_online')}
                        className="min-h-9 flex-1 rounded-lg bg-brand-green px-3 py-2 font-body text-xs text-primary-foreground hover:bg-brand-green/90 sm:flex-none sm:px-4"
                      >
                        Collect Full Amount Online
                      </button>
                      <button
                        onClick={() => handleAcceptDharamshala(b.id, 'pay_at_dharamshala')}
                        className="min-h-9 flex-1 rounded-lg bg-brand-gold px-3 py-2 font-body text-xs text-foreground hover:bg-brand-gold/90 sm:flex-none sm:px-4"
                      >
                        Contribution at Check-in
                      </button>
                      <button
                        onClick={() => handleRejectDharamshala(b.id)}
                        className="min-h-9 flex-1 rounded-lg bg-destructive px-3 py-2 font-body text-xs text-primary-foreground hover:bg-destructive/90 sm:flex-none sm:px-4"
                      >
                        Reject Request
                      </button>
                    </div>
                  )}

                  {String(b.propertyType || '').toLowerCase() === 'dharamshala' && b.bookingStatus === 'checked_in' && (
                    <button
                      onClick={() => handleCompleteDharamshala(b.id)}
                      className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-gold/10 px-3 py-1.5 font-body text-xs font-semibold text-brand-gold hover:bg-brand-gold/15"
                    >
                      Mark Completed
                    </button>
                  )}

                  {needsPartnerVerify(b) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handlePartnerVerify(b.id)}
                        className="min-h-9 flex-1 rounded-lg bg-brand-green px-3 py-2 font-body text-xs text-primary-foreground hover:bg-brand-green/90 sm:flex-none sm:px-4"
                      >
                        Partner Verify Payment
                      </button>
                      <button
                        onClick={() => handlePartnerReject(b.id)}
                        className="min-h-9 flex-1 rounded-lg bg-destructive px-3 py-2 font-body text-xs text-primary-foreground hover:bg-destructive/90 sm:flex-none sm:px-4"
                      >
                        Reject Payment
                      </button>
                      <span className="text-[11px] text-muted-foreground self-center">
                        Payment verification will confirm this booking.
                      </span>
                    </div>
                  )}
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

export default PartnerBookings;
