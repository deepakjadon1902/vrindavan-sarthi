import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, User, CheckCircle, Sparkles, Shield, Clock, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import UpiPayment from '@/components/UpiPayment';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { api } from '@/lib/api';

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { createBooking } = useBookingStore();
  const [hotel, setHotel] = useState<any>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/hotels/${id}`);
        setHotel(res.data?.data || null);
      } catch {
        setHotel(null);
      }
    };
    void run();
  }, [id]);

  if (!hotel) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Hotel not found</p>
      <Link to="/hotels" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Hotels</Link>
    </div>
  );

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
  const total = hotel.pricePerNight * nights;

  const handleInitiateBooking = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!checkIn || !checkOut) { toast.error('Please select check-in and check-out dates'); return; }
    if (!hotel?._id) { toast.error('Hotel not loaded yet'); return; }
    const tempId = `VVS-2025-${String(Math.floor(10000 + Math.random() * 90000))}`;
    setBookingId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (transactionId: string) => {
    if (!user) return;

    const res = await createBooking({
      bookingType: 'hotel',
      itemId: hotel?._id,
      itemName: hotel?.name,
      itemImage: hotel?.image,
      partnerId: hotel?.partnerId,
      partnerName: hotel?.partnerName,
      checkIn,
      checkOut,
      guests,
      totalAmount: total,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      bookingStatus: 'confirmed',
      upiTransactionId: transactionId,
      additionalInfo: `UPI Txn: ${transactionId}`,
    } as any);

    if (!res.success) {
      toast.error(res.error || 'Booking failed');
      return;
    }

    setShowPayment(false);
    setBooked(true);
    toast.success('Booking confirmed! Payment verification pending.');
  };

  const allImages = [hotel.image, ...(hotel.images || [])].filter(Boolean);

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-brand-crimson/15 blur-3xl" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ImageCarousel images={allImages} alt={hotel.name} />

            <div className="glass-panel rounded-2xl p-6 metallic-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-gold animate-float-slow" />
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Sacred Stay</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">{hotel.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground"><MapPin size={15} className="text-brand-crimson" />{hotel.location}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={15} className={i < Math.floor(hotel.rating || 0) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'} />
                  ))}
                  <span className="font-body text-sm text-muted-foreground ml-1">({hotel.rating || 'New'})</span>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: 'Verified', sub: 'Hand-picked' },
                { icon: Award, label: 'Top Rated', sub: 'Pilgrim choice' },
                { icon: Clock, label: '24×7', sub: 'Concierge' },
              ].map((b) => (
                <div key={b.label} className="glass-panel rounded-xl p-4 text-center water-hover">
                  <b.icon size={18} className="mx-auto text-brand-gold mb-1.5" />
                  <p className="font-display text-sm font-semibold text-foreground">{b.label}</p>
                  <p className="font-body text-[10px] text-muted-foreground">{b.sub}</p>
                </div>
              ))}
            </div>

            {hotel.description && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">About this Hotel</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
              </div>
            )}
            {hotel.amenities?.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a: string) => (
                    <span key={a} className="font-body text-sm bg-secondary/80 backdrop-blur px-3 py-1.5 rounded-lg text-secondary-foreground border border-brand-gold/20">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {hotel.partnerName && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Listed By</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full metallic-gold flex items-center justify-center font-display font-bold">{hotel.partnerName.charAt(0)}</div>
                  <div>
                    <p className="font-body text-sm text-foreground font-medium">{hotel.partnerName}</p>
                    <p className="font-body text-xs text-muted-foreground">Verified Partner</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="glass-panel rounded-2xl p-6 sticky top-24 metallic-border">
              {showPayment ? (
                <UpiPayment amount={total} bookingId={bookingId} itemName={hotel.name} onPaymentConfirm={handlePaymentConfirm} onCancel={() => setShowPayment(false)} />
              ) : booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-saffron animate-float-slow" />
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-2">Booking Submitted!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Your payment is being verified by admin. You'll be notified once confirmed.</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <span className="font-display text-4xl font-bold text-shine">₹{hotel.pricePerNight?.toLocaleString('en-IN')}</span>
                    <span className="font-body text-sm text-muted-foreground"> /night</span>
                  </div>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-in</label><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-out</label><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Guests</label><input type="number" min={1} max={10} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <div className="border-t border-brand-gold/20 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{hotel.pricePerNight?.toLocaleString('en-IN')} × {nights} night(s)</span><span className="text-foreground">₹{total.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between font-body text-sm font-semibold border-t border-brand-gold/20 pt-2"><span>Total</span><span className="text-brand-crimson font-display text-lg">₹{total.toLocaleString('en-IN')}</span></div>
                  </div>
                  <button onClick={handleInitiateBooking} className="metallic-gold w-full py-3 rounded-xl text-sm font-body font-semibold mt-4 tracking-wide">Pay & Book Now</button>
                  <p className="font-body text-[11px] text-muted-foreground text-center mt-3">🔒 Secure UPI · Instant confirmation after verification</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelDetail;
