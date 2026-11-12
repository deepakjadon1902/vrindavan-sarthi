import { useEffect, useState } from 'react';
import {
  RotateCcw, Search, CheckCircle2, Clock, AlertTriangle, FileText,
  DollarSign, Info, Eye, ArrowRight, ShieldCheck, Scale, AlertCircle
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type CancelledBooking = {
  _id: string;
  bookingId: string;
  displayBookingId?: string;
  bookingType: string;
  propertyName?: string;
  customerFullName?: string;
  customerMobile?: string;
  customerEmail?: string;
  totalAmount: number;
  amountPaidOnline: number;
  amountPayableAtProperty?: number;
  paymentOption?: string;
  paymentStatus: string;
  bookingStatus: string;
  cancellationReason?: string;
  cancellationDetails?: string;
  cancelledAt?: string;
  cancelledByRole?: string;
  cancelledByName?: string;
  refundableAmount?: number;
  cancellationDeductionAmount?: number;
  cancellationDeductionPercent?: number;
  cancellationResponsibility?: string;
  cancellationExplanation?: string;
  cancellationFaultOverrideReason?: string;
  cancellationPolicySnapshot?: {
    policyType?: string;
    policyName?: string;
    policyVersion?: number;
    isCustom?: boolean;
    tiers?: Array<{ hoursBeforeCheckIn: number; refundPercent: number; description?: string }>;
    disclaimer?: string;
  };
  dharamshalaFeeSnapshot?: {
    fee?: number;
    version?: number;
  };
  refundStatus?: string;
  refundProviderReference?: string;
  refundProcessedAt?: string;
};

const formatCurrency = (val?: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;
const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

const AdminCancellations = () => {
  const token = useAuthStore((s) => s.token);
  const [bookings, setBookings] = useState<CancelledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<CancelledBooking | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fault Reclassification State
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideResponsibility, setOverrideResponsibility] = useState('hotel_fault');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  const fetchCancellations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/bookings/admin/cancellations', {
        ...withAuth(token),
        params: { q: search, status: statusFilter },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setBookings(res.data.data);
      }
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCancellations();
  }, [token, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchCancellations();
  };

  const handleSimulateRefund = async (booking: CancelledBooking) => {
    if (!token) return;
    setSimulatingId(booking._id);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.post(
        `/bookings/admin/cancellations/${booking._id}/simulate-refund`,
        { amount: booking.refundableAmount },
        withAuth(token)
      );
      if (res.data?.success) {
        setSuccessMessage(`Refund of ${formatCurrency(booking.refundableAmount)} simulated successfully for PNR ${booking.bookingId}.`);
        await fetchCancellations();
        if (selectedBooking?._id === booking._id) {
          setSelectedBooking({ ...selectedBooking, refundStatus: 'processed', refundProviderReference: res.data?.data?.refundProviderReference });
        }
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to simulate refund');
    } finally {
      setSimulatingId(null);
    }
  };

  const handleOverrideFault = async () => {
    if (!selectedBooking || !token) return;
    if (!overrideReason.trim()) {
      setErrorMessage('A mandatory justification reason is required to reclassify fault responsibility.');
      return;
    }

    setOverrideLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.put(
        `/bookings/admin/cancellations/${selectedBooking._id}/override-fault`,
        {
          responsibility: overrideResponsibility,
          reason: overrideReason,
        },
        withAuth(token)
      );

      if (res.data?.success) {
        setSuccessMessage(`Fault responsibility updated to "${overrideResponsibility}". Refund recalculated.`);
        setShowOverrideForm(false);
        setOverrideReason('');
        setSelectedBooking(res.data.data);
        await fetchCancellations();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to reclassify fault responsibility');
    } finally {
      setOverrideLoading(false);
    }
  };

  const getResponsibilityBadge = (resp?: string) => {
    switch (resp) {
      case 'hotel_fault':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Hotel Fault</span>;
      case 'platform_fault':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Platform Fault</span>;
      case 'system_technical':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">System Technical</span>;
      case 'administrative':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Administrative Override</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">Customer Voluntary</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-brand-crimson" />
            Cancellations &amp; Refund Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage cancelled reservations, inspect booking-time policy snapshots, reclassify fault responsibility, and simulate refunds in staging.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search PNR, customer, phone, or property..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90">
            Search
          </button>
        </form>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Cancellations' },
            { id: 'pending', label: 'Refund Pending' },
            { id: 'processed', label: 'Refund Processed' },
            { id: 'not_required', label: 'Non-Refundable (₹0)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === tab.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">PNR / Type</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Property</th>
                <th className="p-3">Fault Category</th>
                <th className="p-3">Amount Paid</th>
                <th className="p-3">Calculated Refund</th>
                <th className="p-3">Refund Status</th>
                <th className="p-3">Cancelled At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Loading cancelled reservations...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No cancelled bookings found matching criteria.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">
                      <span className="font-mono font-bold text-brand-crimson">{b.bookingId}</span>
                      <span className="block text-[10px] text-muted-foreground capitalize">{b.bookingType}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">{b.customerFullName || '-'}</span>
                      <span className="block text-[10px] text-muted-foreground">{b.customerMobile || '-'}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">{b.propertyName || 'Property'}</span>
                      <span className="block text-[10px] text-muted-foreground capitalize">
                        {b.paymentOption === 'advance_30' ? '30% Advance' : 'Full Online'}
                      </span>
                    </td>
                    <td className="p-3">
                      {getResponsibilityBadge(b.cancellationResponsibility)}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {formatCurrency(b.amountPaidOnline)}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold ${Number(b.refundableAmount || 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {formatCurrency(b.refundableAmount)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        b.refundStatus === 'processed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : Number(b.refundableAmount || 0) > 0
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {b.refundStatus === 'processed' ? 'Processed' : Number(b.refundableAmount || 0) > 0 ? 'Action Required' : '₹0 Retained'}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {formatDate(b.cancelledAt)}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="px-2.5 py-1 text-xs border border-border hover:bg-muted rounded-md transition-colors font-medium"
                      >
                        Inspect
                      </button>
                      {Number(b.refundableAmount || 0) > 0 && b.refundStatus !== 'processed' && (
                        <button
                          onClick={() => void handleSimulateRefund(b)}
                          disabled={simulatingId === b._id}
                          className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md transition-colors"
                        >
                          {simulatingId === b._id ? 'Processing...' : 'Simulate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Inspection Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading font-bold text-foreground text-base">Reservation Cancellation Dossier</h3>
                <p className="text-xs text-muted-foreground font-mono">PNR: {selectedBooking.bookingId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setShowOverrideForm(false);
                }}
                className="text-muted-foreground hover:text-foreground text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Guest & Property */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Guest Name</span>
                  <span className="font-semibold text-foreground">{selectedBooking.customerFullName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Mobile Number</span>
                  <span className="font-semibold text-foreground">{selectedBooking.customerMobile || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Property</span>
                  <span className="font-semibold text-foreground">{selectedBooking.propertyName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Payment Mode</span>
                  <span className="font-semibold text-foreground capitalize">
                    {selectedBooking.paymentOption === 'advance_30' ? '30% Advance Online' : '100% Full Online'}
                  </span>
                </div>
              </div>

              {/* Policy Snapshot Information */}
              <div className="p-3 border border-border rounded-lg space-y-2 bg-stone-50/50">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-primary" />
                    Booking-Time Policy Snapshot
                  </span>
                  <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-mono">
                    v{selectedBooking.cancellationPolicySnapshot?.policyVersion || 1}
                  </span>
                </div>
                <div className="text-[11px] text-stone-700">
                  <p>
                    <strong>Policy Type:</strong>{' '}
                    {selectedBooking.cancellationPolicySnapshot?.policyName ||
                      (selectedBooking.paymentOption === 'advance_30' ? '30% Advance Booking Policy' : 'Platform Default Policy')}
                  </p>
                  {selectedBooking.cancellationPolicySnapshot?.disclaimer && (
                    <p className="text-stone-500 italic mt-1">{selectedBooking.cancellationPolicySnapshot.disclaimer}</p>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 border border-border rounded-lg space-y-2">
                <p className="font-bold text-foreground uppercase tracking-wider text-[11px]">Financial Settlement</p>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Total Booking Tariff:</span>
                  <span className="font-medium text-foreground">{formatCurrency(selectedBooking.totalAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Online Amount Paid:</span>
                  <span className="font-bold text-foreground">{formatCurrency(selectedBooking.amountPaidOnline)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Calculated Refundable Amount:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(selectedBooking.refundableAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Deduction / Platform Retention:</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(selectedBooking.cancellationDeductionAmount)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Refund Status:</span>
                  <span className="font-semibold capitalize text-foreground">{selectedBooking.refundStatus || 'pending'}</span>
                </div>
                {selectedBooking.refundProviderReference && (
                  <div className="flex justify-between py-1 text-[11px] text-muted-foreground">
                    <span>Provider Reference:</span>
                    <span className="font-mono text-foreground">{selectedBooking.refundProviderReference}</span>
                  </div>
                )}
              </div>

              {/* Fault Responsibility & Reclassification */}
              <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold block text-[11px]">Cancellation Responsibility</span>
                  {getResponsibilityBadge(selectedBooking.cancellationResponsibility)}
                </div>
                {selectedBooking.cancellationExplanation && (
                  <p className="text-foreground text-[11px] italic">"{selectedBooking.cancellationExplanation}"</p>
                )}
                {selectedBooking.cancellationFaultOverrideReason && (
                  <div className="text-[10px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                    <strong>Admin Override Note:</strong> {selectedBooking.cancellationFaultOverrideReason}
                  </div>
                )}

                {/* Toggle Override Form */}
                {selectedBooking.refundStatus !== 'processed' && (
                  <div className="pt-2 border-t border-border">
                    {!showOverrideForm ? (
                      <button
                        onClick={() => setShowOverrideForm(true)}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Reclassify Fault Responsibility (Admin Override)
                      </button>
                    ) : (
                      <div className="space-y-3 p-3 bg-white rounded-lg border border-primary/30 mt-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-stone-900 text-xs">Reclassify Cancellation Responsibility</h4>
                          <button
                            onClick={() => setShowOverrideForm(false)}
                            className="text-stone-400 hover:text-stone-600 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">New Responsibility</label>
                          <select
                            value={overrideResponsibility}
                            onChange={(e) => setOverrideResponsibility(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-xs bg-white"
                          >
                            <option value="hotel_fault">Hotel Fault (100% Online Refund)</option>
                            <option value="platform_fault">Platform Operational Failure (100% Online Refund)</option>
                            <option value="system_technical">System / Technical Gateway Glitch (100% Online Refund)</option>
                            <option value="administrative">Administrative Approval</option>
                            <option value="customer_voluntary">Customer Voluntary (Apply Snapshot Policy)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Mandatory Justification Reason <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            placeholder="Specify reason for reclassifying responsibility (e.g. Hotel overbooked, guest turned away)..."
                            className="w-full px-2 py-1 border rounded text-xs"
                            rows={2}
                          />
                        </div>
                        <button
                          onClick={handleOverrideFault}
                          disabled={overrideLoading}
                          className="w-full py-1.5 bg-primary text-white font-bold text-xs rounded hover:bg-primary/90 transition"
                        >
                          {overrideLoading ? 'Applying...' : 'Apply & Recalculate Refund'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setShowOverrideForm(false);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-xs font-medium"
              >
                Close
              </button>
              {Number(selectedBooking.refundableAmount || 0) > 0 && selectedBooking.refundStatus !== 'processed' && (
                <button
                  onClick={() => void handleSimulateRefund(selectedBooking)}
                  disabled={simulatingId === selectedBooking._id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  {simulatingId === selectedBooking._id ? 'Processing...' : 'Simulate Refund in Staging'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCancellations;
