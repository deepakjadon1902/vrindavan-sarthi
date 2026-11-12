import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import {
  ClipboardList,
  Calendar,
  User,
  Phone,
  Mail,
  CheckCircle2,
  Search,
  LogIn,
  LogOut,
  IndianRupee,
  Receipt,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import BookingFormDetails from '@/components/BookingFormDetails';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';
import { formatBookingStatus } from '@/lib/bookingStatus';

type OperationalFilter =
  | 'all'
  | 'today_arrivals'
  | 'in_house'
  | 'today_departures'
  | 'balance_due'
  | 'pending_property_confirmation'
  | 'checked_out'
  | 'cancelled';

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
    partnerCheckOut,
    acceptDharamshalaRequest,
    rejectDharamshalaRequest,
    markDharamshalaNoShow,
    completeDharamshalaBooking,
    collectBalance,
  } = useBookingStore();

  const [activeTab, setActiveTab] = useState<OperationalFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBookingId, setExpandedBookingId] = useState<string>('');

  // Modals state
  const [cancelBookingId, setCancelBookingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');

  const [checkInBooking, setCheckInBooking] = useState<any | null>(null);
  const [guestSignature, setGuestSignature] = useState('');

  const [checkOutBooking, setCheckOutBooking] = useState<any | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const [collectBooking, setCollectBooking] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [collectReceipt, setCollectReceipt] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, user]);

  const sortedBookings = useMemo(
    () => [...partnerBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [partnerBookings]
  );

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const isTodayDate = (dateVal?: string | Date) => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    return d >= startOfToday && d <= endOfToday;
  };

  const filteredBookings = useMemo(() => {
    return sortedBookings.filter((b) => {
      // 1. Operational filter tab
      if (activeTab === 'today_arrivals') {
        if (b.bookingStatus !== 'confirmed') return false;
        if (!isTodayDate(b.checkInDate || b.checkIn)) return false;
      } else if (activeTab === 'in_house') {
        if (b.bookingStatus !== 'checked_in') return false;
      } else if (activeTab === 'today_departures') {
        if (b.bookingStatus !== 'checked_in') return false;
        if (!isTodayDate(b.checkOutDate || b.checkOut)) return false;
      } else if (activeTab === 'balance_due') {
        if (Number(b.balanceAmount || b.amountPayableAtProperty || 0) <= 0) return false;
        if (['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus)) return false;
      } else if (activeTab === 'pending_property_confirmation') {
        if (b.bookingStatus !== 'pending_property_confirmation') return false;
      } else if (activeTab === 'checked_out') {
        if (!['checked_out', 'completed', 'settled'].includes(b.bookingStatus)) return false;
      } else if (activeTab === 'cancelled') {
        if (b.bookingStatus !== 'cancelled') return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const pnrMatch = (b.bookingId || '').toLowerCase().includes(q);
        const nameMatch = (b.customerFullName || b.userName || '').toLowerCase().includes(q);
        const phoneMatch = (b.userPhone || '').toLowerCase().includes(q);
        const emailMatch = (b.userEmail || '').toLowerCase().includes(q);
        const itemMatch = (b.itemName || '').toLowerCase().includes(q);
        if (!pnrMatch && !nameMatch && !phoneMatch && !emailMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [sortedBookings, activeTab, searchQuery, startOfToday, endOfToday]);

  const { page, setPage, pageItems } = useRecordPagination(filteredBookings, [activeTab, searchQuery]);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'pending_property_confirmation' || s === 'awaiting_customer_payment') return 'bg-brand-saffron/10 text-brand-saffron';
    if (s === 'checked_in') return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (s === 'checked_out') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
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

  const canPartnerCheckOut = (b: any) =>
    ['hotel', 'room', 'room_type'].includes(String(b.bookingType || '')) &&
    b.bookingStatus === 'checked_in';

  const canDecideDharamshala = (b: any) =>
    ['hotel', 'room', 'room_type'].includes(String(b.bookingType || '')) &&
    b.bookingStatus === 'pending_property_confirmation';

  // Modal openers
  const openCollectModal = (b: any) => {
    const remaining = Number(b.balanceAmount || b.amountPayableAtProperty || 0);
    setCollectBooking(b);
    setCollectAmount(remaining);
    setCollectMethod('cash');
    setCollectReceipt('');
    setCollectNotes('');
  };

  const openCheckInModal = (b: any) => {
    setCheckInBooking(b);
    setGuestSignature(b.customerFullName || b.userName || '');
  };

  const openCheckOutModal = (b: any) => {
    setCheckOutBooking(b);
    setCheckoutNotes('');
  };

  // Submit Handlers
  const handleExecuteCollectBalance = async () => {
    if (!collectBooking) return;
    const remaining = Number(collectBooking.balanceAmount || collectBooking.amountPayableAtProperty || 0);
    if (!Number.isFinite(collectAmount) || collectAmount <= 0) {
      toast.error('Please enter a valid positive collection amount');
      return;
    }
    if (collectAmount > remaining) {
      toast.error(`Amount cannot exceed remaining balance of ₹${remaining}`);
      return;
    }

    try {
      setIsSubmittingAction(true);
      const res = await collectBalance(collectBooking.id, {
        amountCollected: Math.round(collectAmount),
        paymentMethod: collectMethod,
        receiptNumber: collectReceipt.trim() || undefined,
        notes: collectNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`₹${Math.round(collectAmount)} collected successfully via ${collectMethod.toUpperCase()}`);
        setCollectBooking(null);
        void fetchPartnerBookings();
      } else {
        toast.error(res.error || 'Balance collection failed');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleExecuteCheckIn = async () => {
    if (!checkInBooking) return;
    if (!guestSignature.trim()) {
      toast.error('Guest full name / digital signature is required');
      return;
    }
    try {
      setIsSubmittingAction(true);
      const res = await partnerCheckIn(checkInBooking.id, guestSignature.trim());
      if (res.success) {
        const checkedAt = res.data?.checkedInAt
          ? new Date(res.data.checkedInAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
          : new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
        toast.success(`Guest Checked In: ${checkedAt}`);
        setCheckInBooking(null);
        setGuestSignature('');
        void fetchPartnerBookings();
      } else {
        toast.error(res.error || 'Check-in failed');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleExecuteCheckOut = async () => {
    if (!checkOutBooking) return;
    try {
      setIsSubmittingAction(true);
      const res = await partnerCheckOut(checkOutBooking.id, checkoutNotes.trim());
      if (res.success) {
        toast.success('Guest successfully checked out. Room inventory locks released.');
        setCheckOutBooking(null);
        setCheckoutNotes('');
        void fetchPartnerBookings();
      } else {
        toast.error(res.error || 'Check-out failed');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAcceptDharamshala = async (id: string, paymentMode: 'pay_at_dharamshala' | 'full_online') => {
    const res = await acceptDharamshalaRequest(id, paymentMode);
    if (res.success) {
      toast.success(
        paymentMode === 'full_online'
          ? 'Request accepted. Customer will pay online to confirm this booking.'
          : 'Request accepted. Customer will pay at Dharamshala as selected.'
      );
      void fetchPartnerBookings();
    } else toast.error(res.error || 'Accept failed');
  };

  const handleRejectDharamshala = async (id: string) => {
    const reason = window.prompt('Reason for rejecting this request:') || '';
    if (!reason.trim()) return toast.error('Rejection reason is required');
    const res = await rejectDharamshalaRequest(id, reason.trim());
    if (res.success) {
      toast.success('Request rejected');
      void fetchPartnerBookings();
    } else toast.error(res.error || 'Reject failed');
  };

  const handleNoShow = async (id: string) => {
    const reason = window.prompt('No-show note:') || 'Guest did not arrive';
    const res = await markDharamshalaNoShow(id, reason.trim() || 'Guest did not arrive');
    if (res.success) {
      toast.success('Booking marked no-show');
      void fetchPartnerBookings();
    } else toast.error(res.error || 'No-show update failed');
  };

  const handleCompleteDharamshala = async (id: string) => {
    const res = await completeDharamshalaBooking(id, 'Stay completed');
    if (res.success) {
      toast.success('Booking marked completed');
      void fetchPartnerBookings();
    } else toast.error(res.error || 'Complete failed');
  };

  const handlePartnerVerify = async (id: string) => {
    const res = await partnerVerifyPayment(id);
    if (res.success) {
      toast.success('Payment verified. Sent to admin for final verification.');
      void fetchPartnerBookings();
    } else toast.error(res.error || 'Verify failed');
  };

  const handlePartnerReject = async (id: string) => {
    const res = await partnerRejectPayment(id);
    if (res.success) {
      toast.success('Payment rejected');
      void fetchPartnerBookings();
    } else toast.error(res.error || 'Reject failed');
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
      void fetchPartnerBookings();
    } else {
      toast.error(res.error || 'Cancel failed');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Search & Filters Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PNR, Guest Name, Phone, or Property..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Operational Quick Tabs ── */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {[
          { key: 'all', label: 'All Bookings', count: sortedBookings.length },
          {
            key: 'today_arrivals',
            label: "Today's Arrivals",
            count: sortedBookings.filter((b) => b.bookingStatus === 'confirmed' && isTodayDate(b.checkInDate || b.checkIn)).length,
          },
          {
            key: 'in_house',
            label: 'In-House Guests',
            count: sortedBookings.filter((b) => b.bookingStatus === 'checked_in').length,
          },
          {
            key: 'today_departures',
            label: "Today's Departures",
            count: sortedBookings.filter((b) => b.bookingStatus === 'checked_in' && isTodayDate(b.checkOutDate || b.checkOut)).length,
          },
          {
            key: 'balance_due',
            label: 'Desk Balance Due',
            count: sortedBookings.filter((b) => Number(b.balanceAmount || b.amountPayableAtProperty || 0) > 0 && !['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus)).length,
          },
          {
            key: 'pending_property_confirmation',
            label: 'Requests Pending',
            count: sortedBookings.filter((b) => b.bookingStatus === 'pending_property_confirmation').length,
          },
          {
            key: 'checked_out',
            label: 'Checked Out',
            count: sortedBookings.filter((b) => ['checked_out', 'completed', 'settled'].includes(b.bookingStatus)).length,
          },
          {
            key: 'cancelled',
            label: 'Cancelled',
            count: sortedBookings.filter((b) => b.bookingStatus === 'cancelled').length,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as OperationalFilter)}
            className={`min-h-9 shrink-0 rounded-lg px-3 py-2 font-body text-[11px] font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === tab.key
                ? 'bg-brand-crimson text-primary-foreground shadow-sm'
                : 'bg-card border border-border hover:bg-muted text-foreground'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading bookings…</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Bookings Found</p>
          <p className="font-body text-sm text-muted-foreground">
            {searchQuery ? 'No bookings match your search query.' : 'No bookings in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {pageItems.map((b) => {
            const balanceDue = Number(b.balanceAmount || b.amountPayableAtProperty || 0);
            return (
              <div key={b.id} className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
                <div className="flex gap-3 sm:gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-24">
                    {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                      <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ClipboardList size={20} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-body text-xs font-bold text-brand-crimson">{b.bookingId}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-body text-[10px] capitalize text-secondary-foreground sm:text-xs">
                            {b.bookingType}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground sm:text-lg mt-0.5">
                          {b.itemName}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {balanceDue > 0 && !['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus) && (
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 font-body text-[10px] sm:text-xs font-semibold text-amber-600">
                            Balance Due: ₹{balanceDue.toLocaleString('en-IN')}
                          </span>
                        )}
                        <span className={`w-fit rounded-full px-2.5 py-1 font-body text-[10px] capitalize sm:text-xs font-medium ${statusColor(b.bookingStatus)}`}>
                          {formatBookingStatus(b.bookingStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 font-body text-[11px] sm:grid-cols-2 sm:gap-3 sm:text-xs md:grid-cols-4">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <User size={13} className="shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{b.customerFullName || b.userName || '-'}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Phone size={13} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{b.userPhone || '-'}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Mail size={13} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{b.userEmail}</span>
                      </div>
                      {b.checkIn && (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Calendar size={13} className="shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {new Date(b.checkIn).toLocaleDateString()} {b.checkOut ? `→ ${new Date(b.checkOut).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Check-In / Check-Out Timestamps */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 font-body text-xs text-muted-foreground">
                      <span>Booked: {new Date(b.createdAt).toLocaleDateString()}</span>
                      {b.checkedInAt && (
                        <span className="text-blue-700 font-medium">
                          Checked-in: {new Date(b.checkedInAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          {b.guestDigitalSignature ? ` (${b.guestDigitalSignature})` : ''}
                        </span>
                      )}
                      {b.checkedOutAt && (
                        <span className="text-emerald-700 font-medium">
                          Checked-out: {new Date(b.checkedOutAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* Operational Action Buttons Bar */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                      {/* Check-in button */}
                      {canPartnerCheckIn(b) && (
                        <button
                          onClick={() => openCheckInModal(b)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 font-body text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                          <LogIn size={13} />
                          Check-In Guest
                        </button>
                      )}

                      {/* Check-out button */}
                      {canPartnerCheckOut(b) && (
                        <button
                          onClick={() => openCheckOutModal(b)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 font-body text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                        >
                          <LogOut size={13} />
                          Check-Out Guest
                        </button>
                      )}

                      {/* Collect Balance button */}
                      {balanceDue > 0 && !['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus) && (
                        <button
                          onClick={() => openCollectModal(b)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-green/40 bg-brand-green/10 px-3.5 py-1.5 font-body text-xs font-semibold text-brand-green hover:bg-brand-green/20 transition-colors"
                        >
                          <IndianRupee size={13} />
                          Collect Balance (₹{balanceDue})
                        </button>
                      )}

                      {/* View Voucher / Invoice */}
                      <Link
                        to={`/bookings/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-body text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <Receipt size={13} className="text-muted-foreground" />
                        Invoice / Voucher
                      </Link>

                      {/* Toggle Details */}
                      <button
                        onClick={() => setExpandedBookingId((current) => (current === b.id ? '' : b.id))}
                        className="min-h-9 rounded-lg border border-border bg-background px-3 py-1.5 font-body text-xs hover:bg-muted font-medium"
                      >
                        {expandedBookingId === b.id ? 'Hide Details' : 'Full Details'}
                      </button>

                      {/* Dharamshala Request Actions */}
                      {canDecideDharamshala(b) && (
                        <>
                          <button
                            onClick={() => handleAcceptDharamshala(b.id, 'full_online')}
                            className="min-h-9 rounded-lg bg-brand-green px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-brand-green/90"
                          >
                            Accept (Online)
                          </button>
                          {String(b.propertyType || '').toLowerCase() === 'dharamshala' && (
                            <button
                              onClick={() => handleAcceptDharamshala(b.id, 'pay_at_dharamshala')}
                              className="min-h-9 rounded-lg bg-brand-gold px-3 py-1.5 font-body text-xs text-foreground hover:bg-brand-gold/90"
                            >
                              Pay at Desk
                            </button>
                          )}
                          <button
                            onClick={() => handleRejectDharamshala(b.id)}
                            className="min-h-9 rounded-lg bg-destructive px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-destructive/90"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Dharamshala Complete */}
                      {String(b.propertyType || '').toLowerCase() === 'dharamshala' && b.bookingStatus === 'checked_in' && (
                        <button
                          onClick={() => handleCompleteDharamshala(b.id)}
                          className="min-h-9 rounded-lg bg-brand-gold/10 px-3 py-1.5 font-body text-xs font-semibold text-brand-gold hover:bg-brand-gold/15"
                        >
                          Mark Completed
                        </button>
                      )}

                      {/* Mark No-Show */}
                      {canPartnerCheckIn(b) && (
                        <button
                          onClick={() => handleNoShow(b.id)}
                          className="min-h-9 rounded-lg bg-destructive/10 px-3 py-1.5 font-body text-xs font-semibold text-destructive hover:bg-destructive/15"
                        >
                          Mark No-Show
                        </button>
                      )}

                      {/* Partner Verify / Reject for Manual UPI */}
                      {needsPartnerVerify(b) && (
                        <>
                          <button
                            onClick={() => handlePartnerVerify(b.id)}
                            className="min-h-9 rounded-lg bg-brand-green px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-brand-green/90"
                          >
                            Verify Payment
                          </button>
                          <button
                            onClick={() => handlePartnerReject(b.id)}
                            className="min-h-9 rounded-lg bg-destructive px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-destructive/90"
                          >
                            Reject Payment
                          </button>
                        </>
                      )}

                      {/* Cancel Booking */}
                      {!['cancelled', 'expired', 'payment_failed', 'checked_out', 'settled'].includes(b.bookingStatus) && (
                        <button
                          onClick={() => {
                            setCancelBookingId(b.id);
                            setCancelReason('');
                            setCancelDetails('');
                          }}
                          className="min-h-9 rounded-lg bg-destructive/10 px-3 py-1.5 font-body text-xs text-destructive hover:bg-destructive/15 ml-auto"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>

                    {expandedBookingId === b.id && (
                      <div className="mt-3">
                        <BookingFormDetails booking={b} viewer="partner" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <RecordPagination page={page} total={filteredBookings.length} onPageChange={setPage} />
        </div>
      )}

      {/* ── Modal: Front-Desk Check-In ── */}
      {checkInBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-heading text-lg font-bold text-foreground">Guest Check-In</h3>
              <button
                onClick={() => setCheckInBooking(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 font-body text-sm">
              <div className="rounded-lg bg-muted/40 p-3 border border-border text-xs">
                <p className="font-semibold text-foreground">{checkInBooking.itemName}</p>
                <p className="text-muted-foreground mt-0.5">Booking ID: {checkInBooking.bookingId}</p>
                <p className="text-muted-foreground">Guest: {checkInBooking.customerFullName || checkInBooking.userName}</p>
              </div>
              <label className="block">
                <span className="font-body text-xs font-semibold text-foreground">Guest Full Name / Signature</span>
                <input
                  type="text"
                  value={guestSignature}
                  onChange={(e) => setGuestSignature(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter guest name for digital register"
                  autoFocus
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Check-in timestamp will be recorded permanently in the guest register and booking ledger.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCheckInBooking(null)}
                className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted"
                disabled={isSubmittingAction}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCheckIn}
                disabled={isSubmittingAction || !guestSignature.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 font-body text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingAction ? 'Checking In…' : 'Confirm Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Front-Desk Check-Out ── */}
      {checkOutBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-heading text-lg font-bold text-foreground">Guest Check-Out</h3>
              <button
                onClick={() => setCheckOutBooking(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 font-body text-sm">
              <div className="rounded-lg bg-muted/40 p-3 border border-border text-xs">
                <p className="font-semibold text-foreground">{checkOutBooking.itemName}</p>
                <p className="text-muted-foreground mt-0.5">Booking ID: {checkOutBooking.bookingId}</p>
                <p className="text-muted-foreground">Guest: {checkOutBooking.customerFullName || checkOutBooking.userName}</p>
              </div>

              {Number(checkOutBooking.balanceAmount || checkOutBooking.amountPayableAtProperty || 0) > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Outstanding Balance: ₹{checkOutBooking.balanceAmount || checkOutBooking.amountPayableAtProperty}</p>
                    <p className="mt-0.5 text-[11px]">
                      Ensure you collect desk balance before checking out the guest, or confirm checkout if settled offline.
                    </p>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="font-body text-xs font-semibold text-foreground">Checkout Notes / Room Condition (Optional)</span>
                <textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Key returned, room inspected, etc."
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Checking out will release all room inventory locks for this reservation and update payout eligibility.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCheckOutBooking(null)}
                className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted"
                disabled={isSubmittingAction}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCheckOut}
                disabled={isSubmittingAction}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-body text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingAction ? 'Checking Out…' : 'Confirm Check-Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Professional Desk Balance Collection ── */}
      {collectBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <IndianRupee size={16} />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground">Collect Desk Balance</h3>
              </div>
              <button
                onClick={() => setCollectBooking(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-body text-sm">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest Name:</span>
                  <span className="font-semibold text-foreground">{collectBooking.customerFullName || collectBooking.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-semibold text-brand-crimson">{collectBooking.bookingId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Booking Amount:</span>
                  <span className="font-semibold text-foreground">₹{Number(collectBooking.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Online Advance Received:</span>
                  <span className="font-semibold text-foreground">₹{Number(collectBooking.amountPaidOnline || collectBooking.advanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prior Desk Collections:</span>
                  <span className="font-semibold text-foreground">₹{Number(collectBooking.amountPaidToProperty || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-medium">
                  <span className="text-brand-crimson">Remaining Balance Due:</span>
                  <span className="font-bold text-brand-green text-sm">
                    ₹{Number(collectBooking.balanceAmount || collectBooking.amountPayableAtProperty || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <label className="block">
                <span className="font-body text-xs font-semibold text-foreground">Collection Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  max={Number(collectBooking.balanceAmount || collectBooking.amountPayableAtProperty || 0)}
                  value={collectAmount || ''}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                  placeholder="Enter collected amount"
                />
              </label>

              {/* Payment Method Selector */}
              <div>
                <span className="block font-body text-xs font-semibold text-foreground mb-1.5">Payment Method</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'upi', 'card'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCollectMethod(method)}
                      className={`py-2 rounded-lg border text-xs font-medium uppercase tracking-wider transition-colors ${
                        collectMethod === method
                          ? 'border-brand-green bg-brand-green/10 text-brand-green font-bold'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Receipt / Invoice Number */}
              <label className="block">
                <span className="font-body text-xs font-semibold text-foreground">Property Receipt # (Optional)</span>
                <input
                  type="text"
                  value={collectReceipt}
                  onChange={(e) => setCollectReceipt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                  placeholder="e.g. REC-2026-0042"
                />
              </label>

              {/* Desk Notes */}
              <label className="block">
                <span className="font-body text-xs font-semibold text-foreground">Desk Notes (Optional)</span>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                  placeholder="e.g. Paid at front-desk counter"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCollectBooking(null)}
                className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted"
                disabled={isSubmittingAction}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCollectBalance}
                disabled={isSubmittingAction || !collectAmount || collectAmount <= 0}
                className="rounded-lg bg-brand-green px-5 py-2 font-body text-xs font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
              >
                {isSubmittingAction ? 'Recording…' : `Collect ₹${collectAmount.toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cancel Booking ── */}
      {cancelBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-heading text-lg font-bold text-foreground">Cancel Booking</h3>
            <p className="mt-1 font-body text-xs text-muted-foreground">
              Provide a clear cancellation reason and refund timeline for the customer.
            </p>
            <div className="mt-4 space-y-3 font-body text-sm">
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Short reason (e.g. Property maintenance, Guest request)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm"
              />
              <textarea
                value={cancelDetails}
                onChange={(e) => setCancelDetails(e.target.value)}
                rows={3}
                placeholder="Detailed explanation and support instructions"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-body text-sm"
              />
              <p className="font-body text-[11px] text-muted-foreground">
                Cancellation charges and customer refund rules apply as approved by platform policies.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCancelBookingId('');
                  setCancelReason('');
                  setCancelDetails('');
                }}
                className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={handlePartnerCancel}
                className="rounded-lg bg-destructive px-4 py-2 font-body text-xs font-semibold text-white hover:bg-destructive/90"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerBookings;
