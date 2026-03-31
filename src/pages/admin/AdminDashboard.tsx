import { Hotel, BedDouble, Car, Map, ClipboardList, Users, TrendingUp, IndianRupee } from 'lucide-react';

// This will show real data once database is connected
// For now shows structure with zero/empty state

const AdminDashboard = () => {
  const stats = [
    { label: 'Total Revenue', value: '₹0', icon: IndianRupee, color: 'text-brand-green' },
    { label: 'Total Bookings', value: '0', icon: ClipboardList, color: 'text-brand-crimson' },
    { label: 'Active Users', value: '0', icon: Users, color: 'text-brand-saffron' },
    { label: 'Listed Properties', value: '0', icon: Hotel, color: 'text-brand-gold' },
  ];

  const quickLinks = [
    { label: 'Hotels', count: 0, icon: Hotel, path: '/admin/hotels' },
    { label: 'Rooms', count: 0, icon: BedDouble, path: '/admin/rooms' },
    { label: 'Cabs', count: 0, icon: Car, path: '/admin/cabs' },
    { label: 'Tours', count: 0, icon: Map, path: '/admin/tours' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="font-heading text-3xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Quick Management</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.path}
              className="bg-card rounded-xl p-6 border border-border card-hover text-center"
            >
              <link.icon size={28} className="mx-auto mb-3 text-brand-gold" />
              <p className="font-body text-sm font-medium text-foreground">{link.label}</p>
              <p className="font-body text-xs text-muted-foreground mt-1">{link.count} listed</p>
            </a>
          ))}
        </div>
      </div>

      {/* Recent Bookings */}
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Recent Bookings</h2>
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No bookings yet</p>
          <p className="font-body text-xs text-muted-foreground/60 mt-1">
            Bookings will appear here once your database is connected
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <TrendingUp size={20} className="text-brand-gold mt-0.5" />
          <div>
            <p className="font-body text-sm font-medium text-foreground">Database Not Connected</p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Connect your database to see real data. All management features are ready — add hotels, rooms, cabs, and tours from the sidebar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
