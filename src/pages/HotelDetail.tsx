import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, User, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import UpiPayment from '@/components/UpiPayment';

const HotelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { addBooking } = useBookingStore();
  const [hotel, setHotel] = useState<any>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    try {
      const data = localStorage.getItem('vvs_hotels');
      if (data) {
        const found = JSON.parse(data).find((h: any) => h.id === id);
        if (found) setHotel(found);
      }
    } catch {}
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
    const tempId = `VVS-2025-${String(Math.floor(10000 + Math.random() * 90000))}`;
    setBookingId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = (transactionId: string) => {
    addBooking({
      bookingType: 'hotel',
      itemId: hotel.id,
      itemName: hotel.name,
      itemImage: hotel.image,
      userId: user!.id,
      userName: user!.name,
      userEmail: user!.email,
      userPhone: user!.phone,
      partnerId: hotel.partnerId,
      partnerName: hotel.partnerName,
      checkIn, checkOut, guests,
      totalAmount: total,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      bookingStatus: 'pending',
      upiTransactionId: transactionId,
      additionalInfo: `UPI Txn: ${transactionId}`,
    });
    setShowPayment(false);
    setBooked(true);
    toast.success('Booking submitted! Payment verification pending.');
  };

  return (
    <div className="pt-20 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl overflow-hidden h-72 md:h-96">
              <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover" />
            </div>
            {hotel.images?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {hotel.images.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="w-24 h-18 rounded-lg object-cover flex-shrink-0 border border-border" />
                ))}
              </div>
            )}
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground">{hotel.name}</h1>
              <div className="flex items-center gap-2 mt-2"><MapPin size={16} className="text-brand-gold" /><span className="font-body text-sm text-muted-foreground">{hotel.location}</span></div>
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(hotel.rating || 0) ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'} />
                ))}
                <span className="font-body text-sm text-muted-foreground ml-1">({hotel.rating || 0})</span>
              </div>
            </div>
            {hotel.description && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">About this Hotel</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>
              </div>
            )}
            {hotel.amenities?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a: string) => (
                    <span key={a} className="font-body text-sm bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {hotel.partnerName && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Listed By</h3>
                <div className="flex items-center gap-2"><User size={16} className="text-brand-gold" /><span className="font-body text-sm text-foreground">{hotel.partnerName}</span></div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
              {showPayment ? (
                <UpiPayment amount={total} bookingId={bookingId} itemName={hotel.name} onPaymentConfirm={handlePaymentConfirm} onCancel={() => setShowPayment(false)} />
              ) : booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-saffron" />
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Booking Submitted!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Your payment is being verified by admin. You'll be notified once confirmed.</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <span className="font-heading text-3xl font-bold text-foreground">₹{hotel.pricePerNight?.toLocaleString('en-IN')}</span>
                    <span className="font-body text-sm text-muted-foreground"> /night</span>
                  </div>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-in</label><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-out</label><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Guests</label><input type="number" min={1} max={10} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <div className="border-t border-border mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{hotel.pricePerNight?.toLocaleString('en-IN')} × {nights} night(s)</span><span className="text-foreground">₹{total.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between font-body text-sm font-semibold border-t border-border pt-2"><span>Total</span><span className="text-brand-crimson">₹{total.toLocaleString('en-IN')}</span></div>
                  </div>
                  <button onClick={handleInitiateBooking} className="btn-gold w-full py-3 rounded-xl text-sm mt-4">Pay & Book Now</button>
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
