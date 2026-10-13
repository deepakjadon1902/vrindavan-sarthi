import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, CreditCard, Home, Mail, Phone } from 'lucide-react';
import type { Booking } from '@/store/bookingStore';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import { formatBookingStatus } from '@/lib/bookingStatus';

const formatMoney = (value?: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const BookingConfirmation = () => {
  const { id } = useParams();
  const { token } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!id || !token) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await api.get(`/bookings/${id}`, withAuth(token));
        const raw = res.data?.data;
        setBooking(raw ? { ...raw, id: raw.id || raw._id } : null);
      } catch {
        setBooking(null);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id, token]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">Preparing your confirmation...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[70vh] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
          <ClipboardList size={46} className="mx-auto mb-4 text-muted-foreground/40" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Booking not found</h1>
          <Link to="/bookings" className="mt-5 inline-flex rounded-lg bg-brand-crimson px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground">
            Go to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(booking.bookingStatus);
  const paidAmount = Number(booking.paymentStatus === 'paid' ? (booking.advanceAmount || booking.amountPaidOnline || booking.totalAmount || 0) : 0);
  const customerName = booking.customerFullName || booking.userName || 'Guest';

  return (
    <div className="min-h-[70vh] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-brand-gold/30 bg-card shadow-[0_20px_60px_rgba(16,24,44,0.08)]">
        <div className="border-b border-brand-gold/20 bg-brand-gold/10 px-5 py-8 text-center sm:px-8">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-green/12 text-brand-green">
            <CheckCircle2 size={34} />
          </div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-brand-crimson">Vrindavan Sarthi</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            {isConfirmed ? 'Booking Confirmed' : 'Booking Request Received'}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl font-body text-sm leading-6 text-muted-foreground sm:text-base">
            Radhe Radhe, {customerName}. Thank you for choosing Vrindavan Sarthi. Your reservation details are saved in My Bookings, and our team will support you throughout your Braj journey.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-brand-crimson">{booking.bookingId}</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-foreground">{booking.itemName}</h2>
              <p className="mt-1 font-body text-sm text-muted-foreground">{formatBookingStatus(booking.bookingStatus)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/70 p-4">
                <p className="font-body text-xs text-muted-foreground">Check-in</p>
                <p className="mt-1 font-body text-sm font-semibold text-foreground">{formatDate(booking.checkIn)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/70 p-4">
                <p className="font-body text-xs text-muted-foreground">Check-out</p>
                <p className="mt-1 font-body text-sm font-semibold text-foreground">{formatDate(booking.checkOut)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/70 p-4">
                <p className="font-body text-xs text-muted-foreground">Guest phone</p>
                <p className="mt-1 flex items-center gap-2 font-body text-sm font-semibold text-foreground"><Phone size={14} /> {booking.customerMobile || booking.userPhone || '-'}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/70 p-4">
                <p className="font-body text-xs text-muted-foreground">Guest email</p>
                <p className="mt-1 flex items-center gap-2 break-all font-body text-sm font-semibold text-foreground"><Mail size={14} /> {booking.customerEmail || booking.userEmail || '-'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-brand-gold/25 bg-brand-cream/50 p-5">
            <p className="font-heading text-lg font-bold text-foreground">Payment Summary</p>
            <div className="mt-4 space-y-3 font-body text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Booking total</span>
                <span className="font-bold text-brand-crimson">{formatMoney(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Paid online</span>
                <span className="font-semibold text-brand-green">{formatMoney(paidAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Payment status</span>
                <span className="font-semibold capitalize text-foreground">{booking.paymentStatus.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              <Link to={`/bookings/${booking.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-crimson px-4 font-body text-sm font-bold text-primary-foreground">
                <CreditCard size={16} /> View Booking Details
              </Link>
              <Link to="/bookings" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 font-body text-sm font-bold text-foreground">
                <ClipboardList size={16} /> My Bookings
              </Link>
              <Link to="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 font-body text-sm font-bold text-foreground">
                <Home size={16} /> Home
              </Link>
            </div>

            <p className="mt-5 rounded-lg border border-brand-gold/25 bg-background/70 px-3 py-2 font-body text-xs leading-5 text-muted-foreground">
              This official confirmation is issued by Vrindavan Sarthi. Please keep your booking ID handy for check-in and support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
