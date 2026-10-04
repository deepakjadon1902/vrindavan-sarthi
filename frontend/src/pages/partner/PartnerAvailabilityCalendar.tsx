import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPropertyTypeLabel, type StayPropertyType } from '@/lib/propertyTypes';
import { formatBookingStatus } from '@/lib/bookingStatus';
import { getApiErrorMessage } from '@/lib/apiError';

type DayStatus = 'available' | 'booked' | 'blocked';

type CalendarDay = {
  date: string;
  status: DayStatus;
  booking?: {
    _id: string;
    bookingId: string;
    bookingStatus: string;
    paymentStatus?: string;
    verificationStage?: string;
    checkIn?: string;
    checkOut?: string;
    customerFullName?: string;
    userName?: string;
    customerMobile?: string;
    userPhone?: string;
    totalAdults?: number;
    totalChildren?: number;
    balanceAmount?: number;
  } | null;
  block?: {
    _id: string;
    kind?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
  };
};

type Room = {
  _id: string;
  number: string;
  floor?: string;
  status?: string;
  calendar: CalendarDay[];
};

type RoomType = {
  _id: string;
  name: string;
  status?: string;
  pricePerNight?: number;
  rooms: Room[];
};

type Hotel = {
  _id: string;
  name: string;
  propertyType?: StayPropertyType;
  approvalStatus?: string;
  status?: string;
  roomTypes: RoomType[];
};

