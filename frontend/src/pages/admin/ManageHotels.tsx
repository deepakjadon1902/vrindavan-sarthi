import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { publishAppEvent } from '@/lib/broadcast';

interface Hotel {
  _id: string;
  name: string;
  location: string;
  pricePerNight: number;
  rating: number;
  image?: string;
  images?: string[];
  description?: string;
  amenities?: string[];
  status: 'active' | 'inactive';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  partnerName?: string;
}

const ManageHotels = () => {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    location: '',
    pricePerNight: '',
    rating: '',
    description: '',
    amenities: '',
    status: 'active' as Hotel['status'],
    image: '',
  });

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/hotels/all', withAuth(token));
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: unknown) {
      toast.error('Failed to load hotels');
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
      location: '',
      pricePerNight: '',
      rating: '',
      description: '',
      amenities: '',
      status: 'active',
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

  const handleEdit = (hotel: Hotel) => {
    setForm({
      name: hotel.name || '',
      location: hotel.location || '',
      pricePerNight: String(hotel.pricePerNight ?? ''),
      rating: String(hotel.rating ?? ''),
      description: hotel.description || '',
      amenities: (hotel.amenities || []).join(', '),
      status: hotel.status || 'active',
      image: hotel.image || '',
    });
    setImagePreview(hotel.image || '');
    setEditingId(hotel._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const payload = {
      name: form.name,
      location: form.location,
      pricePerNight: Number(form.pricePerNight),
      rating: Number(form.rating || 0),
      image: form.image || '/placeholder.svg',
      description: form.description,
      amenities: form.amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      status: form.status,
      approvalStatus: 'approved',
      partnerSubmitted: false,
    };

    try {
      if (editingId) {
        const res = await api.put(`/hotels/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as Hotel;
        setItems((prev) => prev.map((h) => (h._id === editingId ? updated : h)));
        toast.success('Hotel updated');
      } else {
        const res = await api.post('/hotels', payload, withAuth(token));
        const created = res.data?.data as Hotel;
        setItems((prev) => [created, ...prev]);
        toast.success('Hotel added');
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
      await api.delete(`/hotels/${id}`, withAuth(token));
      setItems((prev) => prev.filter((h) => h._id !== id));
      toast.success('Hotel deleted');
      publishAppEvent('listing:changed');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (h) =>
          h.name.toLowerCase().includes(search.toLowerCase()) ||
          h.location.toLowerCase().includes(search.toLowerCase())
      ),
    [items, search]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search hotels..."
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
          <Plus size={16} /> Add Hotel
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Hotel' : 'Add New Hotel'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Image</label>
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
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Krishna Palace"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Location</label>
                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Vrindavan"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Night (₹)</label>
                <input
                  type="number"
                  required
                  value={form.pricePerNight}
                  onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Rating</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="4.5"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="font-body text-sm font-medium text-foreground">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Hotel['status'] })}
                className="px-3 py-1.5 rounded-lg border border-border bg-background font-body text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Amenities (comma separated)</label>
              <input
                type="text"
                value={form.amenities}
                onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="WiFi, TV, Hot Water"
              />
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                placeholder="Hotel details..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">
                {editingId ? 'Update' : 'Add Hotel'}
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
          <p className="font-body text-muted-foreground">Loading hotels…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No hotels added yet</p>
          <p className="font-body text-xs text-muted-foreground/60 mt-1">Click "Add Hotel" to get started</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Image</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Rating</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Listed By</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((hotel) => (
                  <tr key={hotel._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="w-12 h-9 rounded overflow-hidden bg-muted">
                        {hotel.image && hotel.image !== '/placeholder.svg' ? (
                          <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={14} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{hotel.name}</td>
                    <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{hotel.location}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">₹{hotel.pricePerNight}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground hidden md:table-cell">⭐ {hotel.rating}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`font-body text-xs px-2 py-1 rounded-full ${
                          hotel.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {hotel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">
                      {hotel.partnerName || 'Admin'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(hotel)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil size={14} />
                        </button>
                        {deleteConfirm === hotel._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(hotel._id)}
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
                            onClick={() => setDeleteConfirm(hotel._id)}
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
        </div>
      )}
    </div>
  );
};

export default ManageHotels;
