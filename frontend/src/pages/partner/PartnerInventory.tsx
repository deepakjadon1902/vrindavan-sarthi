import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Plus, Trash2, Pencil, CalendarDays } from 'lucide-react';
import { publishAppEvent, subscribeAppEvent } from '@/lib/broadcast';
import { clearSessionCache } from '@/lib/panelCache';
import { getApiErrorMessage } from '@/lib/apiError';

type Hotel = { _id: string; name: string; propertyType?: 'hotel' | 'dharamshala'; status?: string; approvalStatus?: string };

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
  status: 'active' | 'inactive' | 'available' | 'unavailable' | 'closed';
  petsAllowedOverride?: boolean | null;
};

type BlockKind = 'available' | 'offline_booking' | 'unavailable' | 'closed';
type BlockScope = 'room' | 'room_type';

const PartnerInventory = () => {
  const token = useAuthStore((s) => s.token);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomUnit[]>([]);
  const [selectedRoomUnitId, setSelectedRoomUnitId] = useState<string>('');

  const [calendar, setCalendar] = useState<any | null>(null);
  const [matrixData, setMatrixData] = useState<Record<string, any>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState<any | null>(null);

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
  const [blockKind, setBlockKind] = useState<BlockKind>('offline_booking');
  const [blockScope, setBlockScope] = useState<BlockScope>('room');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  const selectedHotel = useMemo(() => hotels.find((h) => h._id === selectedHotelId) || null, [hotels, selectedHotelId]);
  const selectedRoomType = useMemo(() => roomTypes.find((rt) => rt._id === selectedRoomTypeId) || null, [roomTypes, selectedRoomTypeId]);
  const selectedRoomUnit = useMemo(() => rooms.find((r) => r._id === selectedRoomUnitId) || null, [rooms, selectedRoomUnitId]);

  const loadHotels = async () => {
    if (!token) return;
    const res = await api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } });
    const data = res.data?.data || {};
    const list = Array.isArray(data.hotels) ? data.hotels : [];
    setHotels(
      list
        .map((h: any) => ({ _id: h._id, name: h.name, propertyType: h.propertyType || 'hotel', status: h.status, approvalStatus: h.approvalStatus }))
        .filter((h: any) => h._id && h.name)
    );
  };

  const loadRoomTypes = async (hotelId: string) => {
    if (!token || !hotelId) return;
    setRoomTypes([]);
    setSelectedRoomTypeId('');
    setRooms([]);
    setSelectedRoomUnitId('');
    setCalendar(null);
    try {
      const res = await api.get(`/partner/inventory/hotels/${hotelId}/room-types`, withAuth(token));
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
      const res = await api.get(`/partner/inventory/room-types/${roomTypeId}/rooms`, withAuth(token));
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
    const res = await api.get(`/partner/inventory/rooms/${roomUnitId}/calendar`, withAuth(token));
    setCalendar(res.data?.data || null);
  };

  const matrixDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date.toISOString().slice(0, 10);
    });
  }, []);

  const loadMatrix = async () => {
    if (!token || rooms.length === 0) {
      setMatrixData({});
      return;
    }
    try {
      setMatrixLoading(true);
      const from = matrixDays[0];
      const toDate = new Date(matrixDays[matrixDays.length - 1]);
      toDate.setDate(toDate.getDate() + 1);
      const to = toDate.toISOString().slice(0, 10);
      const entries = await Promise.all(
        rooms.map(async (room) => {
          const res = await api.get(`/partner/inventory/rooms/${room._id}/calendar`, {
            ...withAuth(token),
            params: { from, to },
          });
          return [room._id, res.data?.data || null] as const;
        })
      );
      setMatrixData(Object.fromEntries(entries));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load calendar matrix');
      setMatrixData({});
    } finally {
      setMatrixLoading(false);
    }
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
    const unsub = subscribeAppEvent('listing:changed', () => {
      // Clear any cached listings and reload hotels/room types if needed.
      clearSessionCache('vvs_partner_my_listings_all');
      void loadHotels();
      if (selectedHotelId) void loadRoomTypes(selectedHotelId);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedHotelId]);

  useEffect(() => {
    if (!selectedHotelId) return;
    (async () => {
      try { await loadRoomTypes(selectedHotelId); }
      catch (e: unknown) { toast.error(getApiErrorMessage(e, 'Failed to load room types')); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHotelId, token]);

  useEffect(() => {
    if (!selectedRoomTypeId) return;
    (async () => {
      try { await loadRooms(selectedRoomTypeId); }
      catch (e: unknown) { toast.error(getApiErrorMessage(e, 'Failed to load rooms')); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomTypeId, token]);

  useEffect(() => {
    if (!selectedRoomUnitId) return;
    void loadCalendar(selectedRoomUnitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomUnitId, token]);

  useEffect(() => {
    void loadMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, token]);

  const getRoomDayState = (roomId: string, date: string) => {
    const data = matrixData[roomId] || {};
    const dayStart = new Date(`${date}T00:00:00.000Z`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const booking = (data.bookings || []).find((bk: any) => {
      const checkIn = new Date(bk.checkIn).getTime();
      const checkOut = new Date(bk.checkOut).getTime();
      return checkIn < dayEnd && checkOut > dayStart;
    });
    if (booking) return { status: 'booked', booking };
    const block = (data.blocks || []).find((b: any) => {
      const start = new Date(b.startDate).getTime();
      const end = new Date(b.endDate).getTime();
      return start < dayEnd && end > dayStart;
    });
    if (block) return { status: 'blocked', block };
    return { status: 'available' };
  };

  const resetRoomTypeForm = () => {
    setEditingRoomTypeId(null);
    setRtName('');
    setRtPrice(0);
    setRtMaxAdults(2);
    setRtMaxChildren(0);
    setRtPetsAllowed(false);
    setRtDescription('');
    setRtAmenities('');
    setRtImages([]);
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

  const resetRoomForm = () => {
    setEditingRoomUnitId(null);
    setRoomNumber('');
    setRoomFloor('');
    setRoomPetsOverride('inherit');
  };

  const submitRoomType = async () => {
    if (!token) return;
    if (!selectedHotelId) return toast.error('Select a property first');
    if (!rtName.trim()) return toast.error('Room type name is required');
    const isDharamshala = selectedHotel?.propertyType === 'dharamshala';
    if ((!isDharamshala && (!rtPrice || rtPrice <= 0)) || rtPrice < 0) {
      return toast.error(isDharamshala ? 'Enter 0 or more for reference price' : 'Price per night is required');
    }

    try {
      if (editingRoomTypeId) {
        const res = await api.put(
          `/partner/inventory/room-types/${editingRoomTypeId}`,
          {
            name: rtName.trim(),
            description: rtDescription.trim(),
            amenities: rtAmenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            images: rtImages,
            pricePerNight: isDharamshala ? Math.max(0, rtPrice) : rtPrice,
            maxAdults: rtMaxAdults,
            maxChildren: rtMaxChildren,
            petsAllowed: rtPetsAllowed,
          },
          withAuth(token)
        );
        const updated = res.data?.data;
        setRoomTypes((prev) => prev.map((x) => (x._id === updated?._id ? updated : x)));
        toast.success('Room type updated');
        publishAppEvent('listing:changed');
      } else {
        const res = await api.post(
          `/partner/inventory/hotels/${selectedHotelId}/room-types`,
          {
            name: rtName.trim(),
            description: rtDescription.trim(),
            amenities: rtAmenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            images: rtImages,
            pricePerNight: isDharamshala ? Math.max(0, rtPrice) : rtPrice,
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
        publishAppEvent('listing:changed');
      }
      resetRoomTypeForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Save failed');
    }
  };

  const editRoomType = (rt: RoomType) => {
    setEditingRoomTypeId(rt._id);
    setRtName(rt.name || '');
    setRtPrice(Number(rt.pricePerNight || 0));
    setRtMaxAdults(Number(rt.maxAdults || 2));
    setRtMaxChildren(Number(rt.maxChildren || 0));
    setRtPetsAllowed(Boolean(rt.petsAllowed));
    setRtDescription(String(rt.description || ''));
    setRtAmenities(Array.isArray(rt.amenities) ? rt.amenities.join(', ') : '');
    setRtImages(Array.isArray(rt.images) ? rt.images : []);
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
      publishAppEvent('listing:changed');
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
        publishAppEvent('listing:changed');
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
        publishAppEvent('listing:changed');
      }
      resetRoomForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Save failed');
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
      publishAppEvent('listing:changed');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  const createBlock = async () => {
    if (!token) return;
    if (blockScope === 'room' && !selectedRoomUnitId) return toast.error('Select a room first');
    if (blockScope === 'room_type' && !selectedRoomTypeId) return toast.error('Select a room type first');
    if (!blockStart || !blockEnd) return toast.error('Start and end dates are required');
    const payloadKind = blockKind === 'available' ? 'available' : blockKind === 'closed' ? 'closed' : 'unavailable';
    try {
      const endpoint =
        blockScope === 'room_type'
          ? `/partner/inventory/room-types/${selectedRoomTypeId}/blocks`
          : `/partner/inventory/rooms/${selectedRoomUnitId}/blocks`;
      const res = await api.post(
        endpoint,
        { kind: payloadKind, reason: blockKind, startDate: blockStart, endDate: blockEnd },
        withAuth(token)
      );
      toast.success(res.data?.message || (blockKind === 'available' ? 'Marked available' : 'Blocked'));
      publishAppEvent('listing:changed');
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
      publishAppEvent('listing:changed');
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
          <label className="font-body text-xs text-muted-foreground">Property</label>
          <select
            value={selectedHotelId}
            onChange={(e) => setSelectedHotelId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
          >
            <option value="">Select property</option>
            {hotels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}{h.propertyType === 'dharamshala' ? ' - Dharamshala' : ' - Hotel'}
                {h.approvalStatus ? ` • ${h.approvalStatus}` : ''}
                {h.status ? ` • ${h.status}` : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedHotel && (
          <div className="text-xs font-body text-muted-foreground">
            Selected: <span className="text-foreground font-medium">{selectedHotel.name}</span>
            <span className="ml-1 capitalize">({selectedHotel.propertyType || 'hotel'})</span>
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
            <div className="md:col-span-2">
              <label className="font-body text-xs text-muted-foreground">Description (optional)</label>
              <textarea value={rtDescription} onChange={(e) => setRtDescription(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm min-h-[88px]" />
            </div>
            <div className="md:col-span-2">
              <label className="font-body text-xs text-muted-foreground">Amenities (comma separated)</label>
              <input value={rtAmenities} onChange={(e) => setRtAmenities(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm" />
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
            <div className="md:col-span-2">
              <label className="font-body text-xs text-muted-foreground">Photos (room type)</label>
              <input type="file" accept="image/*" multiple onChange={onRoomTypeImagesChange} className="mt-1 w-full font-body text-xs" />
              {rtImages.length > 0 && (
                <div className="mt-2 grid grid-cols-6 gap-2">
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
              {rtImages.length > 0 && <p className="font-body text-[11px] text-muted-foreground mt-1">Click a thumbnail to remove.</p>}
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
                      {selectedHotel?.propertyType === 'dharamshala' ? 'Enquiry only' : `Rs. ${Number(rt.pricePerNight || 0).toLocaleString('en-IN')}`} - Adults {rt.maxAdults} - Children {rt.maxChildren}
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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-base font-semibold">Inventory Calendar Matrix</h3>
            <p className="font-body text-xs text-muted-foreground">Date-wise room occupancy for the next 14 days.</p>
          </div>
          <button onClick={loadMatrix} className="rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
            {matrixLoading ? 'Refreshing...' : 'Refresh Matrix'}
          </button>
        </div>

        {!selectedRoomType ? (
          <p className="font-body text-sm text-muted-foreground">Select a room type to view the occupancy matrix.</p>
        ) : rooms.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">Add room numbers to view date-wise occupancy.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid gap-1" style={{ gridTemplateColumns: `110px repeat(${matrixDays.length}, minmax(44px, 1fr))` }}>
                <div className="rounded-md bg-muted px-2 py-2 font-body text-xs font-bold text-muted-foreground">Room</div>
                {matrixDays.map((date) => (
                  <div key={date} className="rounded-md bg-muted px-1 py-2 text-center font-body text-[10px] font-bold text-muted-foreground">
                    {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                ))}
                {rooms.map((room) => (
                  <div key={room._id} className="contents">
                    <div className="rounded-md border border-border bg-background px-2 py-2 font-body text-xs font-semibold text-foreground">
                      {room.number}
                    </div>
                    {matrixDays.map((date) => {
                      const state = getRoomDayState(room._id, date);
                      const isBooked = state.status === 'booked';
                      const isBlocked = state.status === 'blocked';
                      return (
                        <button
                          key={`${room._id}-${date}`}
                          type="button"
                          onClick={() => {
                            if (isBooked) setSelectedDayDetails({ room, date, booking: state.booking });
                          }}
                          className={`min-h-10 rounded-md border text-[10px] font-bold transition ${
                            isBooked
                              ? 'border-red-200 bg-red-100 text-red-700 hover:bg-red-200'
                              : isBlocked
                                ? 'border-amber-200 bg-amber-100 text-amber-700'
                                : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                          }`}
                          title={isBooked ? 'Booked - click for details' : isBlocked ? 'Blocked' : 'Available'}
                        >
                          {isBooked ? 'Red' : isBlocked ? 'Hold' : 'Green'}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedDayDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
              <h3 className="font-heading text-xl font-semibold text-foreground">Booking Details</h3>
              <p className="font-body text-xs text-muted-foreground">Room {selectedDayDetails.room.number} - {selectedDayDetails.date}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 font-body text-sm">
                <div><span className="text-muted-foreground">Customer:</span> {selectedDayDetails.booking.customerFullName || selectedDayDetails.booking.userName || '-'}</div>
                <div><span className="text-muted-foreground">Contact:</span> {selectedDayDetails.booking.customerMobile || selectedDayDetails.booking.userPhone || '-'}</div>
                <div><span className="text-muted-foreground">Remaining Cash Balance:</span> Rs. {Number(selectedDayDetails.booking.balanceAmount || 0).toLocaleString('en-IN')}</div>
                <div><span className="text-muted-foreground">Payment Verification:</span> {selectedDayDetails.booking.verificationStage || selectedDayDetails.booking.paymentStatus || '-'}</div>
                <div><span className="text-muted-foreground">Booking ID:</span> {selectedDayDetails.booking.bookingId}</div>
              </div>
              <div className="mt-5 text-right">
                <button onClick={() => setSelectedDayDetails(null)} className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>

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
              <button onClick={() => loadCalendar(selectedRoomUnitId)} className="w-full py-2 rounded-lg border border-border font-body text-sm hover:bg-muted">
                Refresh Calendar
              </button>

              <div className="border border-border rounded-lg p-3 bg-background">
                <h4 className="font-body text-sm font-semibold mb-2">Add Block</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Scope</label>
                    <select value={blockScope} onChange={(e) => setBlockScope(e.target.value as BlockScope)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
                      <option value="room">Selected room number only</option>
                      <option value="room_type">Entire selected room type</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground">Type</label>
                    <select value={blockKind} onChange={(e) => setBlockKind(e.target.value as BlockKind)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
                      <option value="available">Available</option>
                      <option value="offline_booking">Offline booking</option>
                      <option value="unavailable">Unavailable</option>
                      <option value="closed">Closed</option>
                    </select>
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
                <button
                  onClick={createBlock}
                  disabled={blockScope === 'room' ? !selectedRoomUnitId : !selectedRoomTypeId}
                  className={`mt-3 w-full py-2 rounded-lg font-body text-sm font-semibold disabled:opacity-50 ${blockKind === 'available' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-destructive text-destructive-foreground'}`}
                >
                  {blockKind === 'available'
                    ? (blockScope === 'room_type' ? 'Set Room Type Available' : 'Set Room Available')
                    : (blockScope === 'room_type' ? 'Block Room Type' : 'Block Room Dates')}
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
                            {String(b.startDate).slice(0, 10)} → {String(b.endDate).slice(0, 10)}
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
