import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import ImageCarousel from '@/components/shared/ImageCarousel';
import SEO from '@/components/SEO';
import { api } from '@/lib/api';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';
import { useSettingsStore } from '@/store/settingsStore';

const TourDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const companyPhone = useSettingsStore((s) => s.settings.adminPhone);
  const [tour, setTour] = useState<any>(() => getPrefetchedDetail('tours', id) || getCachedListingItem('tours', id) || null);
  const [isLoading, setIsLoading] = useState(true);
  const [travelDate, setTravelDate] = useState('');
  const [persons, setPersons] = useState(1);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/tours/${id}`);
        setTour(res.data?.data || null);
      } catch {
        setTour(null);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id]);

  if (isLoading && !tour) {
    return (
      <div className="pt-20 pb-8 text-center min-h-screen bg-background">
        <p className="font-body text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="pt-20 pb-8 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Tour not found</p>
        <Link to="/tours" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">Back to Tours</Link>
      </div>
    );
  }

  const pricePerPerson = Number(tour.pricePerPerson || 0);
  const subtotal = pricePerPerson * persons;
  const convenienceFee = Math.round(subtotal * 0.02);
  const total = subtotal + convenienceFee;
  const advanceAmount = total > 0 ? Math.round(total * 0.3) : 0;
  const balanceAmount = Math.max(0, total - advanceAmount);
  const phoneDigits = companyPhone.replace(/\D/g, '');
  const whatsappDigits = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const allImages = [tour.image, ...(tour.images || [])].filter(Boolean);
  const tourDescription = truncate(tour.description || `${tour.name} guided Braj tour package with booking support from Vrindavan Sarthi Enterprises.`);
  const whatsappMessage = [
    'Radhe Radhe, I want to confirm a tour booking.',
    `Tour: ${tour.name}`,
    travelDate ? `Travel date: ${travelDate}` : '',
    `Persons: ${persons}`,
    tour.destination ? `Destination: ${tour.destination}` : '',
    tour.duration ? `Duration: ${tour.duration}` : '',
    total > 0 ? `Estimated total: Rs. ${total.toLocaleString('en-IN')}` : '',
    'Please confirm availability and payment amount.',
  ].filter(Boolean).join('\n');
  const tourJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${absoluteUrl(`/tours/${tour._id}`)}#service`,
      name: tour.name,
      description: tourDescription,
      image: allImages.map(absoluteAssetUrl).filter(Boolean),
      provider: { '@type': 'Organization', name: 'Vrindavan Sarthi Enterprises', url: absoluteUrl('/') },
      areaServed: ['Braj', 'Vrindavan', 'Mathura', 'Govardhan', 'Barsana', 'Gokul', 'Nandgaon'],
      serviceType: 'Guided spiritual tour package',
      offers: { '@type': 'Offer', url: absoluteUrl(`/tours/${tour._id}`), priceCurrency: 'INR', price: pricePerPerson, availability: 'https://schema.org/InStock' },
    },
    { '@context': 'https://schema.org', '@type': 'TouristTrip', name: tour.name, description: tourDescription, itinerary: tour.itinerary || tour.highlights?.join(', ') || undefined },
  ];

  return (
    <div className="braj-page pt-4 pb-10 min-h-screen">
      <SEO title={`${tour.name} Tour Package`} description={tourDescription} image={allImages[0]} canonicalPath={`/tours/${tour._id}`} jsonLd={tourJsonLd} />
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-4 mt-0 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_385px]">
          <div className="space-y-5">
            <ImageCarousel images={allImages} alt={tour.name} />
            <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-brand-crimson">Guided tour package</p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">{tour.name}</h1>
                  <p className="mt-2 font-body text-sm text-muted-foreground">{tour.destination || 'Braj and nearby pilgrimage route'}</p>
                </div>
                <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 font-body text-sm">
                  <p className="text-muted-foreground">Booking payment</p>
                  <p className="font-bold text-foreground">After confirmation</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 border-t border-border pt-4 font-body text-sm sm:grid-cols-4">
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Duration</p><p className="mt-1 font-semibold">{tour.duration || 'On request'}</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Group</p><p className="mt-1 font-semibold">Max {tour.groupSize || 'custom'}</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Cab</p><p className="mt-1 font-semibold">{tour.cabType || 'As required'}</p></div>
                <div className="border-l-2 border-brand-gold/60 pl-3"><p className="text-xs text-muted-foreground">Advance</p><p className="mt-1 font-semibold">30% or full</p></div>
              </div>
            </div>

            {tour.placesCovered?.length > 0 && (
              <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Places Covered</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {tour.placesCovered.map((place: string) => (
                    <span key={place} className="rounded-lg border border-border bg-secondary/45 px-3 py-2 font-body text-sm text-foreground">{place}</span>
                  ))}
                </div>
              </div>
            )}

            {tour.description && (
              <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">About this Tour</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{tour.description}</p>
              </div>
            )}

            {tour.itinerary && (
              <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Itinerary</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tour.itinerary}</p>
              </div>
            )}

            {tour.includes?.length > 0 && (
              <div className="rounded-lg border border-border/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Included</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tour.includes.map((item: string) => (
                    <span key={item} className="font-body text-sm bg-secondary px-3 py-1.5 rounded-lg border border-border text-secondary-foreground">{item}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-brand-gold/35 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <p className="font-display text-xl font-semibold text-foreground">Simple booking flow</p>
              <div className="mt-4 grid gap-3 font-body text-sm sm:grid-cols-3">
                <div><p className="font-bold text-foreground">1. Confirm</p><p className="mt-1 text-muted-foreground">Share date, persons, pickup need, and tour preference.</p></div>
                <div><p className="font-bold text-foreground">2. Pay</p><p className="mt-1 text-muted-foreground">After confirmation, pay 30% advance or the full amount.</p></div>
                <div><p className="font-bold text-foreground">3. Visit</p><p className="mt-1 text-muted-foreground">Final pickup plan and support details are shared by the team.</p></div>
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-lg border border-brand-gold/45 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.12)] sm:p-6 lg:sticky lg:top-24">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-brand-crimson">Booking desk</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground">Confirm by call or WhatsApp</h2>
              <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">Our team confirms date, pickup plan, vehicle, final amount, and payment link. Payment is collected only after confirmation.</p>

              <div className="mt-5 space-y-3">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Travel Date</label><input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Number of Persons</label><input type="number" min={1} max={tour.groupSize || 50} value={persons} onChange={(e) => setPersons(Math.max(1, Number(e.target.value || 1)))} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-secondary/45 p-4">
                <div className="flex justify-between gap-3 font-body text-sm"><span className="text-muted-foreground">Estimated total</span><span className="font-bold text-foreground">{total > 0 ? `Rs. ${total.toLocaleString('en-IN')}` : 'On confirmation'}</span></div>
                {total > 0 && (
                  <div className="mt-2 space-y-1 font-body text-[11px] text-muted-foreground">
                    <p>Base: Rs. {subtotal.toLocaleString('en-IN')}</p>
                    <p>Service fee: Rs. {convenienceFee.toLocaleString('en-IN')}</p>
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

export default TourDetail;
