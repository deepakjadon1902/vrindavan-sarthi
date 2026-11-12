import {
  Hotel,
  BedDouble,
  ClipboardList,
  Clock,
  ShieldCheck,
  XCircle,
  TrendingUp,
  CheckCircle2,
  LogIn,
  LogOut,
  Users,
  IndianRupee,
  Wallet,
  ArrowUpRight,
  AlertCircle,
  BellRing,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, withAuth } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { getSessionCache, setSessionCache } from '@/lib/panelCache';
import PartnerSetupChecklist from '@/components/partner/PartnerSetupChecklist';

interface DashboardSummaryData {
  properties: {
    total: number;
    published: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  bookings: {
    total: number;
    todayCheckIns: number;
    todayCheckOuts: number;
    upcomingArrivals: number;
    currentGuests: number;
    checkedOut: number;
    cancelled: number;
    pendingConfirmation: number;
  };
  financials: {
    pendingDeskCollections: number;
    propertyDeskCollected: number;
    onlineCollections: number;
    totalGrossTariff: number;
    totalPlatformCommission: number;
    totalPartnerEarnings: number;
    pendingSettlement: number;
    paidSettlements: number;
    settlementThreshold: number;
    isEligibleForSettlement: boolean;
    nextPayoutCycle: string;
  };
  notifications: {
    unreadCount: number;
  };
}

const PartnerDashboard = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isApproved = user?.partnerStatus === 'approved';
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<{ hotels: any[]; cabs: any[]; tours: any[] }>({
    hotels: [],
    cabs: [],
    tours: [],
  });
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [listingsRes, summaryRes] = await Promise.all([
        api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } }).catch(() => ({ data: { data: {} } })),
        api.get('/partner/dashboard-summary', withAuth(token)).catch(() => ({ data: { data: null } })),
      ]);

      const data = listingsRes.data?.data || {};
      const nextListings = {
        hotels: Array.isArray(data.hotels) ? data.hotels : [],
        cabs: Array.isArray(data.cabs) ? data.cabs : [],
        tours: Array.isArray(data.tours) ? data.tours : [],
      };
      setListings(nextListings);
      setSessionCache('vvs_partner_my_listings_raw', nextListings);

      if (summaryRes.data?.data) {
        setSummary(summaryRes.data.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const cached = getSessionCache<{ hotels: any[]; cabs: any[]; tours: any[] }>('vvs_partner_my_listings_raw', 30_000);
    if (cached) {
      setListings((prev) => (!prev.hotels.length && !prev.cabs.length && !prev.tours.length ? cached : prev));
    }
    void loadData();
    const unsub = subscribeAppEvent('listing:changed', () => void loadData());
    return unsub;
  }, [isApproved, token]);

  useEffect(() => {
    if (!user || !isApproved) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, isApproved, user]);

  const allItems = useMemo(() => [...listings.hotels, ...listings.cabs, ...listings.tours], [listings]);
  const pending = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
  const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;
  const approved = allItems.filter((i: any) => i.approvalStatus === 'approved').length;

  /* Greeting based on time */
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const opsBookings = summary?.bookings;
  const opsFinancials = summary?.financials;

  return (
    <div className="space-y-6">
      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-xl border border-brand-gold/30 bg-brand-cream px-6 py-5">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-brand-gold mb-1">
              {greeting}
            </p>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {user?.name}
            </h2>
            {user?.businessName && (
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                {user.businessName}
              </p>
            )}
          </div>
          {summary?.notifications?.unreadCount ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/40 bg-background px-3 py-1.5 text-xs font-body font-medium text-foreground">
              <BellRing size={14} className="text-brand-gold animate-bounce" />
              <span>{summary.notifications.unreadCount} unread update{summary.notifications.unreadCount > 1 ? 's' : ''}</span>
            </div>
          ) : null}
        </div>
        {/* decorative ring */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border-[16px] border-brand-gold/10" />
        <div className="pointer-events-none absolute -right-2 -bottom-6 h-20 w-20 rounded-full border-[10px] border-brand-gold/10" />
      </div>

      {/* ── Partner Onboarding Checklist ── */}
      <PartnerSetupChecklist />

      {/* ── Front-Desk Operations Highlights ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Front-Desk &amp; Guest Operations
          </p>
          <Link to="/partner/bookings" className="font-body text-xs text-brand-crimson font-medium hover:underline inline-flex items-center gap-1">
            Manage Bookings <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Today's Arrivals */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Today's Arrivals</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                <LogIn size={16} />
              </div>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              {opsBookings?.todayCheckIns ?? 0}
            </p>
            <p className="font-body text-[10px] text-muted-foreground mt-1">Confirmed for check-in today</p>
          </div>

          {/* Today's Departures */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Today's Departures</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <LogOut size={16} />
              </div>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              {opsBookings?.todayCheckOuts ?? 0}
            </p>
            <p className="font-body text-[10px] text-muted-foreground mt-1">In-house guests checking out</p>
          </div>

          {/* In-House Guests */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Current In-House</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <Users size={16} />
              </div>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              {opsBookings?.currentGuests ?? 0}
            </p>
            <p className="font-body text-[10px] text-muted-foreground mt-1">Currently checked in</p>
          </div>

          {/* Desk Collections Due */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-muted-foreground">Desk Balance Due</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <IndianRupee size={16} />
              </div>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              ₹{(opsFinancials?.pendingDeskCollections ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-[10px] text-muted-foreground mt-1">To collect at front desk</p>
          </div>
        </div>
      </div>

      {/* ── Financial & Settlement Overview ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border">
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-wider text-muted-foreground">Settlement Status</p>
            <p className="font-heading text-lg font-bold text-foreground">
              {opsFinancials?.nextPayoutCycle || 'Bi-weekly on Monday & Wednesday'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                opsFinancials?.isEligibleForSettlement
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}
            >
              {opsFinancials?.isEligibleForSettlement ? (
                <>
                  <CheckCircle2 size={13} /> Eligible for Remittance
                </>
              ) : (
                <>
                  <AlertCircle size={13} /> Minimum ₹1,000 Threshold (Rolls Over)
                </>
              )}
            </span>
            <Link
              to="/partner/payments"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-border bg-background text-xs font-body hover:bg-muted font-medium"
            >
              View Ledger <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div>
            <p className="font-body text-xs text-muted-foreground">Total Partner Earnings</p>
            <p className="font-heading text-xl font-bold text-foreground mt-0.5">
              ₹{(opsFinancials?.totalPartnerEarnings ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">Net of platform commission</p>
          </div>

          <div>
            <p className="font-body text-xs text-muted-foreground">Collected at Desk</p>
            <p className="font-heading text-xl font-bold text-brand-green mt-0.5">
              ₹{(opsFinancials?.propertyDeskCollected ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">Kept directly by property</p>
          </div>

          <div>
            <p className="font-body text-xs text-muted-foreground">Pending Remittance</p>
            <p className="font-heading text-xl font-bold text-foreground mt-0.5">
              ₹{(opsFinancials?.pendingSettlement ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">From checked-out guests</p>
          </div>

          <div>
            <p className="font-body text-xs text-muted-foreground">Settled Payouts</p>
            <p className="font-heading text-xl font-bold text-foreground mt-0.5">
              ₹{(opsFinancials?.paidSettlements ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">Transferred to your bank</p>
          </div>
        </div>
      </div>

      {/* ── Property Listings Stats ── */}
      <div>
        <p className="font-body text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Property Portfolio
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Hotels */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Hotels
                </span>
                <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                  <Hotel size={16} className="text-brand-gold" />
                </div>
              </div>
              <p className="font-heading text-3xl font-bold text-foreground leading-none">
                {listings.hotels.length}
              </p>
            </div>
            <div className="border-t border-border px-4 py-2 bg-muted/30">
              <p className="font-body text-[10px] text-muted-foreground">Total listings</p>
            </div>
          </div>

          {/* Bookings */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Bookings
                </span>
                <div className="w-8 h-8 rounded-lg bg-brand-crimson/10 flex items-center justify-center">
                  <ClipboardList size={16} className="text-brand-crimson" />
                </div>
              </div>
              <p className="font-heading text-3xl font-bold text-foreground leading-none">
                {partnerBookings.length}
              </p>
            </div>
            <div className="border-t border-border px-4 py-2 bg-muted/30">
              <p className="font-body text-[10px] text-muted-foreground">All time</p>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Pending
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock size={16} className="text-amber-500" />
                </div>
              </div>
              <p className="font-heading text-3xl font-bold text-foreground leading-none">
                {pending}
              </p>
            </div>
            <div className="border-t border-border px-4 py-2 bg-muted/30">
              <p className="font-body text-[10px] text-muted-foreground">Awaiting approval</p>
            </div>
          </div>

          {/* Approved */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Approved
                </span>
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
              </div>
              <p className="font-heading text-3xl font-bold text-foreground leading-none">
                {approved}
              </p>
            </div>
            <div className="border-t border-border px-4 py-2 bg-muted/30">
              <p className="font-body text-[10px] text-muted-foreground">Live listings</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Refreshing indicator ── */}
      {isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-brand-gold animate-pulse" />
          <p className="font-body text-xs text-muted-foreground">Refreshing operations summary…</p>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div>
        <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Quick actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/partner/bookings"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand-crimson/50 hover:bg-brand-crimson/5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-crimson/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-crimson/20">
              <LogIn size={22} className="text-brand-crimson" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">Front-Desk Bookings</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">Check-in, checkout, collect desk balance</p>
            </div>
            <TrendingUp size={14} className="ml-auto text-muted-foreground/40 group-hover:text-brand-crimson transition-colors" />
          </Link>

          <Link
            to="/partner/inventory"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand-saffron/50 hover:bg-brand-saffron/5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-saffron/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-saffron/20">
              <BedDouble size={22} className="text-brand-saffron" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">Rooms &amp; Inventory</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">Physical units, rates, blocks</p>
            </div>
            <TrendingUp size={14} className="ml-auto text-muted-foreground/40 group-hover:text-brand-saffron transition-colors" />
          </Link>

          <Link
            to="/partner/payments"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand-green/50 hover:bg-brand-green/5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-green/20">
              <Wallet size={22} className="text-brand-green" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">Financial Statement</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">Commission, collections, payouts</p>
            </div>
            <TrendingUp size={14} className="ml-auto text-muted-foreground/40 group-hover:text-brand-green transition-colors" />
          </Link>
        </div>
      </div>

      {/* ── Hotel listings summary ── */}
      {listings.hotels.length > 0 && (
        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Your hotels
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {listings.hotels.slice(0, 5).map((h: any) => (
              <div key={h.id || h._id} className="flex items-center gap-3 px-4 py-3">
                {h.images?.[0] ? (
                  <img
                    src={h.images[0]}
                    alt={h.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <Hotel size={16} className="text-brand-gold" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm font-semibold text-foreground truncate">{h.name || 'Unnamed Hotel'}</p>
                  {h.location && (
                    <p className="font-body text-[11px] text-muted-foreground truncate">{h.location}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-[10px] font-semibold capitalize
                    ${
                      h.approvalStatus === 'approved'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : h.approvalStatus === 'rejected'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                >
                  {h.approvalStatus || 'pending'}
                </span>
              </div>
            ))}
            {listings.hotels.length > 5 && (
              <div className="px-4 py-2.5 bg-muted/30">
                <Link to="/partner/hotels" className="font-body text-xs text-brand-gold hover:underline">
                  View all {listings.hotels.length} hotels →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rejected banner ── */}
      {rejected > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <XCircle size={20} className="mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="font-body text-sm font-semibold text-foreground">
              {rejected} listing{rejected > 1 ? 's' : ''} rejected
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Check your listings page for details and resubmit after making changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
