import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Hotel, IndianRupee, Users, ClipboardList, CheckCircle2, Clock, XCircle,
  AlertTriangle, RotateCcw, Landmark, ShieldCheck, UserCheck, HelpCircle,
  TrendingUp, Calendar, ArrowRight, RefreshCw, FileText
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type DashboardKpiData = {
  period: string;
  dateRange: { start: string | null; end: string | null };
  properties: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
  };
  partners: {
    total: number;
    pending: number;
    verified: number;
  };
  customers: {
    total: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    checkedIn: number;
    completed: number;
    cancelled: number;
  };
  financials: {
    totalBookingValue: number;
    onlineCollections: number;
    deskCollections: number;
    platformCommission: number;
    partnerNetEntitlement: number;
    pendingPartnerRemittance: number;
    pendingRefundRequests: number;
    openComplaints: number;
  };
};

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'allTime', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const formatCurrency = (val?: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

const AdminDashboard = () => {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('allTime');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchKpis = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (period === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.get('/admin/dashboard-kpis', { ...withAuth(token), params });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKpis();
  }, [token, period]);

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      void fetchKpis();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Platform Command Center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Live operational metrics and financial equilibrium</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  period === p.id
                    ? 'bg-brand-crimson text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => void fetchKpis()}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <form onSubmit={handleCustomApply} className="flex flex-wrap items-center gap-3 bg-muted/40 p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
              required
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
              required
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1 bg-brand-crimson text-white text-xs font-semibold rounded hover:bg-brand-crimson/90 transition-colors"
          >
            Apply Range
          </button>
        </form>
      )}

      {/* Action Required Banner if pending items exist */}
      {data && (data.financials.pendingRefundRequests > 0 || data.financials.openComplaints > 0 || data.properties.pending > 0 || data.partners.pending > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Action Required Operations Pending</p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                {data.properties.pending} property approvals · {data.partners.pending} partner reviews · {data.financials.pendingRefundRequests} refund requests · {data.financials.openComplaints} open support cases
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.properties.pending > 0 && (
              <Link to="/admin/hotels" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline">
                Review Properties →
              </Link>
            )}
            {data.financials.pendingRefundRequests > 0 && (
              <Link to="/admin/cancellations" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline ml-2">
                Manage Refunds →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
      )}

      {/* Section 1: Financial Overview KPIs */}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <IndianRupee size={15} className="text-brand-crimson" /> Financial Performance & Collections
            </h3>
            <Link to="/admin/revenue" className="text-xs text-brand-crimson hover:underline flex items-center gap-1 font-medium">
              View Detailed Revenue <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Gross Booking Value</span>
              <span className="text-xl font-heading font-bold text-foreground mt-1 block">{formatCurrency(data.financials.totalBookingValue)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Tariff + Taxes across orders</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-emerald-500">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Online Collections</span>
              <span className="text-xl font-heading font-bold text-emerald-600 mt-1 block">{formatCurrency(data.financials.onlineCollections)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Captured via Razorpay</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-blue-500">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Desk Collections</span>
              <span className="text-xl font-heading font-bold text-blue-600 mt-1 block">{formatCurrency(data.financials.deskCollections)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Collected at Reception</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-brand-crimson">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Platform Commission</span>
              <span className="text-xl font-heading font-bold text-brand-crimson mt-1 block">{formatCurrency(data.financials.platformCommission)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Vrindavan Sarthi share</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Partner Net Entitlement</span>
              <span className="text-xl font-heading font-bold text-foreground mt-1 block">{formatCurrency(data.financials.partnerNetEntitlement)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Gross minus OTA commission</span>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-amber-500">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Pending Remittance</span>
              <span className="text-xl font-heading font-bold text-amber-600 mt-1 block">{formatCurrency(data.financials.pendingPartnerRemittance)}</span>
              <span className="text-[10px] text-muted-foreground mt-1 block">Due to hotel partners</span>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Booking State Machine Breakdown */}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ClipboardList size={15} className="text-brand-crimson" /> Booking Operations & Lifecycle
            </h3>
            <Link to="/admin/bookings" className="text-xs text-brand-crimson hover:underline flex items-center gap-1 font-medium">
              Manage All Bookings <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">Total Bookings</span>
              <span className="text-xl font-heading font-bold text-foreground mt-1 block">{data.bookings.total}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">In selected period</span>
            </div>

            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Pending</span>
                <Clock size={13} className="text-amber-500" />
              </div>
              <span className="text-xl font-heading font-bold text-amber-600 mt-1 block">{data.bookings.pending}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Awaiting review/hold</span>
            </div>

            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Confirmed</span>
                <CheckCircle2 size={13} className="text-emerald-500" />
              </div>
              <span className="text-xl font-heading font-bold text-emerald-600 mt-1 block">{data.bookings.confirmed}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Locked & paid</span>
            </div>

            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Checked-in</span>
                <Hotel size={13} className="text-blue-500" />
              </div>
              <span className="text-xl font-heading font-bold text-blue-600 mt-1 block">{data.bookings.checkedIn}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Currently in-house</span>
            </div>

            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Completed</span>
                <ShieldCheck size={13} className="text-indigo-500" />
              </div>
              <span className="text-xl font-heading font-bold text-indigo-600 mt-1 block">{data.bookings.completed}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Checked-out / settled</span>
            </div>

            <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Cancelled</span>
                <RotateCcw size={13} className="text-destructive" />
              </div>
              <span className="text-xl font-heading font-bold text-destructive mt-1 block">{data.bookings.cancelled}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">Customer / property</span>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Platform Entities & Governance */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Properties & Listings Governance */}
          <div className="bg-card border border-border p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Hotel size={14} className="text-brand-crimson" /> Property Inventory Control
              </h4>
              <Link to="/admin/hotels" className="text-xs text-brand-crimson hover:underline">
                Manage →
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-muted/40 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase block">Total</span>
                <span className="text-lg font-bold text-foreground mt-0.5 block">{data.properties.total}</span>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block font-semibold">Active</span>
                <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{data.properties.active}</span>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase block font-semibold">Pending</span>
                <span className="text-lg font-bold text-amber-600 mt-0.5 block">{data.properties.pending}</span>
              </div>
              <div className="p-2.5 bg-rose-500/10 rounded-lg">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 uppercase block font-semibold">Rejected</span>
                <span className="text-lg font-bold text-rose-600 mt-0.5 block">{data.properties.rejected}</span>
              </div>
            </div>
          </div>

          {/* Partners & Customer Accounts */}
          <div className="bg-card border border-border p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-brand-crimson" /> Partner & Customer Base
              </h4>
              <Link to="/admin/partners" className="text-xs text-brand-crimson hover:underline">
                Manage Partners →
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-muted/40 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase block">Total Partners</span>
                <span className="text-lg font-bold text-foreground mt-0.5 block">{data.partners.total}</span>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase block font-semibold">Pending Review</span>
                <span className="text-lg font-bold text-amber-600 mt-0.5 block">{data.partners.pending}</span>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block font-semibold">Verified KYC</span>
                <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{data.partners.verified}</span>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-lg">
                <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase block font-semibold">Customers</span>
                <span className="text-lg font-bold text-blue-600 mt-0.5 block">{data.customers.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
        <Link to="/admin/hotels" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <Hotel size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Properties</span>
          <span className="text-[10px] text-muted-foreground">Listings & Approvals</span>
        </Link>
        <Link to="/admin/partners" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <UserCheck size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Partners</span>
          <span className="text-[10px] text-muted-foreground">Directory & KYC</span>
        </Link>
        <Link to="/admin/cancellations" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <RotateCcw size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Cancellations</span>
          <span className="text-[10px] text-muted-foreground">Refund Requests</span>
        </Link>
        <Link to="/admin/partner-payouts" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <Landmark size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Settlements</span>
          <span className="text-[10px] text-muted-foreground">Partner Payouts</span>
        </Link>
        <Link to="/admin/support" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <HelpCircle size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Support</span>
          <span className="text-[10px] text-muted-foreground">Guest Inquiries</span>
        </Link>
        <Link to="/admin/audit-logs" className="p-3 bg-card border border-border hover:border-brand-gold/60 rounded-xl transition-colors flex flex-col items-center text-center">
          <FileText size={20} className="text-brand-crimson mb-1.5" />
          <span className="text-xs font-semibold text-foreground">Audit Logs</span>
          <span className="text-[10px] text-muted-foreground">Admin Traceability</span>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
