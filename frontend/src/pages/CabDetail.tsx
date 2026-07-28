import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Car, CheckCircle, MapPin, Users, Sparkles, ShieldCheck, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import ImageCarousel from '@/components/shared/ImageCarousel';
import UpiPayment from '@/components/UpiPayment';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';
import SEO from '@/components/SEO';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';

const comparableKey = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const vehicleKey = (value: unknown) => comparableKey(value).replace(/\b(seater|seat|seats|cab|car|taxi|vehicle)\b/g, '').replace(/\s+/g, ' ').trim();

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
  const [passengers, setPassengers] = useState(1);
  const [cabType, setCabType] = useState('');
  const [tollOption, setTollOption] = useState<'included' | 'excluded' | ''>('');
  const [fare, setFare] = useState<number | null>(null);
  const [fareErr, setFareErr] = useState<string>('');
  const [fareRules, setFareRules] = useState<any[]>([]);
  const [selectedFareRuleId, setSelectedFareRuleId] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState('');
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
    const run = async () => {
      try {
        const res = await api.get('/cab-fares');
        setFareRules(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setFareRules([]);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    setFullName(user?.name || '');
    setMobileNumber(user?.phone || '');
  }, [user?.name, user?.phone]);

  const routeOptions = useMemo(() => {
    const seen = new Set<string>();
    const currentCabKeys = [
      vehicleKey(cab?.vehicleName),
      vehicleKey(cab?.vehicleName && cab?.capacity ? `${cab.vehicleName} ${cab.capacity}` : ''),
      vehicleKey(cab?.vehicleName && cab?.capacity ? `${cab.vehicleName} ${cab.capacity} seater` : ''),
    ].filter(Boolean);
    const rulesForCab = fareRules.filter((rule) => {
      if (!currentCabKeys.length) return true;
      const ruleKey = vehicleKey(rule.cabType);
      return currentCabKeys.some((key) => ruleKey === key || ruleKey.includes(key) || key.includes(ruleKey));
    });
    const source = rulesForCab.length ? rulesForCab : fareRules;
    return source
      .map((rule) => ({
        key: `${rule.pickupLocation}|||${rule.dropLocation}`,
        pickupLocation: String(rule.pickupLocation || ''),
        dropLocation: String(rule.dropLocation || ''),
        label: `${rule.pickupLocation} to ${rule.dropLocation}`,
      }))
      .filter((route) => {
        if (!route.pickupLocation || !route.dropLocation || seen.has(route.key)) return false;
        seen.add(route.key);
        return true;
      });
  }, [cab?.capacity, cab?.vehicleName, fareRules]);

  const vehicleOptions = useMemo(() => {
    const seen = new Set<string>();
    return fareRules
      .filter((rule) => String(rule.pickupLocation || '') === pickup && String(rule.dropLocation || '') === dropoff)
      .map((rule) => ({
        id: String(rule._id || rule.id || ''),
        cabType: String(rule.cabType || '').trim(),
        baseFare: Number(rule.baseFare || 0),
      }))
      .filter((value) => {
        if (!value.cabType || seen.has(value.id || value.cabType)) return false;
        seen.add(value.id || value.cabType);
        return true;
      });
  }, [dropoff, fareRules, pickup]);

  useEffect(() => {
    if (!vehicleOptions.length) return;
    const selected = vehicleOptions.find((option) => option.id === selectedFareRuleId || option.cabType === cabType);
    const next = selected || vehicleOptions[0];
    if (!selected || cabType !== next.cabType || selectedFareRuleId !== next.id) {
      setCabType(next.cabType);
      setSelectedFareRuleId(next.id);
    }
  }, [cabType, selectedFareRuleId, vehicleOptions]);

  useEffect(() => {
    if (pickup || dropoff || !routeOptions.length) return;
    const first = routeOptions[0];
    setPickup(first.pickupLocation);
    setDropoff(first.dropLocation);
  }, [dropoff, pickup, routeOptions]);

  const selectedFareRule = useMemo(
    () => fareRules.find((rule) => String(rule._id || rule.id || '') === selectedFareRuleId) || null,
    [fareRules, selectedFareRuleId],
  );

  useEffect(() => {
    setFareErr('');
    if (!pickup || !dropoff || !cabType) {
      setFare(null);
      return;
    }
    if (selectedFareRule) {
      const total = Number(selectedFareRule.baseFare || 0);
      setFare(Number.isFinite(total) && total >= 0 ? total : null);
      return;
    }
    setFare(null);
    setFareErr('Please select a taxi rate set by admin for this route.');
  }, [cabType, dropoff, pickup, selectedFareRule]);

  if (isLoading && !cab) return (
    <div className="pt-20 pb-8 text-center min-h-screen bg-background">
      <p className="font-body text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  if (!cab) return (
    <div className="pt-20 pb-8 text-center min-h-screen bg-background">
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
    if (!cabType) { toast.error('Please select vehicle'); return; }
    if (!tollOption) { toast.error('Please choose whether tolls are included or excluded'); return; }
    if (fareErr) { toast.error(fareErr); return; }
    if (typeof fare !== 'number') { toast.error('Please select a valid route fare'); return; }

    if (!user) return;
    setPendingBookingId(`CAB-${Date.now()}`);
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (transactionId: string) => {
    const res = await createCabBooking({
      fullName,
      mobileNumber,
      pickupLocation: pickup,
      dropLocation: dropoff,
      pickupDate,
      pickupTime,
      passengers,
      cabType,
      cabFareRuleId: selectedFareRuleId,
      tollOption,
      paymentOption: 'advance_30',
      upiTransactionId: transactionId,
    });

    if (!res.success) {
      toast.error(res.error || 'Booking failed');
      return;
    }
    setShowPayment(false);
    setBooked(true);
    toast.success('Cab request submitted! Advance payment verification is pending.');
  };

  const allImages = [cab.image, ...(cab.images || [])].filter(Boolean);
  const convenienceFee = typeof fare === 'number' ? Math.round(fare * 0.02) : 0;
  const checkoutTotal = typeof fare === 'number' ? fare + convenienceFee : 0;
  const advanceAmount = checkoutTotal > 0 ? Math.round(checkoutTotal * 0.3) : 0;
  const balanceAmount = checkoutTotal > 0 ? Math.max(0, checkoutTotal - advanceAmount) : 0;
  const cabDescription = truncate(cab.description || `${cab.vehicleName} ${cab.vehicleType} cab booking for Vrindavan and nearby pilgrimage routes.`);
  const cabJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${absoluteUrl(`/cabs/${cab._id}`)}#service`,
    name: `${cab.vehicleName} Cab Booking`,
    description: cabDescription,
    image: allImages.map(absoluteAssetUrl).filter(Boolean),
    provider: { '@type': 'Organization', name: 'Vrindavan Sarthi Enterprises', url: absoluteUrl('/') },
    areaServed: cab.routes?.length ? cab.routes : ['Vrindavan', 'Mathura'],
    serviceType: 'Cab booking',
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/cabs/${cab._id}`),
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div className="pt-20 pb-8 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <SEO
        title={`${cab.vehicleName} Cab Booking in Vrindavan`}
        description={cabDescription}
        image={allImages[0]}
        canonicalPath={`/cabs/${cab._id}`}
        jsonLd={cabJsonLd}
      />
      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-3 mt-3 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <ImageCarousel images={allImages} alt={cab.vehicleName} />

            <div className="glass-panel rounded-lg p-4 sm:p-5 metallic-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-gold animate-float-slow" />
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-brand-gold">Trusted Ride</span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight">{cab.vehicleName}</h1>
              <p className="font-body text-sm text-muted-foreground mt-2">🚗 {cab.vehicleType}</p>
            </div>

            <div className="glass-panel rounded-lg p-4 sm:p-5">
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-body text-sm">
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Car size={20} className="mx-auto text-brand-gold mb-1" /><p className="text-xs text-muted-foreground">Type</p><p className="font-semibold">{cab.vehicleType}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><Users size={20} className="mx-auto text-brand-crimson mb-1" /><p className="text-xs text-muted-foreground">Seats</p><p className="font-semibold">{cab.capacity}</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><ShieldCheck size={20} className="mx-auto text-brand-green mb-1" /><p className="text-xs text-muted-foreground">Driver</p><p className="font-semibold truncate">Assigned after confirmation</p></div>
                <div className="text-center p-3 rounded-xl bg-secondary/50"><ShieldCheck size={20} className="mx-auto text-blue-500 mb-1" /><p className="text-xs text-muted-foreground">Contact</p><p className="font-semibold">Visible after confirmation</p></div>
              </div>
            </div>

            {cab.routes?.length > 0 && (
              <div className="glass-panel rounded-lg p-4 sm:p-5">
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">Available Routes</h3>
                <div className="flex flex-wrap gap-2">
                  {cab.routes.map((r: string) => (
                    <span key={r} className="font-body text-sm bg-secondary/80 backdrop-blur px-3 py-1.5 rounded-lg text-secondary-foreground flex items-center gap-1 border border-brand-gold/20"><MapPin size={12} />{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative overflow-hidden rounded-lg p-4 sm:p-5 text-center metallic-border glass-panel">
              <ShieldCheck size={32} className="mx-auto text-brand-green mb-2" />
              <p className="font-display text-xl font-semibold text-foreground mb-1">30% Advance Required</p>
              <p className="font-body text-sm text-muted-foreground">Fare is fixed for the whole vehicle. Pay 30% online now and 70% later.</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="glass-panel rounded-lg p-4 sm:p-5 sticky top-24 metallic-border">
              {booked ? (
                <div className="text-center py-5">
                  <CheckCircle size={48} className="mx-auto mb-4 text-brand-green animate-float-slow" />
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-2">Cab Booked!</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">Advance submitted. Admin will verify payment and assign a driver.</p>
                  <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-lg text-sm">View My Bookings</Link>
                </div>
              ) : showPayment ? (
                <UpiPayment
                  amount={advanceAmount}
                  bookingId={pendingBookingId}
                  itemName={`${pickup} to ${dropoff} (${cabType})`}
                  onPaymentConfirm={handlePaymentConfirm}
                  onCancel={() => setShowPayment(false)}
                />
              ) : (
                <>
                  <h3 className="font-display text-2xl font-semibold text-foreground mb-3">Book this Cab</h3>
                  <div className="space-y-4">
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Mobile Number</label><input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Date</label><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Time</label><input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Route</label><select value={pickup && dropoff ? `${pickup}|||${dropoff}` : ''} onChange={(e) => { const [from, to] = e.target.value.split('|||'); setPickup(from || ''); setDropoff(to || ''); setCabType(''); setSelectedFareRuleId(''); }} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"><option value="">Select route</option>{routeOptions.map((route) => <option key={route.key} value={route.key}>{route.label}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Passengers</label><input type="number" min={1} max={cab?.capacity || undefined} value={passengers} onChange={(e) => setPassengers(Math.max(1, Number(e.target.value || 1)))} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                      <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle</label><select value={selectedFareRuleId} onChange={(e) => { const next = vehicleOptions.find((option) => option.id === e.target.value); setSelectedFareRuleId(e.target.value); setCabType(next?.cabType || ''); }} disabled={!vehicleOptions.length} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 disabled:opacity-60"><option value="">Select vehicle</option>{vehicleOptions.map((vehicle) => <option key={vehicle.id || vehicle.cabType} value={vehicle.id}>{vehicle.cabType} - Rs. {vehicle.baseFare.toLocaleString('en-IN')}</option>)}</select></div>
                    </div>
                    <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Toll Charges</label><select value={tollOption} onChange={(e) => setTollOption(e.target.value as 'included' | 'excluded' | '')} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"><option value="">Select toll option</option><option value="included">Tolls Included</option><option value="excluded">Tolls Excluded</option></select></div>

                    <div className="rounded-xl border border-border bg-secondary/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                          <IndianRupee size={16} className="text-brand-gold" /> Base Fare
                        </div>
                        <div className="font-display text-lg font-semibold text-foreground">
                          {typeof fare === 'number' ? `₹${fare.toLocaleString('en-IN')}` : '-'}
                        </div>
                      </div>
                      {fareErr && <p className="mt-2 text-xs font-body text-destructive">{fareErr}</p>}
                      {!fareErr && typeof fare === 'number' && (
                        <div className="mt-2 space-y-1 text-[11px] font-body text-muted-foreground">
                          <p>Convenience fee (2%): Rs. {convenienceFee.toLocaleString('en-IN')}</p>
                          <p>Total: Rs. {checkoutTotal.toLocaleString('en-IN')}</p>
                          <p>Advance now: Rs. {advanceAmount.toLocaleString('en-IN')} | Balance later: Rs. {balanceAmount.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handleBook} className="metallic-gold w-full py-3 rounded-lg text-sm font-body font-semibold mt-4 tracking-wide">Pay 30% Advance</button>
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
