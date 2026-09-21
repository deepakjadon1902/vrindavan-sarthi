import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hotel,
  IndianRupee,
  Map as MapIcon,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';

const typeIcon: Record<string, typeof Hotel> = {
  hotel: Hotel,
  room: BedDouble,
  room_type: BedDouble,
  cab: Car,
  tour: MapIcon,
};

const filters = ['All', 'Upcoming', 'Pending', 'Waitlist', 'Completed', 'Expired', 'Cancelled'];

const statusLabels: Record<string, string> = {
  awaiting_customer_payment: 'Awaiting payment',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  expired_property_no_response: 'Expired',
  payment_failed: 'Payment failed',
  pending_property_confirmation: 'Property review',
  rejected_by_property: 'Rejected',
};

const typeLabels: Record<string, string> = {
  cab: 'Cab',
  hotel: 'Hotel',
  room: 'Room',
  room_type: 'Room',
  tour: 'Tour',
};

const formatDate = (date?: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatStatus = (status: string) => statusLabels[status] || status.replace(/_/g, ' ');

const MyBookings = () => {
  const { user } = useAuthStore();
  const { myBookings, fetchMyBookings, cancelBooking, isLoading } = useBookingStore();
  const [filter, setFilter] = useState('All');
  const [cancelBookingId, setCancelBookingId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchMyBookings();
  }, [fetchMyBookings, user]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => void fetchMyBookings();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchMyBookings, user]);

  useEffect(() => {
    if (!user) return;
    const hasPendingWaitlist = myBookings.some((b) => Boolean(b.isWaitlisted) && !b.waitlistAssignedAt && b.bookingStatus !== 'cancelled');
    if (!hasPendingWaitlist) return;
    const id = window.setInterval(() => void fetchMyBookings(), 15000);
    return () => window.clearInterval(id);
  }, [fetchMyBookings, myBookings, user]);

  useEffect(() => {
    if (!user) return;
    const assigned = myBookings.filter((b) => Boolean(b.waitlistAssignedAt) && b.bookingStatus !== 'cancelled');
    if (!assigned.length) return;

    const storageKey = `vvs_waitlist_notified_${user.id || user.email || 'user'}`;
    const seen = new Set(
      String(window.localStorage.getItem(storageKey) || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    );

    let changed = false;
    for (const booking of assigned) {
      if (!booking.id || seen.has(booking.id)) continue;
      toast.success(`Your room booking ${booking.bookingId} is now confirmed. You can check in on your booked date.`);
      seen.add(booking.id);
      changed = true;
    }

    if (changed) window.localStorage.setItem(storageKey, Array.from(seen).join(','));
  }, [myBookings, user]);

  const bookings = [...myBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered =
    filter === 'All' ? bookings :
    filter === 'Waitlist' ? bookings.filter(b => Boolean(b.isWaitlisted) && !['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus)) :
    filter === 'Upcoming' ? bookings.filter(b => b.bookingStatus === 'confirmed') :
    filter === 'Pending' ? bookings.filter(b => b.bookingStatus === 'pending') :
    filter === 'Completed' ? bookings.filter(b => b.bookingStatus === 'completed') :
    filter === 'Expired' ? bookings.filter(b => b.bookingStatus === 'expired' || b.bookingStatus === 'payment_failed') :
    bookings.filter(b => b.bookingStatus === 'cancelled');

  const stats = [
    { label: 'Total bookings', value: bookings.length, tone: 'text-foreground' },
    { label: 'Confirmed', value: bookings.filter(b => b.bookingStatus === 'confirmed').length, tone: 'text-brand-green' },
    { label: 'Pending', value: bookings.filter(b => b.bookingStatus === 'pending').length, tone: 'text-brand-saffron' },
    {
      label: 'Total spent',
      value: bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0).toLocaleString('en-IN'),
      tone: 'text-brand-crimson',
      currency: true,
    },
  ];

  const countForFilter = (tab: string) => {
    if (tab === 'All') return bookings.length;
    if (tab === 'Waitlist') return bookings.filter(b => Boolean(b.isWaitlisted) && !['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus)).length;
    if (tab === 'Upcoming') return bookings.filter(b => b.bookingStatus === 'confirmed').length;
    if (tab === 'Pending') return bookings.filter(b => b.bookingStatus === 'pending').length;
    if (tab === 'Completed') return bookings.filter(b => b.bookingStatus === 'completed').length;
    if (tab === 'Expired') return bookings.filter(b => b.bookingStatus === 'expired' || b.bookingStatus === 'payment_failed').length;
    return bookings.filter(b => b.bookingStatus === 'cancelled').length;
  };

  const statusBadge = (s: string) => {
    if (s === 'confirmed') return { cls: 'bg-brand-green/12 text-brand-green border-brand-green/25', icon: CheckCircle2 };
    if (s === 'cancelled') return { cls: 'bg-destructive/12 text-destructive border-destructive/25', icon: XCircle };
    if (s === 'expired' || s === 'payment_failed') return { cls: 'bg-destructive/12 text-destructive border-destructive/25', icon: XCircle };
    if (s === 'completed') return { cls: 'bg-brand-gold/15 text-brand-crimson border-brand-gold/30', icon: CheckCircle2 };
    return { cls: 'bg-muted text-muted-foreground border-border', icon: Clock };
  };

  const openCancel = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setCancelBookingId(id);
    setCancelReason('');
    setCancelDetails('');
  };

  const submitCancel = async () => {
    if (!cancelBookingId || !cancelReason.trim()) return toast.error('Cancellation reason is required');
    if (!cancelDetails.trim()) return toast.error('Cancellation details are required');
    const res = await cancelBooking(cancelBookingId, cancelReason.trim(), cancelDetails.trim());
    if (res.success) {
      toast.success('Cancellation submitted');
      setCancelBookingId('');
      setCancelReason('');
      setCancelDetails('');
    }
    else toast.error(res.error || 'Cancel failed');
  };

  return (
      <div className="min-h-screen px-4 pb-16 pt-28 xl:pt-32">
        <div className="container relative mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="premium-kicker">Travel Desk</p>
              <h1 className="mt-1 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl">My Bookings</h1>
              <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-muted-foreground">
                Your confirmed stays, pending requests, cab rides, and tour reservations.
              </p>
            </div>
            <Link
              to="/rooms"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 font-body text-sm font-bold text-foreground shadow-[0_10px_24px_hsl(224_34%_12%_/_0.06)] transition-colors hover:border-brand-gold/55 hover:text-brand-crimson"
            >
              Book again <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-white p-4 shadow-[0_12px_30px_hsl(224_34%_12%_/_0.05)]">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
                <p className={`mt-2 flex items-center font-display text-3xl font-bold leading-none ${stat.tone}`}>
                  {'currency' in stat && stat.currency && <IndianRupee size={19} />}
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-lg border border-border bg-white p-1 shadow-[0_12px_30px_hsl(224_34%_12%_/_0.05)]">
            <div className="flex flex-wrap gap-1">
              {filters.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 py-2 font-body text-sm font-bold whitespace-nowrap transition-colors ${
                    filter === tab
                      ? 'bg-brand-black text-white shadow-[0_8px_18px_hsl(224_38%_10%_/_0.16)]'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === tab ? 'bg-white/15 text-white' : 'bg-secondary text-muted-foreground'}`}>
                    {countForFilter(tab)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-border bg-white p-12 text-center shadow-[0_12px_30px_hsl(224_34%_12%_/_0.05)]">
              <p className="font-body text-muted-foreground">Loading bookings...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-12 text-center shadow-[0_12px_30px_hsl(224_34%_12%_/_0.05)]">
              <ClipboardList size={48} className="mx-auto mb-5 text-brand-gold/70" />
              <h2 className="font-display text-3xl font-semibold text-foreground mb-2">No Bookings Yet</h2>
              <p className="font-body text-muted-foreground mb-6">
                Start your sacred journey by booking a hotel, room, cab, or tour package.
              </p>
              <Link to="/hotels" className="btn-gold px-6 py-3 rounded-lg text-sm inline-flex items-center gap-2 font-semibold">
                Start Your Journey <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {cancelBookingId && (
                <div className="rounded-lg border border-destructive/25 bg-white p-5 shadow-[0_12px_30px_hsl(224_34%_12%_/_0.05)] lg:col-span-2">
                  <h2 className="mb-3 font-display text-2xl font-semibold text-foreground">Cancel booking</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" className="h-11 rounded-lg border border-border bg-background/70 px-3 font-body text-sm" />
                    <input value={cancelDetails} onChange={(e) => setCancelDetails(e.target.value)} placeholder="Full details for cancellation request" className="h-11 rounded-lg border border-border bg-background/70 px-3 font-body text-sm" />
                  </div>
                  <p className="mt-3 font-body text-xs leading-5 text-muted-foreground">A 12% cancellation charge will be deducted from the total payment. The remaining amount will be refundable after review.</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={submitCancel} className="h-10 rounded-lg bg-destructive px-4 font-body text-xs font-bold text-destructive-foreground">Submit Cancellation</button>
                    <button onClick={() => { setCancelBookingId(''); setCancelReason(''); setCancelDetails(''); }} className="h-10 rounded-lg border border-border px-4 font-body text-xs font-bold">Close</button>
                  </div>
                </div>
              )}
              {filtered.map((b) => {
                const Icon = typeIcon[b.bookingType] || ClipboardList;
                const sb = statusBadge(b.bookingStatus);
                const SIcon = sb.icon;
                const paymentCopy = b.paymentMethod === 'doorstep' ? 'Doorstep payment' : `Online - ${b.paymentStatus.replace(/_/g, ' ')}`;

                return (
                  <Link
                    key={b.id}
                    to={`/bookings/${b.id}`}
                    className="group block min-h-[220px] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_4px_16px_rgba(16,24,44,0.06)] transition-all hover:-translate-y-0.5 hover:border-brand-gold/50 hover:shadow-[0_8px_24px_rgba(16,24,44,0.09)]"
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted sm:h-auto sm:min-h-[168px] sm:w-40 sm:flex-none lg:w-44 xl:w-40">
                        {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                          <img src={b.itemImage} alt={b.itemName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-crimson/10 to-brand-gold/10">
                            <Icon size={28} className="text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/[0.94] px-2.5 py-1 font-body text-[10px] font-bold text-foreground shadow-sm">
                          <Icon size={11} /> {typeLabels[b.bookingType] || 'Booking'}
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 break-all font-body text-[10px] font-bold uppercase tracking-[0.16em] text-brand-crimson">{b.bookingId}</p>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            {b.isWaitlisted && !b.waitlistAssignedAt && (
                              <span className="rounded-full border border-brand-saffron/30 bg-brand-saffron/10 px-2 py-1 font-body text-[10px] font-bold text-brand-saffron">
                                Waitlist
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-body text-[10px] font-bold capitalize ${sb.cls}`}>
                              <SIcon size={11} /> {formatStatus(b.bookingStatus)}
                            </span>
                          </div>
                        </div>
                        <h3 className="mt-2 line-clamp-2 break-words font-body text-[18px] font-bold leading-6 text-foreground">
                          {b.itemName}
                        </h3>

                        {b.isWaitlisted && !b.waitlistAssignedAt && (
                          <p className="mt-2 font-body text-xs font-semibold text-brand-saffron">
                            Waiting for room assignment
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[13px] font-semibold text-muted-foreground">
                          {b.checkIn && (
                            <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {formatDate(b.checkIn)}</span>
                          )}
                          {b.checkOut && <span>to {formatDate(b.checkOut)}</span>}
                        </div>

                        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                          {b.totalAmount > 0 && (
                            <span className="flex items-center font-body text-[22px] font-bold leading-none text-brand-crimson"><IndianRupee size={17} />{b.totalAmount.toLocaleString('en-IN')}</span>
                          )}
                          <span className="text-right font-body text-[11px] font-semibold capitalize text-muted-foreground">{paymentCopy}</span>
                        </div>

                        {b.bookingStatus === 'confirmed' && (
                          <button onClick={(e) => openCancel(e, b.id)} className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md px-0 font-body text-xs font-bold text-destructive hover:underline">
                            <XCircle size={13} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
};

export default MyBookings;
