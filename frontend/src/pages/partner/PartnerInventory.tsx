import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Plus, Trash2, Pencil, CalendarDays } from 'lucide-react';

type Hotel = { _id: string; name: string };

type RoomType = {
  _id: string;
  hotelId: string;
  name: string;
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

const PartnerInventory = () => {
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
    const res = await api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } });
    const data = res.data?.data || {};
    const list = Array.isArray(data.hotels) ? data.hotels : [];
    setHotels(list.map((h: any) => ({ _id: h._id, name: h.name })).filter((h: any) => h._id && h.name));
  };

  const loadRoomTypes = async (hotelId: string) => {
    if (!token || !hotelId) return;
    setRoomTypes([]);
    setSelectedRoomTypeId('');
    setRooms([]);
    setSelectedRoomUnitId('');
    setCalendar(null);
    const res = await api.get(`/partner/inventory/hotels/${hotelId}/room-types`, withAuth(token));
    setRoomTypes(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const loadRooms = async (roomTypeId: string) => {
    if (!token || !roomTypeId) return;
    setRooms([]);
    setSelectedRoomUnitId('');
    setCalendar(null);
    const res = await api.get(`/partner/inventory/room-types/${roomTypeId}/rooms`, withAuth(token));
    setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const loadCalendar = async (roomUnitId: string) => {
    if (!token || !roomUnitId) return;
    const qs = new URLSearchParams();
    if (calFrom) qs.set('from', calFrom);
    if (calTo) qs.set('to', calTo);
    const res = await api.get(`/partner/inventory/rooms/${roomUnitId}/calendar?${qs.toString()}`, withAuth(token));
    setCalendar(res.data?.data || null);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadHotels();
      } catch {
        toast.error('Failed to load hotels');
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
    void loadCalendar(selectedRoomUnitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomUnitId, token]);

  const resetRoomTypeForm = () => {
    setEditingRoomTypeId(null);
    setRtName('');
    setRtPrice(0);
    setRtMaxAdults(2);
    setRtMaxChildren(0);
    setRtPetsAllowed(false);
  };

  const resetRoomForm = () => {
    setEditingRoomUnitId(null);
    setRoomNumber('');
    setRoomFloor('');
    setRoomPetsOverride('inherit');
  };

  const submitRoomType = async () => {
    if (!token) return;
    if (!selectedHotelId) return toast.error('Select a hotel first');
    if (!rtName.trim()) return toast.error('Room type name is required');
    if (!rtPrice || rtPrice <= 0) return toast.error('Price per night is required');

    try {
      if (editingRoomTypeId) {
        const res = await api.put(
          `/partner/inventory/room-types/${editingRoomTypeId}`,
          {
            name: rtName.trim(),
            pricePerNight: rtPrice,
            maxAdults: rtMaxAdults,
            maxChildren: rtMaxChildren,
            petsAllowed: rtPetsAllowed,
          },
          withAuth(token)
        );
        const updated = res.data?.data;
        setRoomTypes((prev) => prev.map((x) => (x._id === updated?._id ? updated : x)));
        toast.success('Room type updated');
      } else {
        const res = await api.post(
          `/partner/inventory/hotels/${selectedHotelId}/room-types`,
          {
            name: rtName.trim(),
            pricePerNight: rtPrice,
            maxAdults: rtMaxAdults,
            maxChildren: rtMaxChildren,
            petsAllowed: rtPetsAllowed,
            status: 'active',
          },
          withAuth(token)
        );
        const created = res.data?.data;
        setRoomTypes((prev) => [created, ...prev]);
        toast.success('Room type created');
      }
      resetRoomTypeForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const editRoomType = (rt: RoomType) => {
    setEditingRoomTypeId(rt._id);
    setRtName(rt.name || '');
    setRtPrice(Number(rt.pricePerNight || 0));
    setRtMaxAdults(Number(rt.maxAdults || 2));
    setRtMaxChildren(Number(rt.maxChildren || 0));
    setRtPetsAllowed(Boolean(rt.petsAllowed));
  };

  const deleteRoomType = async (roomTypeId: string) => {
    if (!token) return;
    if (!confirm('Delete this room type and all its rooms/blocks?')) return;
    try {
      await api.delete(`/partner/inventory/room-types/${roomTypeId}`, withAuth(token));
      setRoomTypes((prev) => prev.filter((x) => x._id !== roomTypeId));
      if (selectedRoomTypeId === roomTypeId) {
        setSelectedRoomTypeId('');
        setRooms([]);
        setSelectedRoomUnitId('');
        setCalendar(null);
      }
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  const submitRoom = async () => {
    if (!token) return;
    if (!selectedRoomTypeId) return toast.error('Select a room type first');
    if (!roomNumber.trim()) return toast.error('Room number is required');

    try {
      if (editingRoomUnitId) {
        const res = await api.put(
          `/partner/inventory/rooms/${editingRoomUnitId}`,
          {
            number: roomNumber.trim(),
            floor: roomFloor.trim(),
            petsAllowedOverride: roomPetsOverride === 'inherit' ? null : roomPetsOverride === 'allow',
          },
          withAuth(token)
        );
        const updated = res.data?.data;
        setRooms((prev) => prev.map((x) => (x._id === updated?._id ? updated : x)));
        toast.success('Room updated');
      } else {
        const res = await api.post(
          `/partner/inventory/room-types/${selectedRoomTypeId}/rooms`,
          {
            number: roomNumber.trim(),
            floor: roomFloor.trim(),
            status: 'active',
            petsAllowedOverride: roomPetsOverride === 'inherit' ? null : roomPetsOverride === 'allow',
          },
          withAuth(token)
        );
        const created = res.data?.data;
        setRooms((prev) => [...prev, created].sort((a, b) => String(a.number).localeCompare(String(b.number))));
        toast.success('Room added');
      }
      resetRoomForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const editRoom = (r: RoomUnit) => {
    setEditingRoomUnitId(r._id);
    setRoomNumber(r.number || '');
    setRoomFloor(r.floor || '');
    if (r.petsAllowedOverride === true) setRoomPetsOverride('allow');
    else if (r.petsAllowedOverride === false) setRoomPetsOverride('disallow');
    else setRoomPetsOverride('inherit');
  };

  const deleteRoom = async (roomUnitId: string) => {
    if (!token) return;
    if (!confirm('Delete this room and its blocks?')) return;
    try {
      await api.delete(`/partner/inventory/rooms/${roomUnitId}`, withAuth(token));
      setRooms((prev) => prev.filter((x) => x._id !== roomUnitId));
      if (selectedRoomUnitId === roomUnitId) {
        setSelectedRoomUnitId('');
        setCalendar(null);
      }
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  const createBlock = async () => {
    if (!token) return;
    if (!selectedRoomUnitId) return toast.error('Select a room first');
    if (!blockStart || !blockEnd) return toast.error('Start and end dates are required');
    try {
      await api.post(
        `/partner/inventory/rooms/${selectedRoomUnitId}/blocks`,
        { kind: blockKind, startDate: blockStart, endDate: blockEnd, note: blockNote },
        withAuth(token)
      );
      toast.success('Blocked');
      setBlockNote('');
      void loadCalendar(selectedRoomUnitId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Block failed');
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!token) return;
    try {
      await api.delete(`/partner/inventory/blocks/${blockId}`, withAuth(token));
      toast.success('Block removed');
      if (selectedRoomUnitId) void loadCalendar(selectedRoomUnitId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Inventory & Booking Engine</h2>
        <p className="font-body text-xs text-muted-foreground">Room types → room numbers → per-room calendar blocks.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="font-body text-xs text-muted-foreground">Hotel</label>
          <select
            value={selectedHotelId}
            onChange={(e) => setSelectedHotelId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
          >
            <option value="">Select hotel</option>
            {hotels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        {selectedHotel && (
          <div className="text-xs font-body text-muted-foreground">
            Selected: <span className="text-foreground font-medium">{selectedHotel.name}</span>
          </div>
        )}
      </div>

      {/* Room Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-base font-semibold">Room Types</h3>
            {editingRoomTypeId && (
              <button onClick={resetRoomTypeForm} className="text-xs font-body text-muted-foreground hover:text-foreground">
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="font-body text-xs text-muted-foreground">Room Type Name</label>
              <input value={rtName} onChange={(e) => setRtName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Price / Night</label>
              <input type="number" min={0} value={rtPrice} onChange={(e) => setRtPrice(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Max Adults</label>
              <input type="number" min={1} value={rtMaxAdults} onChange={(e) => setRtMaxAdults(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Max Children</label>
              <input type="number" min={0} value={rtMaxChildren} onChange={(e) => setRtMaxChildren(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="rtPets" type="checkbox" checked={rtPetsAllowed} onChange={(e) => setRtPetsAllowed(e.target.checked)} />
              <label htmlFor="rtPets" className="font-body text-sm">
                Pets allowed (this type)
              </label>
            </div>
          </div>

          <button onClick={submitRoomType} className="mt-4 w-full py-2 rounded-lg bg-brand-gold text-foreground font-body text-sm font-semibold flex items-center justify-center gap-2">
            <Plus size={16} /> {editingRoomTypeId ? 'Update Room Type' : 'Add Room Type'}
          </button>

          <div className="mt-4 space-y-2">
            {roomTypes.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">No room types yet.</p>
            ) : (
              roomTypes.map((rt) => (
                <div
                  key={rt._id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${selectedRoomTypeId === rt._id ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-background'}`}
                >
                  <button onClick={() => setSelectedRoomTypeId(rt._id)} className="text-left flex-1">
                    <div className="font-body text-sm font-semibold text-foreground">{rt.name}</div>
                    <div className="font-body text-xs text-muted-foreground">
                      ₹{Number(rt.pricePerNight || 0).toLocaleString('en-IN')} • Adults {rt.maxAdults} • Children {rt.maxChildren}
                    </div>
                  </button>
                  <button onClick={() => editRoomType(rt)} className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteRoomType(rt._id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rooms */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-base font-semibold">Room Numbers</h3>
            {editingRoomUnitId && (
              <button onClick={resetRoomForm} className="text-xs font-body text-muted-foreground hover:text-foreground">
                Cancel edit
              </button>
            )}
          </div>

          {!selectedRoomType ? (
            <p className="font-body text-sm text-muted-foreground">Select a room type to add room numbers.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-xs text-muted-foreground">Room Number</label>
                  <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground">Floor (optional)</label>
                  <input value={roomFloor} onChange={(e) => setRoomFloor(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="font-body text-xs text-muted-foreground">Pets Allowed (room override)</label>
                  <select value={roomPetsOverride} onChange={(e) => setRoomPetsOverride(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
                    <option value="inherit">Inherit from room type</option>
                    <option value="allow">Allow pets (this room)</option>
                    <option value="disallow">Disallow pets (this room)</option>
                  </select>
                </div>
              </div>

              <button onClick={submitRoom} className="mt-4 w-full py-2 rounded-lg bg-foreground text-primary-foreground font-body text-sm font-semibold flex items-center justify-center gap-2">
                <Plus size={16} /> {editingRoomUnitId ? 'Update Room' : 'Add Room'}
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <div
                    key={r._id}
                    className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${selectedRoomUnitId === r._id ? 'border-brand-gold bg-brand-gold/5' : 'border-border bg-background'}`}
                  >
                    <button onClick={() => setSelectedRoomUnitId(r._id)} className="font-body text-sm font-semibold">
                      {r.number}
                    </button>
                    <button onClick={() => editRoom(r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteRoom(r._id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {rooms.length === 0 && <p className="font-body text-sm text-muted-foreground">No rooms yet.</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-base font-semibold flex items-center gap-2">
            <CalendarDays size={16} /> Room Calendar
          </h3>
          {selectedRoomUnit && (
            <div className="text-xs font-body text-muted-foreground">
              Room <span className="text-foreground font-semibold">{selectedRoomUnit.number}</span>
            </div>
          )}
        </div>

        {!selectedRoomUnit ? (
          <p className="font-body text-sm text-muted-foreground">Select a room number to manage availability blocks and see bookings.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-xs text-muted-foreground">From</label>
                  <input type="date" value={calFrom} onChange={(e) => setCalFrom(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground">To</label>
                  <input type="date" value={calTo} onChange={(e) => setCalTo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                </div>
              </div>
              <button onClick={() => loadCalendar(selectedRoomUnitId)} className="w-full py-2 rounded-lg border border-border font-body text-sm hover:bg-muted">
                Refresh Calendar
              </button>

              <div className="border border-border rounded-lg p-3 bg-background">
                <h4 className="font-body text-sm font-semibold mb-2">Add Block</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Type</label>
                    <select value={blockKind} onChange={(e) => setBlockKind(e.target.value as BlockKind)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
                      <option value="maintenance">Maintenance</option>
                      <option value="closed">Closed</option>
                      <option value="offline_booking">Offline Booking Block</option>
                      <option value="temp_unavailable">Temporary Unavailable</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Note</label>
                    <input value={blockNote} onChange={(e) => setBlockNote(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Start</label>
                    <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground">End</label>
                    <input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
                  </div>
                </div>
                <button onClick={createBlock} className="mt-3 w-full py-2 rounded-lg bg-destructive text-destructive-foreground font-body text-sm font-semibold">
                  Block Dates
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-border rounded-lg p-3 bg-background">
                <h4 className="font-body text-sm font-semibold mb-2">Blocks</h4>
                {(calendar?.blocks || []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">No blocks.</p>
                ) : (
                  <div className="space-y-2">
                    {calendar.blocks.map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between gap-3 p-2 rounded border border-border">
                        <div className="min-w-0">
                          <div className="font-body text-sm font-semibold text-foreground capitalize">{String(b.kind || '').replaceAll('_', ' ')}</div>
                          <div className="font-body text-xs text-muted-foreground">
                            {String(b.startDate).slice(0, 10)} → {String(b.endDate).slice(0, 10)} {b.note ? `• ${b.note}` : ''}
                          </div>
                        </div>
                        <button onClick={() => deleteBlock(b._id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove block">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg p-3 bg-background">
                <h4 className="font-body text-sm font-semibold mb-2">Bookings</h4>
                {(calendar?.bookings || []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">No bookings in this range.</p>
                ) : (
                  <div className="space-y-2">
                    {calendar.bookings.map((bk: any) => (
                      <div key={bk._id} className="p-2 rounded border border-border">
                        <div className="flex items-center justify-between">
                          <div className="font-body text-sm font-semibold text-foreground">{bk.bookingId}</div>
                          <div className="font-body text-xs text-muted-foreground capitalize">{bk.bookingStatus}</div>
                        </div>
                        <div className="font-body text-xs text-muted-foreground">
                          {String(bk.checkIn).slice(0, 10)} → {String(bk.checkOut).slice(0, 10)}
                        </div>
                        <div className="font-body text-xs text-muted-foreground">
                          Guest: {bk.customerFullName || bk.userName || '-'} • Adults {bk.totalAdults ?? '-'} • Children {bk.totalChildren ?? '-'} {bk.hasPet ? '• Pet' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerInventory;
