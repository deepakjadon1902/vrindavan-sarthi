import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble, Car, ClipboardList, Hotel, IndianRupee, Map, Users,
  TrendingUp, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type AdminAnalytics = {
  stats: {
    totalRevenue: number;
    totalBookings: number;
    activeUsers: number;
    listedProperties: number;
  };
  listings: { hotels: number; rooms: number; cabs: number; tours: number };
  recentBookings: Array<{
    _id: string;
    bookingId?: string;
    bookingType?: string;
    itemName?: string;
    userName?: string;
    totalAmount?: number;
    paymentStatus?: string;
    bookingStatus?: string;
    createdAt?: string;
  }>;
};

const AdminDashboard = () => {
  const token = useAuthStore((s) => s.token);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/admin/analytics', withAuth(token));
        const data = res.data?.data as AdminAnalytics | undefined;
        if (data?.stats && data?.listings) setAnalytics(data);
        else setAnalytics(null);
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };
    if (!token) { setAnalytics(null); setLoading(false); return; }
    void load();
  }, [token]);

  const stats = useMemo(() => {
    const s = analytics?.stats;
    return [
      {
        label: 'Total Revenue',
        value: `₹${(s?.totalRevenue || 0).toLocaleString('en-IN')}`,
        sub: 'All time earnings',
        icon: IndianRupee,
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-500',
        accent: 'border-l-4 border-l-emerald-500',
        trend: '+12.5%',
        trendColor: 'text-emerald-500',
      },
      {
        label: 'Total Bookings',
        value: String(s?.totalBookings || 0),
        sub: 'Across all services',
        icon: ClipboardList,
        iconBg: 'bg-brand-crimson/10',
        iconColor: 'text-brand-crimson',
        accent: 'border-l-4 border-l-brand-crimson',
        trend: '+8.2%',
        trendColor: 'text-brand-crimson',
      },
      {
        label: 'Active Users',
        value: String(s?.activeUsers || 0),
        sub: 'Registered accounts',
        icon: Users,
        iconBg: 'bg-brand-saffron/10',
        iconColor: 'text-brand-saffron',
        accent: 'border-l-4 border-l-brand-saffron',
        trend: '+5.1%',
        trendColor: 'text-brand-saffron',
      },
      {
        label: 'Listed Properties',
        value: String(s?.listedProperties || 0),
        sub: 'Hotels, cabs & tours',
        icon: Hotel,
        iconBg: 'bg-brand-gold/10',
        iconColor: 'text-brand-gold',
        accent: 'border-l-4 border-l-brand-gold',
        trend: '+3.7%',
        trendColor: 'text-brand-gold',
      },
    ];
  }, [analytics]);

  const quickLinks = useMemo(() => {
    const l = analytics?.listings;
    return [
      { label: 'Hotels',    count: l?.hotels || 0, icon: Hotel,     path: '/admin/hotels',    accent: 'hover:border-brand-gold/60 hover:shadow-brand-gold/10',    iconBg: 'bg-brand-gold/10',    iconColor: 'text-brand-gold',    bar: 'bg-brand-gold' },
      { label: 'Inventory', count: l?.rooms  || 0, icon: BedDouble, path: '/admin/inventory', accent: 'hover:border-brand-saffron/60 hover:shadow-brand-saffron/10', iconBg: 'bg-brand-saffron/10', iconColor: 'text-brand-saffron', bar: 'bg-brand-saffron' },
      { label: 'Cabs',      count: l?.cabs   || 0, icon: Car,       path: '/admin/cabs',      accent: 'hover:border-emerald-400/60 hover:shadow-emerald-400/10',    iconBg: 'bg-emerald-500/10',   iconColor: 'text-emerald-500',   bar: 'bg-emerald-500' },
      { label: 'Tours',     count: l?.tours  || 0, icon: Map,       path: '/admin/tours',     accent: 'hover:border-brand-crimson/50 hover:shadow-brand-crimson/10', iconBg: 'bg-brand-crimson/10', iconColor: 'text-brand-crimson', bar: 'bg-brand-crimson' },
    ];
  }, [analytics]);

  /** Payment / booking status badge */
  const StatusBadge = ({ value, type }: { value?: string; type: 'payment' | 'booking' }) => {
    const v = (value || '').toLowerCase();
    if (type === 'payment') {
      if (v === 'paid')    return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-body text-[11px] font-bold text-emerald-700 tracking-wide"><CheckCircle2 size={11} /> Paid</span>;
      if (v === 'failed')  return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 font-body text-[11px] font-bold text-red-700 tracking-wide"><XCircle size={11} /> Failed</span>;
      return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-body text-[11px] font-bold text-amber-700 tracking-wide"><Clock size={11} /> Pending</span>;
    }
    if (v === 'confirmed' || v === 'completed' || v === 'delivered')
      return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-body text-[11px] font-bold text-emerald-700 capitalize tracking-wide">{v}</span>;
    if (v === 'cancelled')
      return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 font-body text-[11px] font-bold text-red-700 capitalize tracking-wide">{v}</span>;
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-body text-[11px] font-bold text-amber-700 capitalize tracking-wide">{v || '—'}</span>;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-7">

      {/* ── Section label ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 px-1">
          Overview
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 ${stat.accent}`}
          >
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon size={20} className={stat.iconColor} />
                </div>
                <span className={`font-body text-[11px] font-bold ${stat.trendColor} bg-current/10 px-2 py-0.5 rounded-full`}
                  style={{ backgroundColor: 'transparent' }}>
                  {stat.trend}
                </span>
              </div>
              <p className="font-heading text-[30px] font-extrabold text-foreground leading-none tracking-tight">
                {loading ? <span className="text-muted-foreground/30">—</span> : stat.value}
              </p>
              <p className="font-body text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-2">
                {stat.label}
              </p>
            </div>
            <div className="border-t border-border/60 px-5 py-2.5 bg-muted/20">
              <p className="font-body text-[12px] text-muted-foreground">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Management ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
            Quick management
          </p>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className={`group relative flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:shadow-lg overflow-hidden ${link.accent}`}
            >
              {/* subtle top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${link.bar} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
              <div className={`w-12 h-12 rounded-xl ${link.iconBg} flex items-center justify-center shrink-0`}>
                <link.icon size={22} className={link.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[15px] font-bold text-foreground">{link.label}</p>
                <p className="font-body text-[12px] text-muted-foreground mt-0.5">
                  {loading ? '—' : `${link.count} listed`}
                </p>
              </div>
              <TrendingUp size={15} className="ml-auto text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Bookings ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
            Recent bookings
          </p>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        {loading ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <ClipboardList size={44} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="font-body text-[14px] text-muted-foreground">Loading bookings…</p>
          </div>
        ) : analytics?.recentBookings?.length ? (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {['Booking ID', 'Item', 'Type', 'Customer', 'Date', 'Amount', 'Booking', 'Payment'].map((h) => (
                      <th key={h} className="px-5 py-3.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {analytics.recentBookings.map((b) => (
                    <tr key={b._id} className="hover:bg-muted/25 transition-colors duration-100">
                      {/* Booking ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-[12px] font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          {b.bookingId || '—'}
                        </span>
                      </td>
                      {/* Item name */}
                      <td className="px-5 py-4 max-w-[180px]">
                        <p className="font-body text-[13px] font-medium text-foreground truncate">{b.itemName || '—'}</p>
                      </td>
                      {/* Type */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-lg border border-border bg-muted/60 px-3 py-1 font-body text-[11px] font-bold capitalize text-foreground tracking-wide">
                          {b.bookingType || '—'}
                        </span>
                      </td>
                      {/* Customer */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-body text-[13px] font-medium text-foreground">{b.userName || '—'}</span>
                      </td>
                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-body text-[12px] text-muted-foreground font-medium">{formatDate(b.createdAt)}</span>
                      </td>
                      {/* Amount */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-heading text-[14px] font-extrabold text-brand-crimson">
                          ₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      {/* Booking status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge value={b.bookingStatus} type="booking" />
                      </td>
                      {/* Payment status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge value={b.paymentStatus} type="payment" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <ClipboardList size={44} className="mx-auto mb-4 text-muted-foreground/20" />
            <p className="font-body text-[15px] text-foreground font-semibold">No bookings yet</p>
            <p className="font-body text-[13px] text-muted-foreground mt-1.5">
              Bookings will appear here once users start booking.
            </p>
          </div>
        )}
      </div>

      {/* ── Error state ── */}
      {!loading && !analytics && (
        <div className="flex items-start gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
            <XCircle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="font-body text-[14px] font-bold text-foreground">Unable to load analytics</p>
            <p className="font-body text-[12px] text-muted-foreground mt-1">
              Check backend <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">/api/admin/analytics</code> and database connection.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;