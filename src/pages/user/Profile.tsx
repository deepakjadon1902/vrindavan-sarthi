import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { User, Camera, Save, X, Mail, Phone, MapPin, Calendar, Shield, CreditCard, ClipboardList, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, updateProfile } = useAuthStore();
  const { getBookingsByUser } = useBookingStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    pin: user?.address?.pin || '',
  });

  const bookings = getBookingsByUser(user?.id || '');
  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => b.bookingStatus === 'confirmed').length;
  const totalSpent = bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0);

  const handleSave = () => {
    updateProfile({
      name: form.name,
      phone: form.phone,
      address: { street: form.street, city: form.city, state: form.state, pin: form.pin },
    });
    setEditing(false);
    toast.success('Profile updated successfully');
  };

  if (!user) return null;

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-r from-brand-crimson via-brand-crimson/80 to-brand-gold h-44 sm:h-52">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTR2Mkgy
NHYtMmgxMnptMC00djJIMjR2LTJoMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/60 to-transparent" />
          </div>

          {/* Profile Avatar - overlapping banner */}
          <div className="relative -mt-20 mb-6 px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-card border-4 border-background shadow-xl flex items-center justify-center overflow-hidden">
                <span className="text-5xl font-brand text-brand-gold">{user.name.charAt(0)}</span>
              </div>
              <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-crimson text-primary-foreground flex items-center justify-center shadow-lg hover:bg-brand-crimson/90 transition-colors">
                <Camera size={14} />
              </button>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="font-body text-sm text-muted-foreground flex items-center gap-1"><Mail size={13} /> {user.email}</span>
                {user.phone && <span className="font-body text-sm text-muted-foreground flex items-center gap-1"><Phone size={13} /> {user.phone}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!editing ? (
                <button onClick={() => setEditing(true)} className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium">
                  <Edit3 size={14} /> Edit Profile
                </button>
              ) : (
                <>
                  <button onClick={handleSave} className="btn-crimson px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium"><Save size={14} /> Save</button>
                  <button onClick={() => setEditing(false)} className="px-5 py-2.5 rounded-xl text-sm border border-border font-body hover:bg-muted transition-colors flex items-center gap-2"><X size={14} /> Cancel</button>
                </>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
              <div className="w-10 h-10 mx-auto rounded-lg bg-brand-crimson/10 flex items-center justify-center mb-2">
                <ClipboardList size={18} className="text-brand-crimson" />
              </div>
              <p className="font-heading text-xl font-bold text-foreground">{totalBookings}</p>
              <p className="font-body text-xs text-muted-foreground">Total Bookings</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
              <div className="w-10 h-10 mx-auto rounded-lg bg-brand-green/10 flex items-center justify-center mb-2">
                <Shield size={18} className="text-brand-green" />
              </div>
              <p className="font-heading text-xl font-bold text-foreground">{activeBookings}</p>
              <p className="font-body text-xs text-muted-foreground">Active Bookings</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
              <div className="w-10 h-10 mx-auto rounded-lg bg-brand-gold/10 flex items-center justify-center mb-2">
                <CreditCard size={18} className="text-brand-gold" />
              </div>
              <p className="font-heading text-xl font-bold text-foreground">₹{totalSpent.toLocaleString('en-IN')}</p>
              <p className="font-body text-xs text-muted-foreground">Total Spent</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md transition-shadow">
              <div className="w-10 h-10 mx-auto rounded-lg bg-brand-saffron/10 flex items-center justify-center mb-2">
                <Calendar size={18} className="text-brand-saffron" />
              </div>
              <p className="font-heading text-sm font-bold text-foreground">{memberSince}</p>
              <p className="font-body text-xs text-muted-foreground">Member Since</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Personal Info */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
              <h3 className="font-heading text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                <User size={18} className="text-brand-crimson" /> Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1.5">Full Name</label>
                  {editing ? (
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all" />
                  ) : (
                    <p className="font-body text-sm text-foreground font-medium">{user.name}</p>
                  )}
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1.5">Email Address</label>
                  <p className="font-body text-sm text-foreground font-medium flex items-center gap-1.5"><Mail size={13} className="text-muted-foreground" /> {user.email}</p>
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1.5">Phone Number</label>
                  {editing ? (
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all" placeholder="+91 XXXXX XXXXX" />
                  ) : (
                    <p className="font-body text-sm text-foreground font-medium">{user.phone || '—'}</p>
                  )}
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1.5">Role</label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-crimson/10 text-brand-crimson font-body text-xs font-medium capitalize">
                    <Shield size={12} /> {user.role}
                  </span>
                </div>
              </div>

              {/* Address Section */}
              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="font-heading text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-brand-gold" /> Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {(['street', 'city', 'state', 'pin'] as const).map((field) => (
                    <div key={field}>
                      <label className="font-body text-xs text-muted-foreground block mb-1.5 capitalize">
                        {field === 'pin' ? 'PIN Code' : field}
                      </label>
                      {editing ? (
                        <input
                          value={form[field]}
                          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                          placeholder={field === 'pin' ? '281121' : `Enter ${field}`}
                        />
                      ) : (
                        <p className="font-body text-sm text-foreground font-medium">{user.address?.[field] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Links Sidebar */}
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Quick Links</h3>
                <div className="space-y-2">
                  <Link to="/bookings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-brand-crimson/10 flex items-center justify-center group-hover:bg-brand-crimson/20 transition-colors">
                      <ClipboardList size={16} className="text-brand-crimson" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">My Bookings</p>
                      <p className="font-body text-[10px] text-muted-foreground">{totalBookings} booking(s)</p>
                    </div>
                  </Link>
                  <Link to="/hotels" className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-gold/20 transition-colors">
                      <MapPin size={16} className="text-brand-gold" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">Browse Hotels</p>
                      <p className="font-body text-[10px] text-muted-foreground">Explore stays in Vrindavan</p>
                    </div>
                  </Link>
                  <Link to="/tours" className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-brand-green/10 flex items-center justify-center group-hover:bg-brand-green/20 transition-colors">
                      <Calendar size={16} className="text-brand-green" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">Tour Packages</p>
                      <p className="font-body text-[10px] text-muted-foreground">Sacred pilgrimage tours</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Recent Bookings */}
              {bookings.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-heading text-base font-semibold text-foreground mb-4">Recent Bookings</h3>
                  <div className="space-y-3">
                    {bookings.slice(0, 3).map((b) => (
                      <Link key={b.id} to={`/bookings/${b.id}`} className="block p-3 rounded-xl hover:bg-muted transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <p className="font-body text-sm font-medium text-foreground truncate">{b.itemName}</p>
                            <p className="font-body text-[10px] text-muted-foreground">{b.id}</p>
                          </div>
                          <span className={`font-body text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                            b.bookingStatus === 'confirmed' ? 'bg-brand-green/10 text-brand-green' :
                            b.bookingStatus === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                            'bg-brand-gold/10 text-brand-gold'
                          }`}>{b.bookingStatus}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Profile;
