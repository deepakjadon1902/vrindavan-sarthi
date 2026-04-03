import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Users, CheckCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';

const TourDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { addBooking } = useBookingStore();
  const [tour, setTour] = useState<any>(null);
  const [travelDate, setTravelDate] = useState('');
  const [persons, setPersons] = useState(1);
  const [booked, setBooked] = useState(false);

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

  const handleBook = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!travelDate) { toast.error('Please select travel date'); return; }

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
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    });
    setBooked(true);
    toast.success('Tour booked successfully!');
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
              <img src={tour.image} alt={tour.name} className="w-full h-full object-cover" />
            </div>

            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground">{tour.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 font-body text-sm text-muted-foreground"><Clock size={14} /> {tour.duration}</span>
                <span className="flex items-center gap-1 font-body text-sm text-muted-foreground"><Users size={14} /> Max {tour.groupSize} people</span>
              </div>
            </div>

            {tour.description && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">About this Tour</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{tour.description}</p>
              </div>
            )}

            {tour.itinerary && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Itinerary</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tour.itinerary}</p>
              </div>
            )}

            {tour.includes?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">What's Included</h3>
                <div className="flex flex-wrap gap-2">
                  {tour.includes.map((i: string) => (
                    <span key={i} className="font-body text-sm bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-lg">✓ {i}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
              {booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-green" />
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Tour Booked!</h3>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <span className="font-heading text-3xl font-bold text-foreground">₹{tour.pricePerPerson?.toLocaleString('en-IN')}</span>
                    <span className="font-body text-sm text-muted-foreground"> /person</span>
                  </div>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Travel Date</label><input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Number of Persons</label><input type="number" min={1} max={tour.groupSize || 20} value={persons} onChange={(e) => setPersons(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <div className="border-t border-border mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm"><span className="text-muted-foreground">₹{tour.pricePerPerson} × {persons} person(s)</span><span>₹{total.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between font-body text-sm font-semibold border-t border-border pt-2"><span>Total</span><span className="text-brand-crimson">₹{total.toLocaleString('en-IN')}</span></div>
                  </div>
                  <button onClick={handleBook} className="btn-gold w-full py-3 rounded-xl text-sm mt-4">Book Tour</button>
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
