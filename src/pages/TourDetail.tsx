import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Users, CheckCircle, Sparkles, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import UpiPayment from '@/components/UpiPayment';
import ImageCarousel from '@/components/shared/ImageCarousel';

const TourDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { addBooking } = useBookingStore();
  const [tour, setTour] = useState<any>(null);
  const [travelDate, setTravelDate] = useState('');
  const [persons, setPersons] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    try {
      const data = localStorage.getItem('vvs_tours');
      if (data) {
        const found = JSON.parse(data).find((t: any) => t.id === id);
        if (found) setTour(found);
      }
    } catch {}
  }, [id]);

  if (!tour) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Tour not found</p>
      <Link to="/tours" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Tours</Link>
    </div>
  );

  const total = tour.pricePerPerson * persons;

  const handleInitiateBooking = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!travelDate) { toast.error('Please select travel date'); return; }
    const tempId = `VVS-2025-${String(Math.floor(10000 + Math.random() * 90000))}`;
    setBookingId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = (transactionId: string) => {
    addBooking({
      bookingType: 'tour',
      itemId: tour.id,
      itemName: tour.name,
      itemImage: tour.image,
      userId: user!.id,
      userName: user!.name,
      userEmail: user!.email,
      userPhone: user!.phone,
      partnerId: tour.partnerId,
      partnerName: tour.partnerName,
      checkIn: travelDate,
      guests: persons,
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

  const allImages = [tour.image, ...(tour.images || [])].filter(Boolean);

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-saffron/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-brand-crimson/15 blur-3xl" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ImageCarousel images={allImages} alt={tour.name} />
            <div className="glass-panel rounded-2xl p-6 metallic-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-gold animate-float-slow" />
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Sacred Journey</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">{tour.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground"><Clock size={15} className="text-brand-crimson" /> {tour.duration}</span>
                <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground"><Users size={15} className="text-brand-gold" /> Max {tour.groupSize}</span>
                {tour.startPoint && <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground"><MapPin size={15} className="text-brand-green" /> {tour.startPoint}</span>}
              </div>
            </div>
            {tour.description && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">About this Tour</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{tour.description}</p>
              </div>
            )}
            {tour.itinerary && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Itinerary</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tour.itinerary}</p>
              </div>
            )}
            {tour.includes?.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">What's Included</h3>
                <div className="flex flex-wrap gap-2">
                  {tour.includes.map((i: string) => (
                    <span key={i} className="font-body text-sm bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-lg border border-brand-green/20">✓ {i}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <div className="glass-panel rounded-2xl p-6 sticky top-24 metallic-border">
              {showPayment ? (
                <UpiPayment amount={total} bookingId={bookingId} itemName={tour.name} onPaymentConfirm={handlePaymentConfirm} onCancel={() => setShowPayment(false)} />
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
                    <span className="font-display text-4xl font-bold text-shine">₹{tour.pricePerPerson?.toLocaleString('en-IN')}</span>
                    <span className="font-body text-sm text-muted-foreground"> /person</span>
                  </div>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Travel Date</label><input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Number of Persons</label><input type="number" min={1} max={tour.groupSize || 20} value={persons} onChange={(e) => setPersons(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <div className="border-t border-brand-gold/20 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{tour.pricePerPerson} × {persons} person(s)</span><span>₹{total.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between font-body text-sm font-semibold border-t border-brand-gold/20 pt-2"><span>Total</span><span className="text-brand-crimson font-display text-lg">₹{total.toLocaleString('en-IN')}</span></div>
                  </div>
                  <button onClick={handleInitiateBooking} className="metallic-gold w-full py-3 rounded-xl text-sm font-body font-semibold mt-4 tracking-wide">Pay & Book Tour</button>
                  <p className="font-body text-[11px] text-muted-foreground text-center mt-3">🔒 Secure UPI · Confirmed after admin verification</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourDetail;