type CalendarResponse = {
  from: string;
  to: string;
  days: string[];
  hotels: Hotel[];
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit' });

const formatWeekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

const formatRangeDate = (date?: string) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const formatMonthLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const formatFullCalendarDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BLOCK_REASONS = [
  { value: 'offline_booking', label: 'Offline booking' },
  { value: 'room_full', label: 'Room full' },
  { value: 'currently_not_available', label: 'Currently not available' },
  { value: 'room_not_available', label: 'Room not available' },
] as const;

const PartnerAvailabilityCalendar = () => {
  const token = useAuthStore((s) => s.token);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [rangeStart, setRangeStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return toDateKey(startOfMonth(today));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ hotel: Hotel; roomType: RoomType; room: Room; day: CalendarDay } | null>(null);
  const [blockReason, setBlockReason] = useState<(typeof BLOCK_REASONS)[number]['value']>('offline_booking');
  const [actionLoading, setActionLoading] = useState<'room' | 'room_type' | 'available' | ''>('');

  const selectedHotel = useMemo(
    () => hotels.find((hotel) => hotel._id === selectedHotelId) || hotels[0] || null,
    [hotels, selectedHotelId]
  );

  const roomTotals = useMemo(() => {
    const allRooms = (selectedHotel?.roomTypes || []).flatMap((roomType) => roomType.rooms || []);
    const bookedToday = allRooms.filter((room) => {
      const today = toDateKey(new Date());
      return room.calendar.some((day) => day.date === today && day.status === 'booked');
    }).length;
    return { total: allRooms.length, bookedToday, availableToday: Math.max(0, allRooms.length - bookedToday) };
  }, [selectedHotel]);

  const calendarSlots = useMemo(() => {
    if (days.length === 0) return [];
    const firstDay = new Date(`${days[0]}T00:00:00`).getDay();
    const slots: Array<string | null> = [...Array(firstDay).fill(null), ...days];
    while (slots.length % 7 !== 0) slots.push(null);
    return slots;
  }, [days]);

  const loadCalendar = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const from = rangeStart;
      const to = toDateKey(addMonths(new Date(`${rangeStart}T00:00:00`), 1));
      const res = await api.get('/partner/inventory/availability-calendar', {
        ...withAuth(token),
        params: { from, to },
      });
      const data = (res.data?.data || {}) as CalendarResponse;
      setHotels(Array.isArray(data.hotels) ? data.hotels : []);
      setDays(Array.isArray(data.days) ? data.days : []);
      if (!selectedHotelId && data.hotels?.[0]?._id) setSelectedHotelId(data.hotels[0]._id);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load availability calendar'));
      setHotels([]);
      setDays([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rangeStart, selectedHotelId]);

  const moveRange = (monthsToMove: number) => {
    setRangeStart((current) => toDateKey(startOfMonth(addMonths(new Date(`${current}T00:00:00`), monthsToMove))));
  };

  const cellClass = (status: DayStatus) => {
    if (status === 'booked') return 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200';
    if (status === 'blocked') return 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200';
    return 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
  };

  const cellLabel = (room: Room, day: CalendarDay) => {
    if (day.status === 'booked') return `${room.number} Booked`;
    if (day.status === 'blocked') return `${room.number} Blocked`;
    return `${room.number} Available`;
  };

  const getRoomDay = (room: Room, date: string) =>
    room.calendar.find((day) => day.date === date) || { date, status: 'available' as DayStatus };

  const getRoomTypeCounts = (roomType: RoomType) => {
    let booked = 0;
    let blocked = 0;
    let available = 0;
    for (const room of roomType.rooms) {
      for (const day of room.calendar) {
        if (day.status === 'booked') booked += 1;
        else if (day.status === 'blocked') blocked += 1;
        else available += 1;
      }
    }
    return { booked, blocked, available };
  };

  const selectedEndDate = selectedDay ? toDateKey(addDays(new Date(`${selectedDay.day.date}T00:00:00`), 1)) : '';

  const blockSelectedDate = async (scope: 'room' | 'room_type') => {
    if (!token || !selectedDay) return;
    if (selectedDay.day.status === 'booked') {
      toast.error('This date already has an online booking. It cannot be manually blocked.');
      return;
    }
    try {
      setActionLoading(scope);
      const endpoint = scope === 'room'
        ? `/partner/inventory/rooms/${selectedDay.room._id}/blocks`
        : `/partner/inventory/room-types/${selectedDay.roomType._id}/blocks`;
      const res = await api.post(
        endpoint,
        {
          kind: 'unavailable',
          reason: blockReason,
          startDate: selectedDay.day.date,
          endDate: selectedEndDate,
        },
        withAuth(token)
      );
      toast.success(res.data?.message || (scope === 'room' ? 'Room blocked for this date' : 'Room type blocked for this date'));
      setSelectedDay(null);
      await loadCalendar();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not block this date'));
    } finally {
      setActionLoading('');
    }
  };

  const markSelectedAvailable = async () => {
    if (!token || !selectedDay) return;
    try {
      setActionLoading('available');
      const res = await api.post(
        `/partner/inventory/rooms/${selectedDay.room._id}/blocks`,
        {
          kind: 'available',
          startDate: selectedDay.day.date,
          endDate: selectedEndDate,
        },
        withAuth(token)
      );
      toast.success(res.data?.message || 'Room marked available for this date');
      setSelectedDay(null);
      await loadCalendar();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not mark this room available'));
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Availability Calendar</h2>
          <p className="font-body text-xs text-muted-foreground">
            Live room-number availability from booking inventory and manual blocks.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
          <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-2 text-center">
            <div className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">Showing Month</div>
            <div className="font-heading text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {formatMonthLabel(rangeStart)}
            </div>
          </div>
          <button onClick={() => moveRange(-1)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
            <ChevronLeft size={14} /> Previous
          </button>
          <button onClick={() => moveRange(1)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
            Next <ChevronRight size={14} />
          </button>
          <button onClick={loadCalendar} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-brand-gold px-3 py-2 font-body text-xs font-semibold text-foreground hover:bg-brand-gold/90">
            <RefreshCw size={14} /> {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label className="font-body text-xs text-muted-foreground">Property</label>
          <select
            value={selectedHotelId}
            onChange={(event) => setSelectedHotelId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm"
          >
            {hotels.length === 0 && <option value="">No property found</option>}
            {hotels.map((hotel) => (
              <option key={hotel._id} value={hotel._id}>
                {hotel.name} - {getPropertyTypeLabel(hotel.propertyType || 'hotel')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="font-heading text-lg font-semibold">{roomTotals.total}</div>
            <div className="font-body text-[10px] text-muted-foreground">Rooms</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            <div className="font-heading text-lg font-semibold">{roomTotals.availableToday}</div>
            <div className="font-body text-[10px]">Green Today</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
            <div className="font-heading text-lg font-semibold">{roomTotals.bookedToday}</div>
            <div className="font-body text-[10px]">Red Today</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 font-body text-xs">
        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-emerald-800">Green: available</span>
        <span className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-red-800">Red: booked with room number</span>
        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-amber-800">Amber: manually blocked</span>
      </div>

      {isLoading && hotels.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center font-body text-sm text-muted-foreground">
          Loading availability calendar...
        </div>
      ) : !selectedHotel ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CalendarDays size={42} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-heading text-lg text-foreground">No hotel found</p>
          <p className="font-body text-sm text-muted-foreground">Your submitted property will appear here after it exists in My Hotels.</p>
        </div>
      ) : selectedHotel.roomTypes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CalendarDays size={42} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-heading text-lg text-foreground">No room types yet</p>
          <p className="font-body text-sm text-muted-foreground">Add room types and room numbers from Inventory to show availability.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {selectedHotel.roomTypes.map((roomType) => (
            <section key={roomType._id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-3 border-b border-border bg-muted/25 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">{roomType.name}</h3>
                  <p className="font-body text-xs text-muted-foreground">
                    {roomType.rooms.length} room number(s)
                    {roomType.pricePerNight ? ` - Rs. ${Number(roomType.pricePerNight).toLocaleString('en-IN')} per night` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const counts = getRoomTypeCounts(roomType);
                    return (
                      <>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-medium text-emerald-800">{counts.available} available nights</span>
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-body text-[11px] font-medium text-red-800">{counts.booked} booked nights</span>
                        {counts.blocked > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-body text-[11px] font-medium text-amber-800">{counts.blocked} blocked nights</span>}
                      </>
                    );
                  })()}
                  <span className="rounded-full bg-background px-2.5 py-1 font-body text-[11px] capitalize text-muted-foreground">
                    {roomType.status || 'active'}
                  </span>
                </div>
              </div>

              {roomType.rooms.length === 0 ? (
                <p className="m-4 rounded-lg border border-border bg-background p-4 font-body text-sm text-muted-foreground">
                  No room numbers added for this room type.
                </p>
              ) : (
                <div className="p-3 sm:p-4">
                  <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-center md:hidden">
                    <div className="font-heading text-lg font-semibold text-foreground">{formatMonthLabel(rangeStart)}</div>
                    <div className="font-body text-[11px] text-muted-foreground">Room-wise daily availability</div>
                  </div>

                  <div className="hidden grid-cols-7 overflow-hidden rounded-lg border border-border bg-border md:grid">
                    {WEEKDAYS.map((weekday) => (
                      <div key={weekday} className="bg-muted px-2 py-2 text-center font-body text-xs font-bold text-muted-foreground">
                        {weekday}
                      </div>
                    ))}
                    {calendarSlots.map((date, index) => (
                      <div
                        key={date || `empty-${index}`}
                        className={`min-h-[132px] bg-background p-2 ${date ? '' : 'bg-muted/25'} border-t border-border ${index % 7 === 0 ? '' : 'border-l'}`}
                      >
                        {date && (
                          <>
                            <div className="mb-2 flex items-start justify-between gap-1">
                              <div>
                                <div className="font-heading text-base font-semibold leading-none text-foreground">{formatDay(date)}</div>
                                <div className="mt-0.5 font-body text-[10px] font-medium text-muted-foreground">{formatWeekday(date)}</div>
                              </div>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 font-body text-[9px] text-muted-foreground">
                                {roomType.rooms.length}
                              </span>
                            </div>
                            <div className="max-h-[86px] space-y-1 overflow-y-auto pr-0.5">
                              {roomType.rooms.map((room) => {
                                const day = getRoomDay(room, date);
                                return (
                                  <button
                                    key={`${room._id}-${date}`}
                                    type="button"
                                    onClick={() => setSelectedDay({ hotel: selectedHotel, roomType, room, day })}
                                    className={`flex min-h-7 w-full items-center justify-between gap-1 rounded-md border px-2 py-1 text-left font-body text-[10px] font-bold leading-tight transition ${cellClass(day.status)}`}
                                    title={`${room.number} - ${date} - ${day.status}`}
                                  >
                                    <span className="min-w-0 truncate">{cellLabel(room, day)}</span>
                                    {day.status === 'booked' && day.booking?.bookingId ? (
                                      <span className="shrink-0 truncate text-[9px] font-medium">{day.booking.bookingId}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 md:hidden">
                    {days.map((date) => (
                      <div key={date} className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-heading text-base font-semibold leading-tight text-foreground">
                              {formatFullCalendarDate(date)}
                            </div>
                            <div className="mt-0.5 font-body text-[11px] text-muted-foreground">
                              {roomType.name} - {roomType.rooms.length} room number(s)
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-1 font-body text-[10px] text-muted-foreground">
                            {formatDay(date)}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {roomType.rooms.map((room) => {
                            const day = getRoomDay(room, date);
                            return (
                              <button
                                key={`${room._id}-mobile-${date}`}
                                type="button"
                                onClick={() => setSelectedDay({ hotel: selectedHotel, roomType, room, day })}
                                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left font-body text-xs font-bold transition ${cellClass(day.status)}`}
                                title={`${room.number} - ${date} - ${day.status}`}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate">Room {room.number}</span>
                                  <span className="block text-[10px] font-medium capitalize opacity-80">
                                    {day.status}
                                    {room.floor ? ` - Floor ${room.floor}` : ''}
                                  </span>
                                </span>
                                {day.status === 'booked' && day.booking?.bookingId ? (
                                  <span className="shrink-0 rounded bg-white/50 px-2 py-1 text-[10px] font-semibold">{day.booking.bookingId}</span>
                                ) : (
                                  <span className="shrink-0 rounded bg-white/50 px-2 py-1 text-[10px] font-semibold capitalize">{day.status}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="font-heading text-xl font-semibold text-foreground">Room {selectedDay.room.number}</h3>
            <p className="font-body text-xs text-muted-foreground">
              {selectedDay.hotel.name} - {selectedDay.roomType.name} - {formatRangeDate(selectedDay.day.date)}
            </p>

            <div className={`mt-4 rounded-lg border p-4 font-body text-sm ${cellClass(selectedDay.day.status)}`}>
              <div className="font-semibold capitalize">{selectedDay.day.status}</div>
              {selectedDay.day.status === 'booked' && selectedDay.day.booking ? (
                <div className="mt-3 space-y-2">
                  <div>Booking ID: {selectedDay.day.booking.bookingId}</div>
                  <div>Status: {formatBookingStatus(selectedDay.day.booking.bookingStatus)}</div>
                  <div>Guest: {selectedDay.day.booking.customerFullName || selectedDay.day.booking.userName || '-'}</div>
                  <div>Contact: {selectedDay.day.booking.customerMobile || selectedDay.day.booking.userPhone || '-'}</div>
                  <div>
                    Stay: {formatRangeDate(selectedDay.day.booking.checkIn)} to {formatRangeDate(selectedDay.day.booking.checkOut)}
                  </div>
                  <div>
                    Guests: Adults {selectedDay.day.booking.totalAdults ?? 0}, Children {selectedDay.day.booking.totalChildren ?? 0}
                  </div>
                  <div>Remaining cash balance: Rs. {Number(selectedDay.day.booking.balanceAmount || 0).toLocaleString('en-IN')}</div>
                </div>
              ) : selectedDay.day.status === 'blocked' ? (
                <div className="mt-3 space-y-2">
                  <div>Reason: {String(selectedDay.day.block?.reason || selectedDay.day.block?.kind || 'Blocked').replaceAll('_', ' ')}</div>
                  <div>
                    Block: {formatRangeDate(selectedDay.day.block?.startDate)} to {formatRangeDate(selectedDay.day.block?.endDate)}
                  </div>
                </div>
              ) : (
                <p className="mt-3">This room number is open for booking on this date.</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <h4 className="font-heading text-base font-semibold text-foreground">Partner Availability Control</h4>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Manual blocks sync with public booking availability for this date.
              </p>

              {selectedDay.day.status === 'booked' ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-xs text-red-800">
                  This room already has a booking on this date, so manual blocking is disabled.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="font-body text-xs font-semibold text-muted-foreground">Block reason</label>
                    <select
                      value={blockReason}
                      onChange={(event) => setBlockReason(event.target.value as typeof blockReason)}
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 font-body text-sm"
                      disabled={Boolean(actionLoading)}
                    >
                      {BLOCK_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>{reason.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => blockSelectedDate('room')}
                      disabled={Boolean(actionLoading)}
                      className="min-h-10 rounded-lg bg-amber-600 px-3 py-2 font-body text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                    >
                      {actionLoading === 'room' ? 'Blocking...' : `Block Room ${selectedDay.room.number}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => blockSelectedDate('room_type')}
                      disabled={Boolean(actionLoading)}
                      className="min-h-10 rounded-lg bg-red-600 px-3 py-2 font-body text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {actionLoading === 'room_type' ? 'Blocking...' : `Block ${selectedDay.roomType.name}`}
                    </button>
                  </div>

                  {selectedDay.day.status === 'blocked' && (
                    <button
                      type="button"
                      onClick={markSelectedAvailable}
                      disabled={Boolean(actionLoading)}
                      className="min-h-10 w-full rounded-lg bg-emerald-600 px-3 py-2 font-body text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {actionLoading === 'available' ? 'Updating...' : `Mark Room ${selectedDay.room.number} Available`}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 text-right">
              <button onClick={() => setSelectedDay(null)} disabled={Boolean(actionLoading)} className="rounded-lg border border-border px-4 py-2 font-body text-xs hover:bg-muted disabled:opacity-60">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerAvailabilityCalendar;
