import { useEffect, useState } from 'react';
import { Landmark, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/lib/apiError';

const PartnerBankDetails = () => {
  const token = useAuthStore((s) => s.token);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
  });

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await api.get('/partner/bank-details', withAuth(token));
        const data = res.data?.data || {};
        setForm({
          account_holder_name: data.account_holder_name || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          confirm_account_number: data.account_number || '',
          ifsc_code: data.ifsc_code || '',
        });
      } catch {
        // Empty state is fine for first-time setup.
      }
    };
    void load();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error('Not authenticated');
    if (form.account_number !== form.confirm_account_number) return toast.error('Account numbers must match');
    try {
      setIsSaving(true);
      const res = await api.put('/partner/bank-details', form, withAuth(token));
      const data = res.data?.data || {};
      setForm((prev) => ({
        ...prev,
        account_number: data.account_number || prev.account_number,
        confirm_account_number: data.account_number || prev.confirm_account_number,
        ifsc_code: data.ifsc_code || prev.ifsc_code,
      }));
      toast.success('Bank details saved');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save bank details'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Bank Details</h2>
        <p className="font-body text-xs text-muted-foreground">Used by admin for partner payout settlements.</p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-brand-gold/20 bg-brand-cream p-4">
          <Landmark size={20} className="text-brand-crimson" />
          <p className="font-body text-xs text-muted-foreground">Please enter accurate bank details. Admin will use these details for offline payout processing.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Account Holder Name *</label>
            <input required value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Bank Name *</label>
            <input required value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Account Number *</label>
            <input required value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\s/g, '') })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Confirm Account Number *</label>
            <input required value={form.confirm_account_number} onChange={(e) => setForm({ ...form, confirm_account_number: e.target.value.replace(/\s/g, '') })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">IFSC Code *</label>
            <input required value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase().replace(/\s/g, '') })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="ABCD0123456" />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-crimson px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save Bank Details'}
        </button>
      </form>
    </div>
  );
};

export default PartnerBankDetails;
