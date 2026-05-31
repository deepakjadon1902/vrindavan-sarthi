import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Fare = {
  _id: string;
  pickupLocation: string;
  dropLocation: string;
  cabType: string;
  baseFare: number;
  includedPersons: number;
  extraPersonCharge: number;
  status: 'active' | 'inactive';
  updatedAt?: string;
};

const ManageCabFares = () => {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<Fare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    pickupLocation: '',
    dropLocation: '',
    cabType: '',
    baseFare: '0',
    status: 'active' as Fare['status'],
  });

  const reset = () => {
    setForm({
      pickupLocation: '',
      dropLocation: '',
      cabType: '',
      baseFare: '0',
      status: 'active',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/cab-fares/all', withAuth(token));
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load fares');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => String(a.pickupLocation).localeCompare(String(b.pickupLocation))),
    [items]
  );

  const startEdit = (f: Fare) => {
    setForm({
      pickupLocation: f.pickupLocation || '',
      dropLocation: f.dropLocation || '',
      cabType: f.cabType || '',
      baseFare: String(f.baseFare ?? 0),
      status: f.status || 'active',
    });
    setEditingId(f._id);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.pickupLocation || !form.dropLocation || !form.cabType) return toast.error('Fill required fields');

    const payload = {
      pickupLocation: form.pickupLocation,
      dropLocation: form.dropLocation,
      cabType: form.cabType,
      baseFare: Number(form.baseFare || 0),
      includedPersons: 0,
      extraPersonCharge: 0,
      status: form.status,
    };

    try {
      if (editingId) {
        const res = await api.put(`/cab-fares/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as Fare;
        setItems((prev) => prev.map((x) => (x._id === editingId ? updated : x)));
        toast.success('Fare updated');
      } else {
        const res = await api.post('/cab-fares', payload, withAuth(token));
        const created = res.data?.data as Fare;
        setItems((prev) => [created, ...prev]);
        toast.success('Fare added');
      }
      reset();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const remove = async () => {
    if (!token || !deleteId) return;
    try {
      await api.delete(`/cab-fares/${deleteId}`, withAuth(token));
      setItems((prev) => prev.filter((x) => x._id !== deleteId));
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-foreground">Cab Fare Settings</h2>
        <button
          onClick={() => {
            reset();
            setShowForm(true);
          }}
          className="btn-crimson px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"
        >
          <Plus size={16} /> Add Fare
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Fare' : 'Add Fare'}</h3>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pickup Location</label>
              <input value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Drop Location</label>
              <input value={form.dropLocation} onChange={(e) => setForm({ ...form, dropLocation: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Model & Seats</label>
              <input value={form.cabType} onChange={(e) => setForm({ ...form, cabType: e.target.value })} placeholder="Swift Dzire - 4-Seater" className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Base Fare</label>
              <input type="number" min={0} value={form.baseFare} onChange={(e) => setForm({ ...form, baseFare: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Fare['status'] })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={reset} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading fares…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">No fare rules yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Route</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Base</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm text-foreground">{f.pickupLocation} → {f.dropLocation}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">{f.cabType}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">₹{Number(f.baseFare || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full capitalize ${f.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => startEdit(f)} className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-muted inline-flex items-center gap-2">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => setDeleteId(f._id)} className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-destructive/10 text-destructive inline-flex items-center gap-2">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
          <p className="font-body text-sm text-muted-foreground">Delete this fare rule?</p>
          <div className="flex gap-2">
            <button onClick={remove} className="px-3 py-2 rounded-lg text-xs font-body bg-destructive text-primary-foreground">Delete</button>
            <button onClick={() => setDeleteId(null)} className="px-3 py-2 rounded-lg text-xs font-body border border-border">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCabFares;
