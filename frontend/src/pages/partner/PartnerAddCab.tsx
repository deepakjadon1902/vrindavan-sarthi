import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Image as ImageIcon, Car } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { publishAppEvent } from '@/lib/broadcast';

interface PartnerCab {
  _id: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber?: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  routes?: string[];
  basePrice?: number;
  pricePerKm?: number;
  description?: string;
  features?: string[];
  image?: string;
  images?: string[];
  status: 'available' | 'on-trip' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks?: string;
  createdAt: string;
}

const PartnerAddCab = () => {
  const token = useAuthStore((s) => s.token);
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<PartnerCab[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    vehicleName: '',
    vehicleType: 'Sedan',
    vehicleNumber: '',
    capacity: '4',
    driverName: '',
    driverPhone: '',
    routes: '',
    basePrice: '',
    pricePerKm: '',
    description: '',
    features: '',
    images: [] as string[],
  });

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/my-listings', withAuth(token));
      const cabs = Array.isArray(res.data?.data?.cabs) ? res.data.data.cabs : [];
      setItems(cabs);
    } catch {
      toast.error('Failed to load your cabs');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    const target = items.find((i) => i._id === editId);
    if (!target) return;

    setForm({
      vehicleName: target.vehicleName || '',
      vehicleType: target.vehicleType || 'Sedan',
      vehicleNumber: target.vehicleNumber || '',
      capacity: String(target.capacity ?? 4),
      driverName: target.driverName || '',
      driverPhone: target.driverPhone || '',
      routes: (target.routes || []).join(', '),
      basePrice: String(target.basePrice ?? ''),
      pricePerKm: String(target.pricePerKm ?? ''),
      description: target.description || '',
      features: (target.features || []).join(', '),
      images: [target.image, ...(target.images || [])].filter(Boolean) as string[],
    });
    setEditingId(target._id);
    setShowForm(true);

    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [items, searchParams, setSearchParams]);

  const resetForm = () => {
    setForm({
      vehicleName: '',
      vehicleType: 'Sedan',
      vehicleNumber: '',
      capacity: '4',
      driverName: '',
      driverPhone: '',
      routes: '',
      basePrice: '',
      pricePerKm: '',
      description: '',
      features: '',
      images: [],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, images: [...prev.images, reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.vehicleName || !form.driverName || !form.driverPhone) {
      toast.error('Fill required fields');
      return;
    }

    const payload = {
      vehicleName: form.vehicleName,
      vehicleType: form.vehicleType,
      vehicleNumber: form.vehicleNumber,
      capacity: Number(form.capacity || 4),
      driverName: form.driverName,
      driverPhone: form.driverPhone,
      routes: form.routes
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      basePrice: form.basePrice ? Number(form.basePrice) : undefined,
      pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
      description: form.description,
      features: form.features
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      image: form.images[0] || '/placeholder.svg',
      images: form.images.slice(1),
    };

    try {
      if (editingId) {
        const res = await api.put(`/partner/cabs/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as PartnerCab;
        setItems((prev) => prev.map((c) => (c._id === editingId ? updated : c)));
        toast.success('Cab resubmitted for approval');
      } else {
        const res = await api.post('/partner/cabs', payload, withAuth(token));
        const created = res.data?.data as PartnerCab;
        setItems((prev) => [created, ...prev]);
        toast.success('Cab submitted for admin approval');
      }
      publishAppEvent('listing:changed');
      resetForm();
    } catch {
      toast.error(editingId ? 'Update failed' : 'Submit failed');
    }
  };

  const handleEdit = (item: PartnerCab) => {
    setForm({
      vehicleName: item.vehicleName || '',
      vehicleType: item.vehicleType || 'Sedan',
      vehicleNumber: item.vehicleNumber || '',
      capacity: String(item.capacity ?? 4),
      driverName: item.driverName || '',
      driverPhone: item.driverPhone || '',
      routes: (item.routes || []).join(', '),
      basePrice: String(item.basePrice ?? ''),
      pricePerKm: String(item.pricePerKm ?? ''),
      description: item.description || '',
      features: (item.features || []).join(', '),
      images: [item.image, ...(item.images || [])].filter(Boolean) as string[],
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/partner/cabs/${id}`, withAuth(token));
      setItems((prev) => prev.filter((c) => c._id !== id));
      toast.success('Deleted');
      publishAppEvent('listing:changed');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (c) =>
          c.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
          c.driverName.toLowerCase().includes(search.toLowerCase())
      ),
    [items, search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">My Cabs</h2>
        <p className="font-body text-xs text-muted-foreground">
          Submit cabs for approval. Approved cabs go live on the main application.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cabs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-gold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus size={16} /> Submit Cab
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit & Resubmit' : 'Submit New Cab'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Name *</label>
                <input
                  type="text"
                  required
                  value={form.vehicleName}
                  onChange={(e) => setForm({ ...form, vehicleName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Type</label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm"
                >
                  <option>Sedan</option>
                  <option>SUV</option>
                  <option>Hatchback</option>
                  <option>Tempo Traveller</option>
                </select>
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Number</label>
                <input
                  type="text"
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Driver Name *</label>
                <input
                  type="text"
                  required
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Driver Phone *</label>
                <input
                  type="tel"
                  required
                  value={form.driverPhone}
                  onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Base Price (₹)</label>
                <input
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Km (₹)</label>
                <input
                  type="number"
                  value={form.pricePerKm}
                  onChange={(e) => setForm({ ...form, pricePerKm: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Routes (comma separated)</label>
              <input
                type="text"
                value={form.routes}
                onChange={(e) => setForm({ ...form, routes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="Vrindavan to Mathura, Vrindavan to Agra"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Features (comma separated)</label>
              <input
                type="text"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="AC, Music"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-2 block">Photos</label>
              <div className="flex flex-wrap gap-3 mb-3">
                {form.images.map((img, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-primary-foreground flex items-center justify-center"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                  <ImageIcon size={20} className="text-muted-foreground mb-1" />
                  <span className="font-body text-[10px] text-muted-foreground">Upload</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">First photo becomes the main photo.</p>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-xl text-sm">
                {editingId ? 'Resubmit' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-xl text-sm border border-border font-body hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Car size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No cab submissions</p>
          <p className="font-body text-sm text-muted-foreground">Submit your first cab to get started.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Driver</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Admin</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{c.vehicleName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">
                    {c.driverName} ({c.driverPhone})
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(c.approvalStatus)}`}>
                      {c.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">
                    {c.adminRemarks || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteConfirm === c._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="text-xs font-body text-destructive hover:underline"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs font-body text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(c._id)}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PartnerAddCab;
