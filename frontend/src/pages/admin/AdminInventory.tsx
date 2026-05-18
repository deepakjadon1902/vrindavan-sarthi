import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Plus, Trash2, Pencil, CalendarDays } from 'lucide-react';
import { publishAppEvent } from '@/lib/broadcast';

type Hotel = { _id: string; name: string; status?: string; approvalStatus?: string; location?: string; partnerName?: string };

type RoomType = {
  _id: string;
  hotelId: string;
  name: string;
  description?: string;
  images?: string[];
  amenities?: string[];
  pricePerNight: number;
  maxAdults: number;
  maxChildren: number;
  petsAllowed: boolean;
  status: 'active' | 'inactive';
};

type RoomUnit = {
  _id: string;
  roomTypeId: string;
  number: string;
  floor?: string;
  status: 'active' | 'inactive';
  petsAllowedOverride?: boolean | null;
};

type BlockKind = 'closed' | 'maintenance' | 'offline_booking' | 'temp_unavailable';

const AdminInventory = () => {
  const token = useAuthStore((s) => s.token);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomUnit[]>([]);
  const [selectedRoomUnitId, setSelectedRoomUnitId] = useState<string>('');

  const [calendar, setCalendar] = useState<any | null>(null);
  const [calFrom, setCalFrom] = useState<string>('');
  const [calTo, setCalTo] = useState<string>('');

  // Room type form
  const [rtName, setRtName] = useState('');
  const [rtPrice, setRtPrice] = useState<number>(0);
  const [rtMaxAdults, setRtMaxAdults] = useState<number>(2);
  const [rtMaxChildren, setRtMaxChildren] = useState<number>(0);
  const [rtPetsAllowed, setRtPetsAllowed] = useState<boolean>(false);
  const [rtDescription, setRtDescription] = useState<string>('');
  const [rtAmenities, setRtAmenities] = useState<string>('');
  const [rtImages, setRtImages] = useState<string[]>([]);
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);

  // Room unit form
  const [roomNumber, setRoomNumber] = useState('');
  const [roomFloor, setRoomFloor] = useState('');
  const [roomPetsOverride, setRoomPetsOverride] = useState<'inherit' | 'allow' | 'disallow'>('inherit');
  const [editingRoomUnitId, setEditingRoomUnitId] = useState<string | null>(null);

  // Block form
  const [blockKind, setBlockKind] = useState<BlockKind>('maintenance');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockNote, setBlockNote] = useState('');

  const selectedHotel = useMemo(() => hotels.find((h) => h._id === selectedHotelId) || null, [hotels, selectedHotelId]);
  const selectedRoomType = useMemo(() => roomTypes.find((rt) => rt._id === selectedRoomTypeId) || null, [roomTypes, selectedRoomTypeId]);
  const selectedRoomUnit = useMemo(() => rooms.find((r) => r._id === selectedRoomUnitId) || null, [rooms, selectedRoomUnitId]);

  const loadHotels = async () => {
    if (!token) return;
    try {
      const res = await api.get('/admin/inventory/hotels', withAuth(token));
      setHotels(Array.isArray(res.data?.data) ? res.data.data : []);
      return;
    } catch {
      // Fallback for older servers / route registration issues.
      const res = await api.get('/hotels/all', withAuth(token));
      setHotels(Array.isArray(res.data?.data) ? res.data.data : []);
    }
  };

  const loadRoomTypes = async (hotelId: string) => {
    if (!token || !hotelId) return;
    setRoomTypes([]);
    setSelectedRoomTypeId('');
    setRooms([]);
    setSelectedRoomUnitId('');
    setCalendar(null);
    try {
      const res = await api.get(`/admin/inventory/hotels/${hotelId}/room-types`, withAuth(token));
      setRoomTypes(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to load room types';
      if (status === 401) toast.error('Session expired. Please login again.');
      else toast.error(msg);
      setRoomTypes([]);
    }
  };

  const loadRooms = async (roomTypeId: string) => {
    if (!token || !roomTypeId) return;
    setRooms([]);
    setSelectedRoomUnitId('');
    setCalendar(null);
    try {
      const res = await api.get(`/admin/inventory/room-types/${roomTypeId}/rooms`, withAuth(token));
      setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to load rooms';
      if (status === 401) toast.error('Session expired. Please login again.');
      else toast.error(msg);
      setRooms([]);
    }
  };

  const loadCalendar = async (roomUnitId: string) => {
    if (!token || !roomUnitId) return;
    const qs = new URLSearchParams();
    if (calFrom) qs.set('from', calFrom);
    if (calTo) qs.set('to', calTo);
    const res = await api.get(`/admin/inventory/rooms/${roomUnitId}/calendar?${qs.toString()}`, withAuth(token));
    setCalendar(res.data?.data || null);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadHotels();
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to load hotels');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedHotelId) return;
    (async () => {
      try {
        await loadRoomTypes(selectedHotelId);
      } catch {
        toast.error('Failed to load room types');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHotelId, token]);

  useEffect(() => {
    if (!selectedRoomTypeId) return;
    (async () => {
      try {
        await loadRooms(selectedRoomTypeId);
      } catch {
        toast.error('Failed to load rooms');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomTypeId, token]);

  useEffect(() => {
    if (!selectedRoomUnitId) return;
    (async () => {
      try {
        await loadCalendar(selectedRoomUnitId);
      } catch {
        toast.error('Failed to load calendar');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomUnitId, token]);

  const resetRoomTypeForm = () => {
    setRtName('');
    setRtPrice(0);
    setRtMaxAdults(2);
    setRtMaxChildren(0);
    setRtPetsAllowed(false);
    setRtDescription('');
    setRtAmenities('');
    setRtImages([]);
    setEditingRoomTypeId(null);
  };

  const resetRoomUnitForm = () => {
    setRoomNumber('');
    setRoomFloor('');
    setRoomPetsOverride('inherit');
    setEditingRoomUnitId(null);
  };

  const onSubmitRoomType = async () => {
    if (!token) return;
    if (!selectedHotelId) return toast.error('Select a hotel first');
    if (!rtName.trim()) return toast.error('Room type name is required');
    if (!Number.isFinite(rtPrice) || rtPrice <= 0) return toast.error('Price per night is required');

    const payload = {
      name: rtName.trim(),
      description: rtDescription.trim(),
      amenities: rtAmenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      images: rtImages,
      pricePerNight: Number(rtPrice),
      maxAdults: Number(rtMaxAdults || 1),
      maxChildren: Number(rtMaxChildren || 0),
      petsAllowed: Boolean(rtPetsAllowed),
      status: 'active',
    };

    try {
      if (editingRoomTypeId) {
        const res = await api.put(`/admin/inventory/room-types/${editingRoomTypeId}`, payload, withAuth(token));
        const updated = res.data?.data as RoomType;
        setRoomTypes((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
        toast.success('Room type updated');
        publishAppEvent('listing:changed');
      } else {
        const res = await api.post(`/admin/inventory/hotels/${selectedHotelId}/room-types`, payload, withAuth(token));
        const created = res.data?.data as RoomType;
        setRoomTypes((prev) => [created, ...prev]);
        toast.success('Room type added');
        publishAppEvent('listing:changed');
      }
      resetRoomTypeForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save room type');
    }
  };

  const onEditRoomType = (rt: RoomType) => {
    setRtName(rt.name || '');
    setRtPrice(Number(rt.pricePerNight || 0));
    setRtMaxAdults(Number(rt.maxAdults || 1));
    setRtMaxChildren(Number(rt.maxChildren || 0));
    setRtPetsAllowed(Boolean(rt.petsAllowed));
    setRtDescription(String(rt.description || ''));
    setRtAmenities(Array.isArray(rt.amenities) ? rt.amenities.join(', ') : '');
    setRtImages(Array.isArray(rt.images) ? rt.images : []);
    setEditingRoomTypeId(rt._id);
  };

  const onRoomTypeImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setRtImages((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeRoomTypeImage = (idx: number) => {
    setRtImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const onDeleteRoomType = async (roomTypeId: string) => {
    if (!token) return;
    try {
      await api.delete(`/admin/inventory/room-types/${roomTypeId}`, withAuth(token));
      setRoomTypes((prev) => prev.filter((x) => x._id !== roomTypeId));
      if (selectedRoomTypeId === roomTypeId) {
        setSelectedRoomTypeId('');
        setRooms([]);
        setSelectedRoomUnitId('');
        setCalendar(null);
      }
      toast.success('Deleted');
      publishAppEvent('listing:changed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const onSubmitRoomUnit = async () => {
    if (!token) return;
    if (!selectedRoomTypeId) return toast.error('Select a room type first');
    if (!roomNumber.trim()) return toast.error('Room number is required');

    const payload: any = {
      number: roomNumber.trim(),
      floor: roomFloor.trim(),
      status: 'active',
    };
    if (roomPetsOverride === 'allow') payload.petsAllowedOverride = true;
    if (roomPetsOverride === 'disallow') payload.petsAllowedOverride = false;
    if (roomPetsOverride === 'inherit') payload.petsAllowedOverride = null;

    try {
      if (editingRoomUnitId) {
        const res = await api.put(`/admin/inventory/rooms/${editingRoomUnitId}`, payload, withAuth(token));
        const updated = res.data?.data as RoomUnit;
        setRooms((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
        toast.success('Room updated');
        publishAppEvent('listing:changed');
      } else {
        const res = await api.post(`/admin/inventory/room-types/${selectedRoomTypeId}/rooms`, payload, withAuth(token));
        const created = res.data?.data as RoomUnit;
        setRooms((prev) => [...prev, created].sort((a, b) => String(a.number).localeCompare(String(b.number))));
        toast.success('Room added');
        publishAppEvent('listing:changed');
      }
      resetRoomUnitForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save room');
    }
  };

  const onEditRoomUnit = (r: RoomUnit) => {
    setRoomNumber(r.number || '');
    setRoomFloor(r.floor || '');
    if (r.petsAllowedOverride === true) setRoomPetsOverride('allow');
    else if (r.petsAllowedOverride === false) setRoomPetsOverride('disallow');
    else setRoomPetsOverride('inherit');
    setEditingRoomUnitId(r._id);
  };

  const onDeleteRoomUnit = async (roomUnitId: string) => {
    if (!token) return;
    try {
      await api.delete(`/admin/inventory/rooms/${roomUnitId}`, withAuth(token));
      setRooms((prev) => prev.filter((x) => x._id !== roomUnitId));
      if (selectedRoomUnitId === roomUnitId) {
        setSelectedRoomUnitId('');
        setCalendar(null);
      }
      toast.success('Deleted');
      publishAppEvent('listing:changed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const onAddBlock = async () => {
    if (!token) return;
    if (!selectedRoomUnitId) return toast.error('Select a room first');
    if (!blockStart || !blockEnd) return toast.error('Start and end dates are required');

    try {
      await api.post(
        `/admin/inventory/rooms/${selectedRoomUnitId}/blocks`,
        { kind: blockKind, startDate: blockStart, endDate: blockEnd, note: blockNote },
        withAuth(token)
      );
      toast.success('Block added');
      publishAppEvent('listing:changed');
      setBlockStart('');
      setBlockEnd('');
      setBlockNote('');
      await loadCalendar(selectedRoomUnitId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add block');
    }
  };

  const onDeleteBlock = async (blockId: string) => {
    if (!token) return;
    try {
      await api.delete(`/admin/inventory/blocks/${blockId}`, withAuth(token));
      toast.success('Deleted');
      publishAppEvent('listing:changed');
      if (selectedRoomUnitId) await loadCalendar(selectedRoomUnitId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-heading text-xl font-bold text-foreground">Inventory & Booking Engine</h2>
        <p className="font-body text-xs text-muted-foreground mt-1">
          Select a hotel → add room types → add room numbers → manage availability calendar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hotel + Room Types */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div>
            <label className="font-body text-xs text-muted-foreground">Hotel</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-border bg-background font-body text-sm"
            >
              <option value="">Select hotel</option>
              {hotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                  {h.approvalStatus ? ` • ${h.approvalStatus}` : ''}
                  {h.status ? ` • ${h.status}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-body text-sm font-semibold text-foreground">Room Types</p>
              <button
                type="button"
                onClick={resetRoomTypeForm}
                className="text-xs font-body text-muted-foreground hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input
                value={rtName}
                onChange={(e) => setRtName(e.target.value)}
                placeholder="Room type name (e.g. Double Bed AC)"
                className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
              />
              <textarea
                value={rtDescription}
                onChange={(e) => setRtDescription(e.target.value)}
                placeholder="Description (optional)"
                className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm min-h-[88px]"
              />
              <input
                value={rtAmenities}
                onChange={(e) => setRtAmenities(e.target.value)}
                placeholder="Amenities (comma separated)"
                className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
              />
              <div className="px-3 py-2 rounded-lg border border-border bg-background/70">
                <label className="font-body text-xs text-muted-foreground">Photos (room type)</label>
                <input type="file" accept="image/*" multiple onChange={onRoomTypeImagesChange} className="mt-1 w-full font-body text-xs" />
                {rtImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {rtImages.map((img, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => removeRoomTypeImage(idx)}
                        className="relative group rounded-lg overflow-hidden border border-border"
                        title="Click to remove"
                      >
                        <img src={img} alt="" className="w-full h-16 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="font-body text-[11px] text-muted-foreground mt-1">Click a thumbnail to remove.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={String(rtPrice || '')}
                  onChange={(e) => setRtPrice(Number(e.target.value || 0))}
                  placeholder="Price/night"
                  type="number"
                  className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
                />
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background/70">
                  <input id="rtPetsAllowed" type="checkbox" checked={rtPetsAllowed} onChange={(e) => setRtPetsAllowed(e.target.checked)} />
                  <label htmlFor="rtPetsAllowed" className="font-body text-sm text-foreground">
                    Pets allowed
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={String(rtMaxAdults ?? 2)}
                  onChange={(e) => setRtMaxAdults(Number(e.target.value || 1))}
                  placeholder="Max adults"
                  type="number"
                  className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
                />
                <input
                  value={String(rtMaxChildren ?? 0)}
                  onChange={(e) => setRtMaxChildren(Number(e.target.value || 0))}
                  placeholder="Max children"
                  type="number"
                  className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
                />
              </div>
              <button onClick={onSubmitRoomType} className="btn-crimson w-full py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2">
                <Plus size={16} /> {editingRoomTypeId ? 'Update Room Type' : 'Add Room Type'}
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              {roomTypes.length === 0 ? (
                <p className="p-4 font-body text-xs text-muted-foreground">No room types yet.</p>
              ) : (
                <div className="max-h-[320px] overflow-auto">
                  {roomTypes.map((rt) => (
                    <button
                      key={rt._id}
                      onClick={() => setSelectedRoomTypeId(rt._id)}
                      className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${
                        selectedRoomTypeId === rt._id ? 'bg-muted/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-body text-sm font-semibold text-foreground truncate">{rt.name}</p>
                          <p className="font-body text-xs text-muted-foreground truncate">
                            ₹{Number(rt.pricePerNight || 0).toLocaleString('en-IN')} • Adults {rt.maxAdults} • Children {rt.maxChildren}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoomType(rt);
                            }}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRoomType(rt._id);
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rooms (room numbers) */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm font-semibold text-foreground">Room Numbers</p>
              <p className="font-body text-xs text-muted-foreground">
                {selectedRoomType ? `${selectedRoomType.name}` : 'Select a room type to add room numbers.'}
              </p>
            </div>
            <button type="button" onClick={resetRoomUnitForm} className="text-xs font-body text-muted-foreground hover:underline">
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Room number (e.g. 201)"
                className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
                disabled={!selectedRoomTypeId}
              />
              <input
                value={roomFloor}
                onChange={(e) => setRoomFloor(e.target.value)}
                placeholder="Floor (optional)"
                className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
                disabled={!selectedRoomTypeId}
              />
            </div>

            <select
              value={roomPetsOverride}
              onChange={(e) => setRoomPetsOverride(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm"
              disabled={!selectedRoomTypeId}
            >
              <option value="inherit">Pets: inherit from room type</option>
              <option value="allow">Pets: allow</option>
              <option value="disallow">Pets: disallow</option>
            </select>

            <button
              onClick={onSubmitRoomUnit}
              disabled={!selectedRoomTypeId}
              className="btn-crimson w-full py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} /> {editingRoomUnitId ? 'Update Room' : 'Add Room'}
            </button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            {rooms.length === 0 ? (
              <p className="p-4 font-body text-xs text-muted-foreground">No room numbers yet.</p>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                {rooms.map((r) => (
                  <button
                    key={r._id}
                    onClick={() => setSelectedRoomUnitId(r._id)}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${
                      selectedRoomUnitId === r._id ? 'bg-muted/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-body text-sm font-semibold text-foreground">Room {r.number}</p>
                        <p className="font-body text-xs text-muted-foreground">{r.floor ? `Floor: ${r.floor}` : '—'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRoomUnit(r);
                          }}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRoomUnit(r._id);
                          }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm font-semibold text-foreground">Room Calendar</p>
              <p className="font-body text-xs text-muted-foreground">
                {selectedRoomUnit ? `Room ${selectedRoomUnit.number}` : 'Select a room number to view availability.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectedRoomUnitId && loadCalendar(selectedRoomUnitId)}
              disabled={!selectedRoomUnitId}
              className="px-3 py-2 rounded-lg text-xs font-body border border-border hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              <CalendarDays size={14} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-body text-xs text-muted-foreground">From</label>
              <input value={calFrom} onChange={(e) => setCalFrom(e.target.value)} type="date" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">To</label>
              <input value={calTo} onChange={(e) => setCalTo(e.target.value)} type="date" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="font-body text-sm font-semibold text-foreground">Manual Block</p>
            <select value={blockKind} onChange={(e) => setBlockKind(e.target.value as BlockKind)} className="w-full px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm">
              <option value="closed">Closed</option>
              <option value="maintenance">Maintenance</option>
              <option value="offline_booking">Offline booking block</option>
              <option value="temp_unavailable">Temporary unavailable</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={blockStart} onChange={(e) => setBlockStart(e.target.value)} type="date" className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
              <input value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} type="date" className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
            </div>
            <input value={blockNote} onChange={(e) => setBlockNote(e.target.value)} placeholder="Note (optional)" className="px-3 py-2 rounded-lg border border-border bg-background/70 font-body text-sm" />
            <button onClick={onAddBlock} disabled={!selectedRoomUnitId} className="btn-crimson w-full py-2.5 rounded-xl text-sm disabled:opacity-50">
              Add Block
            </button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            {!calendar ? (
              <p className="p-4 font-body text-xs text-muted-foreground">No calendar loaded.</p>
            ) : (
              <div className="max-h-[320px] overflow-auto divide-y divide-border">
                <div className="p-4">
                  <p className="font-body text-sm font-semibold text-foreground">Blocks</p>
                  {(calendar.blocks || []).length === 0 ? (
                    <p className="font-body text-xs text-muted-foreground mt-1">No blocks.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {(calendar.blocks || []).map((b: any) => (
                        <div key={b._id} className="flex items-start justify-between gap-3 bg-muted/30 rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="font-body text-xs font-semibold text-foreground capitalize">{String(b.kind || '').replaceAll('_', ' ')}</p>
                            <p className="font-body text-[11px] text-muted-foreground">
                              {String(b.startDate || '').slice(0, 10)} → {String(b.endDate || '').slice(0, 10)}
                              {b.note ? ` • ${b.note}` : ''}
                            </p>
                          </div>
                          <button onClick={() => onDeleteBlock(b._id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="font-body text-sm font-semibold text-foreground">Bookings</p>
                  {(calendar.bookings || []).length === 0 ? (
                    <p className="font-body text-xs text-muted-foreground mt-1">No bookings in selected range.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {(calendar.bookings || []).map((bk: any) => (
                        <div key={bk._id} className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-body text-xs font-semibold text-foreground">{bk.bookingId || '—'}</p>
                            <p className="font-body text-[11px] text-muted-foreground capitalize">{bk.bookingStatus || '—'}</p>
                          </div>
                          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                            {String(bk.checkIn || '').slice(0, 10)} → {String(bk.checkOut || '').slice(0, 10)}
                          </p>
                          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                            {bk.customerFullName || bk.userName || '—'} • {bk.userPhone || '—'} • Adults {bk.totalAdults ?? 0} • Children {bk.totalChildren ?? 0}
                            {bk.hasPet ? ' • Pet' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!selectedHotel && (
        <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-5">
          <p className="font-body text-sm text-foreground font-semibold">Tip</p>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Partners must submit hotels for admin approval. Only approved hotels appear in the main app.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminInventory;
