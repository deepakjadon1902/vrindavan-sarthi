import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Image as ImageIcon, BedDouble } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { publishAppEvent } from '@/lib/broadcast';

interface PartnerRoom {
  _id: string;
  hotelName: string;
  name: string;
  type: string;
  floor?: string;
  pricePerNight: number;
  pricePerBed?: number;
  capacity: number;
  bedCount?: number;
  isAC: boolean;
  hasAttachedBathroom?: boolean;
  hasBalcony?: boolean;
  hasTV?: boolean;
  hasWiFi?: boolean;
  image?: string;
  images?: string[];
  amenities?: string[];
  description?: string;
  status: 'available' | 'booked' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks?: string;
  createdAt: string;
}

const PartnerAddRoom = () => {
  const token = useAuthStore((s) => s.token);
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<PartnerRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    hotelName: '',
    name: '',
    type: 'Double Bed',
    floor: '',
    pricePerNight: '',
    pricePerBed: '',
    capacity: '2',
    bedCount: '1',
    isAC: true,
    hasAttachedBathroom: true,
    hasBalcony: false,
    hasTV: true,
    hasWiFi: true,
    amenities: '',
    description: '',
    images: [] as string[],
  });

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/my-listings', withAuth(token));
      const rooms = Array.isArray(res.data?.data?.rooms) ? res.data.data.rooms : [];
      setItems(rooms);
    } catch {
      toast.error('Failed to load your rooms');
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
      hotelName: target.hotelName || '',
      name: target.name || '',
      type: target.type || 'Double Bed',
      floor: target.floor || '',
      pricePerNight: String(target.pricePerNight ?? ''),
      pricePerBed: String(target.pricePerBed ?? 0),
      capacity: String(target.capacity ?? 2),
      bedCount: String(target.bedCount ?? 1),
      isAC: Boolean(target.isAC),
      hasAttachedBathroom: Boolean(target.hasAttachedBathroom ?? true),
      hasBalcony: Boolean(target.hasBalcony ?? false),
      hasTV: Boolean(target.hasTV ?? true),
      hasWiFi: Boolean(target.hasWiFi ?? true),
      amenities: (target.amenities || []).join(', '),
      description: target.description || '',
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
      hotelName: '',
      name: '',
      type: 'Double Bed',
      floor: '',
      pricePerNight: '',
      pricePerBed: '',
      capacity: '2',
      bedCount: '1',
      isAC: true,
      hasAttachedBathroom: true,
      hasBalcony: false,
      hasTV: true,
      hasWiFi: true,
      amenities: '',
      description: '',
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
    if (!form.name || !form.hotelName || !form.pricePerNight) {
      toast.error('Fill required fields');
      return;
    }

    const payload = {
      hotelName: form.hotelName,
      name: form.name,
      type: form.type,
      floor: form.floor,
      pricePerNight: Number(form.pricePerNight),
      pricePerBed: Number(form.pricePerBed || 0),
      capacity: Number(form.capacity || 2),
      bedCount: Number(form.bedCount || 1),
      isAC: form.isAC,
      hasAttachedBathroom: form.hasAttachedBathroom,
      hasBalcony: form.hasBalcony,
      hasTV: form.hasTV,
      hasWiFi: form.hasWiFi,
      amenities: form.amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      description: form.description,
      image: form.images[0] || '/placeholder.svg',
      images: form.images.slice(1),
    };

    try {
      if (editingId) {
        const res = await api.put(`/partner/rooms/${editingId}`, payload, withAuth(token));
        const updated = res.data?.data as PartnerRoom;
        setItems((prev) => prev.map((r) => (r._id === editingId ? updated : r)));
        toast.success('Room resubmitted for approval');
      } else {
        const res = await api.post('/partner/rooms', payload, withAuth(token));
        const created = res.data?.data as PartnerRoom;
        setItems((prev) => [created, ...prev]);
        toast.success('Room submitted for admin approval');
      }
      publishAppEvent('listing:changed');
      resetForm();
    } catch {
      toast.error(editingId ? 'Update failed' : 'Submit failed');
    }
  };

  const handleEdit = (item: PartnerRoom) => {
    setForm({
      hotelName: item.hotelName || '',
      name: item.name || '',
      type: item.type || 'Double Bed',
      floor: item.floor || '',
      pricePerNight: String(item.pricePerNight ?? ''),
      pricePerBed: String(item.pricePerBed ?? 0),
      capacity: String(item.capacity ?? 2),
      bedCount: String(item.bedCount ?? 1),
      isAC: Boolean(item.isAC),
      hasAttachedBathroom: Boolean(item.hasAttachedBathroom ?? true),
      hasBalcony: Boolean(item.hasBalcony ?? false),
      hasTV: Boolean(item.hasTV ?? true),
      hasWiFi: Boolean(item.hasWiFi ?? true),
      amenities: (item.amenities || []).join(', '),
      description: item.description || '',
      images: [item.image, ...(item.images || [])].filter(Boolean) as string[],
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/partner/rooms/${id}`, withAuth(token));
      setItems((prev) => prev.filter((r) => r._id !== id));
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
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.hotelName.toLowerCase().includes(search.toLowerCase())
      ),
    [items, search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">My Rooms</h2>
        <p className="font-body text-xs text-muted-foreground">
          Submit rooms for approval. Approved rooms go live on the main application.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search rooms..."
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
          <Plus size={16} /> Submit Room
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit & Resubmit' : 'Submit New Room'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Room Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Name *</label>
                <input
                  type="text"
                  required
                  value={form.hotelName}
                  onChange={(e) => setForm({ ...form, hotelName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm"
                >
                  <option>Single Bed</option>
                  <option>Double Bed</option>
                  <option>Triple Bed</option>
                  <option>Dormitory</option>
                </select>
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Floor</label>
                <input
                  type="text"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
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
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Beds</label>
                <input
                  type="number"
                  min="1"
                  value={form.bedCount}
                  onChange={(e) => setForm({ ...form, bedCount: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Night (₹) *</label>
                <input
                  type="number"
                  required
                  value={form.pricePerNight}
                  onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Bed (₹)</label>
                <input
                  type="number"
                  value={form.pricePerBed}
                  onChange={(e) => setForm({ ...form, pricePerBed: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {(
                [
                  ['isAC', 'AC'],
                  ['hasAttachedBathroom', 'Attached Bathroom'],
                  ['hasBalcony', 'Balcony'],
                  ['hasTV', 'TV'],
                  ['hasWiFi', 'WiFi'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 font-body text-sm">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked } as any)}
                    className="rounded border-border"
                  />{' '}
                  {label}
                </label>
              ))}
            </div>

            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Amenities (comma separated)</label>
              <input
                type="text"
                value={form.amenities}
                onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="Hot water, Parking"
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
          <BedDouble size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No room submissions</p>
          <p className="font-body text-sm text-muted-foreground">Submit your first room to get started.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Room</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Hotel</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Admin</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">{r.hotelName}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{r.pricePerNight}</td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(r.approvalStatus)}`}>
                      {r.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">
                    {r.adminRemarks || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(r)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteConfirm === r._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(r._id)}
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
                          onClick={() => setDeleteConfirm(r._id)}
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

export default PartnerAddRoom;
