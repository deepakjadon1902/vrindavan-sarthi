import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Shield, Clock, User as UserIcon, Star, Landmark, BedDouble, Minus, Plus, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';
import { useSettingsStore } from '@/store/settingsStore';
import SEO from '@/components/SEO';
import SimpleBookingPanel from '@/components/shared/SimpleBookingPanel';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';
import { hasPropertyTermsText, normalizePropertyTerms } from '@/components/shared/PropertyTerms';
import { isDharamshalaType } from '@/lib/propertyTypes';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout failed to load'));
    document.body.appendChild(script);
  });

const getNextDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date();
  date.setDate(date.getDate() + 1);
  return getLocalDateKey(date);
};

const dateKeyToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  return new Date(year, month - 1, day);
};

const RoomTypeDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, token } = useAuthStore();
  const { createRoomTypeBooking } = useBookingStore();
  const defaultHotelTaxPercent = useSettingsStore((s) => s.settings.hotelTaxPercent);
  const supportPhone = useSettingsStore((s) => s.settings.adminPhone);

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [checkIn, setCheckIn] = useState(() => qs.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(() => qs.get('checkOut') || '');

  const [data, setData] = useState<any | null>(() => getPrefetchedDetail('roomTypes', id) || getCachedListingItem('roomTypes', id) || null);
  const [selectedRoomAvailability, setSelectedRoomAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(() => !(getPrefetchedDetail('roomTypes', id) || getCachedListingItem('roomTypes', id)));
  const reqSeq = useRef(0);
  const roomAvailabilityReqSeq = useRef(0);

  const [customerFullName, setCustomerFullName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [totalAdults, setTotalAdults] = useState(1);
  const [totalChildren, setTotalChildren] = useState(0);
  const [roomQuantity, setRoomQuantity] = useState(1);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'advance_30' | 'full_100' | ''>('');
  const [propertyTermsAccepted, setPropertyTermsAccepted] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [isWaitlistedBooking, setIsWaitlistedBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityCalendar, setAvailabilityCalendar] = useState<any[] | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    const from = checkIn ? new Date(`${checkIn}T00:00:00.000Z`) : undefined;
    const to = checkOut ? new Date(`${checkOut}T00:00:00.000Z`) : undefined;
    if (from && Number.isFinite(from.getTime()) && to && Number.isFinite(to.getTime()) && to > from) return { from, to };
    if (from && Number.isFinite(from.getTime())) return { from };
    return undefined;
  });

  useEffect(() => {
    setCustomerFullName(user?.name || '');
    setCustomerMobile(user?.phone || '');
    setCustomerEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    if (!id) return;
    const cached = getPrefetchedDetail('roomTypes', id) || getCachedListingItem('roomTypes', id);
    if (cached) {
      setData((prev) => prev || cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const seq = (reqSeq.current += 1);
    const run = async () => {
      try {
        const params: any = {};
        if (checkIn && checkOut) { params.checkIn = checkIn; params.checkOut = checkOut; }
        const res = await api.get(`/room-types/${id}`, { params });
        if (reqSeq.current !== seq) return;
        setData(res.data?.data || null);
      } catch (e: any) {
        if (reqSeq.current !== seq) return;
        toast.error(e?.response?.data?.message || 'Failed to load room type');
        setData(cached || null);
      } finally {
        if (reqSeq.current === seq) {
          setLoading(false);
        }
      }
    };
    void run();
  }, [id, checkIn, checkOut]);

  useEffect(() => {
    const from = checkIn ? new Date(`${checkIn}T00:00:00.000Z`) : undefined;
    const to = checkOut ? new Date(`${checkOut}T00:00:00.000Z`) : undefined;
    if (from && Number.isFinite(from.getTime()) && to && Number.isFinite(to.getTime()) && to > from) setSelectedRange({ from, to });
    else if (from && Number.isFinite(from.getTime())) setSelectedRange({ from });
    else setSelectedRange(undefined);
  }, [checkIn, checkOut]);

  useEffect(() => {
    if (!id || !checkIn || !checkOut) {
      setSelectedRoomAvailability([]);
      return;
    }
    const seq = (roomAvailabilityReqSeq.current += 1);
    const run = async () => {
      try {
        const res = await api.get(`/room-types/${id}/room-availability`, { params: { checkIn, checkOut } });
        if (roomAvailabilityReqSeq.current !== seq) return;
        setSelectedRoomAvailability(res.data?.data?.roomAvailability || []);
        setData((prev: any) => prev ? { ...prev, ...res.data?.data } : prev);
      } catch {
        if (roomAvailabilityReqSeq.current === seq) setSelectedRoomAvailability([]);
      }
    };
    void run();
  }, [id, checkIn, checkOut]);

  const roomType = data || null;
  const hotel = roomType?.hotel || null;
  const uploader = roomType?.uploader || null;
  const isDharamshala = isDharamshalaType(hotel?.propertyType);
  const showPrices = hotel?.showPrices !== false;
  const roomHasPublishedPrice = Number(roomType?.pricePerNight || 0) > 0;
  const canShowRoomPrices = showPrices && (!isDharamshala || roomHasPublishedPrice);
  const supportDigits = supportPhone.replace(/\D/g, '');
  const whatsappMessage = `Radhe Radhe, I want to book ${hotel?.name || 'this property'}${roomType?.name ? ` - ${roomType.name}` : ''}${hotel?.location ? ` in ${hotel.location}` : ''}. Please share availability and price.`;
  const propertyTerms = normalizePropertyTerms(hotel?.propertyTerms);
  const mustAcceptPropertyTerms = propertyTerms.isActive && hasPropertyTermsText(propertyTerms);

  useEffect(() => {
    setPropertyTermsAccepted(false);
  }, [hotel?._id, propertyTerms.currentVersion]);

  const maxAdults = Math.max(1, Number(roomType?.maxAdults || 1));
  const maxChildren = Math.max(0, Number(roomType?.maxChildren || 0));
  const availableCountForSelection = typeof roomType?.availableCount === 'number' ? Math.max(0, Number(roomType.availableCount)) : null;
  const maxRoomQuantity = Math.max(1, availableCountForSelection !== null ? availableCountForSelection : Math.min(10, Number(roomType?.totalCount || 1) || 1));
  const maxAdultsForSelection = maxAdults * roomQuantity;
  const maxChildrenForSelection = maxChildren * roomQuantity;

  useEffect(() => {
    setRoomQuantity((prev) => Math.min(maxRoomQuantity, Math.max(1, prev)));
  }, [maxRoomQuantity]);

  useEffect(() => {
    setTotalAdults((prev) => Math.min(maxAdultsForSelection, Math.max(1, prev)));
    setTotalChildren((prev) => Math.min(maxChildrenForSelection, Math.max(0, prev)));
  }, [maxAdultsForSelection, maxChildrenForSelection]);

  useEffect(() => {
    if (isDharamshala || !canShowRoomPrices || paymentOption) return;
    setPaymentOption('advance_30');
  }, [canShowRoomPrices, isDharamshala, paymentOption]);

  useEffect(() => {
    if (!id) return;
    setAvailabilityLoading(true);
    const run = async () => {
      try {
        const now = new Date();
        const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
        const anchor = checkIn || fallbackFrom;
        const to = new Date(new Date(`${anchor}T00:00:00.000Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10);
        const res = await api.get(`/room-types/${id}/calendar`, { params: { from: anchor, to } });
        setAvailabilityCalendar(res.data?.data?.calendar || []);
        setShowAvailability(true);
      } catch {
        // ignore
      } finally {
        setAvailabilityLoading(false);
      }
    };
    void run();
  }, [id, checkIn]);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, { totalCount: number; availableCount: number; availabilityStatusLabel?: string }>();
    for (const d of availabilityCalendar || []) {
      const key = String(d?.date || '');
      if (!key) continue;
      map.set(key, {
        totalCount: Number(d?.totalCount || 0),
        availableCount: Number(d?.availableCount || 0),
        availabilityStatusLabel: typeof d?.availabilityStatusLabel === 'string' ? d.availabilityStatusLabel : undefined,
      });
    }
    return map;
  }, [availabilityCalendar]);

  const todayUtc = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }, []);
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const checkOutMinKey = useMemo(() => (checkIn ? getNextDateKey(checkIn) : todayKey), [checkIn, todayKey]);

  const handleCheckInDateChange = (value: string) => {
    if (value && value < todayKey) {
      toast.error('Check-in date cannot be in the past');
      return;
    }
    setCheckIn(value);
    if (checkOut && value && checkOut <= value) setCheckOut('');
    const from = value ? dateKeyToLocalDate(value) : undefined;
    const to = checkOut && value && checkOut > value ? dateKeyToLocalDate(checkOut) : undefined;
    setSelectedRange(from ? { from, ...(to ? { to } : {}) } : undefined);
  };

  const handleCheckOutDateChange = (value: string) => {
    if (value && value < todayKey) {
      toast.error('Check-out date cannot be in the past');
      return;
    }
    if (value && checkIn && value <= checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }
    setCheckOut(value);
    const from = checkIn ? dateKeyToLocalDate(checkIn) : undefined;
    const to = value ? dateKeyToLocalDate(value) : undefined;
    setSelectedRange(from ? { from, ...(to ? { to } : {}) } : undefined);
  };

  if (loading && !roomType) {
    return (
      <div className="braj-page pt-20 pb-8 text-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!roomType || !hotel) {
    return (
      <div className="braj-page pt-20 pb-8 text-center min-h-screen">
        <p className="text-2xl text-muted-foreground">Room type not found</p>
        <Link to="/rooms" className="btn-crimson inline-block mt-4 px-6 py-2 rounded-lg text-sm">
          Back to Rooms
        </Link>
      </div>
    );
  }

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
  const baseTotal = Number(roomType.pricePerNight || 0) * nights * roomQuantity;
  const taxEnabled = !isDharamshala && Boolean(hotel?.taxEnabled);
  const taxPercent = taxEnabled
    ? hotel?.gstMode === 'automatic'
      ? Number(roomType.pricePerNight || 0) <= 7500 ? 5 : 18
      : Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? defaultHotelTaxPercent ?? 12)))
    : 0;
  const taxTotal = Math.round((baseTotal * taxPercent) / 100);
  const subtotal = baseTotal + taxTotal;
  const dharamshalaServiceFee = Math.max(0, Math.round(Number(hotel?.dharamshalaServiceFee ?? 99)));
  const convenienceFeePercent = isDharamshala ? 0 : 4.45;
  const convenienceFee = isDharamshala ? dharamshalaServiceFee : Math.round(baseTotal * (convenienceFeePercent / 100));
  const total = subtotal + convenienceFee;
  const effectivePaymentOption = isDharamshala ? 'full_100' : paymentOption;
  const payableNow = isDharamshala ? 0 : effectivePaymentOption === 'full_100' ? total : effectivePaymentOption === 'advance_30' ? Math.round(total * 0.3) : 0;
  const balanceLater = Math.max(0, total - payableNow);
  const availableCount = availableCountForSelection;
  const totalCount = typeof roomType.totalCount === 'number' ? roomType.totalCount : null;
  const roomAvailability = selectedRoomAvailability.length
    ? selectedRoomAvailability
    : Array.isArray(roomType.roomAvailability)
      ? roomType.roomAvailability
      : [];
  const isFullyBookedSelectedDates = Boolean(checkIn && checkOut && availableCount !== null && availableCount <= 0);
  const isRequestedQuantityUnavailable = Boolean(checkIn && checkOut && availableCount !== null && roomQuantity > availableCount);

  const loadAvailabilityCalendar = async (opts?: { from?: string; to?: string }) => {
    if (!id) return;
    setAvailabilityLoading(true);
    try {
      const now = new Date();
      const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
      const anchor = checkIn || fallbackFrom;
      const fallbackTo = new Date(new Date(`${anchor}T00:00:00.000Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const from = opts?.from || anchor || fallbackFrom;
      const to = opts?.to || fallbackTo;
      const res = await api.get(`/room-types/${id}/calendar`, { params: { from, to } });
      setAvailabilityCalendar(res.data?.data?.calendar || []);
      setShowAvailability(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load availability calendar');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const validateBookingForm = () => {
    if (!isAuthenticated) { toast.error('Please login to book'); navigate('/login'); return false; }
    if (!checkIn || !checkOut) { toast.error('Please select check-in and check-out dates'); return false; }
    if (checkIn < todayKey) { toast.error('Check-in date cannot be in the past'); return false; }
    if (checkOut <= checkIn) { toast.error('Check-out must be after check-in'); return false; }
    if (!customerFullName.trim() || !customerMobile.trim() || !customerEmail.trim()) { toast.error('Please fill your name, mobile and email'); return false; }
    if (canShowRoomPrices && !effectivePaymentOption) { toast.error('Please select a payment option'); return false; }
    if (roomQuantity < 1) { toast.error('Please select at least 1 room'); return false; }
    if (availableCount !== null && roomQuantity > availableCount) {
      toast.error(`Only ${availableCount} room(s) are available for selected dates`);
      return false;
    }
    if (mustAcceptPropertyTerms && !propertyTermsAccepted) {
      toast.error("Please confirm that you accept this property's rules and booking policies.");
      return false;
    }
    return true;
  };

  const buildBookingPayload = () => {
    return {
      hotelId: hotel?._id,
      roomTypeId: roomType?._id,
      checkIn,
      checkOut,
      roomQuantity,
      customerFullName,
      customerMobile,
      customerEmail,
      totalAdults,
      totalChildren,
      guestDetails: [],
      totalAmount: canShowRoomPrices ? total : 0,
      paymentMethod: 'online',
      paymentProvider: 'razorpay',
      paymentOption: effectivePaymentOption,
      propertyTermsAccepted,
      acceptedPropertyTermsVersion: propertyTerms.currentVersion,
      additionalInfo: 'Razorpay Checkout payment initiated.',
    };
  };

  const startRazorpayPayment = async () => {
    const ok = validateBookingForm();
    if (!ok) return;
    if (!showPrices && !isDharamshala) {
      toast.error('Prices are not published for this room. Please book by call or WhatsApp.');
      return;
    }
    if (!token) { toast.error('Please login to book'); navigate('/login'); return; }
    if (availableCount !== null && roomQuantity > availableCount) {
      setShowAvailability(true);
      void loadAvailabilityCalendar();
      toast.error('Selected room count is not available for these dates. Please reduce rooms or choose other dates.');
      return;
    }

    setIsStartingPayment(true);
    let pendingRazorpayBookingId = '';
    try {
      const bookingResult = await createRoomTypeBooking(buildBookingPayload());
      if (!bookingResult.success || !bookingResult.data?.id) {
        toast.error(bookingResult.error || 'Booking failed');
        setIsStartingPayment(false);
        return;
      }

      const pendingBooking = bookingResult.data;
      pendingRazorpayBookingId = pendingBooking.id;
      setBookingId(String(pendingBooking.bookingId));
      setIsWaitlistedBooking(Boolean(pendingBooking.isWaitlisted));

      if (isDharamshala) {
        setBooked(true);
        toast.success('Request submitted. The Dharamshala will confirm availability before payment.');
        setIsStartingPayment(false);
        return;
      }

      await loadRazorpayCheckout();

      const markRazorpayAttemptFailed = async (status: 'failed' | 'cancelled' | 'dismissed' | 'verification_failed', razorpayPaymentId?: string) => {
        try {
          await api.post('/payments/razorpay/fail', {
            bookingId: pendingBooking.id,
            razorpay_payment_id: razorpayPaymentId,
            status,
          }, withAuth(token));
        } catch {
          // Webhook may still settle the final payment state.
        }
      };

      const orderRes = await api.post('/payments/razorpay/orders', { bookingId: pendingBooking.id }, withAuth(token));
      const data = orderRes.data?.data || {};
      const order = data.order || {};
      const keyId = String(data.keyId || '');
      if (!window.Razorpay || !keyId || !order.id) throw new Error('Razorpay Checkout is not ready');

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Vrindavan Sarthi',
        description: `${hotel.name} - ${roomType.name}`,
        order_id: order.id,
        image: '/logo.png',
        prefill: {
          name: customerFullName,
          email: customerEmail,
          contact: customerMobile,
        },
        notes: {
          bookingId: pendingBooking.bookingId,
          roomType: roomType.name,
        },
        theme: {
          color: '#8a1f2d',
        },
        modal: {
          ondismiss: async () => {
            await markRazorpayAttemptFailed('dismissed');
            setIsStartingPayment(false);
            toast.message('Payment cancelled. Booking marked as failed.');
          },
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post('/payments/razorpay/verify', {
              bookingId: pendingBooking.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }, withAuth(token));
            const verified = verifyRes.data?.data || pendingBooking;
            if (verified.bookingId) setBookingId(String(verified.bookingId));
            setBooked(true);
            toast.success(pendingBooking.isWaitlisted ? 'Payment verified. You are on the waitlist.' : 'Payment verified. Booking confirmed!');
          } catch (err: any) {
            await markRazorpayAttemptFailed('verification_failed', response?.razorpay_payment_id);
            toast.error(err?.response?.data?.message || 'Payment verification failed');
          } finally {
            setIsStartingPayment(false);
          }
        },
      });
      (rzp as any).on?.('payment.failed', async (response: any) => {
        await markRazorpayAttemptFailed('failed', response?.error?.metadata?.payment_id);
        setIsStartingPayment(false);
        toast.error(response?.error?.description || 'Razorpay payment failed');
      });
      rzp.open();
    } catch (err: any) {
      if (pendingRazorpayBookingId) {
        try {
          await api.post('/payments/razorpay/fail', {
            bookingId: pendingRazorpayBookingId,
            status: 'failed',
          }, withAuth(token));
        } catch {
          // Keep the original startup error visible to the customer.
        }
      }
      toast.error(err?.response?.data?.message || err?.message || 'Unable to start Razorpay payment');
      setIsStartingPayment(false);
    }
  };

  const images = Array.isArray(roomType.images) && roomType.images.length ? roomType.images : [hotel.image, ...(hotel.images || [])].filter(Boolean);
  const roomDescription = truncate(roomType.description || `${roomType.name} at ${hotel.name}, ${hotel.location || 'Braj'}, with verified booking support from Vrindavan Sarthi.`);
  const roomJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    '@id': `${absoluteUrl(`/room-types/${roomType._id}`)}#room`,
    name: roomType.name,
    description: roomDescription,
    url: absoluteUrl(`/room-types/${roomType._id}`),
    image: images.map(absoluteAssetUrl).filter(Boolean),
    containedInPlace: {
      '@type': 'LodgingBusiness',
      name: hotel.name,
      url: absoluteUrl(`/hotels/${hotel._id}`),
      address: {
        '@type': 'PostalAddress',
        streetAddress: hotel.location || hotel.nearestTemple || 'Braj',
        addressLocality: hotel.location || 'Braj',
        addressRegion: 'Uttar Pradesh',
        addressCountry: 'IN',
      },
    },
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: maxAdults + maxChildren,
    },
    amenityFeature: (roomType.amenities || []).map((amenity: string) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/room-types/${roomType._id}`),
      priceCurrency: 'INR',
      price: Number(roomType.pricePerNight || 0),
      availability: isFullyBookedSelectedDates ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  };

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputCls = "premium-field w-full px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

  return (
    <div className="braj-page min-h-screen pt-4 pb-8">
      <SEO
        title={`${roomType.name} at ${hotel.name}`}
        description={roomDescription}
        image={images[0]}
        canonicalPath={`/room-types/${roomType._id}`}
        jsonLd={roomJsonLd}
      />
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-0 mb-4 transition-colors"
        >
          <span className="premium-icon-button inline-flex h-7 w-7 items-center justify-center">
            <ArrowLeft size={14} />
          </span>
          Back to Hotels
        </button>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ── Left / Main ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Image carousel */}
            <div className="overflow-hidden rounded-lg shadow-sm">
              <ImageCarousel
                images={images}
                alt={roomType.name}
                heightClass="aspect-[4/3] h-auto min-h-[220px] max-h-[330px] sm:aspect-[16/10] sm:min-h-[260px] md:max-h-[350px] lg:aspect-[16/9]"
              />
            </div>

            {/* Room info card */}
            <div className="premium-surface space-y-5 p-4 sm:p-6">
              {/* Title row */}
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground leading-tight">{roomType.name}</h1>

                {/* Location + badges */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin size={14} className="text-brand-crimson" />
                    {hotel.location}
                  </span>

                  {/* Rating */}
                  {hotel.rating && (
                    <span className="flex items-center gap-1 text-sm text-foreground font-medium">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} size={13} fill={s <= Math.round(hotel.rating) ? '#FBBF24' : 'none'} stroke={s <= Math.round(hotel.rating) ? '#FBBF24' : '#D1D5DB'} />
                      ))}
                      <span className="ml-1">{hotel.rating}</span>
                    </span>
                  )}

                  {/* Verified badge */}
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700 text-xs font-medium">
                    <Shield size={11} /> Verified Listing
                  </span>

                  {/* Landmark badge */}
                  {hotel.nearestLandmark && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-700 text-xs font-medium">
                      <Landmark size={11} /> {hotel.nearestLandmark}
                    </span>
                  )}
                </div>

                {roomType.description && (
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">{roomType.description}</p>
                )}
              </div>

              {/* Check-in/out times */}
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-green-600" />
                  Check-in {hotel.checkInTime || '12:00'}
                </span>
                  <span className="text-border">-</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-brand-crimson" />
                  Check-out {hotel.checkOutTime || '11:00'}
                </span>
              </div>

              {/* Amenities */}
              {Array.isArray(roomType.amenities) && roomType.amenities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {roomType.amenities.map((a: string) => (
                      <span
                        key={a}
                        className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Capacity', value: `Adults ${maxAdults} · Children ${maxChildren}` },
                  { label: 'Inventory', value: totalCount !== null ? `${totalCount} rooms` : '-' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-700">{item.icon}{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Uploader */}
              {uploader && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs text-gray-400 mb-1">Uploaded by</p>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <UserIcon size={14} /> {uploader.displayName || 'Verified partner'}
                  </p>
                  {uploader.bio && <p className="text-xs text-gray-500 mt-1">{uploader.bio}</p>}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="premium-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <BedDouble size={18} className="text-brand-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">Room Count Rule</h2>
                </div>
                <p className="text-sm leading-6 text-gray-500">
                  This room type has {totalCount || maxRoomQuantity} room(s) listed by the property. A family booking can select multiple rooms in one booking, but never more than the listed or available inventory.
                </p>
              </div>
              <div className="premium-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Shield size={18} className="text-brand-green" />
                  <h2 className="font-display text-xl font-bold text-foreground">After Booking</h2>
                </div>
                <p className="text-sm leading-6 text-gray-500">
                  Your booking confirmation is shown to you after payment verification. Exact room numbers remain visible only to the admin and the respective property partner.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right / Booking sidebar ───────────────────────────────────── */}
          <div className="lg:col-span-1">
            {booked ? (
            <div className="premium-surface p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Shield size={22} className="text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{isDharamshala ? 'Request Submitted' : 'Booking Successful'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isDharamshala
                    ? 'Your booking request has been sent to the Dharamshala for confirmation.'
                    : isWaitlistedBooking ? 'Payment verified. You are on the waitlist.' : 'Your payment is verified and room booking is confirmed.'}
                </p>
                {bookingId && <p className="text-xs text-gray-400 mt-2">Booking ID: <span className="text-gray-700 font-medium">{bookingId}</span></p>}
                <Link to="/bookings" className="btn-crimson inline-block mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold">
                  View My Bookings
                </Link>
              </div>
            ) : (
              <div className="premium-surface space-y-4 p-4 sm:p-5 lg:sticky lg:top-24">
                <SimpleBookingPanel service={isDharamshala ? 'dharamshala' : 'stay'} />

                {/* Price */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Price</p>
                  {canShowRoomPrices ? (
                    <>
                      <p className="text-3xl font-bold text-brand-crimson">
                        Rs. {Number(roomType.pricePerNight || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-400">per night</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-brand-crimson">{isDharamshala ? 'Contribution on request' : 'Price on request'}</p>
                      <p className="text-xs text-gray-400">{isDharamshala ? 'Dharamshala will confirm amount and availability' : 'Confirm current price by call or WhatsApp'}</p>
                    </>
                  )}
                </div>

                <hr className="border-gray-100" />

                {/* Date pickers */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-in</label>
                    <input type="date" min={todayKey} value={checkIn} onChange={(e) => handleCheckInDateChange(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-out</label>
                    <input type="date" min={checkOutMinKey} value={checkOut} onChange={(e) => handleCheckOutDateChange(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Availability strip */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <button
                    type="button"
                    onClick={() => void loadAvailabilityCalendar()}
                    disabled={availabilityLoading}
                    className="mt-1.5 text-xs font-medium text-brand-crimson hover:underline disabled:opacity-50"
                  >
                    {availabilityLoading ? 'Loading calendar...' : 'Refresh availability calendar'}
                  </button>

                  {showAvailability && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <p className="text-[11px] text-gray-500">Tap dates to select check-in / check-out.</p>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-gray-400">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" /> Available</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Low</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Full</span>
                        </div>
                      </div>
                      <Calendar
                        mode="range"
                        selected={selectedRange}
                        onSelect={(range) => {
                          setSelectedRange(range);
                          const from = range?.from ? format(range.from, 'yyyy-MM-dd') : '';
                          const to = range?.to ? format(range.to, 'yyyy-MM-dd') : '';
                          if (from && from < todayKey) return;
                          setCheckIn(from);
                          setCheckOut(from && to && to > from ? to : '');
                        }}
                        numberOfMonths={1}
                        fromDate={todayUtc}
                        disabled={(date) => date < todayUtc}
                        modifiers={{
                          fullyBooked: (date) => {
                            const key = format(date, 'yyyy-MM-dd');
                            const item = availabilityByDate.get(key);
                            return typeof item?.availableCount === 'number' && item.availableCount <= 0;
                          },
                          lowAvailability: (date) => {
                            const key = format(date, 'yyyy-MM-dd');
                            const item = availabilityByDate.get(key);
                            return typeof item?.availableCount === 'number' && item.availableCount > 0 && item.availableCount <= 2;
                          },
                          available: (date) => {
                            const key = format(date, 'yyyy-MM-dd');
                            const item = availabilityByDate.get(key);
                            return typeof item?.availableCount === 'number' && item.availableCount > 2;
                          },
                        }}
                        modifiersClassNames={{
                          fullyBooked: 'bg-red-50 text-red-600 hover:bg-red-100',
                          lowAvailability: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                          available: 'bg-green-50 text-green-700 hover:bg-green-100',
                        }}
                        components={{
                          DayContent: (props) => {
                            const key = format(props.date, 'yyyy-MM-dd');
                            const item = availabilityByDate.get(key);
                            const count = item ? item.availableCount : null;
                            return (
                              <div className="flex flex-col items-center justify-center leading-none">
                                <div>{props.date.getDate()}</div>
                                {typeof count === 'number' && (
                                  <div className="mt-0.5 text-[9px] text-gray-400">{count}</div>
                                )}
                              </div>
                            );
                          },
                        }}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Rooms */}
                <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rooms</p>
                    </div>
                    <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setRoomQuantity((prev) => Math.max(1, prev - 1))}
                        disabled={roomQuantity <= 1}
                        className="grid h-10 w-10 place-items-center text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Decrease rooms"
                      >
                        <Minus size={14} />
                      </button>
                      <div className="grid h-10 min-w-12 place-items-center border-x border-gray-200 bg-white px-3 text-sm font-bold text-gray-900">
                        {roomQuantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRoomQuantity((prev) => Math.min(maxRoomQuantity, prev + 1))}
                        disabled={roomQuantity >= maxRoomQuantity}
                        className="grid h-10 w-10 place-items-center text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Increase rooms"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 px-3 py-2 text-gray-500">
                      Capacity
                      <span className="block font-semibold text-gray-800">{maxAdultsForSelection} adults · {maxChildrenForSelection} children</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
                      Price
                      <span className="block font-semibold">{canShowRoomPrices ? `Rs. ${baseTotal.toLocaleString('en-IN')}` : 'On request'}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    You can select up to {maxRoomQuantity} room(s) for this room type.
                  </p>
                  {isRequestedQuantityUnavailable && (
                    <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
                      Only {availableCount} room(s) are available for these dates. Reduce rooms or choose another date.
                    </p>
                  )}
                </div>

                {/* Your Details */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Details</p>
                  <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)} placeholder="Full Name" className={inputCls} />
                  <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Mobile Number" className={inputCls} />
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className={inputCls} />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Adults</label>
                      <input type="number" min={1} max={maxAdultsForSelection} value={totalAdults}
                        onChange={(e) => setTotalAdults(Math.min(maxAdultsForSelection, Math.max(1, Number(e.target.value || 1))))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Children</label>
                      <input type="number" min={0} max={maxChildrenForSelection} value={totalChildren}
                        onChange={(e) => setTotalChildren(Math.min(maxChildrenForSelection, Math.max(0, Number(e.target.value || 0))))}
                        className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Price breakdown */}
                {canShowRoomPrices && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Rs. {Number(roomType.pricePerNight || 0).toLocaleString('en-IN')} x {nights} night(s) x {roomQuantity} room(s)</span>
                    <span className="text-gray-700">Rs. {baseTotal.toLocaleString('en-IN')}</span>
                  </div>
                  {taxEnabled && (
                    <div className="flex justify-between text-gray-500">
                      <span>Hotel Taxes</span>
                      <span className="text-gray-700">Rs. {taxTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>{isDharamshala ? 'Platform fee after acceptance' : 'Platform convenience fee'}</span>
                    <span className="text-gray-700">Rs. {convenienceFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-1">
                    <span className="text-gray-800">{isDharamshala ? 'Estimated total' : 'Total'}</span>
                    <span className="text-brand-crimson">Rs. {total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                )}


                {/* Payment options */}
                {canShowRoomPrices && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{isDharamshala ? 'Request Flow' : 'Payment Option'}</p>

                  {!isDharamshala && (
                  <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: paymentOption === 'advance_30' ? 'hsl(var(--brand-crimson))' : 'hsl(var(--border))' }}>
                    <input type="radio" name="roomPaymentOption" checked={paymentOption === 'advance_30'} onChange={() => setPaymentOption('advance_30')} className="mt-1 accent-[hsl(var(--brand-crimson))]" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-800">30% Advance Online</span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        Pay Rs. {Math.round(total * 0.3).toLocaleString('en-IN')} now · Balance Rs. {Math.max(0, total - Math.round(total * 0.3)).toLocaleString('en-IN')} at property.
                      </span>
                      <span className="inline-block mt-1.5 rounded-md bg-red-50 border border-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        30% advance is strictly non-refundable
                      </span>
                    </span>
                  </label>
                  )}

                  {isDharamshala ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-sm">
                      <p className="font-semibold text-gray-800">Submit request first</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        The Dharamshala or admin will confirm availability first. Lister contact details are shown only after successful booking confirmation.
                      </p>
                    </div>
                  ) : (
                  <label className={`flex items-start gap-3 rounded-xl border p-3 ${isDharamshala ? 'cursor-default bg-amber-50/60' : 'cursor-pointer hover:bg-gray-50'} transition-colors`}
                    style={{ borderColor: effectivePaymentOption === 'full_100' ? 'hsl(var(--brand-crimson))' : 'hsl(var(--border))' }}>
                    <input type="radio" name="roomPaymentOption" checked={effectivePaymentOption === 'full_100'} onChange={() => setPaymentOption('full_100')} disabled={isDharamshala} className="mt-1 accent-[hsl(var(--brand-crimson))] disabled:opacity-80" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-800">Full Online Payment</span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        Pay Rs. {total.toLocaleString('en-IN')} now with no balance at property.
                      </span>
                      {isDharamshala && (
                        <span className="mt-1.5 inline-block rounded-md border border-amber-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Dharamshala charges are not refundable.
                        </span>
                      )}
                    </span>
                  </label>
                  )}

                  {effectivePaymentOption && !isDharamshala && (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 flex justify-between text-sm">
                      <span className="text-gray-500">Payable now</span>
                      <span className="font-bold text-brand-crimson">Rs. {payableNow.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {effectivePaymentOption === 'advance_30' && (
                    <div className="flex justify-between text-xs text-gray-400 px-1">
                      <span>Balance at property</span>
                      <span>Rs. {balanceLater.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
                )}

                {mustAcceptPropertyTerms && (
                  <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3">
                    <label className="flex items-start gap-2 rounded-lg border border-border bg-white px-3 py-2 font-body text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={propertyTermsAccepted}
                        onChange={(e) => setPropertyTermsAccepted(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        I confirm that I have read and accepted this property's rules and booking policies shown on the hotel page.
                      </span>
                    </label>
                  </div>
                )}

                {/* CTA */}
                {isDharamshala ? (
                  <button
                    onClick={startRazorpayPayment}
                    disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                    className="btn-gold w-full rounded-lg py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStartingPayment ? 'Submitting request...' : 'Submit Booking Request'}
                  </button>
                ) : !showPrices ? (
                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href={`https://wa.me/${supportDigits}?text=${encodeURIComponent(whatsappMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-gold inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold tracking-wide"
                    >
                      <MessageCircle size={16} /> WhatsApp Booking
                    </a>
                    <a
                      href={`tel:${supportDigits}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 hover:border-brand-gold/50"
                    >
                      <Phone size={16} /> Call Booking
                    </a>
                  </div>
                ) : !isFullyBookedSelectedDates ? (
                  <button
                    onClick={startRazorpayPayment}
                    disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                    className="btn-gold w-full rounded-lg py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStartingPayment ? 'Opening secure checkout...' : 'Continue to Secure Booking'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => { setShowAvailability(true); void loadAvailabilityCalendar(); }}
                      className="w-full py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View availability &amp; change dates
                    </button>
                    <button
                      onClick={startRazorpayPayment}
                      disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                      className="btn-gold w-full rounded-lg py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isStartingPayment ? 'Opening secure checkout...' : 'Join Waitlist'}
                    </button>
                  </div>
                )}

                {!isDharamshala && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">Need help before booking?</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <a
                        href={`https://wa.me/${supportDigits}?text=${encodeURIComponent(whatsappMessage)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:border-brand-gold/50"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                      <a
                        href={`tel:${supportDigits}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:border-brand-gold/50"
                      >
                        <Phone size={14} /> Call
                      </a>
                    </div>
                  </div>
                )}

                <p className="text-center text-[11px] text-gray-400">
                  {canShowRoomPrices ? (isDharamshala ? 'Contact details appear in My Bookings after successful confirmation.' : 'Secure payment with automatic booking confirmation.') : 'Prices and availability are confirmed by our booking desk.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomTypeDetail;


