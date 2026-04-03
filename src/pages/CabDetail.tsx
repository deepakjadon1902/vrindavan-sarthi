import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Car, Phone, User, CheckCircle, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';

const CabDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { addBooking } = useBookingStore();
  const [cab, setCab] = useState<any>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem('vvs_cabs');
      if (data) {
        const found = JSON.parse(data).find((c: any) => c.id === id);
        if (found) setCab(found);
      }
    } catch {}
  }, [id]);

  if (!cab) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Cab not found</p>
      <Link to="/cabs" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Cabs</Link>
    </div>
  );

  const handleBook = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!pickupDate) { toast.error('Please select pickup date'); return; }

    addBooking({
      bookingType: 'cab',
      itemId: cab.id,
      itemName: `${cab.vehicleName} - ${cab.driverName}`,
      itemImage: cab.image,
      userId: user!.id,
      userName: user!.name,
      userEmail: user!.email,
      userPhone: user!.phone,
      partnerId: cab.partnerId,
      partnerName: cab.partnerName,
      checkIn: pickupDate,
      totalAmount: 0,
      paymentMethod: 'doorstep',
      paymentStatus: 'pending',
      bookingStatus: 'confirmed',
      additionalInfo: `Pickup: ${pickup}, Drop: ${dropoff}`,
    });
    setBooked(true);
    toast.success('Cab booked! Pay at doorstep.');
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
              <img src={cab.image} alt={cab.vehicleName} className="w-full h-full object-cover" />
            </div>

            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground">{cab.vehicleName}</h1>
              <p className="font-body text-sm text-muted-foreground mt-1">🚗 {cab.vehicleType}</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-4 font-body text-sm">
                <div><span className="text-muted-foreground block text-xs mb-1">Type</span><span className="flex items-center gap-1"><Car size={14} /> {cab.vehicleType}</span></div>
                <div><span className="text-muted-foreground block text-xs mb-1">Capacity</span><span className="flex items-center gap-1"><Users size={14} /> {cab.capacity} Seater</span></div>
                <div><span className="text-muted-foreground block text-xs mb-1">Driver</span><span className="flex items-center gap-1"><User size={14} /> {cab.driverName}</span></div>
                <div><span className="text-muted-foreground block text-xs mb-1">Phone</span><span className="flex items-center gap-1"><Phone size={14} /> {cab.driverPhone}</span></div>
              </div>
            </div>

            {cab.routes?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-3">Available Routes</h3>
                <div className="flex flex-wrap gap-2">
                  {cab.routes.map((r: string) => (
                    <span key={r} className="font-body text-sm bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground flex items-center gap-1"><MapPin size={12} />{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-6 text-center">
              <p className="font-heading text-lg font-semibold text-foreground mb-1">💰 Pay at Doorstep</p>
              <p className="font-body text-sm text-muted-foreground">Fare decided by driver. Payment directly to driver at destination.</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
              {booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-green" />
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-2">Cab Booked!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Pay directly to the driver</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-4">Book this Cab</h3>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Date</label><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Location</label><input type="text" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. Vrindavan" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Drop Location</label><input type="text" value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="e.g. Mathura" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                  </div>
                  <button onClick={handleBook} className="btn-gold w-full py-3 rounded-xl text-sm mt-6">Book Cab (Pay at Doorstep)</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CabDetail;
