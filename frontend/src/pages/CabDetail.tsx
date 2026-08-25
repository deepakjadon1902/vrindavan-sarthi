import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import ImageCarousel from '@/components/shared/ImageCarousel';
import SEO from '@/components/SEO';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';
import { useSettingsStore } from '@/store/settingsStore';

const comparableKey = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const vehicleKey = (value: unknown) => comparableKey(value).replace(/\b(seater|seat|seats|cab|car|taxi|vehicle)\b/g, '').replace(/\s+/g, ' ').trim();

const CabDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const companyPhone = useSettingsStore((s) => s.settings.adminPhone);
  const [cab, setCab] = useState<any>(() => getPrefetchedDetail('cabs', id) || getCachedListingItem('cabs', id) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [cabType, setCabType] = useState('');
  const [fare, setFare] = useState<number | null>(null);
  const [fareErr, setFareErr] = useState('');
  const [fareRules, setFareRules] = useState<any[]>([]);
  const [selectedFareRuleId, setSelectedFareRuleId] = useState('');
  const fixedPassengerCount = Math.max(1, Number(cab?.capacity || 1));

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
    setFareErr('Admin fare is pending for this route.');
  }, [cabType, dropoff, pickup, selectedFareRule]);

  if (isLoading && !cab) {
    return (
      <div className="pt-20 pb-8 text-center min-h-screen bg-background">
        <p className="font-body text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!cab) {
    return (
      <div className="pt-20 pb-8 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Cab not found</p>
        <Link to="/cabs" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Cabs</Link>
      </div>
    );
  }

  const allImages = [cab.image, ...(cab.images || [])].filter(Boolean);
  const convenienceFee = typeof fare === 'number' ? Math.round(fare * 0.0445) : 0;
  const checkoutTotal = typeof fare === 'number' ? fare + convenienceFee : 0;
  const advanceAmount = checkoutTotal > 0 ? Math.round(checkoutTotal * 0.3) : 0;
  const balanceAmount = checkoutTotal > 0 ? Math.max(0, checkoutTotal - advanceAmount) : 0;
  const phoneDigits = companyPhone.replace(/\D/g, '');
  const whatsappDigits = phoneDigits;
  const selectedRouteLabel = pickup && dropoff ? `${pickup} to ${dropoff}` : 'Route not selected';
  const cabDescription = truncate(cab.description || `${cab.vehicleName} ${cab.vehicleType} cab booking for Braj and nearby pilgrimage routes.`);
  const whatsappMessage = [
    'Radhe Radhe, I want to confirm a cab booking.',
    `Cab: ${cab.vehicleName}`,
    `Route: ${selectedRouteLabel}`,
    pickupDate ? `Date: ${pickupDate}` : '',
    pickupTime ? `Time: ${pickupTime}` : '',
    `Passengers/Seats: ${fixedPassengerCount}`,
    cabType ? `Vehicle: ${cabType}` : '',
    typeof fare === 'number' ? `Estimated total: Rs. ${checkoutTotal.toLocaleString('en-IN')}` : '',
    'Please confirm availability and payment amount.',
  ].filter(Boolean).join('\n');
  const cabJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${absoluteUrl(`/cabs/${cab._id}`)}#service`,
    name: `${cab.vehicleName} Cab Booking`,
    description: cabDescription,
    image: allImages.map(absoluteAssetUrl).filter(Boolean),
    provider: { '@type': 'Organization', name: 'Vrindavan Sarthi', url: absoluteUrl('/') },
    areaServed: cab.routes?.length ? cab.routes : ['Braj', 'Vrindavan', 'Mathura', 'Govardhan', 'Barsana'],
    serviceType: 'Cab booking',
    offers: { '@type': 'Offer', url: absoluteUrl(`/cabs/${cab._id}`), priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
  };

  return (
    <div className="braj-page pt-4 pb-10 min-h-screen">
      <SEO title={`${cab.vehicleName} Cab Booking Across Braj`} description={cabDescription} image={allImages[0]} canonicalPath={`/cabs/${cab._id}`} jsonLd={cabJsonLd} />
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-4 mt-0 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_385px]">
          <div className="space-y-5">
            <ImageCarousel images={allImages} alt={cab.vehicleName} />

            <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-brand-crimson">Private cab booking</p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">{cab.vehicleName}</h1>
                  <p className="mt-2 font-body text-sm text-muted-foreground">{cab.vehicleType}</p>
                </div>
                <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 font-body text-sm">
                  <p className="text-muted-foreground">Booking payment</p>
                  <p className="font-bold text-foreground">After confirmation</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <h3 className="font-display text-xl font-semibold text-foreground">Vehicle Details</h3>
              <div className="mt-4 grid gap-3 font-body text-sm sm:grid-cols-4">
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Type</p><p className="mt-1 font-semibold">{cab.vehicleType}</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Seats</p><p className="mt-1 font-semibold">{cab.capacity}</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Driver</p><p className="mt-1 font-semibold">Shared after call</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Advance</p><p className="mt-1 font-semibold">30% or full</p></div>
              </div>
            </div>

            {cab.routes?.length > 0 && (
              <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Available Routes</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cab.routes.map((r: string) => (
                    <span key={r} className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 font-body text-sm text-secondary-foreground">{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-brand-gold/35 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <p className="font-display text-xl font-semibold text-foreground">Simple booking flow</p>
              <div className="mt-4 grid gap-3 font-body text-sm sm:grid-cols-3">
                <div><p className="font-bold text-foreground">1. Confirm</p><p className="mt-1 text-muted-foreground">Share your route, date, and time by call or WhatsApp.</p></div>
                <div><p className="font-bold text-foreground">2. Pay</p><p className="mt-1 text-muted-foreground">After confirmation, pay 30% advance or the full fare.</p></div>
                <div><p className="font-bold text-foreground">3. Travel</p><p className="mt-1 text-muted-foreground">Driver and contact details are shared by the travel desk.</p></div>
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-lg border border-brand-gold/45 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.12)] sm:p-6 lg:sticky lg:top-24">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-brand-crimson">Booking desk</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground">Confirm by call or WhatsApp</h2>
              <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">Our team confirms availability, driver details, final fare, and payment link. No advance is collected before confirmation.</p>

              <div className="mt-5 space-y-3">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Date</label><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Time</label><input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Route</label><select value={pickup && dropoff ? `${pickup}|||${dropoff}` : ''} onChange={(e) => { const [from, to] = e.target.value.split('|||'); setPickup(from || ''); setDropoff(to || ''); setCabType(''); setSelectedFareRuleId(''); }} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"><option value="">Select route</option>{routeOptions.map((route) => <option key={route.key} value={route.key}>{route.label}</option>)}</select></div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-secondary/45 p-4">
                <div className="flex items-center justify-between gap-3 font-body text-sm">
                  <span className="text-muted-foreground">Estimated fare</span>
                  <span className="font-bold text-foreground">{typeof fare === 'number' ? `Rs. ${fare.toLocaleString('en-IN')}` : 'On confirmation'}</span>
                </div>
                {fareErr && <p className="mt-2 text-xs font-body text-destructive">{fareErr}</p>}
                {!fareErr && typeof fare === 'number' && (
                  <div className="mt-2 space-y-1 font-body text-[11px] text-muted-foreground">
                    <p>Total estimate with service fee: Rs. {checkoutTotal.toLocaleString('en-IN')}</p>
                    <p>After confirmation: 30% advance Rs. {advanceAmount.toLocaleString('en-IN')} or full payment.</p>
                    <p>Balance if advance paid: Rs. {balanceAmount.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-body text-sm font-bold">
                  <MessageCircle size={17} /> WhatsApp Booking
                </a>
                <a href={`tel:${phoneDigits}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-3 font-body text-sm font-bold text-foreground hover:border-brand-gold/50">
                  <Phone size={17} /> Call to Confirm
                </a>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 font-body text-xs sm:grid-cols-2">
                <div><p className="text-muted-foreground">Payment</p><p className="font-bold text-foreground">After confirmation</p></div>
                <div><p className="text-muted-foreground">Advance</p><p className="font-bold text-foreground">30% or full</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CabDetail;
