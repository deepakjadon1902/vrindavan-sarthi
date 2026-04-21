import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Image as ImageIcon, Map } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { publishAppEvent } from '@/lib/broadcast';

interface PartnerTour {
  _id: string;
  name: string;
  duration: string;
  pricePerPerson: number;
  groupSize?: number;
  startPoint?: string;
  endPoint?: string;
  image?: string;
  images?: string[];
  description?: string;
  itinerary?: string;
  includes?: string[];
  excludes?: string[];
  highlights?: string[];
  status: 'active' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks?: string;
  createdAt: string;
}

const PartnerAddTour = () => {
  const token = useAuthStore((s) => s.token);
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<PartnerTour[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    duration: '',
    pricePerPerson: '',
    groupSize: '10',
    startPoint: '',
    endPoint: '',
    description: '',
    itinerary: '',
    includes: '',
    excludes: '',
    highlights: '',
    images: [] as string[],
  });

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/my-listings', withAuth(token));
      const tours = Array.isArray(res.data?.data?.tours) ? res.data.data.tours : [];
      setItems(tours);
    } catch {
      toast.error('Failed to load your tours');
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
      name: target.name || '',
      duration: target.duration || '',
      pricePerPerson: String(target.pricePerPerson ?? ''),
      groupSize: String(target.groupSize ?? 10),
      startPoint: target.startPoint || '',
      endPoint: target.endPoint || '',
      description: target.description || '',
      itinerary: target.itinerary || '',
      includes: (target.includes || []).join(', '),
      excludes: (target.excludes || []).join(', '),
      highlights: (target.highlights || []).join(', '),
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
      name: '',
      duration: '',
      pricePerPerson: '',
      groupSize: '10',
      startPoint: '',
      endPoint: '',
      description: '',
      itinerary: '',
      includes: '',
      excludes: '',
      highlights: '',
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
    if (!form.name || !form.duration || !form.pricePerPerson) {
      toast.error('Fill required fields');
      return;
    }

    const payload = {
      name: form.name,
      duration: form.duration,
      pricePerPerson: Number(form.pricePerPerson),
      groupSize: Number(form.groupSize || 10),
      startPoint: form.startPoint,
      endPoint: form.endPoint,
      description: form.description,
      itinerary: form.itinerary,
      includes: form.includes
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      excludes: form.excludes
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      highlights: form.highlights
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      image: form.images[0] || '/placeholder.svg',
      images: form.images.slice(1),
    };

    try {
      if (editingId) {
        const res = await api.put(`/partner/tours/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as PartnerTour;
        setItems((prev) => prev.map((t) => (t._id === editingId ? updated : t)));
        toast.success('Tour resubmitted for approval');
      } else {
        const res = await api.post('/partner/tours', payload, withAuth(token));
        const created = res.data?.data as PartnerTour;
        setItems((prev) => [created, ...prev]);
        toast.success('Tour submitted for admin approval');
      }
      publishAppEvent('listing:changed');
      resetForm();
    } catch {
      toast.error(editingId ? 'Update failed' : 'Submit failed');
    }
  };

  const handleEdit = (item: PartnerTour) => {
    setForm({
      name: item.name || '',
      duration: item.duration || '',
      pricePerPerson: String(item.pricePerPerson ?? ''),
      groupSize: String(item.groupSize ?? 10),
      startPoint: item.startPoint || '',
      endPoint: item.endPoint || '',
      description: item.description || '',
      itinerary: item.itinerary || '',
      includes: (item.includes || []).join(', '),
      excludes: (item.excludes || []).join(', '),
      highlights: (item.highlights || []).join(', '),
      images: [item.image, ...(item.images || [])].filter(Boolean) as string[],
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/partner/tours/${id}`, withAuth(token));
      setItems((prev) => prev.filter((t) => t._id !== id));
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

  const filtered = useMemo(() => items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">My Tours</h2>
        <p className="font-body text-xs text-muted-foreground">
          Submit tours for approval. Approved tours go live on the main application.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tours..."
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
          <Plus size={16} /> Submit Tour
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit & Resubmit' : 'Submit New Tour'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Duration *</label>
                <input
                  type="text"
                  required
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="1 Day"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Person (₹) *</label>
                <input
                  type="number"
                  required
                  value={form.pricePerPerson}
                  onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Group Size</label>
                <input
                  type="number"
                  min="1"
                  value={form.groupSize}
                  onChange={(e) => setForm({ ...form, groupSize: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Start Point</label>
                <input
                  type="text"
                  value={form.startPoint}
                  onChange={(e) => setForm({ ...form, startPoint: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">End Point</label>
                <input
                  type="text"
                  value={form.endPoint}
                  onChange={(e) => setForm({ ...form, endPoint: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Includes (comma separated)</label>
              <input
                type="text"
                value={form.includes}
                onChange={(e) => setForm({ ...form, includes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="Guide, Pickup"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Highlights (comma separated)</label>
              <input
                type="text"
                value={form.highlights}
                onChange={(e) => setForm({ ...form, highlights: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Excludes (comma separated)</label>
              <input
                type="text"
                value={form.excludes}
                onChange={(e) => setForm({ ...form, excludes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Itinerary</label>
              <textarea
                rows={4}
                value={form.itinerary}
                onChange={(e) => setForm({ ...form, itinerary: e.target.value })}
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
          <Map size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No tour submissions</p>
          <p className="font-body text-sm text-muted-foreground">Submit your first tour to get started.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Tour</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Duration</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Admin</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">{t.duration}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{t.pricePerPerson}</td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(t.approvalStatus)}`}>
                      {t.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">
                    {t.adminRemarks || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteConfirm === t._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(t._id)}
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
                          onClick={() => setDeleteConfirm(t._id)}
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

export default PartnerAddTour;
