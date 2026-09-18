import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/lib/apiError';

type Hotel = { _id: string; name: string };
type RoomType = { _id: string; hotelId: string; name: string; pricePerNight: number };
type RatePlan = {
  _id: string;
  name: string;
  code: string;
  mealPlan: string;
  basePrice: number;
  currency: string;
  active: boolean;
  isDefault?: boolean;
};

const mealPlans = [
  ['ROOM_ONLY', 'Room only'],
  ['BREAKFAST', 'Breakfast'],
  ['HALF_BOARD', 'Half board'],
  ['FULL_BOARD', 'Full board'],
];

const PartnerRates = () => {
  const token = useAuthStore((s) => s.token);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState('Room Only');
  const [mealPlan, setMealPlan] = useState('ROOM_ONLY');
  const [basePrice, setBasePrice] = useState(0);
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [overridePrice, setOverridePrice] = useState(0);
  const [minimumStay, setMinimumStay] = useState(1);
  const [maximumStay, setMaximumStay] = useState('');
  const [closed, setClosed] = useState(false);
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);

  const selectedPlan = useMemo(() => plans.find((plan) => plan._id === selectedPlanId) || null, [plans, selectedPlanId]);

  const loadHotels = useCallback(async () => {
    if (!token) return;
    const res = await api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } });
    const list = Array.isArray(res.data?.data?.hotels) ? res.data.data.hotels : [];
    const next = list.map((hotel: any) => ({ _id: hotel._id, name: hotel.name })).filter((hotel: Hotel) => hotel._id && hotel.name);
    setHotels(next);
    setSelectedHotelId((current) => current || next[0]?._id || '');
  }, [token]);

  const loadRoomTypes = useCallback(async (hotelId: string) => {
    if (!token || !hotelId) return;
    const res = await api.get(`/partner/inventory/hotels/${hotelId}/room-types`, withAuth(token));
    const next = Array.isArray(res.data?.data) ? res.data.data : [];
    setRoomTypes(next);
    setSelectedRoomTypeId((current) => (next.some((roomType: RoomType) => roomType._id === current) ? current : next[0]?._id || ''));
  }, [token]);

  const loadPlans = useCallback(async (roomTypeId: string) => {
    if (!token || !roomTypeId) return;
    setLoading(true);
    try {
      const res = await api.get(`/rates/manage/room-types/${roomTypeId}/plans`, withAuth(token));
      const next = Array.isArray(res.data?.data) ? res.data.data : [];
      setPlans(next);
      setSelectedPlanId((current) => (next.some((plan: RatePlan) => plan._id === current) ? current : next[0]?._id || ''));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Rate plans could not be loaded'));
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadHotels().catch((err) => toast.error(getApiErrorMessage(err, 'Hotels could not be loaded')));
  }, [loadHotels]);

  useEffect(() => {
    void loadRoomTypes(selectedHotelId).catch((err) => toast.error(getApiErrorMessage(err, 'Room types could not be loaded')));
  }, [loadRoomTypes, selectedHotelId]);

  useEffect(() => {
    void loadPlans(selectedRoomTypeId);
  }, [loadPlans, selectedRoomTypeId]);

  useEffect(() => {
    if (!selectedPlan) return;
    setPlanName(selectedPlan.name || 'Room Only');
    setMealPlan(selectedPlan.mealPlan || 'ROOM_ONLY');
    setBasePrice(Number(selectedPlan.basePrice || 0));
    setActive(Boolean(selectedPlan.active));
  }, [selectedPlan]);

  const savePlan = async () => {
    if (!token || !selectedRoomTypeId) return;
    try {
      const body = { name: planName, mealPlan, basePrice, active };
      if (selectedPlanId) await api.put(`/rates/manage/plans/${selectedPlanId}`, body, withAuth(token));
      else await api.post(`/rates/manage/room-types/${selectedRoomTypeId}/plans`, body, withAuth(token));
      toast.success('Rate plan saved');
      await loadPlans(selectedRoomTypeId);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Rate plan could not be saved'));
    }
  };

  const saveCalendar = async () => {
    if (!token || !selectedPlanId) return;
    try {
      await api.put(`/rates/manage/plans/${selectedPlanId}/calendar`, {
        from,
        to,
        price: overridePrice,
        minimumStay,
        maximumStay: maximumStay ? Number(maximumStay) : undefined,
        closed,
        closedToArrival,
        closedToDeparture,
      }, withAuth(token));
      toast.success('Rate calendar updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Rate calendar could not be saved'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Rates</h2>
          <p className="text-sm text-muted-foreground">Manage room rate plans and date-specific overrides.</p>
        </div>
        <button onClick={() => loadPlans(selectedRoomTypeId)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Hotel</span>
          <select value={selectedHotelId} onChange={(e) => setSelectedHotelId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Room type</span>
          <select value={selectedRoomTypeId} onChange={(e) => setSelectedRoomTypeId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            {roomTypes.map((roomType) => <option key={roomType._id} value={roomType._id}>{roomType.name}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold">Rate Plans</h3>
          <div className="space-y-2">
            {plans.map((plan) => (
              <button
                key={plan._id}
                onClick={() => setSelectedPlanId(plan._id)}
                className={`w-full rounded-md border p-3 text-left text-sm hover:bg-muted ${selectedPlanId === plan._id ? 'border-primary' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{plan.name}</span>
                  <span>{plan.currency || 'INR'} {Number(plan.basePrice || 0).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{plan.mealPlan}{plan.isDefault ? ' - default' : ''}{plan.active ? '' : ' - inactive'}</p>
              </button>
            ))}
            {!loading && plans.length === 0 && <p className="text-sm text-muted-foreground">No rate plans yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold">Plan Details</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Meal plan</span>
              <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
                {mealPlans.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Default price</span>
              <input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value || 0))} className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 pt-7 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </div>
          <button onClick={savePlan} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            <Save size={16} /> Save Rate Plan
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays size={18} />
          <h3 className="font-semibold">Date Override</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Nightly price</span>
            <input type="number" min={0} value={overridePrice} onChange={(e) => setOverridePrice(Number(e.target.value || 0))} className="w-full rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Min stay</span>
            <input type="number" min={1} value={minimumStay} onChange={(e) => setMinimumStay(Number(e.target.value || 1))} className="w-full rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Max stay</span>
            <input type="number" min={1} value={maximumStay} onChange={(e) => setMaximumStay(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
          </label>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Closed</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={closedToArrival} onChange={(e) => setClosedToArrival(e.target.checked)} /> CTA</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={closedToDeparture} onChange={(e) => setClosedToDeparture(e.target.checked)} /> CTD</label>
          </div>
        </div>
        <button disabled={!selectedPlanId} onClick={saveCalendar} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          <Save size={16} /> Save Date Override
        </button>
      </section>
    </div>
  );
};

export default PartnerRates;
