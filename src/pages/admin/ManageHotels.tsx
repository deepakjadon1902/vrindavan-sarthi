import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Hotel {
  id: string;
  name: string;
  location: string;
  pricePerNight: number;
  rating: number;
  image: string;
  description: string;
  amenities: string[];
  status: 'active' | 'inactive';
}

// Local storage key for hotels data
const STORAGE_KEY = 'vvs_hotels';

const getStoredHotels = (): Hotel[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveHotels = (hotels: Hotel[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hotels));
};

const ManageHotels = () => {
  const [hotels, setHotels] = useState<Hotel[]>(getStoredHotels);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '', location: '', pricePerNight: '', rating: '', description: '',
    amenities: '', status: 'active' as 'active' | 'inactive', image: '',
  });

  const resetForm = () => {
    setForm({ name: '', location: '', pricePerNight: '', rating: '', description: '', amenities: '', status: 'active', image: '' });
    setImagePreview('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setForm({ ...form, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = (hotel: Hotel) => {
    setForm({
      name: hotel.name, location: hotel.location, pricePerNight: String(hotel.pricePerNight),
      rating: String(hotel.rating), description: hotel.description,
      amenities: hotel.amenities.join(', '), status: hotel.status, image: hotel.image,
    });
    setImagePreview(hotel.image);
    setEditingId(hotel.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hotelData: Hotel = {
      id: editingId || `hotel-${Date.now()}`,
      name: form.name,
      location: form.location,
      pricePerNight: Number(form.pricePerNight),
      rating: Number(form.rating),
      image: form.image || '/placeholder.svg',
      description: form.description,
      amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean),
      status: form.status,
    };

    let updated: Hotel[];
    if (editingId) {
      updated = hotels.map((h) => (h.id === editingId ? hotelData : h));
      toast.success('Hotel updated successfully');
    } else {
      updated = [...hotels, hotelData];
      toast.success('Hotel added successfully');
    }
    setHotels(updated);
    saveHotels(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = hotels.filter((h) => h.id !== id);
    setHotels(updated);
    saveHotels(updated);
    setDeleteConfirm(null);
    toast.success('Hotel deleted');
  };

  const filtered = hotels.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" placeholder="Search hotels..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2">
          <Plus size={16} /> Add Hotel
        </button>
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Hotel' : 'Add New Hotel'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Image</label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImagePreview(''); setForm({ ...form, image: '' }); }}
                      className="absolute top-1 right-1 bg-foreground/70 text-primary-foreground rounded-full p-0.5">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-brand-gold/50 transition-colors">
                    <Upload size={20} className="text-muted-foreground mb-1" />
                    <span className="font-body text-xs text-muted-foreground">Upload</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Hotel name" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Location</label>
                <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan, UP" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Night (₹)</label>
                <input type="number" required value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="2000" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Rating (1-5)</label>
                <input type="number" min="1" max="5" step="0.1" required value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="4.5" />
              </div>
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Amenities (comma separated)</label>
              <input type="text" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="WiFi, AC, Parking, Temple View" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Hotel description..." />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-body text-sm font-medium text-foreground">Status:</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                className="px-3 py-1.5 rounded-lg border border-border bg-background font-body text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">
                {editingId ? 'Update Hotel' : 'Add Hotel'}
              </button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Hotel size={48} className="mx-auto mb-4 text-muted-foreground/30" />
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
                  <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((hotel) => (
                  <tr key={hotel.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="w-12 h-9 rounded overflow-hidden bg-muted">
                        {hotel.image && hotel.image !== '/placeholder.svg' ? (
                          <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground" /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{hotel.name}</td>
                    <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{hotel.location}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">₹{hotel.pricePerNight}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground hidden md:table-cell">⭐ {hotel.rating}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`font-body text-xs px-2 py-1 rounded-full ${hotel.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'}`}>
                        {hotel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(hotel)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil size={14} />
                        </button>
                        {deleteConfirm === hotel.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(hotel.id)} className="text-xs font-body text-destructive hover:underline">Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs font-body text-muted-foreground hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(hotel.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
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
