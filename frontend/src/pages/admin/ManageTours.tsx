import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Map } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { publishAppEvent } from '@/lib/broadcast';

interface Tour {
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
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  partnerName?: string;
}

const ManageTours = () => {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<Tour[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [form, setForm] = useState({
    name: '',
    duration: '',
    pricePerPerson: '',
    groupSize: '10',
    startPoint: '',
    endPoint: '',
    status: 'active' as Tour['status'],
    description: '',
    itinerary: '',
    includes: '',
    excludes: '',
    highlights: '',
    image: '',
  });

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/tours/all', withAuth(token));
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error('Failed to load tours');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setForm({
      name: '',
      duration: '',
      pricePerPerson: '',
      groupSize: '10',
      startPoint: '',
      endPoint: '',
      status: 'active',
      description: '',
      itinerary: '',
      includes: '',
      excludes: '',
      highlights: '',
      image: '',
    });
    setImagePreview('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setForm((prev) => ({ ...prev, image: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (item: Tour) => {
    setForm({
      name: item.name || '',
      duration: item.duration || '',
      pricePerPerson: String(item.pricePerPerson ?? ''),
      groupSize: String(item.groupSize ?? 10),
      startPoint: item.startPoint || '',
      endPoint: item.endPoint || '',
      status: item.status || 'active',
      description: item.description || '',
      itinerary: item.itinerary || '',
      includes: (item.includes || []).join(', '),
      excludes: (item.excludes || []).join(', '),
      highlights: (item.highlights || []).join(', '),
      image: item.image || '',
    });
    setImagePreview(item.image || '');
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const payload = {
      name: form.name,
      duration: form.duration,
      pricePerPerson: Number(form.pricePerPerson),
      groupSize: Number(form.groupSize || 10),
      startPoint: form.startPoint,
      endPoint: form.endPoint,
      image: form.image || '/placeholder.svg',
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
      status: form.status,
      approvalStatus: 'approved',
      partnerSubmitted: false,
    };

    try {
      if (editingId) {
        const res = await api.put(`/tours/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as Tour;
        setItems((prev) => prev.map((t) => (t._id === editingId ? updated : t)));
        toast.success('Tour updated');
      } else {
        const res = await api.post('/tours', payload, withAuth(token));
        const created = res.data?.data as Tour;
        setItems((prev) => [created, ...prev]);
        toast.success('Tour added');
      }
      publishAppEvent('listing:changed');
      resetForm();
    } catch {
      toast.error(editingId ? 'Update failed' : 'Create failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/tours/${id}`, withAuth(token));
      setItems((prev) => prev.filter((t) => t._id !== id));
      toast.success('Tour deleted');
      publishAppEvent('listing:changed');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  return (
    <div className="space-y-6">
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
          className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus size={16} /> Add Tour
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Tour' : 'Add New Tour'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Image</label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('');
                        setForm((prev) => ({ ...prev, image: '' }));
                      }}
                      className="absolute top-1 right-1 bg-foreground/80 text-primary-foreground rounded-full p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                    <Upload size={18} className="text-muted-foreground mb-1" />
                    <span className="font-body text-xs text-muted-foreground">Upload</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Govardhan Parikrama"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Duration</label>
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
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Person (₹)</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Tour['status'] })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">
                {editingId ? 'Update' : 'Add Tour'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-muted-foreground">Loading tours…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Map size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No tours added yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Image</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Duration</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Person</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Listed By</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="w-12 h-9 rounded overflow-hidden bg-muted">
                      {item.image && item.image !== '/placeholder.svg' ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={14} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.duration}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerPerson}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`font-body text-xs px-2 py-1 rounded-full ${
                        item.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">
                    {item.partnerName || 'Admin'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteConfirm === item._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(item._id)}
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
                          onClick={() => setDeleteConfirm(item._id)}
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

export default ManageTours;
