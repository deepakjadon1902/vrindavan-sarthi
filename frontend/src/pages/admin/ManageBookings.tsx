import { useBookingStore } from '@/store/bookingStore';
import { Building2, ClipboardList, CreditCard, Eye, User } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import BookingFormDetails from '@/components/BookingFormDetails';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';
import { formatBookingStatus, formatBookingStatusFilter } from '@/lib/bookingStatus';

const ManageBookings = () => {
  const token = useAuthStore((s) => s.token);
  const {
    adminBookings,
    fetchAllBookings,
    isLoading,
    verifyPayment,
    rejectPayment,
    adminCancelBooking,
    updateBookingStatus,
    markDharamshalaNoShow,
  } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'pending_property_confirmation' | 'awaiting_customer_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'completed' | 'pending' | 'settled' | 'expired' | 'payment_failed' | 'rejected_by_property' | 'expired_property_no_response'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'room_type' | 'cab' | 'tour'>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBookingId, setAssignBookingId] = useState<string>('');
  const [cabs, setCabs] = useState<any[]>([]);
  const [selectedCabId, setSelectedCabId] = useState<string>('');
  const [expandedBookingId, setExpandedBookingId] = useState<string>('');
  const [cancelBookingId, setCancelBookingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');

  useEffect(() => {
    void fetchAllBookings();
  }, [fetchAllBookings]);

  const loadCabs = async () => {
    if (!token) return;
    try {
      const res = await api.get('/cabs/all', withAuth(token));
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setCabs(list);
    } catch {
      setCabs([]);
    }
  };

  const bookings = useMemo(
    () => [...adminBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [adminBookings]
  );

  const filtered = bookings
    .filter((b) => filter === 'all' || b.bookingStatus === filter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);
  const { page, setPage, pageItems } = useRecordPagination(filtered, [filter, typeFilter]);

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

  const verificationBadge = (b: any) => {
    if (b.paymentMethod !== 'online') return null;
    if (b.paymentProvider === 'razorpay' && b.paymentStatus === 'pending') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">awaiting Razorpay</span>;
    }
    const stage = b.verificationStage || 'pending_admin';
    if (stage === 'verified') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green">verified</span>;
    if (stage === 'rejected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">rejected</span>;
    if (stage === 'pending_partner') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-saffron/10 text-brand-saffron">partner pending</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">admin pending</span>;
  };

  const canAdminVerify = (b: any) =>
    !b.partnerId &&
    b.paymentMethod === 'online' &&
    b.paymentProvider !== 'razorpay' &&
    b.paymentStatus === 'pending' &&
    b.verificationStage !== 'verified' &&
    b.verificationStage !== 'rejected';
  const canAssignCab = (b: any) =>
    b.bookingType === 'cab' &&
    b.bookingStatus === 'pending' &&
    (b.paymentMethod !== 'online' || b.paymentStatus === 'paid');
  const handleVerify = async (id: string) => {
    const res = await verifyPayment(id);
    if (res.success) toast.success('Payment verified');
    else toast.error(res.error || 'Verify failed');
  };

  const handleReject = async (id: string) => {
    const res = await rejectPayment(id);
    if (res.success) toast.success('Payment rejected');
    else toast.error(res.error || 'Reject failed');
  };

  const handleStatusChange = async (id: string, status: 'checked_in' | 'checked_out' | 'completed' | 'settled') => {
    const res = await updateBookingStatus(id, status);
    if (res.success) toast.success(`Booking marked ${status.replace('_', ' ')}`);
    else toast.error(res.error || 'Status update failed');
  };

  const handleNoShow = async (id: string) => {
    const reason = window.prompt('No-show note:') || 'Guest did not arrive';
    const res = await markDharamshalaNoShow(id, reason.trim() || 'Guest did not arrive');
    if (res.success) toast.success('Booking marked no-show');
    else toast.error(res.error || 'No-show update failed');
  };

  const handleAdminCancel = async () => {
    if (!cancelBookingId || !cancelReason.trim()) return toast.error('Cancellation reason is required');
    if (!cancelDetails.trim()) return toast.error('Cancellation details are required');
    const res = await adminCancelBooking(cancelBookingId, cancelReason.trim(), cancelDetails.trim());
    if (res.success) {
      toast.success('Booking cancelled and user notified');
      setCancelBookingId('');
      setCancelReason('');
      setCancelDetails('');
    } else {
      toast.error(res.error || 'Cancel failed');
    }
  };

  const openAssign = async (bookingId: string) => {
    setAssignBookingId(bookingId);
    setSelectedCabId('');
    setAssignOpen(true);
    await loadCabs();
  };

  const submitAssign = async () => {
    if (!token) return toast.error('Not authenticated');
    if (!assignBookingId || !selectedCabId) return toast.error('Select a cab');
    try {
      await api.put(`/bookings/${assignBookingId}/assign-cab`, { cabId: selectedCabId }, withAuth(token));
      toast.success('Cab assigned');
      setAssignOpen(false);
      setAssignBookingId('');
      setSelectedCabId('');
      void fetchAllBookings();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Assign failed');
    }
  };

  const renderBookingActions = (b: any, variant: 'mobile' | 'desktop' = 'desktop') => {
    const canAdminOperate = !b.partnerId;
    const buttonBase =
      variant === 'mobile'
        ? 'min-h-9 flex-1 rounded-lg px-3 py-1.5 font-body text-xs sm:flex-none'
        : 'px-3 py-1.5 rounded-lg text-xs font-body';

    return (
      <div className={`flex flex-wrap gap-2 ${variant === 'desktop' ? 'items-center justify-end' : ''}`}>
        <button
          onClick={() => setExpandedBookingId((current) => (current === b.id ? '' : b.id))}
          className={`${buttonBase} inline-flex items-center justify-center gap-1.5 border border-border hover:bg-muted`}
        >
          <Eye size={13} />
          {expandedBookingId === b.id ? 'Hide Details' : 'View Details'}
        </button>
        {canAdminOperate && canAssignCab(b) ? (
          <button
            onClick={() => void openAssign(b.id)}
            className={`${buttonBase} bg-brand-gold text-foreground hover:bg-brand-gold/90`}
          >
            Assign Driver
          </button>
        ) : String(b.propertyType || '').toLowerCase() === 'dharamshala' && b.bookingStatus === 'pending_property_confirmation' ? (
          <span className="self-center font-body text-[11px] text-muted-foreground">Waiting partner decision</span>
        ) : canAdminOperate && b.paymentMethod === 'online' ? (
          canAdminVerify(b) ? (
            <>
              <button
                onClick={() => handleVerify(b.id)}
                className={`${buttonBase} bg-brand-green text-primary-foreground hover:bg-brand-green/90`}
              >
                Verify
              </button>
              <button
                onClick={() => handleReject(b.id)}
                className={`${buttonBase} bg-destructive text-primary-foreground hover:bg-destructive/90`}
              >
                Reject
              </button>
            </>
          ) : (
            <span className="self-center font-body text-[11px] text-muted-foreground">
              {b.paymentProvider === 'razorpay' && b.paymentStatus === 'pending'
                ? 'Waiting Razorpay'
                : b.verificationStage === 'pending_partner' ? 'Waiting partner' : ''}
            </span>
          )
        ) : null}
        {canAdminOperate && ['hotel', 'room', 'room_type'].includes(b.bookingType) && (b.paymentStatus === 'paid' || b.paymentStatus === 'not_required') && b.bookingStatus === 'confirmed' && (
          <>
            <button
              onClick={() => void handleStatusChange(b.id, 'checked_in')}
              className={`${buttonBase} bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              Mark Check-in
            </button>
            {String(b.propertyType || '').toLowerCase() === 'dharamshala' && (
              <button
                onClick={() => void handleNoShow(b.id)}
                className={`${buttonBase} bg-destructive/10 text-destructive hover:bg-destructive/15`}
              >
                No-show
              </button>
            )}
          </>
        )}
        {canAdminOperate && ['hotel', 'room', 'room_type'].includes(b.bookingType) && (b.paymentStatus === 'paid' || b.paymentStatus === 'not_required') && b.bookingStatus === 'checked_in' && (
          <>
            <button
              onClick={() => void handleStatusChange(b.id, 'checked_out')}
              className={`${buttonBase} bg-brand-green/10 text-brand-green hover:bg-brand-green/15`}
            >
              Mark Check-out
            </button>
            {String(b.propertyType || '').toLowerCase() === 'dharamshala' && (
              <button
                onClick={() => void handleStatusChange(b.id, 'completed')}
                className={`${buttonBase} bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/15`}
              >
                Complete
              </button>
            )}
          </>
        )}
        {canAdminOperate && !['cancelled', 'expired', 'payment_failed', 'checked_out', 'settled'].includes(b.bookingStatus) && (
          <button
            onClick={() => {
              setCancelBookingId(b.id);
              setCancelReason('');
              setCancelDetails('');
            }}
            className={`${buttonBase} bg-destructive/10 text-destructive hover:bg-destructive/15`}
          >
            Cancel
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(['all', 'pending_property_confirmation', 'awaiting_customer_payment', 'confirmed', 'checked_in', 'checked_out', 'pending', 'expired', 'payment_failed', 'rejected_by_property', 'expired_property_no_response', 'cancelled', 'completed', 'settled'] as const).map((f) => (
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

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(['all', 'hotel', 'room', 'room_type', 'cab', 'tour'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`min-h-8 shrink-0 rounded-lg px-3 py-1.5 font-body text-[11px] capitalize transition-colors sm:text-xs ${
              typeFilter === t ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            {t}
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
          <p className="font-heading text-xl text-foreground mb-2">No Bookings</p>
          <p className="font-body text-sm text-muted-foreground">Bookings will appear here when users make reservations.</p>
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {pageItems.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-[10px] font-semibold text-brand-crimson">{b.bookingId}</p>
                  <h3 className="mt-1 line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground">{b.itemName}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded bg-secondary px-2 py-0.5 font-body text-[10px] capitalize text-secondary-foreground">{b.bookingType.replace('_', ' ')}</span>
                    <span className={`rounded-full px-2 py-0.5 font-body text-[10px] ${statusColor(b.bookingStatus)}`}>
                      {formatBookingStatus(b.bookingStatus)}
                    </span>
                  </div>
                </div>
                <p className="shrink-0 text-right font-body text-sm font-semibold text-foreground">
                  Rs. {Number(b.totalAmount || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 font-body text-[11px] text-muted-foreground">
                <div className="flex min-w-0 items-center gap-1.5">
                  <User size={12} className="shrink-0" />
                  <span className="truncate">{b.customerFullName || b.userName || '-'}</span>
                  <span className="shrink-0 text-muted-foreground/70">{b.customerMobile || b.userPhone || ''}</span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <CreditCard size={12} className="shrink-0" />
                  <span className="truncate">
                    {b.paymentMethod === 'doorstep' ? 'Doorstep' : `${b.paymentProvider === 'razorpay' ? 'Razorpay' : 'UPI'} ${b.paymentStatus}`}
                  </span>
                  <span className="inline-flex shrink-0">{verificationBadge(b)}</span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <Building2 size={12} className="shrink-0" />
                  <span className="truncate">{b.partnerName || 'Admin'}</span>
                </div>
              </div>

              <div className="mt-3">{renderBookingActions(b, 'mobile')}</div>

              {expandedBookingId === b.id && (
                <div className="mt-3">
                  <BookingFormDetails booking={b} viewer="admin" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="hidden overflow-hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
          {assignOpen && (
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="font-body text-sm text-muted-foreground">Assign cab for booking</div>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedCabId}
                    onChange={(e) => setSelectedCabId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-card font-body text-sm"
                  >
                    <option value="">Select cab</option>
                    {cabs.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.vehicleName} ({c.vehicleType}) - {c.driverName}
                      </option>
                    ))}
                  </select>
                  <button onClick={submitAssign} className="px-3 py-2 rounded-lg text-xs font-body bg-brand-green text-primary-foreground">
                    Assign
                  </button>
                  <button
                    onClick={() => {
                      setAssignOpen(false);
                      setAssignBookingId('');
                      setSelectedCabId('');
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-body border border-border"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          {cancelBookingId && (
            <div className="p-4 border-b border-border bg-destructive/5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="font-body text-sm font-medium text-foreground">Cancel booking with reason</div>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Short reason sent to customer"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 font-body text-sm"
                />
                <input
                  value={cancelDetails}
                  onChange={(e) => setCancelDetails(e.target.value)}
                  placeholder="Details, refund timeline, and support note"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 font-body text-sm"
                />
                <span className="font-body text-[11px] text-muted-foreground">12% cancellation charge applies; remaining amount is refundable.</span>
                <button onClick={handleAdminCancel} className="rounded-lg bg-destructive px-3 py-2 font-body text-xs text-primary-foreground">
                  Confirm Cancel
                </button>
                <button onClick={() => { setCancelBookingId(''); setCancelReason(''); setCancelDetails(''); }} className="rounded-lg border border-border px-3 py-2 font-body text-xs">
                  Close
                </button>
              </div>
            </div>
          )}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Booking ID</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">User</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Total Amount</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Payment</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Partner</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((b) => (
                <Fragment key={b.id}>
                <tr className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-xs text-brand-crimson font-medium">{b.bookingId}</td>
                  <td className="px-4 py-3">
                    <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground max-w-[240px]">
                    <div className="truncate">{b.itemName}</div>
                    {b.bookingType === 'cab' && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {b.pickupDate} {b.pickupTime} • {b.guests || 1} passengers • {b.tollOption === 'included' ? 'Tolls included' : 'Tolls excluded'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">
                    <div>{b.customerFullName || b.userName}</div>
                    <div className="text-[11px]">{b.customerMobile || b.userPhone}</div>
                  </td>
                  <td className="px-4 py-3 font-body text-sm font-semibold text-foreground">
                    Rs. {Number(b.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground">
                    {b.paymentMethod === 'doorstep' ? 'Doorstep' : `${b.paymentProvider === 'razorpay' ? 'Razorpay' : 'UPI'} ${b.paymentStatus}`}
                    <span className="ml-2 inline-flex">{verificationBadge(b)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full ${statusColor(b.bookingStatus)}`}>{formatBookingStatus(b.bookingStatus)}</span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{b.partnerName || 'Admin'}</td>
                  <td className="px-4 py-3 text-right">
                    {renderBookingActions(b, 'desktop')}
                  </td>
                </tr>
                {expandedBookingId === b.id && (
                  <tr key={`${b.id}-details`} className="border-b border-border">
                    <td colSpan={9} className="px-4 pb-4">
                      <BookingFormDetails booking={b} viewer="admin" />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <RecordPagination page={page} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default ManageBookings;
