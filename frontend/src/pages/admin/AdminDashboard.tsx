import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Car, ClipboardList, Hotel, IndianRupee, Map, Users } from 'lucide-react';
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

    if (!token) {
      setAnalytics(null);
      setLoading(false);
      return;
    }
    void load();
  }, [token]);

  const stats = useMemo(() => {
    const s = analytics?.stats;
    return [
      {
        label: 'Total Revenue',
        value: `₹${(s?.totalRevenue || 0).toLocaleString('en-IN')}`,
        icon: IndianRupee,
        color: 'text-brand-green',
      },
      { label: 'Total Bookings', value: String(s?.totalBookings || 0), icon: ClipboardList, color: 'text-brand-crimson' },
      { label: 'Active Users', value: String(s?.activeUsers || 0), icon: Users, color: 'text-brand-saffron' },
      { label: 'Listed Properties', value: String(s?.listedProperties || 0), icon: Hotel, color: 'text-brand-gold' },
    ];
  }, [analytics]);

  const quickLinks = useMemo(() => {
    const l = analytics?.listings;
    return [
      { label: 'Hotels', count: l?.hotels || 0, icon: Hotel, path: '/admin/hotels' },
      { label: 'Rooms', count: l?.rooms || 0, icon: BedDouble, path: '/admin/rooms' },
      { label: 'Cabs', count: l?.cabs || 0, icon: Car, path: '/admin/cabs' },
      { label: 'Tours', count: l?.tours || 0, icon: Map, path: '/admin/tours' },
    ];
  }, [analytics]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="font-heading text-3xl font-bold text-foreground">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Quick Management</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.label} to={link.path} className="bg-card rounded-xl p-6 border border-border card-hover text-center">
              <link.icon size={28} className="mx-auto mb-3 text-brand-gold" />
              <p className="font-body text-sm font-medium text-foreground">{link.label}</p>
              <p className="font-body text-xs text-muted-foreground mt-1">{loading ? '—' : link.count} listed</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Recent Bookings</h2>
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-body text-muted-foreground">Loading…</p>
          </div>
        ) : analytics?.recentBookings?.length ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">Booking</th>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-body text-xs font-medium text-muted-foreground">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentBookings.map((b) => (
                    <tr key={b._id} className="border-t border-border">
                      <td className="px-4 py-3 font-body text-sm text-foreground">
                        <div className="font-semibold">{b.bookingId || '—'}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{b.itemName || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-foreground capitalize">{b.bookingType || '—'}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground">{b.userName || '—'}</td>
                      <td className="px-4 py-3 font-body text-sm font-semibold text-foreground">₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground capitalize">{b.bookingStatus || '—'}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground capitalize">{b.paymentStatus || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-body text-muted-foreground">No bookings yet</p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">Bookings will appear here once users start booking.</p>
          </div>
        )}
      </div>

      {!loading && !analytics && (
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="font-body text-sm text-foreground font-medium">Unable to load analytics</p>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Check backend `/api/admin/analytics` and database connection.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
