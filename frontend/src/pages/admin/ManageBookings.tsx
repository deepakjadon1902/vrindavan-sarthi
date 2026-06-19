import { useBookingStore } from '@/store/bookingStore';
import { ClipboardList } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import BookingFormDetails from '@/components/BookingFormDetails';

const ManageBookings = () => {
  const token = useAuthStore((s) => s.token);
  const {
    adminBookings,
    fetchAllBookings,
    isLoading,
    verifyPayment,
    rejectPayment,
  } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed' | 'pending'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'room_type' | 'cab' | 'tour'>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBookingId, setAssignBookingId] = useState<string>('');
  const [cabs, setCabs] = useState<any[]>([]);
  const [selectedCabId, setSelectedCabId] = useState<string>('');
  const [expandedBookingId, setExpandedBookingId] = useState<string>('');

  useEffect(() => {
    void fetchAllBookings();
  }, [fetchAllBookings]);

  const loadCabs = async () => {
    if (!token) return;
    try {
      const res = await api.get('/cabs/all', withAuth(token));
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setCabs(list);
    } catch {
      setCabs([]);
    }
  };

  const bookings = useMemo(
    () => [...adminBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [adminBookings]
  );

  const filtered = bookings
    .filter((b) => filter === 'all' || b.bookingStatus === filter)
    .filter((b) => typeFilter === 'all' || b.bookingType === typeFilter);

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-brand-green/10 text-brand-green';
    if (s === 'cancelled') return 'bg-destructive/10 text-destructive';
    if (s === 'completed') return 'bg-brand-gold/10 text-brand-gold';
    return 'bg-muted text-muted-foreground';
  };

  const verificationBadge = (b: any) => {
    if (b.paymentMethod !== 'online') return null;
    const stage = b.verificationStage || 'pending_admin';
    if (stage === 'verified') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green">verified</span>;
    if (stage === 'rejected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">rejected</span>;
    if (stage === 'pending_partner') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-saffron/10 text-brand-saffron">partner pending</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">admin pending</span>;
  };

  const canAdminVerify = (b: any) =>
    b.paymentMethod === 'online' &&
    b.paymentStatus === 'pending' &&
    (b.partnerId ? b.partnerPaymentVerified === true : true) &&
    b.verificationStage !== 'verified' &&
    b.verificationStage !== 'rejected';
  const canAssignCab = (b: any) =>
    b.bookingType === 'cab' &&
    b.bookingStatus === 'pending' &&
    (b.paymentMethod !== 'online' || b.paymentStatus === 'paid');

  const handleVerify = async (id: string) => {
    const res = await verifyPayment(id);
    if (res.success) toast.success('Payment verified');
    else toast.error(res.error || 'Verify failed');
  };

  const handleReject = async (id: string) => {
    const res = await rejectPayment(id);
    if (res.success) toast.success('Payment rejected');
    else toast.error(res.error || 'Reject failed');
  };

  const openAssign = async (bookingId: string) => {
    setAssignBookingId(bookingId);
    setSelectedCabId('');
    setAssignOpen(true);
    await loadCabs();
  };

  const submitAssign = async () => {
    if (!token) return toast.error('Not authenticated');
    if (!assignBookingId || !selectedCabId) return toast.error('Select a cab');
    try {
      await api.put(`/bookings/${assignBookingId}/assign-cab`, { cabId: selectedCabId }, withAuth(token));
      toast.success('Cab assigned');
      setAssignOpen(false);
      setAssignBookingId('');
      setSelectedCabId('');
      void fetchAllBookings();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Assign failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(['all', 'confirmed', 'pending', 'cancelled', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${
              filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.bookingStatus === f).length})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'hotel', 'room', 'room_type', 'cab', 'tour'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${
              typeFilter === t ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading bookings…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Bookings</p>
          <p className="font-body text-sm text-muted-foreground">Bookings will appear here when users make reservations.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          {assignOpen && (
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="font-body text-sm text-muted-foreground">Assign cab for booking</div>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedCabId}
                    onChange={(e) => setSelectedCabId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-card font-body text-sm"
                  >
                    <option value="">Select cab</option>
                    {cabs.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.vehicleName} ({c.vehicleType}) - {c.driverName}
                      </option>
                    ))}
                  </select>
                  <button onClick={submitAssign} className="px-3 py-2 rounded-lg text-xs font-body bg-brand-green text-primary-foreground">
                    Assign
                  </button>
                  <button
                    onClick={() => {
                      setAssignOpen(false);
                      setAssignBookingId('');
                      setSelectedCabId('');
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-body border border-border"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Booking ID</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">User</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Total Amount</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Payment</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Partner</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <Fragment key={b.id}>
                <tr className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-xs text-brand-crimson font-medium">{b.bookingId}</td>
                  <td className="px-4 py-3">
                    <span className="font-body text-xs bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground max-w-[240px]">
                    <div className="truncate">{b.itemName}</div>
                    {b.bookingType === 'cab' && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {b.pickupDate} {b.pickupTime} • {b.guests || 1} passengers • {b.tollOption === 'included' ? 'Tolls included' : 'Tolls excluded'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">
                    <div>{b.customerFullName || b.userName}</div>
                    <div className="text-[11px]">{b.customerMobile || b.userPhone}</div>
                  </td>
                  <td className="px-4 py-3 font-body text-sm font-semibold text-foreground">
                    Rs. {Number(b.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground">
                    {b.paymentMethod === 'doorstep' ? 'Doorstep' : `UPI ${b.paymentStatus}`}
                    <span className="ml-2 inline-flex">{verificationBadge(b)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${statusColor(b.bookingStatus)}`}>{b.bookingStatus}</span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{b.partnerName || 'Admin'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => setExpandedBookingId((current) => (current === b.id ? '' : b.id))}
                      className="px-3 py-1.5 rounded-lg text-xs font-body border border-border hover:bg-muted"
                    >
                      {expandedBookingId === b.id ? 'Hide Details' : 'View Details'}
                    </button>
                    {canAssignCab(b) ? (
                      <button
                        onClick={() => void openAssign(b.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-body bg-brand-gold text-foreground hover:bg-brand-gold/90"
                      >
                        Assign Driver
                      </button>
                    ) : b.paymentMethod === 'online' ? (
                      canAdminVerify(b) ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerify(b.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-body bg-brand-green text-primary-foreground hover:bg-brand-green/90"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleReject(b.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-body bg-destructive text-primary-foreground hover:bg-destructive/90"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="font-body text-[11px] text-muted-foreground">
                          {b.verificationStage === 'pending_partner' ? 'Waiting partner verification' : ''}
                        </span>
                      )
                    ) : (
                      <span className="font-body text-[11px] text-muted-foreground">-</span>
                    )}
                    </div>
                  </td>
                </tr>
                {expandedBookingId === b.id && (
                  <tr key={`${b.id}-details`} className="border-b border-border">
                    <td colSpan={9} className="px-4 pb-4">
                      <BookingFormDetails booking={b} viewer="admin" />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManageBookings;
