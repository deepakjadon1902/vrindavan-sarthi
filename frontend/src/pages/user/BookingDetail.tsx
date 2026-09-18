import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBookingStore } from '@/store/bookingStore';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ArrowLeft, Calendar, MapPin, User, Phone, Mail, CreditCard, ClipboardList, XCircle, CheckCircle2, Clock, IndianRupee, Hotel, BedDouble, Car, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { api, withAuth } from '@/lib/api';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout failed to load'));
    document.body.appendChild(script);
  });

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { fetchBookingById, cancelBooking } = useBookingStore();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [modifyForm, setModifyForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    roomTypeId: '',
    roomQuantity: 1,
    adults: 1,
    children: 0,
    pets: false,
  });
  const [modifyPreview, setModifyPreview] = useState<any>(null);
  const [isPreviewingModification, setIsPreviewingModification] = useState(false);
  const [isSubmittingModification, setIsSubmittingModification] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      const b = await fetchBookingById(id);
      setBooking(b);
      setIsLoading(false);
    };
    void run();
  }, [fetchBookingById, id]);

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-20 pb-8 px-4 flex items-center justify-center">
          <div className="text-center">
            <p className="font-body text-sm text-muted-foreground">Loading booking...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!booking) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-20 pb-8 px-4 flex items-center justify-center">
          <div className="text-center">
            <ClipboardList size={64} className="mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">Booking Not Found</h2>
            <Link to="/bookings" className="font-body text-sm text-brand-crimson hover:underline">← Back to Bookings</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const typeIcon = {
    hotel: Hotel,
    room: BedDouble,
    cab: Car,
    tour: MapIcon,
    room_type: BedDouble,
  }[booking.bookingType];

  const TypeIcon = typeIcon || ClipboardList;

  const statusConfig = {
    confirmed: { color: 'bg-brand-green/10 text-brand-green border-brand-green/20', icon: CheckCircle2, label: 'Confirmed' },
    cancelled: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Cancelled' },
    expired: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Expired' },
    payment_failed: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Payment Failed' },
    completed: { color: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20', icon: CheckCircle2, label: 'Completed' },
    pending: { color: 'bg-muted text-muted-foreground border-border', icon: Clock, label: 'Pending' },
  }[booking.bookingStatus] || { color: 'bg-muted text-muted-foreground border-border', icon: Clock, label: String(booking.bookingStatus || 'Pending') };

  const StatusIcon = statusConfig.icon;

  const handleCancel = async () => {
    const needsReason = booking.bookingStatus === 'confirmed';
    const reason = needsReason ? window.prompt('Please enter a cancellation reason:') || '' : '';
    if (needsReason && !reason.trim()) return toast.error('Cancellation reason is required for confirmed bookings');
    const details = needsReason ? window.prompt('Please add cancellation details:') || '' : '';
    if (needsReason && !details.trim()) return toast.error('Cancellation details are required');
    const res = await cancelBooking(booking.id, reason.trim() || undefined, details.trim() || undefined);
    if (res.success) toast.success('Booking cancelled successfully');
    else toast.error(res.error || 'Cancel failed');
  };

  const verificationLabel = (() => {
    if (booking.isWaitlisted) return 'Waitlisted (awaiting room assignment)';
    const stage = String(booking.verificationStage || '');
    if (stage === 'verified') return 'Verified';
    if (stage === 'pending_partner') return 'Pending partner verification';
    if (stage === 'pending_admin') return 'Pending admin verification';
    if (stage === 'rejected') return 'Rejected';
    return booking.paymentMethod === 'doorstep' ? 'Pay at doorstep' : 'Verification pending';
  })();

  const viewItemHref = (() => {
    const type = String(booking.bookingType || '');
    if (type === 'room_type') {
      const rtId = booking.roomTypeId || booking.itemId;
      return rtId ? `/room-types/${rtId}` : '/rooms';
    }
    if (type === 'hotel') return booking.itemId ? `/hotels/${booking.itemId}` : '/hotels';
    if (type === 'cab') return booking.itemId ? `/cabs/${booking.itemId}` : '/cabs';
    if (type === 'tour') return booking.itemId ? `/tours/${booking.itemId}` : '/tours';
    return '/';
  })();

  const canReview = (() => {
    if (!booking?.hotelId || !booking?.checkOut) return false;
    if (!['confirmed', 'completed'].includes(String(booking.bookingStatus))) return false;
    return new Date(booking.checkOut).getTime() <= Date.now();
  })();

  const isHotelMarketplace =
    booking.service_billing_model === 'hotel_marketplace' ||
    ['hotel', 'room', 'room_type'].includes(String(booking.bookingType || ''));
  const formatMoney = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const roomAmount = Number(booking.baseAmount || booking.checkoutSubtotal || 0);
  const hotelTaxes = Number(booking.taxAmount || 0);
  const convenienceFee = Number(booking.convenienceFeeAmount || 0);
  const totalPayable = Number(booking.totalAmount || 0);
  const advancePaid = Number(booking.advanceAmount || (booking.paymentOption === 'advance_30' ? Math.round(totalPayable * 0.3) : totalPayable));
  const balancePayable = Number(booking.balanceAmount || Math.max(0, totalPayable - advancePaid));
  const customerName = booking.customerFullName || booking.userName || '-';
  const customerPhone = booking.customerMobile || booking.userPhone || '-';
  const customerEmail = booking.customerEmail || booking.userEmail || '-';
  const documentLabel = isHotelMarketplace ? 'Booking Confirmation & Payment Receipt' : 'Tax Invoice';
  const canModify =
    booking.bookingType === 'room_type' &&
    booking.bookingStatus === 'confirmed' &&
    booking.paymentStatus === 'paid';
  const modificationKey = () => {
    const random = window.crypto?.getRandomValues ? Array.from(window.crypto.getRandomValues(new Uint32Array(2))).join('-') : Math.random().toString(16).slice(2);
    return `modify:${booking.id}:${Date.now()}:${random}`;
  };

  const submitReview = async () => {
    if (!token || !booking?.id) return;
    try {
      setIsReviewing(true);
      await api.post('/reviews', { bookingId: booking.id, rating: reviewRating, text: reviewText }, withAuth(token));
      toast.success('Review submitted');
      setReviewText('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Review failed');
    } finally {
      setIsReviewing(false);
    }
  };

  const openModify = async () => {
    setModifyOpen(true);
    setModifyPreview(null);
    setModifyForm({
      checkInDate: booking.checkIn ? new Date(booking.checkIn).toISOString().slice(0, 10) : '',
      checkOutDate: booking.checkOut ? new Date(booking.checkOut).toISOString().slice(0, 10) : '',
      roomTypeId: booking.roomTypeId || booking.itemId || '',
      roomQuantity: Number(booking.roomQuantity || 1),
      adults: Number(booking.totalAdults || booking.guests || 1),
      children: Number(booking.totalChildren || 0),
      pets: Boolean(booking.hasPet),
    });
    if (booking.hotelId) {
      try {
        const res = await api.get(`/hotels/${booking.hotelId}/room-types`);
        setRoomTypes(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setRoomTypes([]);
      }
    }
  };

  const previewModification = async () => {
    if (!token || !booking?.id) return;
    try {
      setIsPreviewingModification(true);
      const res = await api.post(`/bookings/${booking.id}/modify/preview`, modifyForm, withAuth(token));
      setModifyPreview(res.data?.modification || null);
    } catch (err: any) {
      setModifyPreview(null);
      toast.error(err?.response?.data?.message || 'Modification preview failed');
    } finally {
      setIsPreviewingModification(false);
    }
  };

  const confirmModification = async () => {
    if (!token || !booking?.id || !modifyPreview?.inventoryAvailable) return;
    const idempotencyKey = modificationKey();
    try {
      setIsSubmittingModification(true);
      const res = await api.post(`/bookings/${booking.id}/modify`, modifyForm, {
        ...withAuth(token),
        headers: { ...(withAuth(token).headers || {}), 'Idempotency-Key': idempotencyKey },
      });
      const payment = res.data?.payment;
      const modification = res.data?.modification;
      if (payment?.order?.id && payment?.keyId) {
        await loadRazorpayCheckout();
        if (!window.Razorpay) throw new Error('Razorpay Checkout is not ready');
        const rzp = new window.Razorpay({
          key: payment.keyId,
          amount: payment.order.amount,
          currency: payment.order.currency || 'INR',
          name: 'Vrindavan Sarthi',
          description: `Additional payment for ${booking.bookingId}`,
          order_id: payment.order.id,
          handler: async (response: any) => {
            try {
              const verified = await api.post(`/bookings/${booking.id}/modify/payment`, {
                modificationId: modification?._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }, withAuth(token));
              setBooking(verified.data?.data || booking);
              toast.success('Booking modified');
              setModifyOpen(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.message || 'Additional payment verification failed');
            }
          },
          modal: {
            ondismiss: () => toast.error('Additional payment was not completed'),
          },
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
        });
        rzp.open();
        return;
      }
      setBooking(res.data?.data || booking);
      toast.success(modifyPreview.paymentAction === 'refund' ? 'Booking modified. Refund processing may take time.' : 'Booking modified');
      setModifyOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Booking modification failed');
    } finally {
      setIsSubmittingModification(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <button onClick={() => navigate('/bookings')} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft size={16} /> Back to My Bookings
          </button>

          {/* Header */}
          <div className="bg-card rounded-lg border border-border overflow-hidden mb-4">
            <div className="relative h-40 sm:h-52 bg-muted">
              {booking.itemImage && booking.itemImage !== '/placeholder.svg' ? (
                <img src={booking.itemImage} alt={booking.itemName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-crimson/10 to-brand-gold/10">
                  <TypeIcon size={64} className="text-muted-foreground/20" />
                </div>
              )}
              <div className="absolute top-4 left-4">
                <span className="font-body text-xs bg-foreground/80 text-primary-foreground px-3 py-1.5 rounded-full capitalize backdrop-blur-sm flex items-center gap-1.5">
                  <TypeIcon size={12} /> {booking.bookingType}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <span className={`font-body text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 backdrop-blur-sm ${statusConfig.color}`}>
                  <StatusIcon size={12} /> {statusConfig.label}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <p className="font-body text-xs text-brand-crimson font-medium mb-1">{booking.bookingId}</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-2">{booking.itemName}</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Booking Details */}
            <div className="lg:col-span-2 space-y-4">
              {/* Dates & Guests */}
              <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Booking Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {booking.checkIn && (
                    <div>
                      <p className="font-body text-xs text-muted-foreground mb-1">Check-in</p>
                      <p className="font-body text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar size={14} className="text-brand-crimson" />
                        {new Date(booking.checkIn).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {booking.checkOut && (
                    <div>
                      <p className="font-body text-xs text-muted-foreground mb-1">Check-out</p>
                      <p className="font-body text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar size={14} className="text-brand-gold" />
                        {new Date(booking.checkOut).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {booking.guests && (
                    <div>
                      <p className="font-body text-xs text-muted-foreground mb-1">Guests</p>
                      <p className="font-body text-sm font-medium text-foreground">{booking.guests} Guest(s)</p>
                    </div>
                  )}
                  <div>
                    <p className="font-body text-xs text-muted-foreground mb-1">Booked On</p>
                    <p className="font-body text-sm font-medium text-foreground">
                      {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {booking.additionalInfo && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="font-body text-xs text-muted-foreground mb-1">Additional Notes</p>
                    <p className="font-body text-sm text-foreground">{booking.additionalInfo}</p>
                  </div>
                )}

                {booking.bookingType === 'cab' && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="font-body text-xs text-muted-foreground mb-2">Cab Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-body text-sm">
                      <div><span className="text-muted-foreground text-xs block">Pickup</span><span className="font-medium">{booking.pickupLocation || '-'}</span></div>
                      <div><span className="text-muted-foreground text-xs block">Drop</span><span className="font-medium">{booking.dropLocation || '-'}</span></div>
                      <div><span className="text-muted-foreground text-xs block">Date</span><span className="font-medium">{booking.pickupDate || (booking.checkIn ? new Date(booking.checkIn).toLocaleDateString('en-IN') : '-') }</span></div>
                      <div><span className="text-muted-foreground text-xs block">Time</span><span className="font-medium">{booking.pickupTime || '-'}</span></div>
                      <div><span className="text-muted-foreground text-xs block">Cab Type</span><span className="font-medium">{booking.cabType || '-'}</span></div>
                      <div><span className="text-muted-foreground text-xs block">Fare</span><span className="font-medium">₹{Number(booking.cabFareTotal || booking.totalAmount || 0).toLocaleString('en-IN')}</span></div>
                    </div>

                    {booking.bookingStatus === 'confirmed' && (booking.assignedVehicleName || booking.assignedDriverName) ? (
                      <div className="mt-4 rounded-xl bg-secondary/40 border border-border p-4">
                        <p className="font-body text-xs text-muted-foreground mb-2">Assigned Driver</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-body text-sm">
                          <div><span className="text-muted-foreground text-xs block">Vehicle</span><span className="font-medium">{booking.assignedVehicleName || '-'}</span></div>
                          <div><span className="text-muted-foreground text-xs block">Vehicle Type</span><span className="font-medium">{booking.assignedVehicleType || '-'}</span></div>
                          <div><span className="text-muted-foreground text-xs block">Driver</span><span className="font-medium">{booking.assignedDriverName || '-'}</span></div>
                          <div><span className="text-muted-foreground text-xs block">Contact</span><span className="font-medium">{booking.assignedDriverPhone || '-'}</span></div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 font-body text-[11px] text-muted-foreground">Driver details will appear here after admin confirms your booking.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Guest Info */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Guest Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
                  <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><User size={14} className="text-brand-crimson" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium text-foreground break-words">{customerName}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-brand-gold/10 flex items-center justify-center"><Phone size={14} className="text-brand-gold" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-foreground break-words">{customerPhone}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3 md:col-span-2">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-brand-green/10 flex items-center justify-center"><Mail size={14} className="text-brand-green" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-foreground break-all">{customerEmail}</p>
                    </div>
                  </div>
                </div>
              </div>

              {modifyOpen && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Modify Booking</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="font-body text-xs text-muted-foreground">
                      Check-in
                      <input
                        type="date"
                        value={modifyForm.checkInDate}
                        onChange={(e) => setModifyForm((current) => ({ ...current, checkInDate: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="font-body text-xs text-muted-foreground">
                      Check-out
                      <input
                        type="date"
                        value={modifyForm.checkOutDate}
                        onChange={(e) => setModifyForm((current) => ({ ...current, checkOutDate: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="font-body text-xs text-muted-foreground sm:col-span-2">
                      Room Type
                      <select
                        value={modifyForm.roomTypeId}
                        onChange={(e) => setModifyForm((current) => ({ ...current, roomTypeId: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value={modifyForm.roomTypeId}>{booking.itemName}</option>
                        {roomTypes.map((rt) => (
                          <option key={rt._id || rt.id} value={rt._id || rt.id}>
                            {rt.name} - ₹{Number(rt.pricePerNight || 0).toLocaleString('en-IN')}/night
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="font-body text-xs text-muted-foreground">
                      Rooms
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={modifyForm.roomQuantity}
                        onChange={(e) => setModifyForm((current) => ({ ...current, roomQuantity: Number(e.target.value || 1) }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="font-body text-xs text-muted-foreground">
                      Adults
                      <input
                        type="number"
                        min={1}
                        value={modifyForm.adults}
                        onChange={(e) => setModifyForm((current) => ({ ...current, adults: Number(e.target.value || 1) }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="font-body text-xs text-muted-foreground">
                      Children
                      <input
                        type="number"
                        min={0}
                        value={modifyForm.children}
                        onChange={(e) => setModifyForm((current) => ({ ...current, children: Number(e.target.value || 0) }))}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={modifyForm.pets}
                        onChange={(e) => setModifyForm((current) => ({ ...current, pets: e.target.checked }))}
                      />
                      Pet travelling
                    </label>
                  </div>

                  {modifyPreview && (
                    <div className="mt-4 rounded-lg border border-border bg-background/70 p-4">
                      <div className="grid grid-cols-2 gap-3 font-body text-sm">
                        <div><span className="block text-xs text-muted-foreground">Current total</span><span className="font-semibold">{formatMoney(modifyPreview.oldAmount)}</span></div>
                        <div><span className="block text-xs text-muted-foreground">New total</span><span className="font-semibold">{formatMoney(modifyPreview.newAmount)}</span></div>
                        <div><span className="block text-xs text-muted-foreground">Availability</span><span className={modifyPreview.inventoryAvailable ? 'text-brand-green' : 'text-destructive'}>{modifyPreview.inventoryAvailable ? 'Available' : 'Unavailable'}</span></div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            {modifyPreview.paymentAction === 'additional_payment' ? 'Additional amount due' : modifyPreview.paymentAction === 'refund' ? 'Refund amount' : 'Price difference'}
                          </span>
                          <span className="font-semibold">
                            {formatMoney(modifyPreview.paymentAction === 'refund' ? modifyPreview.refundAmount : Math.abs(Number(modifyPreview.differenceAmount || 0)))}
                          </span>
                        </div>
                      </div>
                      {modifyPreview.paymentAction === 'refund' && (
                        <p className="mt-3 font-body text-xs text-muted-foreground">Refund processing may take time depending on Razorpay, the bank, and payment method.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={previewModification}
                      disabled={isPreviewingModification}
                      className="rounded-lg border border-border px-4 py-2 font-body text-xs font-semibold hover:bg-muted disabled:opacity-60"
                    >
                      {isPreviewingModification ? 'Checking...' : 'Check Availability'}
                    </button>
                    <button
                      onClick={confirmModification}
                      disabled={isSubmittingModification || !modifyPreview?.inventoryAvailable}
                      className="rounded-lg bg-brand-crimson px-4 py-2 font-body text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {isSubmittingModification ? 'Submitting...' : 'Confirm Modification'}
                    </button>
                    <button
                      onClick={() => setModifyOpen(false)}
                      className="rounded-lg border border-border px-4 py-2 font-body text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Sidebar */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-crimson mb-1">{documentLabel}</p>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Payment Summary</h3>
                <div className="space-y-3">
                  {isHotelMarketplace ? (
                    <>
                      <div className="flex justify-between gap-4 font-body text-sm">
                        <span className="text-muted-foreground">Room Amount</span>
                        <span className="font-semibold text-foreground">{formatMoney(roomAmount)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-body text-sm">
                        <span className="text-muted-foreground">Hotel Taxes</span>
                        <span className="font-semibold text-foreground">{formatMoney(hotelTaxes)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-body text-sm">
                        <span className="text-muted-foreground">Platform Convenience Fee</span>
                        <span className="font-semibold text-foreground">{formatMoney(convenienceFee)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between gap-4 font-body text-sm">
                    <span className="font-semibold text-foreground">Total Payable</span>
                    <span className="font-bold text-brand-crimson">{formatMoney(totalPayable)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-body text-sm">
                    <span className="text-muted-foreground">Advance Paid Online</span>
                    <span className="font-semibold text-brand-green">{formatMoney(advancePaid)}</span>
                  </div>
                  {isHotelMarketplace && (
                    <div className="flex justify-between gap-4 font-body text-sm">
                      <span className="text-muted-foreground">Balance at Property</span>
                      <span className="font-semibold text-foreground">{formatMoney(balancePayable)}</span>
                    </div>
                  )}
                  <div className="hidden">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-foreground">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground">{booking.paymentMethod === 'doorstep' ? 'Pay at Doorstep' : 'Online'}</span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="flex items-center gap-1 capitalize">
                      {booking.paymentStatus === 'paid' ? <CheckCircle2 size={12} className="text-brand-green" /> : booking.paymentStatus === 'failed' ? <XCircle size={12} className="text-destructive" /> : <Clock size={12} className="text-brand-saffron" />}
                      {booking.paymentStatus}
                    </span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Verification</span>
                    <span className="text-right text-foreground">{verificationLabel}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-body text-base">
                    <span className="font-semibold text-foreground">Booking Total</span>
                    <span className="font-bold text-brand-crimson text-lg">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {isHotelMarketplace && (
                    <p className="rounded-lg border border-brand-gold/25 bg-brand-cream/60 px-3 py-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                      This is not a tax invoice for accommodation. The property partner will issue the hotel tax invoice where applicable.
                    </p>
                  )}
                </div>
              </div>

              {booking.bookingStatus === 'confirmed' && (booking.partnerName || booking.partnerPhone) && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-heading text-sm font-semibold text-foreground mb-3">Partner Contact</h3>
                  <div className="space-y-2 font-body text-sm">
                    <p className="text-foreground">{booking.partnerName || '-'}</p>
                    {booking.partnerPhone && (
                      <a href={`tel:${booking.partnerPhone}`} className="inline-flex items-center gap-2 text-brand-crimson hover:underline">
                        <Phone size={14} /> {booking.partnerPhone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {canReview && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-heading text-sm font-semibold text-foreground mb-3">Rate Your Stay</h3>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>{rating} Star{rating > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                  <textarea
                    rows={4}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your experience"
                    className="mt-3 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm resize-none"
                  />
                  <button
                    onClick={submitReview}
                    disabled={isReviewing}
                    className="mt-3 w-full py-2.5 rounded-xl bg-brand-gold text-foreground font-body text-sm font-semibold disabled:opacity-60"
                  >
                    {isReviewing ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              )}

              {booking.bookingStatus === 'confirmed' && (
                <div className="space-y-2">
                  {canModify && (
                    <button
                      onClick={openModify}
                      className="w-full py-3 rounded-xl bg-brand-gold text-foreground font-body text-sm font-semibold hover:bg-brand-gold/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Calendar size={16} /> Modify Booking
                    </button>
                  )}
                  <button
                    onClick={handleCancel}
                    className="w-full py-3 rounded-xl border-2 border-destructive text-destructive font-body text-sm font-medium hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} /> Cancel Booking
                  </button>
                </div>
              )}

              <Link
                to={viewItemHref}
                className="block w-full py-3 rounded-xl bg-brand-crimson text-primary-foreground font-body text-sm font-medium text-center hover:bg-brand-crimson/90 transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default BookingDetail;
