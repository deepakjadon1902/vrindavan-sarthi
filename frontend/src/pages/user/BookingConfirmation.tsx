import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, CreditCard, Home, Mail, Phone, Calendar, ArrowRight, ShieldCheck, Clock, MapPin, Navigation, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking } from '@/store/bookingStore';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import { getAuthoritativeBookingState } from '@/lib/bookingStatus';
import BookingCountdownTimer from '@/components/BookingCountdownTimer';
import BookingTimeline from '@/components/BookingTimeline';

const resolvePropertyDirectionsUrl = (input: {
  mapValue?: string;
  name?: string;
  location?: string;
  nearestTemple?: string;
}): string | null => {
  const raw = String(input.mapValue || '').trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const name = String(input.name || '').trim();
  const location = String(input.location || '').trim();
  if (!name && !location) {
    return null;
  }
  const parts = [name, location, input.nearestTemple ? `Near ${input.nearestTemple}` : '', 'Vrindavan'].filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
};

const formatMoney = (value?: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const BookingConfirmation = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const guestToken = searchParams.get('token') || searchParams.get('guestAccessToken') || '';
  const { token } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!booking) return;
    try {
      setIsDownloadingInvoice(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (guestToken) headers['x-guest-booking-token'] = guestToken;
      const targetId = booking.id || booking._id || id;
      const url = guestToken
        ? `/bookings/${targetId}/invoice?guestAccessToken=${encodeURIComponent(guestToken)}`
        : `/bookings/${targetId}/invoice`;

      const response = await api.get(url, {
        headers,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const filename = `booking-receipt-${booking.bookingId || targetId}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Booking receipt downloaded successfully');
    } catch (err: any) {
      let msg = 'Could not download receipt. Please try again or contact support.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json?.message) msg = json.message;
        } catch {
          // fallback
        }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      toast.error(msg);
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const fetchBooking = async () => {
    if (!id || (!token && !guestToken)) {
      setIsLoading(false);
      return;
    }
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (guestToken) headers['x-guest-booking-token'] = guestToken;
      const url = guestToken
        ? `/bookings/${id}?guestAccessToken=${encodeURIComponent(guestToken)}`
        : `/bookings/${id}`;
      const res = await api.get(url, { headers });
      const raw = res.data?.data;
      setBooking(raw ? { ...raw, id: raw.id || raw._id } : null);
    } catch {
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooking();
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchBooking();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [id, token, guestToken]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] px-4 pt-24 pb-16 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="w-10 h-10 border-3 border-brand-crimson border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-heading text-base font-semibold text-foreground">Preparing confirmation...</p>
          <p className="mt-1 font-body text-xs text-muted-foreground">Retrieving verified booking record from server</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[70vh] px-4 pt-24 pb-16 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/40" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Booking not found</h1>
          <p className="mt-2 font-body text-xs text-muted-foreground">This reservation record could not be located.</p>
          <Link to="/bookings" className="mt-6 inline-flex rounded-xl bg-brand-crimson px-6 py-2.5 font-body text-sm font-semibold text-primary-foreground shadow-sm">
            Go to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const state = getAuthoritativeBookingState(booking);
  const isConfirmed = state.isConfirmed;
  const paidAmount = Number(booking.paymentStatus === 'paid' ? (booking.advanceAmount || booking.amountPaidOnline || booking.totalAmount || 0) : 0);
  const balanceAtProperty = Number(booking.amountPayableAtProperty || booking.balanceAmount || Math.max(0, Number(booking.totalAmount || 0) - paidAmount));
  const customerName = booking.customerFullName || booking.userName || 'Guest';
  const customerPhone = booking.customerMobile || booking.userPhone || '-';
  const customerEmail = booking.customerEmail || booking.userEmail || '-';

  const propertyName = booking.propertyName || String(booking.itemName || '').split(' - ')[0] || booking.partnerName || 'Property';
  const propertyLocation = booking.propertyLocation || booking.propertyAddress || '';
  const nearestTemple = booking.nearestTemple || '';
  const directionsUrl = resolvePropertyDirectionsUrl({
    mapValue: booking.googleMapLink,
    name: propertyName,
    location: propertyLocation,
    nearestTemple,
  });
  const partnerPhone = booking.partnerPhone || booking.partnerWhatsapp || '';
  const showContact = Boolean(partnerPhone && (state.isConfirmed || booking.bookingStatus === 'awaiting_customer_payment'));

  const rawBookingStatus = String(booking.bookingStatus || '').toLowerCase();
  const rawPaymentStatus = String(booking.paymentStatus || '').toLowerCase();
  const canDownloadReceipt = Boolean(
    booking &&
    rawPaymentStatus !== 'failed' &&
    (
      rawPaymentStatus === 'paid' ||
      paidAmount > 0 ||
      ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(rawBookingStatus)
    ) &&
    !(
      ['pending', 'pending_property_confirmation', 'awaiting_customer_payment', 'rejected_by_property', 'expired', 'expired_property_no_response'].includes(rawBookingStatus) &&
      rawPaymentStatus !== 'paid'
    )
  );

  return (
    <div className="min-h-[75vh] px-4 pt-20 sm:pt-24 pb-8 sm:pb-12 bg-background">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Hero Card */}
        <div className="overflow-hidden rounded-3xl border border-brand-gold/30 bg-card shadow-sm">
          <div className="border-b border-brand-gold/20 bg-brand-gold/10 px-6 py-8 sm:py-10 text-center">
            <div className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl ${isConfirmed ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-gold/20 text-brand-crimson'}`}>
              {isConfirmed ? <CheckCircle2 size={36} /> : <Clock size={36} />}
            </div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-brand-crimson">Vrindavan Sarthi</p>
            <h1 className="mt-2 font-heading text-2xl sm:text-4xl font-extrabold text-foreground">
              {state.heroTitle}
            </h1>
            <p className="mx-auto mt-2.5 max-w-2xl font-body text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Radhe Radhe, {customerName}. {state.heroSubtitle}
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-1.5 font-mono text-xs font-semibold text-foreground">
              <span>Booking ID:</span>
              <span className="font-bold text-brand-crimson">{booking.bookingId}</span>
            </div>
          </div>

          {/* Active Countdown Timer (if in approval or payment hold window) */}
          {state.activeTimerType !== 'none' && state.activeExpiresAt && (
            <div className="p-5 sm:p-6 border-b border-border/60 bg-background/50">
              <BookingCountdownTimer
                timerType={state.activeTimerType}
                expiresAt={state.activeExpiresAt}
                onExpire={fetchBooking}
              />
            </div>
          )}

          {/* 2-Column Content Layout */}
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Left Column: Stay & Guest Details */}
            <div className="space-y-6">
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-brand-crimson">Accommodation</p>
                <h2 className="mt-1 font-heading text-xl sm:text-2xl font-bold text-foreground">{booking.itemName}</h2>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  <span className="h-2 w-2 rounded-full bg-brand-green" />
                  {state.badgeLabel}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5"><Calendar size={13} /> Check-in</p>
                  <p className="mt-1 font-heading text-sm sm:text-base font-bold text-foreground">{formatDate(booking.checkIn)}</p>
                  <p className="text-[11px] font-body text-muted-foreground">{booking.checkInTime || '12:00 PM'}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5"><Calendar size={13} /> Check-out</p>
                  <p className="mt-1 font-heading text-sm sm:text-base font-bold text-foreground">{formatDate(booking.checkOut)}</p>
                  <p className="text-[11px] font-body text-muted-foreground">11:00 AM</p>
                </div>
              </div>

              {/* Property Location & Directions */}
              {(propertyLocation || directionsUrl) && (
                <div className="rounded-2xl border border-border/80 bg-background/60 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-xs font-bold uppercase tracking-wider text-brand-crimson flex items-center gap-1.5">
                        <MapPin size={13} />
                        <span>Property Location & Directions</span>
                      </p>
                      <h3 className="mt-1 font-heading text-base font-bold text-foreground">
                        {propertyName}
                      </h3>
                      {propertyLocation && (
                        <p className="mt-1 font-body text-xs text-muted-foreground leading-relaxed">
                          {propertyLocation}
                        </p>
                      )}
                      {nearestTemple && (
                        <p className="mt-1 font-body text-xs font-medium text-brand-gold">
                          Landmark: Near {nearestTemple}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2.5">
                    {directionsUrl && (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-crimson px-3.5 py-2 font-body text-xs font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm"
                      >
                        <Navigation size={13} />
                        <span>Get Directions / Open in Maps</span>
                        <ExternalLink size={12} className="opacity-70" />
                      </a>
                    )}
                    {showContact && (
                      <a
                        href={`tel:${partnerPhone.replace(/\D/g, '')}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                      >
                        <Phone size={13} className="text-brand-crimson" />
                        <span>Call Reception ({partnerPhone})</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Guest Information */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4 sm:p-5">
                <h4 className="font-heading text-sm font-bold text-foreground mb-3">Guest Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-body">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Primary Guest</span>
                    <span className="font-semibold text-foreground">{customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Mobile Number</span>
                    <span className="font-semibold text-foreground flex items-center gap-1"><Phone size={12} /> {customerPhone}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Email Address</span>
                    <span className="font-semibold text-foreground flex items-center gap-1"><Mail size={12} /> {customerEmail}</span>
                  </div>
                </div>
              </div>

              {/* Booking Progress Timeline */}
              <BookingTimeline booking={booking} state={state} />
            </div>

            {/* Right Column: Pricing & Primary Action */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-gold/30 bg-card p-5 sm:p-6 shadow-sm">
                <p className="font-heading text-base font-bold text-foreground pb-3 border-b border-border/60">
                  Payment Summary
                </p>

                <div className="mt-4 space-y-2.5 font-body text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Booking Total</span>
                    <span className="font-bold text-foreground">{formatMoney(booking.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Paid Online</span>
                    <span className="font-semibold text-brand-green">{formatMoney(paidAmount)}</span>
                  </div>
                  {balanceAtProperty > 0 && (
                    <div className="flex justify-between gap-4 pt-2 border-t border-border/50">
                      <span className="font-semibold text-foreground">Balance at Property</span>
                      <span className="font-bold text-brand-crimson">{formatMoney(balanceAtProperty)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 pt-2 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="font-bold capitalize text-foreground">{booking.paymentStatus.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {canDownloadReceipt && (
                    <button
                      onClick={handleDownloadInvoice}
                      disabled={isDownloadingInvoice}
                      className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-crimson px-4 font-body text-sm font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm disabled:opacity-60"
                    >
                      <Download size={16} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                      <span>{isDownloadingInvoice ? 'Generating Receipt...' : 'Download Booking Receipt (PDF)'}</span>
                    </button>
                  )}
                  <Link
                    to={`/bookings/${booking.id}`}
                    className={`w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-body text-sm font-semibold transition-colors ${
                      canDownloadReceipt
                        ? 'border border-border bg-card text-foreground hover:bg-secondary'
                        : 'bg-brand-crimson font-bold text-white hover:bg-brand-crimson/90 shadow-sm'
                    }`}
                  >
                    <span>View Booking Details</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/bookings"
                    className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                  >
                    <ClipboardList size={16} /> My Bookings
                  </Link>
                  <Link
                    to="/"
                    className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 font-body text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                  >
                    <Home size={16} /> Return to Home
                  </Link>
                </div>
              </div>

              {/* Devotional / Support Card */}
              <div className="rounded-2xl border border-brand-gold/20 bg-brand-cream/60 p-4 text-xs font-body leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground flex items-center gap-1.5 mb-1">
                  <ShieldCheck size={14} className="text-brand-crimson" />
                  <span>Vrindavan Sarthi Devotional Guarantee</span>
                </p>
                Your reservation is backed by our dedicated Braj pilgrimage support. Need assistance? Call our 24/7 Helpline: <strong className="text-foreground">+91 86798 20256</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
