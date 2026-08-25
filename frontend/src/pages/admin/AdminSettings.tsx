import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { Settings, Save, CreditCard, FileText, Shield, Lock, ShoppingBag, PackageSearch, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import axios from 'axios';

const AdminSettings = () => {
  const { settings, saveSettings, refreshSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'payment' | 'features' | 'terms' | 'privacy' | 'partnerPolicies' | 'security'>('payment');

  const [form, setForm] = useState({ ...settings });
  const [savingFeature, setSavingFeature] = useState<'shopEnabled' | 'trackOrderEnabled' | null>(null);
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
    if (res.success) {
      await refreshSettings();
      toast.success('Settings saved successfully!');
    }
    else toast.error(res.error || 'Failed to save settings');
  };

  const handleToggleFeature = async (key: 'shopEnabled' | 'trackOrderEnabled') => {
    const nextForm = { ...form, [key]: !form[key] };
    setForm(nextForm);
    setSavingFeature(key);
    const res = await saveSettings(nextForm);
    setSavingFeature(null);

    if (!res.success) {
      setForm({ ...settings });
      toast.error(res.error || 'Failed to update feature visibility');
      return;
    }

    await refreshSettings();
    toast.success(`${key === 'shopEnabled' ? 'Shop' : 'Track Order'} ${nextForm[key] ? 'unblocked' : 'blocked'} successfully`);
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
    { id: 'features' as const, label: 'Feature Visibility', icon: Eye },
    { id: 'terms' as const, label: 'Terms of Service', icon: FileText },
    { id: 'privacy' as const, label: 'Privacy Policy', icon: Shield },
    { id: 'partnerPolicies' as const, label: 'Partner T&C', icon: FileText },
    { id: 'security' as const, label: 'Security', icon: Lock },
  ];

  const featureCards = [
    {
      key: 'shopEnabled' as const,
      title: 'Shop',
      description: 'Controls the public shop page, product detail pages, featured products, shop links, and new product orders.',
      icon: ShoppingBag,
    },
    {
      key: 'trackOrderEnabled' as const,
      title: 'Track Order',
      description: 'Controls the public tracking page, navbar link, order success tracking link, and public tracking lookup.',
      icon: PackageSearch,
    },
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
              <p className="font-body text-sm text-foreground">Configure your UPI ID here. When users book hotels, rooms, cabs, or tours, a UPI QR code will be generated with this ID for payment.</p>
              <p className="font-body text-xs text-muted-foreground mt-1">Cab bookings collect a 30% advance online and the remaining 70% offline with the driver.</p>
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
                  placeholder="Vrindavan Sarthi" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Default Hotel Taxes (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.01}
                  value={String(form.hotelTaxPercent ?? 12)}
                  onChange={(e) => setForm({ ...form, hotelTaxPercent: Number(e.target.value || 0) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="12"
                />
                <p className="font-body text-xs text-muted-foreground mt-1">Fallback hotel tax rate for room bookings when a property does not define its own percentage.</p>
              </div>
            </div>
            {form.upiId && (
              <div className="bg-muted rounded-xl p-6 text-center">
                <p className="font-body text-sm text-muted-foreground mb-3">QR Code Preview (Sample ₹100)</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${form.upiId}&pn=${form.upiName}&am=100&cu=INR&tn=Vrindavan Sarthi Booking`)}`}
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

        {activeTab === 'features' && (
          <div className="space-y-5">
            <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">Main Application Visibility</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {featureCards.map((feature) => {
                const enabled = Boolean(form[feature.key]);
                const Icon = feature.icon;
                return (
                  <div key={feature.key} className="rounded-xl border border-border bg-background p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon size={18} className={enabled ? 'text-brand-green' : 'text-destructive'} />
                          <h4 className="font-heading text-base font-bold text-foreground">{feature.title}</h4>
                        </div>
                        <p className="mt-2 font-body text-xs leading-5 text-muted-foreground">{feature.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-bold ${enabled ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive'}`}>
                        {enabled ? 'Visible' : 'Blocked'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFeature(feature.key)}
                      disabled={savingFeature === feature.key}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-body text-sm font-semibold transition-colors ${
                        enabled
                          ? 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
                          : 'btn-gold'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {enabled ? <EyeOff size={16} /> : <Eye size={16} />}
                      {savingFeature === feature.key ? 'Saving...' : enabled ? `Block ${feature.title}` : `Unblock ${feature.title}`}
                    </button>
                  </div>
                );
              })}
            </div>
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

        {activeTab === 'partnerPolicies' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-3">Partner Terms, Conditions & Policies</h3>
              <p className="mt-2 font-body text-xs text-muted-foreground">This content is shown inside the Partner Dashboard under Partner T&C.</p>
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Partner Terms & Conditions</label>
              <textarea
                rows={12}
                value={form.partnerTerms}
                onChange={(e) => setForm({ ...form, partnerTerms: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-y leading-relaxed"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Partner Policies</label>
              <textarea
                rows={12}
                value={form.partnerPolicies}
                onChange={(e) => setForm({ ...form, partnerPolicies: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-y leading-relaxed"
              />
            </div>
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
