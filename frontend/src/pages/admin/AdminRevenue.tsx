import { useEffect, useState } from 'react';
import {
  IndianRupee, TrendingUp, Hotel, Building, CreditCard, ShieldCheck,
  Calendar, RefreshCw, ArrowUpRight
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type RevenueSummary = {
  period: string;
  dateRange: { start: string | null; end: string | null };
  totals: {
    grossBookingValue: number;
    onlineCollections: number;
    deskCollections: number;
    platformCommission: number;
    convenienceFee: number;
    totalPlatformRevenue: number;
    partnerNetEntitlement: number;
    absorbedGatewayFees: number;
  };
  breakdown: {
    dharamshalas: {
      bookingsCount: number;
      grossValue: number;
      serviceFeesCollected: number;
      deskCollections: number;
    };
    commercialHotels: {
      bookingsCount: number;
      grossValue: number;
      commissionEarned: number;
      convenienceFeeCollected: number;
      partnerNetPayout: number;
    };
  };
};

const PERIODS = [
  { id: 'allTime', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
];

const formatCurrency = (val?: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

const AdminRevenue = () => {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('allTime');

  const fetchRevenue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/admin/revenue-summary', {
        ...withAuth(token),
        params: { period },
      });
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
    void fetchRevenue();
  }, [token, period]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="text-brand-crimson" size={20} />
            Platform Revenue & Commission Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transparent breakdown of gross booking value, commissions, service fees, and gateway absorption
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  period === p.id
                    ? 'bg-brand-crimson text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => void fetchRevenue()}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
      )}

      {/* Main Revenue Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block font-medium">Total Gross Booking Value</span>
            <span className="text-2xl font-heading font-bold text-foreground mt-1.5 block">
              {formatCurrency(data.totals.grossBookingValue)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">Combined tariff + hotel taxes</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-brand-crimson">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block font-medium">Platform Total Revenue</span>
            <span className="text-2xl font-heading font-bold text-brand-crimson mt-1.5 block">
              {formatCurrency(data.totals.totalPlatformRevenue)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">Commission + convenience + service fees</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-emerald-500">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block font-medium">Partner Net Payouts</span>
            <span className="text-2xl font-heading font-bold text-emerald-600 mt-1.5 block">
              {formatCurrency(data.totals.partnerNetEntitlement)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">Total net entitlement to hospitality partners</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl shadow-xs border-l-4 border-l-purple-500">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block font-medium">Gateway Fees Absorbed</span>
            <span className="text-2xl font-heading font-bold text-purple-600 mt-1.5 block">
              {formatCurrency(data.totals.absorbedGatewayFees)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">100% platform-absorbed (₹0 levy on partners/guests)</span>
          </div>
        </div>
      )}

      {/* Section: Category Split Breakdown */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Commercial Hotels */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Hotel className="text-brand-crimson" size={18} />
                <h3 className="font-heading font-bold text-foreground text-sm">Commercial Hotels Marketplace</h3>
              </div>
              <span className="text-xs bg-muted px-2.5 py-1 rounded-md font-semibold text-foreground">
                {data.breakdown.commercialHotels.bookingsCount} Bookings
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Gross Booking Value:</span>
                <span className="font-semibold text-foreground">{formatCurrency(data.breakdown.commercialHotels.grossValue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">OTA Platform Commission Earned:</span>
                <span className="font-bold text-brand-crimson">{formatCurrency(data.breakdown.commercialHotels.commissionEarned)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Convenience Fees Collected (4.45%):</span>
                <span className="font-bold text-foreground">{formatCurrency(data.breakdown.commercialHotels.convenienceFeeCollected)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Hotel Net Remittance:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(data.breakdown.commercialHotels.partnerNetPayout)}</span>
              </div>
            </div>
          </div>

          {/* Dharamshala Pilgrimage Lodging */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building className="text-brand-saffron" size={18} />
                <h3 className="font-heading font-bold text-foreground text-sm">Dharamshalas & Ashrams (Exempt Lodging)</h3>
              </div>
              <span className="text-xs bg-muted px-2.5 py-1 rounded-md font-semibold text-foreground">
                {data.breakdown.dharamshalas.bookingsCount} Requests
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Gross Booking Value:</span>
                <span className="font-semibold text-foreground">{formatCurrency(data.breakdown.dharamshalas.grossValue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Property-Configured Service Fees:</span>
                <span className="font-bold text-brand-crimson">{formatCurrency(data.breakdown.dharamshalas.serviceFeesCollected)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Desk Room Rent Collections:</span>
                <span className="font-bold text-blue-600">{formatCurrency(data.breakdown.dharamshalas.deskCollections)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Applicable GST:</span>
                <span className="font-bold text-muted-foreground">0% (Charitable Exemption)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRevenue;
