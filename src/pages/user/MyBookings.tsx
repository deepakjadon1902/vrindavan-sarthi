import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight, Calendar, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { useState } from 'react';
import { toast } from 'sonner';

const MyBookings = () => {
  const { user } = useAuthStore();
  const { getBookingsByUser, cancelBooking } = useBookingStore();
  const [filter, setFilter] = useState('All');

  const bookings = getBookingsByUser(user?.id || '').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = filter === 'All' ? bookings :
    filter === 'Upcoming' ? bookings.filter(b => b.bookingStatus === 'confirmed') :
    filter === 'Completed' ? bookings.filter(b => b.bookingStatus === 'completed') :
    bookings.filter(b => b.bookingStatus === 'cancelled');

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'completed') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  const handleCancel = (id: string) => {
    cancelBooking(id);
    toast.success('Booking cancelled');
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="font-heading text-3xl font-semibold text-foreground mb-8">My Bookings</h1>

          <div className="flex gap-2 mb-8 overflow-x-auto">
            {['All', 'Upcoming', 'Completed', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-lg font-body text-sm whitespace-nowrap transition-colors ${
                  filter === tab ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-16 text-center">
              <ClipboardList size={64} className="mx-auto mb-6 text-muted-foreground/20" />
              <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">No Bookings Yet</h2>
              <p className="font-body text-muted-foreground mb-6">
                Start your sacred journey by booking a hotel, room, cab, or tour package.
              </p>
              <Link to="/hotels" className="btn-gold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                Start Your Journey <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((b) => (
                <div key={b.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-24 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {b.itemImage && b.itemImage !== '/placeholder.svg' ? (
                        <img src={b.itemImage} alt={b.itemName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ClipboardList size={20} className="text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-body text-xs text-muted-foreground">{b.id}</p>
                          <h3 className="font-heading text-lg font-semibold text-foreground">{b.itemName}</h3>
                          <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded text-secondary-foreground capitalize">{b.bookingType}</span>
                        </div>
                        <span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${statusColor(b.bookingStatus)}`}>{b.bookingStatus}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 font-body text-xs text-muted-foreground">
                        {b.checkIn && (
                          <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(b.checkIn).toLocaleDateString()}</span>
                        )}
                        {b.checkOut && <span>→ {new Date(b.checkOut).toLocaleDateString()}</span>}
                        {b.totalAmount > 0 && <span className="font-semibold text-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</span>}
                        <span>{b.paymentMethod === 'doorstep' ? '💰 Pay at Doorstep' : `💳 ${b.paymentStatus}`}</span>
                      </div>
                      {b.bookingStatus === 'confirmed' && (
                        <button onClick={() => handleCancel(b.id)} className="mt-3 flex items-center gap-1 font-body text-xs text-destructive hover:underline">
                          <XCircle size={12} /> Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default MyBookings;
