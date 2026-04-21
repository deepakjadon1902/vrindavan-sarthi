import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight, Calendar, XCircle, Hotel, BedDouble, Car, Map as MapIcon, Sparkles, CheckCircle2, Clock, IndianRupee } from 'lucide-react';
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

  useEffect(() => {
    if (!user) return;
    void fetchMyBookings();
  }, [fetchMyBookings, user]);

  const bookings = [...myBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered =
    filter === 'All' ? bookings :
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

  const handleCancel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await cancelBooking(id);
    if (res.success) toast.success('Booking cancelled');
    else toast.error(res.error || 'Cancel failed');
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 pt-24 pb-16 px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-brand-crimson/15 blur-3xl" />

        <div className="container mx-auto max-w-5xl relative">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-brand-gold animate-float-slow" />
              <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Your Sacred Journey</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">My Bookings</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">Track every stay, ride, and tour in one place</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="glass-panel rounded-2xl p-4 water-hover">
              <p className="font-body text-xs text-muted-foreground">Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 water-hover">
              <p className="font-body text-xs text-muted-foreground">Confirmed</p>
              <p className="font-display text-2xl font-bold text-brand-green">{stats.confirmed}</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 water-hover">
              <p className="font-body text-xs text-muted-foreground">Pending</p>
              <p className="font-display text-2xl font-bold text-brand-saffron">{stats.pending}</p>
            </div>
            <div className="glass-panel rounded-2xl p-4 water-hover">
              <p className="font-body text-xs text-muted-foreground">Total Spent</p>
              <p className="font-display text-2xl font-bold text-brand-crimson flex items-center"><IndianRupee size={16} />{stats.spent.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {['All', 'Upcoming', 'Pending', 'Completed', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl font-body text-sm whitespace-nowrap transition-all ${
                  filter === tab
                    ? 'metallic-gold shadow-lg'
                    : 'glass-panel text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="glass-panel rounded-3xl p-16 text-center metallic-border">
              <p className="font-body text-muted-foreground">Loading bookingsâ€¦</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-panel rounded-3xl p-16 text-center metallic-border">
              <ClipboardList size={64} className="mx-auto mb-6 text-brand-gold/40 animate-float-slow" />
              <h2 className="font-display text-3xl font-semibold text-foreground mb-2">No Bookings Yet</h2>
              <p className="font-body text-muted-foreground mb-6">
                Start your sacred journey by booking a hotel, room, cab, or tour package.
              </p>
              <Link to="/hotels" className="metallic-gold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2 font-semibold">
                Start Your Journey <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((b) => {
                const Icon = typeIcon[b.bookingType] || ClipboardList;
                const sb = statusBadge(b.bookingStatus);
                const SIcon = sb.icon;
                return (
                  <Link
                    key={b.id}
                    to={`/bookings/${b.id}`}
                    className="glass-panel rounded-2xl overflow-hidden water-hover group block"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="w-28 h-28 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
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
                          <span className={`font-body text-[10px] px-2 py-0.5 rounded-full capitalize border flex items-center gap-1 ${sb.cls}`}>
                            <SIcon size={10} /> {b.bookingStatus}
                          </span>
                        </div>
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
                            {b.paymentMethod === 'doorstep' ? '💰 Doorstep' : `💳 ${b.paymentStatus}`}
                          </span>
                        </div>
                        {b.bookingStatus === 'confirmed' && (
                          <button onClick={(e) => handleCancel(e, b.id)} className="mt-2 flex items-center gap-1 font-body text-[11px] text-destructive hover:underline">
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
