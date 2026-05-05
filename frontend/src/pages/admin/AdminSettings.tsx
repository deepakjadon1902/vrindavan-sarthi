import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { Settings, Save, CreditCard, FileText, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import axios from 'axios';

const AdminSettings = () => {
  const { settings, saveSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'payment' | 'terms' | 'privacy' | 'security'>('payment');

  const [form, setForm] = useState({ ...settings });
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [adminCreds, setAdminCreds] = useState({
    currentPassword: '',
    newEmail: '',
    newPassword: '',
  });

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    setAdminCreds((prev) => ({ ...prev, newEmail: user?.email || '' }));
  }, [user?.email]);

  const handleSave = async () => {
    const res = await saveSettings(form);
    if (res.success) toast.success('Settings saved successfully!');
    else toast.error(res.error || 'Failed to save settings');
  };

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as any)?.message;
      if (typeof msg === 'string') return msg;
      return err.message || fallback;
    }
    if (err instanceof Error) return err.message || fallback;
    return fallback;
  };

  const handleUpdateAdminCredentials = async () => {
    if (!token) return toast.error('Not authenticated');
    if (!adminCreds.currentPassword) return toast.error('Current password is required');
    if (!adminCreds.newEmail && !adminCreds.newPassword) return toast.error('Enter new email and/or new password');

    try {
      await api.put(
        '/users/admin-credentials',
        {
          currentPassword: adminCreds.currentPassword,
          newEmail: adminCreds.newEmail || undefined,
          newPassword: adminCreds.newPassword || undefined,
        },
        withAuth(token)
      );

      setAdminCreds((p) => ({ ...p, currentPassword: '', newPassword: '' }));
      await refreshMe();
      toast.success('Admin credentials updated');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to update admin credentials'));
    }
  };

  const tabs = [
    { id: 'payment' as const, label: 'UPI Payment', icon: CreditCard },
    { id: 'terms' as const, label: 'Terms of Service', icon: FileText },
    { id: 'privacy' as const, label: 'Privacy Policy', icon: Shield },
    { id: 'security' as const, label: 'Security', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-brand-gold" />
        <h2 className="font-heading text-2xl font-bold text-foreground">Application Settings</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-body text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-crimson text-primary-foreground'
                : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">UPI Payment Settings</h3>
            <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-4 mb-4">
              <p className="font-body text-sm text-foreground">Configure your UPI ID here. When users book hotels, rooms, or tours, a UPI QR code will be generated with this ID for payment.</p>
              <p className="font-body text-xs text-muted-foreground mt-1">Cab bookings use "Pay at Doorstep" method — no UPI payment required.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">UPI ID *</label>
                <input type="text" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="yourname@upi or 9999999999@paytm" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Payee Name</label>
                <input type="text" value={form.upiName} onChange={(e) => setForm({ ...form, upiName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="VrindavanSarthi" />
              </div>
            </div>
            {form.upiId && (
              <div className="bg-muted rounded-xl p-6 text-center">
                <p className="font-body text-sm text-muted-foreground mb-3">QR Code Preview (Sample ₹100)</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${form.upiId}&pn=${form.upiName}&am=100&cu=INR&tn=VrindavanSarthi+Booking`)}`}
                  alt="UPI QR Preview"
                  className="mx-auto rounded-lg border border-border"
                />
                <p className="font-body text-xs text-muted-foreground mt-2">UPI: {form.upiId}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">Terms of Service</h3>
            <p className="font-body text-xs text-muted-foreground">This content will be shown on the Terms of Service page of the application.</p>
            <textarea
              rows={20}
              value={form.termsOfService}
              onChange={(e) => setForm({ ...form, termsOfService: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-y leading-relaxed"
            />
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">Privacy Policy</h3>
            <p className="font-body text-xs text-muted-foreground">This content will be shown on the Privacy Policy page of the application.</p>
            <textarea
              rows={20}
              value={form.privacyPolicy}
              onChange={(e) => setForm({ ...form, privacyPolicy: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-y leading-relaxed"
            />
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">Admin Access</h3>
            <p className="font-body text-xs text-muted-foreground">
              Change the admin login email/password. You must enter the current password to confirm.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Admin Email</label>
                <input
                  type="email"
                  value={adminCreds.newEmail}
                  onChange={(e) => setAdminCreds((p) => ({ ...p, newEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="admin@email.com"
                />
              </div>

              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">New Password</label>
                <input
                  type="password"
                  value={adminCreds.newPassword}
                  onChange={(e) => setAdminCreds((p) => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Current Password *</label>
                <input
                  type="password"
                  value={adminCreds.currentPassword}
                  onChange={(e) => setAdminCreds((p) => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Enter current password to confirm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleUpdateAdminCredentials} className="btn-crimson px-6 py-2.5 rounded-lg text-sm flex items-center gap-2">
                <Save size={16} /> Update Admin Login
              </button>
            </div>
          </div>
        )}

        {activeTab !== 'security' && (
          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <button onClick={handleSave} className="btn-crimson px-6 py-2.5 rounded-lg text-sm flex items-center gap-2">
              <Save size={16} /> Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
