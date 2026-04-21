import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, CheckCircle, BedDouble, Snowflake, Sparkles, Wifi, Bath } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import UpiPayment from '@/components/UpiPayment';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { api } from '@/lib/api';

const RoomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { createBooking } = useBookingStore();
  const [room, setRoom] = useState<any>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/rooms/${id}`);
        setRoom(res.data?.data || null);
      } catch {
        setRoom(null);
      }
    };
    void run();
  }, [id]);

  if (!room) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Room not found</p>
      <Link to="/rooms" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Rooms</Link>
    </div>
  );

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
  const total = room.pricePerNight * nights;

  const handleInitiateBooking = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!checkIn || !checkOut) { toast.error('Please select dates'); return; }
    const tempId = `VVS-2025-${String(Math.floor(10000 + Math.random() * 90000))}`;
    setBookingId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (transactionId: string) => {
    if (!user) return;
    const res = await createBooking({
      bookingType: 'room',
      itemId: room?._id,
      itemName: `${room.name} - ${room.hotelName}`,
      itemImage: room.image,
      partnerId: room.partnerId,
      partnerName: room.partnerName,
      checkIn, checkOut,
      guests: room.capacity,
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

  const allImages = [room.image, ...(room.images || [])].filter(Boolean);

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-24 w-80 h-80 rounded-full bg-brand-crimson/15 blur-3xl" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ImageCarousel images={allImages} alt={room.name} />
            <div className="glass-panel rounded-2xl p-6 metallic-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-gold animate-float-slow" />
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Cozy Retreat</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">{room.name}</h1>
              <p className="font-body text-sm text-muted-foreground mt-2">📍 {room.hotelName}</p>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-display text-xl font-semibold text-foreground mb-4">Room Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-body text-sm">
                <div className="text-center p-3 rounded-xl bg-secondary/50"><BedDouble size={20} className="mx-auto text-brand-gold mb-1" /><p className="text-xs text-muted-foreground">Type</p><p className="font-semibold">{room.type}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><User size={20} className="mx-auto text-brand-crimson mb-1" /><p className="text-xs text-muted-foreground">Capacity</p><p className="font-semibold">{room.capacity}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Snowflake size={20} className={`mx-auto mb-1 ${room.isAC ? 'text-blue-500' : 'text-muted-foreground/40'}`} /><p className="text-xs text-muted-foreground">AC</p><p className="font-semibold">{room.isAC ? 'Yes' : 'No'}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Wifi size={20} className={`mx-auto mb-1 ${room.hasWiFi ? 'text-brand-green' : 'text-muted-foreground/40'}`} /><p className="text-xs text-muted-foreground">WiFi</p><p className="font-semibold">{room.hasWiFi ? 'Yes' : 'No'}</p></div>
              </div>
            </div>
            {room.description && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">About this Room</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{room.description}</p>
              </div>
            )}
            {room.amenities?.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {room.amenities.map((a: string) => (<span key={a} className="font-body text-sm bg-secondary/80 backdrop-blur px-3 py-1.5 rounded-lg text-secondary-foreground border border-brand-gold/20">{a}</span>))}
                </div>
              </div>
            )}
            {room.partnerName && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Listed By</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full metallic-gold flex items-center justify-center font-display font-bold">{room.partnerName.charAt(0)}</div>
                  <div><p className="font-body text-sm font-medium">{room.partnerName}</p><p className="font-body text-xs text-muted-foreground">Verified Partner</p></div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <div className="glass-panel rounded-2xl p-6 sticky top-24 metallic-border">
              {showPayment ? (
                <UpiPayment amount={total} bookingId={bookingId} itemName={`${room.name} - ${room.hotelName}`} onPaymentConfirm={handlePaymentConfirm} onCancel={() => setShowPayment(false)} />
              ) : booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-saffron animate-float-slow" />
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-2">Booking Submitted!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Payment verification pending.</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <span className="font-display text-4xl font-bold text-shine">₹{room.pricePerNight?.toLocaleString('en-IN')}</span>
                    <span className="font-body text-sm text-muted-foreground"> /night</span>
                  </div>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-in</label><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-out</label><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <div className="border-t border-brand-gold/20 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{room.pricePerNight} × {nights} night(s)</span><span>₹{total.toLocaleString('en-IN')}</span></div>
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

export default RoomDetail;
