import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Shield, Clock, User as UserIcon, PawPrint } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import ImageCarousel from '@/components/shared/ImageCarousel';
import UpiPayment from '@/components/UpiPayment';

const RoomTypeDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { createRoomTypeBooking } = useBookingStore();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [checkIn, setCheckIn] = useState(() => qs.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(() => qs.get('checkOut') || '');

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Detailed booking form
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [arrivalMode, setArrivalMode] = useState<'personal_vehicle' | 'transport'>('transport');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [totalAdults, setTotalAdults] = useState(1);
  const [totalChildren, setTotalChildren] = useState(0);
  const [hasPet, setHasPet] = useState(false);
  const [adultDetails, setAdultDetails] = useState<Array<{ name: string; age: string; gender?: string }>>([{ name: '', age: '', gender: '' }]);
  const [childDetails, setChildDetails] = useState<Array<{ name: string; age: string; gender?: string }>>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    setCustomerFullName(user?.name || '');
    setCustomerMobile(user?.phone || '');
    setCustomerEmail(user?.email || '');
  }, [user]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const params: any = {};
      if (checkIn && checkOut) {
        params.checkIn = checkIn;
        params.checkOut = checkOut;
      }
      const res = await api.get(`/room-types/${id}`, { params });
      setData(res.data?.data || null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load room type');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut]);

  const roomType = data || null;
  const hotel = roomType?.hotel || null;
  const uploader = roomType?.uploader || null;

  const maxAdults = Math.max(1, Number(roomType?.maxAdults || 1));
  const maxChildren = Math.max(0, Number(roomType?.maxChildren || 0));

  useEffect(() => {
    setTotalAdults((prev) => Math.min(maxAdults, Math.max(1, prev)));
    setTotalChildren((prev) => Math.min(maxChildren, Math.max(0, prev)));
  }, [maxAdults, maxChildren]);

  useEffect(() => {
    setAdultDetails((prev) => {
      const next = [...prev];
      while (next.length < totalAdults) next.push({ name: '', age: '', gender: '' });
      return next.slice(0, totalAdults);
    });
    setChildDetails((prev) => {
      const next = [...prev];
      while (next.length < totalChildren) next.push({ name: '', age: '', gender: '' });
      return next.slice(0, totalChildren);
    });
  }, [totalAdults, totalChildren]);

  if (loading && !roomType) {
    return (
      <div className="pt-24 pb-16 text-center min-h-screen bg-background">
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!roomType || !hotel) {
    return (
      <div className="pt-24 pb-16 text-center min-h-screen bg-background">
        <p className="font-heading text-2xl text-muted-foreground">Room type not found</p>
        <Link to="/rooms" className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block">
          Back to Rooms
        </Link>
      </div>
    );
  }

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
  const total = Number(roomType.pricePerNight || 0) * nights;
  const availableCount = typeof roomType.availableCount === 'number' ? roomType.availableCount : null;
  const totalCount = typeof roomType.totalCount === 'number' ? roomType.totalCount : null;

  const canPet = Boolean(hotel.petsAllowed) && Boolean(roomType.petsAllowed);

  const handleInitiateBooking = () => {
    if (!isAuthenticated) {
      toast.error('Please login to book');
      navigate('/login');
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }
    if (availableCount !== null && availableCount <= 0) {
      toast.error('No rooms available for selected dates');
      return;
    }
    if (!customerFullName.trim() || !customerMobile.trim() || !customerEmail.trim()) {
      toast.error('Please fill your name, mobile and email');
      return;
    }
    const invalidAdult = adultDetails.some((a) => !a.name.trim() || !Number(a.age || 0));
    const invalidChild = childDetails.some((c) => !c.name.trim() || !Number(c.age || 0));
    if (invalidAdult || invalidChild) {
      toast.error('Please fill name and age for each guest');
      return;
    }
    if (hasPet && !canPet) {
      toast.error('Pets are not allowed for this room type');
      return;
    }
    const tempId = `VVS-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;
    setBookingId(tempId);
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (transactionId: string) => {
    const guestDetails = [
      ...adultDetails.map((a) => ({ type: 'adult', name: a.name, age: Number(a.age || 0), gender: a.gender || null })),
      ...childDetails.map((c) => ({ type: 'child', name: c.name, age: Number(c.age || 0), gender: c.gender || null })),
    ];

    const res = await createRoomTypeBooking({
      hotelId: hotel?._id,
      roomTypeId: roomType?._id,
      checkIn,
      checkOut,
      customerFullName,
      customerMobile,
      customerEmail,
      arrivalMode,
      vehicleNumber: arrivalMode === 'personal_vehicle' ? vehicleNumber : '',
      arrivalTime,
      totalAdults,
      totalChildren,
      hasPet,
      guestDetails,
      totalAmount: total,
      paymentMethod: 'online',
      upiTransactionId: transactionId,
      additionalInfo: `UPI Txn: ${transactionId}`,
    });

    if (!res.success) {
      toast.error(res.error || 'Booking failed');
      return;
    }

    setShowPayment(false);
    setBooked(true);
    toast.success('Booking confirmed! Payment verification pending.');
  };

  const images = Array.isArray(roomType.images) && roomType.images.length ? roomType.images : [hotel.image, ...(hotel.images || [])].filter(Boolean);

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl relative">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-6 mt-4 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ImageCarousel images={images} alt={roomType.name} />

            <div className="glass-panel rounded-2xl p-6 metallic-border space-y-4">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight">{roomType.name}</h1>
                <p className="font-body text-sm text-muted-foreground mt-2">{roomType.description || ''}</p>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                    <MapPin size={15} className="text-brand-crimson" />
                    {hotel.name} • {hotel.location}
                  </span>
                  <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                    <Shield size={15} className="text-brand-gold" />
                    Verified listing
                  </span>
                  <span className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                    <Clock size={15} className="text-brand-green" />
                    Check-in {hotel.checkInTime || '12:00'} • Check-out {hotel.checkOutTime || '11:00'}
                  </span>
                </div>
              </div>

              {(Array.isArray(roomType.amenities) && roomType.amenities.length) && (
                <div>
                  <p className="font-body text-sm font-semibold text-foreground mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {roomType.amenities.map((a: string) => (
                      <span key={a} className="glass-chip px-3 py-1 rounded-full font-body text-xs text-foreground">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="font-body text-xs text-muted-foreground">Capacity</p>
                  <p className="font-body text-sm text-foreground font-semibold">Adults {maxAdults} • Children {maxChildren}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="font-body text-xs text-muted-foreground">Inventory</p>
                  <p className="font-body text-sm text-foreground font-semibold">
                    {totalCount !== null ? `${totalCount} rooms` : '—'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="font-body text-xs text-muted-foreground">Pets</p>
                  <p className="font-body text-sm text-foreground font-semibold inline-flex items-center gap-2">
                    <PawPrint size={14} className="text-muted-foreground" />
                    {canPet ? 'Allowed' : 'Not allowed'}
                  </p>
                </div>
              </div>

              {uploader && (
                <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-4">
                  <p className="font-body text-xs text-muted-foreground">Uploaded by</p>
                  <p className="font-body text-sm text-foreground font-semibold inline-flex items-center gap-2">
                    <UserIcon size={14} /> {uploader.name || '—'}
                  </p>
                  {(uploader.phone || uploader.email) && (
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {uploader.phone ? `Phone: ${uploader.phone}` : ''}
                      {uploader.phone && uploader.email ? ' • ' : ''}
                      {uploader.email ? `Email: ${uploader.email}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Booking */}
          <div className="lg:col-span-1">
            {booked ? (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <p className="font-heading text-xl text-foreground font-semibold">Booking created</p>
                <p className="font-body text-sm text-muted-foreground mt-2">Verification pending.</p>
                <Link to="/bookings" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-block mt-4">
                  View My Bookings
                </Link>
              </div>
            ) : showPayment ? (
              <UpiPayment
                amount={total}
                bookingId={bookingId}
                itemName={`${hotel.name} • ${roomType.name}`}
                onPaymentConfirm={handlePaymentConfirm}
                onCancel={() => setShowPayment(false)}
              />
            ) : (
              <div className="glass-panel rounded-2xl p-6 metallic-border sticky top-24">
                <p className="font-body text-xs text-muted-foreground">Price</p>
                <p className="font-display text-3xl font-bold text-brand-crimson">₹{Number(roomType.pricePerNight || 0).toLocaleString('en-IN')}</p>
                <p className="font-body text-xs text-muted-foreground">per night</p>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Check-in</label>
                    <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Check-out</label>
                    <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  </div>
                </div>

                {checkIn && checkOut && (
                  <div className="mt-3 bg-muted/30 rounded-xl p-3">
                    <p className="font-body text-xs text-muted-foreground">
                      {availableCount !== null ? (availableCount > 0 ? `${availableCount} rooms left` : 'Fully booked') : 'Availability will show here'}
                    </p>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  <p className="font-body text-sm font-semibold text-foreground">Your Details</p>
                  <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Mobile Number" className="w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />

                  <div className="grid grid-cols-2 gap-2">
                    <select value={arrivalMode} onChange={(e) => setArrivalMode(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm">
                      <option value="transport">Transport</option>
                      <option value="personal_vehicle">Personal Vehicle</option>
                    </select>
                    <input value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} placeholder="Arrival Time" className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  </div>
                  {arrivalMode === 'personal_vehicle' && (
                    <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="Vehicle Number (optional)" className="w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-body text-xs text-muted-foreground">Adults</label>
                      <input type="number" min={1} max={maxAdults} value={totalAdults} onChange={(e) => setTotalAdults(Number(e.target.value || 1))} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                    </div>
                    <div>
                      <label className="font-body text-xs text-muted-foreground">Children</label>
                      <input type="number" min={0} max={maxChildren} value={totalChildren} onChange={(e) => setTotalChildren(Number(e.target.value || 0))} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input id="hasPet" type="checkbox" checked={hasPet} onChange={(e) => setHasPet(e.target.checked)} disabled={!canPet} />
                    <label htmlFor="hasPet" className="font-body text-sm text-foreground">
                      Any Pet with guest?
                    </label>
                    {!canPet && <span className="font-body text-xs text-muted-foreground">(Not allowed)</span>}
                  </div>

                  <div className="space-y-2">
                    <p className="font-body text-sm font-semibold text-foreground">Guest Details</p>
                    {adultDetails.map((a, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2">
                        <input placeholder={`Adult ${idx + 1} Name`} value={a.name} onChange={(e) => setAdultDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} className="col-span-2 px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                        <input placeholder="Age" value={a.age} onChange={(e) => setAdultDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, age: e.target.value } : x)))} className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                        <select value={a.gender || ''} onChange={(e) => setAdultDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, gender: e.target.value } : x)))} className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm">
                          <option value="">Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    ))}
                    {childDetails.map((c, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2">
                        <input placeholder={`Child ${idx + 1} Name`} value={c.name} onChange={(e) => setChildDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} className="col-span-2 px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                        <input placeholder="Age" value={c.age} onChange={(e) => setChildDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, age: e.target.value } : x)))} className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
                        <select value={c.gender || ''} onChange={(e) => setChildDetails((prev) => prev.map((x, i) => (i === idx ? { ...x, gender: e.target.value } : x)))} className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm">
                          <option value="">Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-brand-gold/20 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-muted-foreground">₹{Number(roomType.pricePerNight || 0).toLocaleString('en-IN')} × {nights} night(s)</span>
                      <span className="text-foreground">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-body text-sm font-semibold border-t border-brand-gold/20 pt-2">
                      <span>Total</span>
                      <span className="text-brand-crimson font-display text-lg">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <button onClick={handleInitiateBooking} className="metallic-gold w-full py-3 rounded-xl text-sm font-body font-semibold mt-4 tracking-wide">
                    Pay & Book Now
                  </button>
                  <p className="font-body text-[11px] text-muted-foreground text-center mt-3">Secure UPI · Instant confirmation after verification</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomTypeDetail;

