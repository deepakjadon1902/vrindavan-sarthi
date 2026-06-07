import { useEffect, useMemo, useState } from 'react';
import { Download, Landmark, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/lib/apiError';

type PayoutPartner = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  bankDetails?: {
    account_holder_name?: string;
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    verified?: boolean;
    updatedAt?: string;
  };
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const AdminPartnerPayouts = () => {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<PayoutPartner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/payouts', withAuth(token));
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load partner payouts'));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.name, p.email, p.phone, p.businessName, p.bankDetails?.bank_name, p.bankDetails?.account_holder_name]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [items, search]);

  const exportCsv = () => {
    const rows = [
      ['Partner Name', 'Business Name', 'Email', 'Phone', 'Account Holder', 'Bank Name', 'Account Number', 'IFSC Code', 'Verified', 'Updated At'],
      ...filtered.map((p) => [
        p.name,
        p.businessName || '',
        p.email,
        p.phone || '',
        p.bankDetails?.account_holder_name || '',
        p.bankDetails?.bank_name || '',
        p.bankDetails?.account_number || '',
        p.bankDetails?.ifsc_code || '',
        p.bankDetails?.verified ? 'Yes' : 'No',
        p.bankDetails?.updatedAt ? new Date(p.bankDetails.updatedAt).toLocaleString('en-IN') : '',
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `partner-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Partner Payouts</h2>
          <p className="font-body text-xs text-muted-foreground">Verified partner bank details for offline settlements.</p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="btn-crimson px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-50">
          <Download size={16} /> Download CSV
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search partners..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center font-body text-sm text-muted-foreground">Loading payouts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Landmark size={42} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-body text-sm text-muted-foreground">No verified bank details found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {['Partner', 'Business', 'Bank', 'Account Holder', 'Account Number', 'IFSC', 'Updated'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-body text-sm">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-muted-foreground">{p.businessName || '-'}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{p.bankDetails?.bank_name || '-'}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{p.bankDetails?.account_holder_name || '-'}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{p.bankDetails?.account_number || '-'}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{p.bankDetails?.ifsc_code || '-'}</td>
                    <td className="px-4 py-3 font-body text-xs text-muted-foreground">
                      {p.bankDetails?.updatedAt ? new Date(p.bankDetails.updatedAt).toLocaleDateString('en-IN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPartnerPayouts;
