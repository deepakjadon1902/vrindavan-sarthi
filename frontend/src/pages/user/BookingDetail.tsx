import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBookingStore } from '@/store/bookingStore';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ArrowLeft, Calendar, MapPin, User, Phone, Mail, CreditCard, ClipboardList, XCircle, CheckCircle2, Clock, IndianRupee, Hotel, BedDouble, Car, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchBookingById, cancelBooking } = useBookingStore();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <div className="min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center">
          <div className="text-center">
            <p className="font-body text-sm text-muted-foreground">Loading bookingâ€¦</p>
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
  }[booking.bookingType];

  const TypeIcon = typeIcon;

  const statusConfig = {
    confirmed: { color: 'bg-brand-green/10 text-brand-green border-brand-green/20', icon: CheckCircle2, label: 'Confirmed' },
    cancelled: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Cancelled' },
    completed: { color: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20', icon: CheckCircle2, label: 'Completed' },
    pending: { color: 'bg-muted text-muted-foreground border-border', icon: Clock, label: 'Pending' },
  }[booking.bookingStatus];

  const StatusIcon = statusConfig.icon;

  const handleCancel = async () => {
    const res = await cancelBooking(booking.id);
    if (res.success) toast.success('Booking cancelled successfully');
    else toast.error(res.error || 'Cancel failed');
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <button onClick={() => navigate('/bookings')} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to My Bookings
          </button>

          {/* Header */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
            <div className="relative h-48 sm:h-64 bg-muted">
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

            <div className="p-6">
              <p className="font-body text-xs text-brand-crimson font-medium mb-1">{booking.bookingId}</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-2">{booking.itemName}</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Booking Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dates & Guests */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Booking Details</h3>
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
              </div>

              {/* Guest Info */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Guest Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-body text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-crimson/10 flex items-center justify-center"><User size={14} className="text-brand-crimson" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium text-foreground">{booking.userName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center"><Phone size={14} className="text-brand-gold" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-foreground">{booking.userPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center"><Mail size={14} className="text-brand-green" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-foreground truncate">{booking.userEmail}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Sidebar */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Payment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-foreground">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground">{booking.paymentMethod === 'doorstep' ? '💰 Pay at Doorstep' : '💳 Online'}</span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="flex items-center gap-1 capitalize">
                      {booking.paymentStatus === 'paid' ? <CheckCircle2 size={12} className="text-brand-green" /> : booking.paymentStatus === 'failed' ? <XCircle size={12} className="text-destructive" /> : <Clock size={12} className="text-brand-saffron" />}
                      {booking.paymentStatus}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-body text-base">
                    <span className="font-semibold text-foreground">Total Paid</span>
                    <span className="font-bold text-brand-crimson text-lg">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {booking.partnerName && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-heading text-sm font-semibold text-foreground mb-2">Listed By</h3>
                  <p className="font-body text-sm text-muted-foreground">{booking.partnerName}</p>
                </div>
              )}

              {booking.bookingStatus === 'confirmed' && (
                <button
                  onClick={handleCancel}
                  className="w-full py-3 rounded-xl border-2 border-destructive text-destructive font-body text-sm font-medium hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={16} /> Cancel Booking
                </button>
              )}

              <Link
                to={`/${booking.bookingType}s/${booking.itemId}`}
                className="block w-full py-3 rounded-xl bg-brand-crimson text-primary-foreground font-body text-sm font-medium text-center hover:bg-brand-crimson/90 transition-colors"
              >
                View {booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1)} Page
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
