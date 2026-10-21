import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBookingStore } from '@/store/bookingStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  CreditCard,
  ClipboardList,
  XCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Hotel,
  BedDouble,
  Car,
  Map as MapIcon,
  MessageCircle,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState, useRef } from 'react';
import { api, withAuth } from '@/lib/api';
import { getAuthoritativeBookingState, formatBookingStatus } from '@/lib/bookingStatus';
import { BookingCountdownTimer } from '@/components/BookingCountdownTimer';
import { BookingTimeline } from '@/components/BookingTimeline';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const loadRazorpayCheckout = (timeoutMs = 10000) =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    let timeoutId: ReturnType<typeof setTimeout>;
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      if (window.Razorpay) return resolve();
      const onExistingLoad = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      const onExistingError = () => {
        clearTimeout(timeoutId);
        reject(new Error('Razorpay Checkout failed to load'));
      };
      existing.addEventListener('load', onExistingLoad, { once: true });
      existing.addEventListener('error', onExistingError, { once: true });
      timeoutId = setTimeout(() => {
        existing.removeEventListener('load', onExistingLoad);
        existing.removeEventListener('error', onExistingError);
        if (window.Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay Checkout timed out while loading'));
        }
      }, timeoutMs);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    timeoutId = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error('Razorpay Checkout timed out while loading'));
      }
    }, timeoutMs);
    script.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Razorpay Checkout failed to load'));
    };
    document.body.appendChild(script);
  });

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const adminPhone = useSettingsStore((s) => s.settings.adminPhone);
  const { fetchBookingById, cancelBooking } = useBookingStore();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [isPayingDharamshala, setIsPayingDharamshala] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const refreshBooking = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsRefreshing(true);
      const b = await fetchBookingById(id);
      if (b) setBooking(b);
    } catch {
      // Keep existing booking on network blip
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

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

  // Bounded auto-polling for pending property confirmation
  useEffect(() => {
    if (!booking) return;
    const isAwaitingProperty = booking.bookingStatus === 'pending_property_confirmation';
    if (!isAwaitingProperty) return;

    const interval = setInterval(() => {
      void refreshBooking(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [booking?.bookingStatus, id]);

  const copyBookingId = () => {
    if (!booking?.bookingId) return;
    navigator.clipboard?.writeText(booking.bookingId);
    setCopiedId(true);
    toast.success('Booking ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-3 border-brand-crimson border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-heading text-base font-semibold text-foreground">Loading your booking details...</p>
            <p className="font-body text-xs text-muted-foreground">Retrieving verified reservation data from server</p>
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
        <div className="min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center">
          <div className="text-center max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
            <ClipboardList size={56} className="mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Booking Not Found</h2>
            <p className="font-body text-xs text-muted-foreground mb-6">We could not locate this reservation record. It may have expired or been removed.</p>
            <Link to="/bookings" className="inline-flex py-2.5 px-6 rounded-xl bg-brand-crimson text-white font-body text-sm font-semibold hover:bg-brand-crimson/90 transition-colors shadow-sm">
              Return to My Bookings
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const state = getAuthoritativeBookingState(booking);

  const handleCancel = async () => {
    const needsReason = booking.bookingStatus === 'confirmed';
    const policyNotice = 'Cancellation Schedule:\n• > 48h before check-in: 75% refund\n• 24h-48h before check-in: 50% refund\n• < 24h: 0% refund\n• 30% advance is non-refundable on voluntary cancellation.\n\nEnter cancellation reason:';
    const reason = needsReason ? window.prompt(policyNotice) || '' : '';
    if (needsReason && !reason.trim()) return toast.error('Cancellation reason is required for confirmed bookings');
    const details = needsReason ? window.prompt('Please add cancellation details:') || '' : '';
    if (needsReason && !details.trim()) return toast.error('Cancellation details are required');
    const res = await cancelBooking(booking.id, reason.trim() || undefined, details.trim() || undefined);
    if (res.success) {
      toast.success('Booking cancelled successfully');
      await refreshBooking();
    } else {
      toast.error(res.error || 'Cancel failed');
    }
  };

  const handleDisputeNoShow = async () => {
    const reason = window.prompt('Please explain why this no-show record is disputed (e.g. arrived at hotel, property closed, contact issue):') || '';
    if (!reason.trim()) return toast.error('Dispute reason is required');
    try {
      const res = await api.post(`/bookings/${booking.id}/no-show-dispute`, { reason: reason.trim() }, withAuth(token));
      setBooking(res.data?.data || booking);
      toast.success('Dispute submitted for admin review');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Dispute submission failed');
    }
  };

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
  const isDharamshalaBooking = String(booking.propertyType || '').toLowerCase() === 'dharamshala';
  const formatMoney = (value: unknown) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
  const roomAmount = Number(isDharamshalaBooking ? booking.dharamshalaAmount : (booking.baseAmount || booking.checkoutSubtotal || 0));
  const hotelTaxes = Number(booking.taxAmount || 0);
  const convenienceFee = Number(isDharamshalaBooking ? booking.vrindavanSarthiServiceFee : (booking.convenienceFeeAmount || 0));
  const totalPayable = Number(booking.totalAmount || 0);
  const advancePaid = Number(isDharamshalaBooking ? booking.amountPaidOnline : (booking.advanceAmount || (booking.paymentOption === 'advance_30' ? Math.round(totalPayable * 0.3) : totalPayable)));
  const balancePayable = Number(isDharamshalaBooking ? booking.amountPayableAtProperty : (booking.balanceAmount || Math.max(0, totalPayable - advancePaid)));

  // Strict contact mappings (P3: never mix guest phone with admin or partner phone)
  const customerName = booking.customerFullName || booking.userName || 'Guest';
  const customerPhone = booking.customerMobile || booking.userPhone || '-';
  const customerEmail = booking.customerEmail || booking.userEmail || '-';

  // Partner / Host contact
  const partnerWhatsapp = String(booking.partnerWhatsapp || booking.partnerPhone || '').replace(/\D/g, '');
  const showHostContact = state.isConfirmed && (booking.partnerName || booking.partnerPhone || booking.partnerEmail);

  // Razorpay prefill MUST strictly use customer's verified mobile number, NEVER platform admin phone
  const razorpayContact = String(customerPhone || '').replace(/\D/g, '');

  const canModify =
    booking.bookingType === 'room_type' &&
    booking.bookingStatus === 'confirmed' &&
    booking.paymentStatus === 'paid';

  const acceptedOnlineAmount = isDharamshalaBooking ? Number(booking.amountPaidOnline || 0) : Number(advancePaid || 0);

  const payAcceptedDharamshala = async () => {
    if (!token || !booking?.id || !state.canPay) return;

    if (state.isHoldExpired) {
      toast.error('Payment hold has expired. This booking request has timed out.');
      await refreshBooking();
      return;
    }

    try {
      setIsPayingDharamshala(true);
      await loadRazorpayCheckout();
      const orderRes = await api.post('/payments/razorpay/orders', { bookingId: booking.id }, withAuth(token));
      const data = orderRes.data?.data || {};
      const order = data.order || {};
      const keyId = String(data.keyId || '');
      if (!window.Razorpay || !keyId || !order.id) throw new Error('Razorpay Checkout is not ready');

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Vrindavan Sarthi',
        description: `${isDharamshalaBooking ? 'Dharamshala' : 'Room'} reservation: ${booking.bookingId}`,
        order_id: order.id,
        image: '/logo.png',
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: razorpayContact,
        },
        theme: {
          color: '#8a1f2d',
        },
        handler: async (response: any) => {
          try {
            setIsVerifyingPayment(true);
            const verifyRes = await api.post(
              '/payments/razorpay/verify',
              {
                bookingId: booking.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              withAuth(token)
            );
            const updatedBooking = verifyRes.data?.data || booking;
            const confirmedBookingId = updatedBooking.id || updatedBooking._id || booking.id;
            setBooking(updatedBooking);
            toast.success('Payment verified! Booking confirmed.');
            navigate(`/bookings/${confirmedBookingId}/confirmed`, { replace: true });
          } catch (err: any) {
            // Check if already processed
            if (err?.response?.data?.message === 'PAYMENT_ALREADY_PROCESSED') {
              const refreshed = await fetchBookingById(booking.id);
              if (refreshed) setBooking(refreshed);
              toast.success('Payment confirmed.');
              navigate(`/bookings/${booking.id}/confirmed`, { replace: true });
              return;
            }

            // Safe bounded poll to verify whether webhook settled payment
            for (let i = 0; i < 4; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const check = await fetchBookingById(booking.id);
              if (check && (check.paymentStatus === 'paid' || check.bookingStatus === 'confirmed')) {
                setBooking(check);
                toast.success('Payment verified! Booking confirmed.');
                navigate(`/bookings/${booking.id}/confirmed`, { replace: true });
                return;
              }
            }

            toast.error(err?.response?.data?.message || 'Payment verification failed');
          } finally {
            setIsVerifyingPayment(false);
            setIsPayingDharamshala(false);
          }
        },
        modal: {
          ondismiss: async () => {
            setIsVerifyingPayment(true);
            // Safe bounded poll: check if user paid via UPI QR or asynchronous flow before closing modal
            let confirmed = false;
            for (let i = 0; i < 4; i++) {
              try {
                const latest = await fetchBookingById(booking.id);
                if (latest && (latest.paymentStatus === 'paid' || latest.bookingStatus === 'confirmed')) {
                  setBooking(latest);
                  toast.success('Payment verified! Booking confirmed.');
                  confirmed = true;
                  navigate(`/bookings/${booking.id}/confirmed`, { replace: true });
                  break;
                }
              } catch {}
              if (i < 3) await new Promise((r) => setTimeout(r, 2000));
            }
            setIsVerifyingPayment(false);
            setIsPayingDharamshala(false);

            if (!confirmed) {
              toast.message('Checkout closed. If funds were debited, your booking will be confirmed automatically upon bank settlement.');
            }
          },
        },
      });

      (rzp as any).on?.('payment.failed', (response: any) => {
        setIsPayingDharamshala(false);
        setIsVerifyingPayment(false);
        toast.error(response?.error?.description || 'Razorpay payment failed');
      });

      rzp.open();
    } catch (err: any) {
      setIsPayingDharamshala(false);
      setIsVerifyingPayment(false);
      const msg = err?.response?.data?.message || err?.message || 'Unable to start payment';
      if (msg === 'PAYMENT_HOLD_EXPIRED') {
        toast.error('Payment hold has expired. The reserved room inventory has been released.');
        await refreshBooking();
      } else if (msg === 'PAYMENT_ALREADY_PROCESSED') {
        toast.success('Payment is already processed!');
        await refreshBooking();
      } else {
        toast.error(msg);
      }
    }
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
    const idempotencyKey = `modify:${booking.id}:${Date.now()}`;
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
            contact: razorpayContact,
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

  const typeIcon = {
    hotel: Hotel,
    room: BedDouble,
    room_type: BedDouble,
    cab: Car,
    tour: MapIcon,
  }[String(booking.bookingType || 'hotel')] || Hotel;
  const TypeIcon = typeIcon;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#faf8f5] pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground">
            <Link to="/bookings" className="hover:text-brand-crimson transition-colors flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>My Bookings</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-foreground font-semibold">{booking.bookingId}</span>
          </nav>

          {/* Hero Header Card (Airbnb Style) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-body text-xs font-semibold text-secondary-foreground capitalize">
                    <TypeIcon size={12} className="text-brand-crimson" />
                    {booking.propertyType || booking.bookingType || 'Lodging'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-bold ${
                      state.variant === 'success'
                        ? 'bg-brand-green/12 text-brand-green'
                        : state.variant === 'warning' || state.variant === 'info'
                        ? 'bg-brand-saffron/12 text-brand-saffron'
                        : state.variant === 'destructive'
                        ? 'bg-destructive/12 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {state.badgeLabel}
                  </span>
                </div>

                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground">
                  {booking.itemName}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-3 font-body text-xs text-muted-foreground">
                  <button
                    onClick={copyBookingId}
                    className="inline-flex items-center gap-1.5 font-mono font-medium hover:text-brand-crimson transition-colors"
                  >
                    <span>ID: {booking.bookingId}</span>
                    {copiedId ? <Check size={12} className="text-brand-green" /> : <Copy size={12} />}
                  </button>
                  <span>•</span>
                  <span>Booked on {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Status Action / Refresh */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <button
                  onClick={() => refreshBooking()}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  title="Check live status from server"
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-brand-crimson' : ''} />
                  <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
                </button>
                <Link
                  to={viewItemHref}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  <span>View Listing</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>

            {/* Authoritative Hero Status Banner */}
            <div
              className={`mt-6 rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 ${
                state.variant === 'success'
                  ? 'border-brand-green/25 bg-brand-green/5 text-foreground'
                  : state.variant === 'warning' || state.variant === 'info'
                  ? 'border-brand-saffron/30 bg-brand-saffron/5 text-foreground'
                  : state.variant === 'destructive'
                  ? 'border-destructive/25 bg-destructive/5 text-foreground'
                  : 'border-border bg-secondary/40 text-foreground'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {state.variant === 'success' ? (
                  <CheckCircle2 size={22} className="text-brand-green" />
                ) : state.variant === 'warning' || state.variant === 'info' ? (
                  <Clock size={22} className="text-brand-saffron" />
                ) : state.variant === 'destructive' ? (
                  <AlertCircle size={22} className="text-destructive" />
                ) : (
                  <ShieldCheck size={22} className="text-brand-crimson" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-heading text-sm sm:text-base font-bold text-foreground">
                  {state.heroTitle}
                </h4>
                <p className="mt-0.5 font-body text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {state.heroSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Active Countdown Timer (Prominently rendered when active) */}
          {state.activeTimerType !== 'none' && state.activeExpiresAt && (
            <BookingCountdownTimer
              timerType={state.activeTimerType}
              expiresAt={state.activeExpiresAt}
              onExpire={() => refreshBooking()}
            />
          )}

          {/* Main 2-Column Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6 items-start">
            {/* Left Column: Property, Stay, Timeline, Guest & Host info */}
            <div className="space-y-6">
              {/* Stay & Room Details Card */}
              <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <h3 className="font-heading text-base font-bold text-foreground">Stay Details</h3>
                  {booking.roomQuantity && (
                    <span className="font-body text-xs text-muted-foreground font-medium">
                      {booking.roomQuantity} room(s)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4">
                    <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Calendar size={13} className="text-brand-crimson" /> Check-in
                    </p>
                    <p className="font-heading text-sm sm:text-base font-bold text-foreground">
                      {booking.checkIn ? new Date(booking.checkIn).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                    </p>
                    <p className="text-[11px] font-body text-muted-foreground">{booking.checkInTime || '12:00 PM'}</p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4">
                    <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Calendar size={13} className="text-brand-gold" /> Check-out
                    </p>
                    <p className="font-heading text-sm sm:text-base font-bold text-foreground">
                      {booking.checkOut ? new Date(booking.checkOut).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                    </p>
                    <p className="text-[11px] font-body text-muted-foreground">11:00 AM</p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4 col-span-2 sm:col-span-1">
                    <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <User size={13} className="text-brand-saffron" /> Occupancy
                    </p>
                    <p className="font-heading text-sm sm:text-base font-bold text-foreground">
                      {booking.guests || booking.totalAdults || 1} Guest(s)
                    </p>
                    <p className="text-[11px] font-body text-muted-foreground">
                      {booking.roomNumbers?.length ? `Room ${booking.roomNumbers.join(', ')}` : 'Room allocated'}
                    </p>
                  </div>
                </div>

                {/* Additional Notes */}
                {booking.additionalInfo && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs font-body text-muted-foreground">
                    <strong className="text-foreground">Notes: </strong>{booking.additionalInfo}
                  </div>
                )}
              </div>

              {/* Booking Progress Timeline */}
              <BookingTimeline booking={booking} state={state} />

              {/* Guest Information Card (P3: Verified correct customer contact) */}
              <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm">
                <h3 className="font-heading text-base font-bold text-foreground mb-4 pb-3 border-b border-border/60 flex items-center justify-between">
                  <span>Guest Information</span>
                  <span className="font-body text-xs text-muted-foreground font-normal">Primary Traveller</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body">
                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4">
                    <span className="text-muted-foreground block text-[11px] mb-1">Full Name</span>
                    <span className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
                      <User size={14} className="text-brand-crimson" /> {customerName}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4">
                    <span className="text-muted-foreground block text-[11px] mb-1">Phone Number</span>
                    <span className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
                      <Phone size={14} className="text-brand-green" /> {customerPhone}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-[#faf8f5] p-4 sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px] mb-1">Email Address</span>
                    <span className="font-heading text-sm font-bold text-foreground flex items-center gap-2 break-all">
                      <Mail size={14} className="text-brand-gold" /> {customerEmail}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property Host Contact Card (Only shown when allowed/confirmed) */}
              {showHostContact ? (
                <div className="rounded-3xl border border-brand-gold/30 bg-card p-6 shadow-sm">
                  <h3 className="font-heading text-base font-bold text-foreground mb-3 pb-3 border-b border-border/60 flex items-center gap-2">
                    <Hotel size={18} className="text-brand-crimson" />
                    <span>Host / Property Contact</span>
                  </h3>
                  <p className="font-body text-xs text-muted-foreground mb-4 leading-relaxed">
                    Your reservation is confirmed. You can reach out directly to your host for check-in assistance or property directions.
                  </p>

                  <div className="space-y-3 font-body text-sm">
                    <p className="font-bold text-foreground">{booking.partnerName || 'Property Partner'}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {booking.partnerPhone && (
                        <a
                          href={`tel:${booking.partnerPhone}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-crimson/30 bg-brand-crimson/5 px-4 py-2 font-body text-xs font-bold text-brand-crimson hover:bg-brand-crimson/10 transition-colors"
                        >
                          <Phone size={13} /> Call {booking.partnerPhone}
                        </a>
                      )}
                      {partnerWhatsapp && (
                        <a
                          href={`https://wa.me/${partnerWhatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/5 px-4 py-2 font-body text-xs font-bold text-brand-green hover:bg-brand-green/10 transition-colors"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      )}
                      {booking.partnerEmail && (
                        <a
                          href={`mailto:${booking.partnerEmail}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                        >
                          <Mail size={13} /> Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs font-body text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={14} className="text-muted-foreground" />
                    <span>Host Contact Protection</span>
                  </p>
                  Direct property contact details are unlocked automatically once your booking is confirmed.
                </div>
              )}

              {/* Devotional Support Helpline Card */}
              <div className="rounded-3xl border border-brand-gold/30 bg-brand-cream/60 p-5 sm:p-6 text-xs font-body leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground flex items-center gap-2 mb-1.5 text-sm font-heading">
                  <ShieldCheck size={16} className="text-brand-crimson" />
                  <span>Vrindavan Sarthi 24/7 Pilgrimage Support</span>
                </p>
                Need help with your Braj yatra or reservation? Our dedicated support team is available around the clock.
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href="tel:+918679820256"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border px-3.5 py-1.5 font-body text-xs font-bold text-foreground hover:border-brand-crimson transition-colors"
                  >
                    <Phone size={12} className="text-brand-crimson" />
                    <span>+91 86798 20256</span>
                  </a>
                  <span className="text-[11px] text-muted-foreground">Toll-free pilgrim desk</span>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Pricing, Payment Transparency & Action Card */}
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-brand-gold/30 bg-card p-6 shadow-sm space-y-5">
                <div className="pb-3 border-b border-border/60">
                  <h3 className="font-heading text-lg font-bold text-foreground">Payment Summary</h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">Transparent fee breakdown</p>
                </div>

                <div className="space-y-3 font-body text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Room Tariff</span>
                    <span className="font-medium text-foreground">{formatMoney(roomAmount)}</span>
                  </div>

                  {hotelTaxes > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Taxes & GST</span>
                      <span className="font-medium text-foreground">{formatMoney(hotelTaxes)}</span>
                    </div>
                  )}

                  {convenienceFee > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Service / Platform Fee</span>
                      <span className="font-medium text-foreground">{formatMoney(convenienceFee)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/60 flex justify-between gap-4">
                    <span className="font-bold text-foreground text-base">Total Payable</span>
                    <span className="font-extrabold text-brand-crimson text-lg">{formatMoney(totalPayable)}</span>
                  </div>

                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-muted-foreground">Paid Online</span>
                    <span className="font-bold text-brand-green">{formatMoney(advancePaid)}</span>
                  </div>

                  {balancePayable > 0 && (
                    <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 flex justify-between items-center gap-4 text-xs">
                      <span className="font-bold text-foreground">Balance at Property</span>
                      <span className="font-extrabold text-brand-crimson text-sm">{formatMoney(balancePayable)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/50 flex justify-between gap-4 text-xs">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="font-bold capitalize text-foreground flex items-center gap-1">
                      {booking.paymentStatus === 'paid' ? (
                        <CheckCircle2 size={13} className="text-brand-green" />
                      ) : (
                        <Clock size={13} className="text-brand-saffron" />
                      )}
                      {booking.paymentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Primary State Action Box */}
                <div className="pt-2">
                  {/* Case 1: Payment Verifying State */}
                  {isVerifyingPayment ? (
                    <div className="rounded-2xl border border-brand-saffron/40 bg-brand-saffron/10 p-4 text-center space-y-2.5">
                      <div className="w-7 h-7 border-2 border-brand-crimson border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="font-heading text-sm font-bold text-foreground">Verifying Payment...</p>
                      <p className="font-body text-xs text-muted-foreground leading-relaxed">
                        Communicating with your bank and confirming room allocation. Please do not close or reload this window.
                      </p>
                    </div>
                  ) : state.canPay ? (
                    /* Case 2: Awaiting Customer Payment */
                    <div className="space-y-3">
                      <button
                        onClick={payAcceptedDharamshala}
                        disabled={isPayingDharamshala || isVerifyingPayment}
                        className="w-full py-3.5 px-4 rounded-2xl bg-brand-crimson text-white font-body text-sm font-bold hover:bg-brand-crimson/90 transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <CreditCard size={17} />
                        <span>{isPayingDharamshala ? 'Opening Razorpay...' : `Pay ${formatMoney(acceptedOnlineAmount)} & Confirm`}</span>
                      </button>
                      <p className="font-body text-[11px] text-center text-muted-foreground leading-relaxed">
                        Secured by 256-bit encrypted Razorpay Checkout. UPI, Cards & Netbanking accepted.
                      </p>
                    </div>
                  ) : state.isAwaitingApproval ? (
                    /* Case 3: Awaiting Property Approval */
                    <div className="rounded-2xl border border-brand-saffron/30 bg-brand-saffron/5 p-4 text-center space-y-2.5">
                      <Clock size={24} className="mx-auto text-brand-saffron" />
                      <p className="font-heading text-sm font-bold text-foreground">Awaiting Host Confirmation</p>
                      <p className="font-body text-xs text-muted-foreground leading-relaxed">
                        The property partner is checking availability. Once approved, the payment option will unlock here.
                      </p>
                      <button
                        onClick={() => refreshBooking()}
                        disabled={isRefreshing}
                        className="w-full mt-2 py-2 px-3 rounded-xl border border-border bg-card font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>Check Approval Status</span>
                      </button>
                    </div>
                  ) : state.isConfirmed ? (
                    /* Case 4: Booking Confirmed */
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-center">
                        <CheckCircle2 size={24} className="mx-auto text-brand-green mb-1.5" />
                        <p className="font-heading text-sm font-bold text-foreground">Reservation Confirmed</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5">Your room is guaranteed for check-in.</p>
                      </div>

                      {canModify && (
                        <button
                          onClick={openModify}
                          className="w-full py-3 rounded-2xl bg-brand-gold text-foreground font-body text-sm font-bold hover:bg-brand-gold/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Calendar size={15} /> Modify Dates / Guests
                        </button>
                      )}

                      <button
                        onClick={handleCancel}
                        className="w-full py-2.5 rounded-2xl border border-destructive/40 text-destructive font-body text-xs font-semibold hover:bg-destructive/5 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle size={14} /> Cancel Reservation
                      </button>
                    </div>
                  ) : state.code === 'expired' || state.code === 'expired_property_no_response' || state.code === 'rejected_by_property' ? (
                    /* Case 5: Expired / Declined */
                    <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-center space-y-3">
                      <AlertCircle size={24} className="mx-auto text-destructive" />
                      <div>
                        <p className="font-heading text-sm font-bold text-foreground">
                          {state.code === 'rejected_by_property'
                            ? 'Property Unavailable'
                            : 'Booking Window Expired'}
                        </p>
                        <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">
                          {state.code === 'rejected_by_property'
                            ? 'The property was unable to confirm these dates.'
                            : 'The active hold or response window lapsed without completion.'}
                        </p>
                      </div>
                      <Link
                        to="/hotels"
                        className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-brand-crimson text-white font-body text-xs font-bold hover:bg-brand-crimson/90 transition-colors shadow-sm"
                      >
                        Find Another Stay in Braj
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default BookingDetail;
