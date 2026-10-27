import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Shield, ShieldCheck, Clock, User as UserIcon, Star, Landmark, BedDouble, Minus, Plus, MessageCircle, Phone, CalendarDays, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import ImageCarousel from '@/components/shared/ImageCarousel';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';
import { useSettingsStore } from '@/store/settingsStore';
import SEO from '@/components/SEO';
import { absoluteAssetUrl, absoluteUrl, truncate } from '@/lib/seo';
import { hasPropertyTermsText, normalizePropertyTerms } from '@/components/shared/PropertyTerms';
import { isDharamshalaType } from '@/lib/propertyTypes';
import { BookingCountdownTimer } from '@/components/BookingCountdownTimer';
import { filterSafeGallery } from '@/lib/imageSanitizer';

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

const loadRazorpayCheckout = (timeoutMs = 10000) =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    let timeoutId: ReturnType<typeof setTimeout>;
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      if (window.Razorpay) return resolve();
      const onExistingLoad = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      const onExistingError = () => {
        clearTimeout(timeoutId);
        reject(new Error('Razorpay Checkout failed to load'));
      };
      existing.addEventListener('load', onExistingLoad, { once: true });
      existing.addEventListener('error', onExistingError, { once: true });
      timeoutId = setTimeout(() => {
        existing.removeEventListener('load', onExistingLoad);
        existing.removeEventListener('error', onExistingError);
        if (window.Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay Checkout timed out while loading'));
        }
      }, timeoutMs);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    timeoutId = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error('Razorpay Checkout timed out while loading'));
      }
    }, timeoutMs);
    script.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Razorpay Checkout failed to load'));
    };
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

const RoomTypeDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, token } = useAuthStore();
  const { createRoomTypeBooking } = useBookingStore();
  const defaultHotelTaxPercent = useSettingsStore((s) => s.settings.hotelTaxPercent);
  const supportPhone = useSettingsStore((s) => s.settings.adminPhone);

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const [checkIn, setCheckIn] = useState(() => qs.get('checkIn') || todayKey);
  const [checkOut, setCheckOut] = useState(() => {
    const from = qs.get('checkIn') || todayKey;
    return qs.get('checkOut') || getNextDateKey(from);
  });

  const [data, setData] = useState<any | null>(() => getPrefetchedDetail('roomTypes', id) || getCachedListingItem('roomTypes', id) || null);
  const [selectedRoomAvailability, setSelectedRoomAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(() => !(getPrefetchedDetail('roomTypes', id) || getCachedListingItem('roomTypes', id)));
  const reqSeq = useRef(0);
  const roomAvailabilityReqSeq = useRef(0);

  const [customerFullName, setCustomerFullName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerOrigin, setCustomerOrigin] = useState('');
  const [totalAdults, setTotalAdults] = useState(1);
  const [totalChildren, setTotalChildren] = useState(0);
  const [roomQuantity, setRoomQuantity] = useState(1);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'advance_30' | 'full_100' | ''>('');
  const [propertyTermsAccepted, setPropertyTermsAccepted] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [guestCredentialMessage, setGuestCredentialMessage] = useState('');
  const [isWaitlistedBooking, setIsWaitlistedBooking] = useState(false);
  const [isRequestSubmitted, setIsRequestSubmitted] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<any>(null);
  const [booked, setBooked] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityCalendar, setAvailabilityCalendar] = useState<any[] | null>(null);
  const mainColumnRef = useRef<HTMLDivElement | null>(null);
  const [bookingPanelHeight, setBookingPanelHeight] = useState<number | null>(null);

  useEffect(() => {
    setCustomerFullName(user?.name || '');
    setCustomerMobile(user?.phone || '');
    setCustomerEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    const el = mainColumnRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateHeight = () => setBookingPanelHeight(Math.ceil(el.getBoundingClientRect().height));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [data]);

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
  const canShowRoomPrices = showPrices && !isDharamshala && roomHasPublishedPrice;
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

  const checkOutMinKey = useMemo(() => (checkIn ? getNextDateKey(checkIn) : todayKey), [checkIn, todayKey]);

  const handleCheckInDateChange = (value: string) => {
    if (value && value < todayKey) {
      toast.error('Check-in date cannot be in the past');
      return;
    }
    setCheckIn(value);
    if (!value) {
      setCheckOut('');
      return;
    }
    if (!checkOut || checkOut <= value) setCheckOut(getNextDateKey(value));
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
  };

  if (loading && !roomType) {
    return (
      <div className="min-h-screen bg-[#fdfcf9] pt-20 sm:pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 animate-pulse space-y-6">
          <div className="h-6 w-32 rounded-lg bg-neutral-200" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-8">
            <div className="space-y-4">
              <div className="aspect-[16/10] w-full rounded-2xl bg-neutral-200" />
              <div className="h-8 w-2/3 rounded-lg bg-neutral-200" />
              <div className="h-4 w-1/2 rounded-lg bg-neutral-200" />
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
              <div className="h-6 w-1/3 rounded-lg bg-neutral-200" />
              <div className="h-10 w-full rounded-xl bg-neutral-200" />
              <div className="h-10 w-full rounded-xl bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!roomType || !hotel) {
    return (
      <div className="min-h-screen bg-[#fdfcf9] pt-24 pb-16 flex items-center justify-center px-4">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 text-center max-w-md mx-auto shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-4">
            <BedDouble size={28} />
          </div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Room Type Not Found</h2>
          <p className="font-body text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            This room configuration is either no longer available or was updated. Explore other verified stays across Vrindavan and Braj.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/rooms" className="btn-emerald rounded-full px-6 py-2.5 text-xs font-bold shadow-sm">
              Explore All Rooms
            </Link>
            <Link to="/hotels" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors">
              View Stays
            </Link>
          </div>
        </div>
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
  const dharamshalaServiceFee = hotel?.dharamshalaPlatformFeeEnabled === false ? 0 : Math.max(0, Math.round(Number(hotel?.dharamshalaServiceFee ?? 79)));
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
  const checkInAvailability = checkIn ? availabilityByDate.get(checkIn) : undefined;
  const checkOutAvailability = checkOut ? availabilityByDate.get(checkOut) : undefined;
  const visibleCalendarDays = availabilityCalendar || [];
  const lowAvailabilityDays = visibleCalendarDays.filter((day) => Number(day?.availableCount || 0) > 0 && Number(day?.availableCount || 0) <= 2).length;
  const fullyBookedDays = visibleCalendarDays.filter((day) => Number(day?.availableCount || 0) <= 0).length;
  const nextOpenDay = visibleCalendarDays.find((day) => Number(day?.availableCount || 0) > 0)?.date;
  const inventoryPulse = availableCount !== null
    ? availableCount <= 0
      ? { label: 'Sold out for selected dates', tone: 'border-red-100 bg-red-50 text-red-700', bar: 'bg-red-500', width: '100%' }
      : availableCount <= 2
        ? { label: `Only ${availableCount} room(s) left`, tone: 'border-amber-100 bg-amber-50 text-amber-800', bar: 'bg-amber-500', width: '42%' }
        : { label: `${availableCount} room(s) available`, tone: 'border-emerald-100 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', width: '78%' }
    : { label: availabilityLoading ? 'Checking live inventory' : 'Select dates for live inventory', tone: 'border-gray-100 bg-gray-50 text-gray-600', bar: 'bg-gray-300', width: '28%' };
  const formatStayDate = (value: string) => value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'Select';

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
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load availability calendar');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const getPrimaryButtonText = () => {
    if (isStartingPayment) {
      return isDharamshala ? 'Submitting request...' : 'Opening payment gateway...';
    }
    if (isDharamshala) {
      return 'Submit Free Room Request';
    }
    if (!canShowRoomPrices) {
      return 'Request Booking';
    }
    if (effectivePaymentOption === 'advance_30') {
      return `Pay Rs. ${payableNow.toLocaleString('en-IN')} Advance & Confirm`;
    }
    if (effectivePaymentOption === 'full_100') {
      return `Pay Rs. ${payableNow.toLocaleString('en-IN')} Full & Confirm`;
    }
    return 'Select Payment Option';
  };

  const validateBookingForm = () => {
    if (!checkIn || !checkOut) { toast.error('Please select check-in and check-out dates'); return false; }
    if (checkIn < todayKey) { toast.error('Check-in date cannot be in the past'); return false; }
    if (checkOut <= checkIn) { toast.error('Check-out must be after check-in'); return false; }
    if (!customerFullName.trim() || !customerMobile.trim() || !customerEmail.trim() || !customerOrigin.trim()) {
      toast.error('Please fill your name, mobile, email, and city of origin');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) { toast.error('Please enter a valid email address'); return false; }
    const mobileDigits = customerMobile.replace(/\D/g, '');
    if (mobileDigits.length < 7 || mobileDigits.length > 15) { toast.error('Please enter a valid mobile number'); return false; }
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
      customerOrigin,
      totalAdults,
      totalChildren,
      guestDetails: [],
      totalAmount: canShowRoomPrices ? total : 0,
      paymentMethod: 'online',
      paymentProvider: 'razorpay',
      paymentOption: effectivePaymentOption,
      propertyTermsAccepted,
      acceptedPropertyTermsVersion: propertyTerms.currentVersion,
    };
  };

  const startRazorpayPayment = async () => {
    const ok = validateBookingForm();
    if (!ok) return;
    if (!showPrices && !isDharamshala) {
      toast.error('Prices are not published for this room. Please book by call or WhatsApp.');
      return;
    }
    if (availableCount !== null && roomQuantity > availableCount) {
      void loadAvailabilityCalendar();
      toast.error('Selected room count is not available for these dates. Please reduce rooms or choose other dates.');
      return;
    }

    setIsStartingPayment(true);
    let pendingRazorpayBookingId = '';
    let pendingGuestAccessToken = '';
    try {
      const bookingResult = await createRoomTypeBooking(buildBookingPayload());
      if (!bookingResult.success || !bookingResult.data?.id) {
        toast.error(bookingResult.error || 'Booking failed');
        setIsStartingPayment(false);
        return;
      }

      const pendingBooking = bookingResult.data;
      const guestAccessToken = pendingBooking.guestAccessToken || '';
      const guestAccountMessage = pendingBooking.guestAccount?.message || '';
      pendingGuestAccessToken = guestAccessToken;
      pendingRazorpayBookingId = pendingBooking.id;
      setBookingId(String(pendingBooking.bookingId));
      setGuestCredentialMessage(guestAccountMessage);
      setIsWaitlistedBooking(Boolean(pendingBooking.isWaitlisted));

      if (pendingBooking.bookingStatus === 'pending_property_confirmation') {
        setSubmittedBooking(pendingBooking);
        setIsRequestSubmitted(true);
        setBooked(true);
        if (guestAccountMessage) toast.info(guestAccountMessage);
        toast.success(isDharamshala ? 'Request submitted. The Dharamshala will confirm availability before payment.' : 'Request submitted. The property will confirm availability before payment.');
        setIsStartingPayment(false);
        return;
      }

      await loadRazorpayCheckout();

      const markRazorpayAttemptFailed = async (status: 'failed' | 'cancelled' | 'dismissed' | 'verification_failed', razorpayPaymentId?: string) => {
        try {
          await api.post('/payments/razorpay/fail', {
            bookingId: pendingBooking.id,
            guestAccessToken,
            razorpay_payment_id: razorpayPaymentId,
            status,
          }, token ? withAuth(token) : undefined);
        } catch {
          // Webhook may still settle the final payment state.
        }
      };

      const orderRes = await api.post('/payments/razorpay/orders', { bookingId: pendingBooking.id, guestAccessToken }, token ? withAuth(token) : undefined);
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
          contact: String(customerMobile || '').replace(/\D/g, '') || String(supportDigits || '').replace(/\D/g, ''),
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
              guestAccessToken,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }, token ? withAuth(token) : undefined);
            const verified = verifyRes.data?.data || pendingBooking;
            const confirmedBookingId = verified.id || verified._id || pendingBooking.id;
            if (verified.bookingId) setBookingId(String(verified.bookingId));
            setBooked(true);
            if (guestAccountMessage) toast.info(guestAccountMessage);
            toast.success(pendingBooking.isWaitlisted ? 'Payment verified. You are on the waitlist.' : 'Payment verified. Booking confirmed!');
            if (confirmedBookingId) { const target = token ? `/bookings/${confirmedBookingId}/confirmed` : `/bookings/${confirmedBookingId}/confirmed?token=${encodeURIComponent(guestAccessToken)}`; navigate(target, { replace: true }); }
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
            guestAccessToken: pendingGuestAccessToken,
            status: 'failed',
          }, token ? withAuth(token) : undefined);
        } catch {
          // Keep the original startup error visible to the customer.
        }
      }
      toast.error(err?.response?.data?.message || err?.message || 'Unable to start Razorpay payment');
      setIsStartingPayment(false);
    }
  };

  const rawImages = Array.isArray(roomType.images) && roomType.images.length ? roomType.images : [hotel.image, ...(hotel.images || [])].filter(Boolean);
  const images = filterSafeGallery(rawImages);
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
    offers: isDharamshala ? undefined : {
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
    <div className="braj-page min-h-screen pt-4 pb-24 lg:pb-8">
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

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* ── Left / Main ──────────────────────────────────────────────── */}
          <div ref={mainColumnRef} className="min-w-0 space-y-5">

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
          </div>

          {/* ── Right / Booking sidebar ───────────────────────────────────── */}
          <div className="min-w-0 lg:flex lg:h-full">
            {booked ? (
              <div className="premium-surface p-5 sm:p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-brand-green/12 text-brand-green flex items-center justify-center mx-auto">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-xl font-heading font-bold text-foreground">
                    {isRequestSubmitted ? 'Request Submitted' : 'Booking Successful'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                    {isRequestSubmitted
                      ? (isDharamshala
                        ? 'Your booking request has been sent to the Dharamshala for confirmation.'
                        : 'Your booking request has been sent to the property for confirmation. You can pay after it is accepted.')
                      : isWaitlistedBooking
                      ? 'Payment verified. You are on the waitlist.'
                      : 'Your payment is verified and room booking is confirmed.'}
                  </p>
                </div>

                {isRequestSubmitted && submittedBooking?.requestExpiresAt && (
                  <div className="text-left">
                    <BookingCountdownTimer
                      timerType="request_approval"
                      expiresAt={submittedBooking.requestExpiresAt}
                      totalMinutes={5}
                      label="Property Response Window"
                    />
                  </div>
                )}

                {bookingId && (
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-xs">
                    <span className="text-muted-foreground">Booking ID: </span>
                    <span className="font-mono font-bold text-foreground">{bookingId}</span>
                  </div>
                )}

                {guestCredentialMessage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">
                    <p className="font-bold">Guest reservation confirmed</p>
                    <p>{guestCredentialMessage}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Link
                    to={submittedBooking?.id ? `/bookings/${submittedBooking.id}${submittedBooking.guestAccessToken ? `?token=${encodeURIComponent(submittedBooking.guestAccessToken)}` : ''}` : '/bookings'}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-brand-crimson text-white font-body text-sm font-semibold hover:bg-brand-crimson/90 transition-colors text-center"
                  >
                    Track Booking Status
                  </Link>
                  <Link
                    to="/bookings"
                    className="py-2.5 px-4 rounded-xl border border-border bg-card text-foreground font-body text-sm font-medium hover:bg-secondary transition-colors text-center"
                  >
                    My Bookings
                  </Link>
                </div>
              </div>
            ) : (
              <div
                id="booking-form-section" className="premium-surface premium-sidebar-scroll space-y-4 p-4 sm:p-5 lg:h-[var(--booking-panel-height)] lg:max-h-[var(--booking-panel-height)] lg:w-full lg:overflow-y-auto"
                style={bookingPanelHeight ? ({ '--booking-panel-height': `${bookingPanelHeight}px` } as CSSProperties) : undefined}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{isDharamshala ? 'Request Room' : 'Book Room'}</p>
                      {canShowRoomPrices ? (
                        <p className="mt-1 text-3xl font-bold text-brand-crimson">
                          Rs. {Number(roomType.pricePerNight || 0).toLocaleString('en-IN')}
                          <span className="ml-1 text-xs font-medium text-gray-400">/ night</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-2xl font-bold text-brand-crimson">{isDharamshala ? 'Confirm first' : 'Price on request'}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadAvailabilityCalendar()}
                      disabled={availabilityLoading}
                      className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm disabled:opacity-50"
                    >
                      {availabilityLoading ? 'Checking' : 'Refresh'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-1.5 text-center text-[11px] font-bold text-gray-500">
                    {['Stay', 'Details', isDharamshala ? 'Request' : 'Pay'].map((step, index) => (
                      <div key={step} className="rounded-xl bg-white px-2 py-2 shadow-sm">
                        <span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-full bg-brand-gold/20 text-brand-crimson">{index + 1}</span>
                        {step}
                      </div>
                    ))}
                  </div>

                  <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gold/12 text-brand-crimson">
                          <CalendarDays size={17} />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">1. Stay</p>
                          <p className="text-sm font-bold text-gray-900">{formatStayDate(checkIn)} - {formatStayDate(checkOut)}</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${inventoryPulse.tone}`}>
                        {availableCount !== null && availableCount > 0 ? <CheckCircle2 size={12} className="mr-1 inline" /> : null}
                        {availableCount !== null ? inventoryPulse.label : 'Live check'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Check-in</span>
                        <input type="date" min={todayKey} value={checkIn} onChange={(e) => handleCheckInDateChange(e.target.value)} className="h-9 w-full bg-transparent text-sm font-bold text-gray-900 outline-none" />
                      </label>
                      <label className="block rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Check-out</span>
                        <input type="date" min={checkOutMinKey} value={checkOut} onChange={(e) => handleCheckOutDateChange(e.target.value)} className="h-9 w-full bg-transparent text-sm font-bold text-gray-900 outline-none" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-500">Rooms</span>
                          <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <button type="button" onClick={() => setRoomQuantity((prev) => Math.max(1, prev - 1))} disabled={roomQuantity <= 1} className="grid h-8 w-8 place-items-center text-gray-700 disabled:opacity-40" aria-label="Decrease rooms">
                              <Minus size={13} />
                            </button>
                            <div className="grid h-8 min-w-9 place-items-center border-x border-gray-200 px-2 text-sm font-bold">{roomQuantity}</div>
                            <button type="button" onClick={() => setRoomQuantity((prev) => Math.min(maxRoomQuantity, prev + 1))} disabled={roomQuantity >= maxRoomQuantity} className="grid h-8 w-8 place-items-center text-gray-700 disabled:opacity-40" aria-label="Increase rooms">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Adults</span>
                          <input type="number" min={1} max={maxAdultsForSelection} value={totalAdults} onChange={(e) => setTotalAdults(Math.min(maxAdultsForSelection, Math.max(1, Number(e.target.value || 1))))} className="h-8 w-full bg-transparent text-sm font-bold outline-none" />
                        </label>
                        <label className="block rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Children</span>
                          <input type="number" min={0} max={maxChildrenForSelection} value={totalChildren} onChange={(e) => setTotalChildren(Math.min(maxChildrenForSelection, Math.max(0, Number(e.target.value || 0))))} className="h-8 w-full bg-transparent text-sm font-bold outline-none" />
                        </label>
                      </div>
                    </div>

                    {isRequestedQuantityUnavailable && (
                      <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
                        Only {availableCount} room(s) are available for these dates.
                      </p>
                    )}
                  </section>

                  <section className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">2. Contact</p>
                      {!isAuthenticated && (
                        <Link to="/login" className="text-xs font-bold text-brand-crimson hover:underline">
                          Login
                        </Link>
                      )}
                    </div>
                    <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)} placeholder="Full Name" className={inputCls} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Mobile Number" className={inputCls} />
                      <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className={inputCls} />
                    </div>
                    <input value={customerOrigin} onChange={(e) => setCustomerOrigin(e.target.value)} placeholder="Origin / City of Departure (e.g. New Delhi, Jaipur, Mumbai)" className={inputCls} />
                    {!isAuthenticated && (
                      <p className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] leading-5 text-amber-800">
                        Booking as a guest. You will receive a secure direct link to track your reservation. Creating an account with a custom password is fully optional.
                      </p>
                    )}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">3. Review & Request</p>

                    {canShowRoomPrices && !isDharamshala && (
                      <div className="space-y-1.5 rounded-xl bg-gray-50 p-3 text-sm">
                        <div className="flex justify-between gap-3 text-gray-500">
                          <span>{nights} night(s) x {roomQuantity} room(s)</span>
                          <span className="text-gray-700">Rs. {baseTotal.toLocaleString('en-IN')}</span>
                        </div>
                        {taxEnabled && (
                          <div className="flex justify-between gap-3 text-gray-500">
                            <span>Taxes</span>
                            <span className="text-gray-700">Rs. {taxTotal.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3 text-gray-500">
                          <span>Platform fee</span>
                          <span className="text-gray-700">Rs. {convenienceFee.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-gray-200 pt-2 text-base font-bold">
                          <span>Total</span>
                          <span className="text-brand-crimson">Rs. {total.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}

                    {canShowRoomPrices && !isDharamshala && (
                      <div className="grid grid-cols-1 gap-2">
                        <button type="button" onClick={() => setPaymentOption('advance_30')} className={`rounded-xl border p-3 text-left text-sm transition-colors ${paymentOption === 'advance_30' ? 'border-brand-crimson bg-red-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                          <span className="block font-bold text-gray-900">Pay 30% now</span>
                          <span className="text-xs text-gray-500">Rs. {Math.round(total * 0.3).toLocaleString('en-IN')} now, balance at property.</span>
                        </button>
                        <button type="button" onClick={() => setPaymentOption('full_100')} className={`rounded-xl border p-3 text-left text-sm transition-colors ${paymentOption === 'full_100' ? 'border-brand-crimson bg-red-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                          <span className="block font-bold text-gray-900">Pay full amount</span>
                          <span className="text-xs text-gray-500">Rs. {total.toLocaleString('en-IN')} online, no balance later.</span>
                        </button>
                        {effectivePaymentOption && (
                          <div className="flex justify-between rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                            <span className="text-gray-600">Payable now</span>
                            <span className="font-bold text-brand-crimson">Rs. {payableNow.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {effectivePaymentOption === 'advance_30' && (
                          <div className="flex justify-between px-1 text-xs text-gray-400">
                            <span>Balance at property</span>
                            <span>Rs. {balanceLater.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isDharamshala && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-sm">
                        <p className="font-semibold text-gray-800">No online payment now</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">Your request goes to the Dharamshala first. Payment or contribution details come after acceptance.</p>
                      </div>
                    )}

                                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-950 font-medium">
                      <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
                      <span><strong>Cancellation Policy:</strong> Free cancellation & 100% refund available per property policy before check-in.</span>
                    </div>

                    {mustAcceptPropertyTerms && (
                      <label className="flex items-start gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/5 px-3 py-2 font-body text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={propertyTermsAccepted}
                          onChange={(e) => setPropertyTermsAccepted(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>I accept this property's rules and booking policies.</span>
                      </label>
                    )}

                    {!showPrices && !isDharamshala ? (
                      <div className="grid grid-cols-1 gap-2">
                        <a href={`https://wa.me/${supportDigits}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="btn-gold inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold tracking-wide">
                          <MessageCircle size={16} /> WhatsApp Booking
                        </a>
                        <a href={`tel:${supportDigits}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 hover:border-brand-gold/50">
                          <Phone size={16} /> Call Booking
                        </a>
                      </div>
                    ) : !isFullyBookedSelectedDates ? (
                      <button
                        onClick={startRazorpayPayment}
                        disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                        className="btn-emerald w-full rounded-xl py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                      >
                        {getPrimaryButtonText()}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button type="button" onClick={() => void loadAvailabilityCalendar()} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                          Recheck availability
                        </button>
                        <button onClick={startRazorpayPayment} disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable} className="btn-emerald w-full rounded-xl py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 shadow-sm">
                          {getPrimaryButtonText()}
                        </button>
                      </div>
                    )}

                    {!isDharamshala && (
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`https://wa.me/${supportDigits}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:border-brand-gold/50">
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                        <a href={`tel:${supportDigits}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:border-brand-gold/50">
                          <Phone size={14} /> Call
                        </a>
                      </div>
                    )}
                  </section>
                </div>

                
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sticky Booking Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">
              {canShowRoomPrices && !isDharamshala ? `Rs. ${total.toLocaleString('en-IN')}` : isDharamshala ? 'Free Request' : 'Price on request'}
              {canShowRoomPrices && !isDharamshala && <span className="text-[11px] font-normal text-slate-500 ml-1">({nights}N)</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('booking-form-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                startRazorpayPayment();
              }
            }}
            className="btn-emerald px-5 py-2.5 text-sm font-bold shadow-sm"
          >
            {booked ? 'Track Status' : isDharamshala ? 'Request Room' : 'Book Room'}
          </button>
        </div>

        <div className="mt-5 grid auto-rows-fr gap-4 md:grid-cols-2">
          <div className="premium-surface flex h-full flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <BedDouble size={18} className="text-brand-gold" />
              <h2 className="font-display text-xl font-bold text-foreground">Room Count Rule</h2>
            </div>
            <p className="text-sm leading-6 text-gray-500">
              This room type has {totalCount || maxRoomQuantity} room(s) listed by the property. A family booking can select multiple rooms in one booking, but never more than the listed or available inventory.
            </p>
          </div>
          <div className="premium-surface flex h-full flex-col p-5">
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
    </div>
  );
};

export default RoomTypeDetail;
