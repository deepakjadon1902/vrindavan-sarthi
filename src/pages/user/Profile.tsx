import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { User, Camera, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const Profile = () => {
  const { user, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    pin: user?.address?.pin || '',
  });

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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="font-heading text-3xl font-semibold text-foreground mb-8">My Profile</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-brand-gold/10 flex items-center justify-center mb-4 relative">
                <span className="text-4xl font-brand text-brand-gold">{user.name.charAt(0)}</span>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-crimson text-primary-foreground flex items-center justify-center">
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="font-heading text-xl font-semibold text-foreground">{user.name}</h2>
              <p className="font-body text-sm text-muted-foreground">{user.email}</p>
              <p className="font-body text-xs text-muted-foreground mt-2">
                Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Details */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-lg font-semibold text-foreground">Profile Details</h3>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="btn-gold px-4 py-2 rounded-lg text-xs">Edit Profile</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSave} className="btn-crimson px-4 py-2 rounded-lg text-xs flex items-center gap-1"><Save size={12} /> Save</button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-xs border border-border font-body hover:bg-muted transition-colors flex items-center gap-1"><X size={12} /> Cancel</button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-body text-xs text-muted-foreground block mb-1">Full Name</label>
                    {editing ? (
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                    ) : (
                      <p className="font-body text-sm text-foreground">{user.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground block mb-1">Email</label>
                    <p className="font-body text-sm text-foreground">{user.email}</p>
                  </div>
                  <div>
                    <label className="font-body text-xs text-muted-foreground block mb-1">Phone</label>
                    {editing ? (
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                    ) : (
                      <p className="font-body text-sm text-foreground">{user.phone || '—'}</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border my-4" />

                <h4 className="font-body text-sm font-medium text-foreground">Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['street', 'city', 'state', 'pin'] as const).map((field) => (
                    <div key={field}>
                      <label className="font-body text-xs text-muted-foreground block mb-1 capitalize">{field === 'pin' ? 'PIN Code' : field}</label>
                      {editing ? (
                        <input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
                      ) : (
                        <p className="font-body text-sm text-foreground">{user.address?.[field] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Profile;
