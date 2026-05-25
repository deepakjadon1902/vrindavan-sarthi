import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Car, CheckCircle, MapPin, Users, Sparkles, ShieldCheck, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';

const CabDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { createCabBooking } = useBookingStore();
  const [cab, setCab] = useState<any>(() => getPrefetchedDetail('cabs', id) || getCachedListingItem('cabs', id) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [persons, setPersons] = useState(1);
  const [cabType, setCabType] = useState('');
  const [fare, setFare] = useState<number | null>(null);
  const [fareErr, setFareErr] = useState<string>('');
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/cabs/${id}`);
        setCab(res.data?.data || null);
      } catch {
        setCab(null);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id]);

  useEffect(() => {
    setFullName(user?.name || '');
    setMobileNumber(user?.phone || '');
  }, [user?.name, user?.phone]);

  useEffect(() => {
    setCabType((prev) => prev || cab?.vehicleType || '');
  }, [cab?.vehicleType]);

  useEffect(() => {
    const run = async () => {
      setFare(null);
      setFareErr('');
      if (!pickup || !dropoff || !cabType) return;
      try {
        const res = await api.get('/cab-fares/calculate', {
          params: {
            pickupLocation: pickup,
            dropLocation: dropoff,
            cabType,
            persons,
          },
        });
        const total = Number(res.data?.data?.totalFare ?? res.data?.data?.cabFareTotal ?? 0);
        if (Number.isFinite(total) && total >= 0) setFare(total);
      } catch (e: any) {
        const msg = e?.response?.data?.message || 'Fare not set for this route/cab type.';
        setFareErr(String(msg));
      }
    };
    void run();
  }, [pickup, dropoff, cabType, persons]);

  if (isLoading && !cab) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-body text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  if (!cab) return (
    <div className="pt-24 pb-16 text-center min-h-screen bg-background">
      <p className="font-heading text-2xl text-muted-foreground">Cab not found</p>
      <Link to="/cabs" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Cabs</Link>
    </div>
  );

  const handleBook = async () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return; }
    if (!fullName) { toast.error('Please enter full name'); return; }
    if (!mobileNumber) { toast.error('Please enter mobile number'); return; }
    if (!pickupDate) { toast.error('Please select pickup date'); return; }
    if (!pickupTime) { toast.error('Please select pickup time'); return; }
    if (!pickup || !dropoff) { toast.error('Please enter pickup and drop'); return; }
    if (!cabType) { toast.error('Please select cab type'); return; }
    if (fareErr) { toast.error(fareErr); return; }

    if (!user) return;
    const res = await createCabBooking({
      fullName,
      mobileNumber,
      pickupLocation: pickup,
      dropLocation: dropoff,
      pickupDate,
      pickupTime,
      persons,
      cabType,
    });

    if (!res.success) {
      toast.error(res.error || 'Booking failed');
      return;
    }
    setBooked(true);
    toast.success('Cab request submitted! Admin will confirm and assign a driver.');
  };

  const allImages = [cab.image, ...(cab.images || [])].filter(Boolean);

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 -right-24 w-80 h-80 rounded-full bg-brand-green/15 blur-3xl" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ImageCarousel images={allImages} alt={cab.vehicleName} />

            <div className="glass-panel rounded-2xl p-6 metallic-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-gold animate-float-slow" />
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Trusted Ride</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">{cab.vehicleName}</h1>
              <p className="font-body text-sm text-muted-foreground mt-2">🚗 {cab.vehicleType}</p>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-display text-xl font-semibold text-foreground mb-4">Vehicle Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-body text-sm">
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Car size={20} className="mx-auto text-brand-gold mb-1" /><p className="text-xs text-muted-foreground">Type</p><p className="font-semibold">{cab.vehicleType}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Users size={20} className="mx-auto text-brand-crimson mb-1" /><p className="text-xs text-muted-foreground">Seats</p><p className="font-semibold">{cab.capacity}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><ShieldCheck size={20} className="mx-auto text-brand-green mb-1" /><p className="text-xs text-muted-foreground">Driver</p><p className="font-semibold truncate">Assigned after confirmation</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><ShieldCheck size={20} className="mx-auto text-blue-500 mb-1" /><p className="text-xs text-muted-foreground">Contact</p><p className="font-semibold">Visible after confirmation</p></div>
              </div>
            </div>

            {cab.routes?.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Available Routes</h3>
                <div className="flex flex-wrap gap-2">
                  {cab.routes.map((r: string) => (
                    <span key={r} className="font-body text-sm bg-secondary/80 backdrop-blur px-3 py-1.5 rounded-lg text-secondary-foreground flex items-center gap-1 border border-brand-gold/20"><MapPin size={12} />{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative overflow-hidden rounded-2xl p-6 text-center metallic-border glass-panel">
              <ShieldCheck size={32} className="mx-auto text-brand-green mb-2" />
              <p className="font-display text-xl font-semibold text-foreground mb-1">💰 Pay at Doorstep</p>
              <p className="font-body text-sm text-muted-foreground">Fare decided by driver. Pay directly upon arrival — no advance needed.</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="glass-panel rounded-2xl p-6 sticky top-24 metallic-border">
              {booked ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-green animate-float-slow" />
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-2">Cab Booked!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Pay directly to the driver</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : (
                <>
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-4">Book this Cab</h3>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Mobile Number</label><input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Date</label><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Time</label><input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Location</label><input type="text" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. Vrindavan" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Drop Location</label><input type="text" value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="e.g. Mathura" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Persons</label><input type="number" min={1} value={persons} onChange={(e) => setPersons(Math.max(1, Number(e.target.value || 1)))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                      <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Cab Type</label><input type="text" value={cabType} onChange={(e) => setCabType(e.target.value)} placeholder="e.g. Sedan" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    </div>

                    <div className="rounded-xl border border-border bg-secondary/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                          <IndianRupee size={16} className="text-brand-gold" /> Estimated Fare
                        </div>
                        <div className="font-display text-lg font-semibold text-foreground">
                          {typeof fare === 'number' ? `₹${fare.toLocaleString('en-IN')}` : '-'}
                        </div>
                      </div>
                      {fareErr && <p className="mt-2 text-xs font-body text-destructive">{fareErr}</p>}
                      {!fareErr && <p className="mt-2 text-[11px] font-body text-muted-foreground">Cash payment to driver after trip completion.</p>}
                    </div>
                  </div>
                  <button onClick={handleBook} className="metallic-gold w-full py-3 rounded-xl text-sm font-body font-semibold mt-6 tracking-wide">Submit Booking Request</button>
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
