import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight, Calendar, XCircle, Hotel, BedDouble, Car, Map as MapIcon, CheckCircle2, Clock, IndianRupee } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const typeIcon: Record<string, any> = {
  hotel: Hotel,
  room: BedDouble,
  cab: Car,
  tour: MapIcon,
};

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
    filter === 'Waitlist' ? bookings.filter(b => Boolean(b.isWaitlisted) && b.bookingStatus !== 'cancelled') :
    filter === 'Upcoming' ? bookings.filter(b => b.bookingStatus === 'confirmed') :
    filter === 'Pending' ? bookings.filter(b => b.bookingStatus === 'pending') :
    filter === 'Completed' ? bookings.filter(b => b.bookingStatus === 'completed') :
    bookings.filter(b => b.bookingStatus === 'cancelled');

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.bookingStatus === 'confirmed').length,
    pending: bookings.filter(b => b.bookingStatus === 'pending').length,
    spent: bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0),
  };

  const statusBadge = (s: string) => {
    if (s === 'confirmed') return { cls: 'bg-brand-green/15 text-brand-green border-brand-green/30', icon: CheckCircle2 };
    if (s === 'cancelled') return { cls: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle };
    if (s === 'completed') return { cls: 'bg-brand-gold/15 text-brand-gold border-brand-gold/30', icon: CheckCircle2 };
    return { cls: 'bg-muted text-muted-foreground border-border', icon: Clock };
  };

  const openCancel = (e: React.MouseEvent, id: string) => {
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
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 pt-20 pb-8 px-4 relative overflow-hidden">
        <div className="container mx-auto max-w-5xl relative">
          {/* Header */}
          <div className="mb-5">
            <p className="premium-kicker">Travel Desk</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">My Bookings</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">Track every stay, ride, and tour in one place</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="premium-surface p-4">
              <p className="font-body text-xs text-muted-foreground">Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="premium-surface p-4">
              <p className="font-body text-xs text-muted-foreground">Confirmed</p>
              <p className="font-display text-2xl font-bold text-brand-green">{stats.confirmed}</p>
            </div>
            <div className="premium-surface p-4">
              <p className="font-body text-xs text-muted-foreground">Pending</p>
              <p className="font-display text-2xl font-bold text-brand-saffron">{stats.pending}</p>
            </div>
            <div className="premium-surface p-4">
              <p className="font-body text-xs text-muted-foreground">Total Spent</p>
              <p className="font-display text-2xl font-bold text-brand-crimson flex items-center"><IndianRupee size={16} />{stats.spent.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {['All', 'Upcoming', 'Pending', 'Waitlist', 'Completed', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-4 py-2 font-body text-sm whitespace-nowrap transition-colors ${
                  filter === tab
                    ? 'bg-brand-gold text-foreground font-semibold'
                    : 'border border-border bg-white text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="premium-surface p-12 text-center">
              <p className="font-body text-muted-foreground">Loading bookings...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="premium-surface p-12 text-center">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cancelBookingId && (
                <div className="md:col-span-2 premium-surface p-5 border-destructive/25">
                  <h2 className="font-display text-xl font-semibold text-foreground mb-3">Cancel booking</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" className="rounded-lg border border-border bg-background/70 px-3 py-2 font-body text-sm" />
                    <input value={cancelDetails} onChange={(e) => setCancelDetails(e.target.value)} placeholder="Full details for cancellation request" className="rounded-lg border border-border bg-background/70 px-3 py-2 font-body text-sm" />
                  </div>
                  <p className="mt-3 font-body text-xs text-muted-foreground">A 12% cancellation charge will be deducted from the total payment. The remaining amount will be refundable after review.</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={submitCancel} className="rounded-lg bg-destructive px-4 py-2 font-body text-xs text-primary-foreground">Submit Cancellation</button>
                    <button onClick={() => { setCancelBookingId(''); setCancelReason(''); setCancelDetails(''); }} className="rounded-lg border border-border px-4 py-2 font-body text-xs">Close</button>
                  </div>
                </div>
              )}
              {filtered.map((b) => {
                const Icon = typeIcon[b.bookingType] || ClipboardList;
                const sb = statusBadge(b.bookingStatus);
                const SIcon = sb.icon;
                return (
                  <Link
                    key={b.id}
                    to={`/bookings/${b.id}`}
                    className="premium-surface overflow-hidden transition-transform hover:-translate-y-0.5 group block"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="w-28 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                        {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                          <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-crimson/10 to-brand-gold/10">
                            <Icon size={28} className="text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded glass-chip text-[9px] capitalize flex items-center gap-1">
                          <Icon size={9} /> {b.bookingType}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-body text-[10px] text-brand-crimson font-medium tracking-wider">{b.bookingId}</p>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {b.isWaitlisted && !b.waitlistAssignedAt && (
                              <span className="font-body text-[10px] px-2 py-0.5 rounded-full border border-brand-saffron/30 bg-brand-saffron/10 text-brand-saffron">
                                Waitlist
                              </span>
                            )}
                            <span className={`font-body text-[10px] px-2 py-0.5 rounded-full capitalize border flex items-center gap-1 ${sb.cls}`}>
                              <SIcon size={10} /> {b.bookingStatus}
                            </span>
                          </div>
                        </div>
                        {b.isWaitlisted && !b.waitlistAssignedAt && (
                          <p className="mt-1 font-body text-[11px] text-brand-saffron">
                            Waitlisted - waiting for room assignment
                          </p>
                        )}
                        <h3 className="font-display text-base font-semibold text-foreground truncate mt-0.5">{b.itemName}</h3>
                        <div className="flex items-center gap-3 mt-2 font-body text-[11px] text-muted-foreground">
                          {b.checkIn && (
                            <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(b.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          )}
                          {b.checkOut && <span>→ {new Date(b.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {b.totalAmount > 0 && (
                            <span className="font-display text-lg font-bold text-brand-crimson flex items-center"><IndianRupee size={13} />{b.totalAmount.toLocaleString('en-IN')}</span>
                          )}
                          <span className="font-body text-[10px] text-muted-foreground">
                            {b.paymentMethod === 'doorstep' ? 'Doorstep' : `Online - ${b.paymentStatus}`}
                          </span>
                        </div>
                        {b.bookingStatus === 'confirmed' && (
                          <button onClick={(e) => openCancel(e, b.id)} className="mt-2 flex items-center gap-1 font-body text-[11px] text-destructive hover:underline">
                            <XCircle size={11} /> Cancel
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
      <Footer />
    </>
  );
};

export default MyBookings;
