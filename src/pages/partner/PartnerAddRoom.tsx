import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, BedDouble } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface PartnerRoom {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  businessName: string;
  hotelName: string;
  name: string;
  type: string;
  floor: string;
  pricePerNight: number;
  pricePerBed: number;
  capacity: number;
  bedCount: number;
  isAC: boolean;
  hasAttachedBathroom: boolean;
  hasBalcony: boolean;
  hasTV: boolean;
  hasWiFi: boolean;
  image: string;
  images: string[];
  amenities: string[];
  description: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks: string;
  createdAt: string;
}

const STORAGE_KEY = 'vvs_partner_rooms';
const getStored = (): PartnerRoom[] => { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; } catch { return []; } };
const save = (data: PartnerRoom[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const PartnerAddRoom = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<PartnerRoom[]>(() => getStored().filter(i => i.partnerId === user?.id));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const [form, setForm] = useState({
    hotelName: '', name: '', type: 'Double Bed', floor: '', pricePerNight: '', pricePerBed: '',
    capacity: '2', bedCount: '1', isAC: true, hasAttachedBathroom: true, hasBalcony: false,
    hasTV: true, hasWiFi: true, amenities: '', description: '', image: '',
  });

  const resetForm = () => {
    setForm({ hotelName: '', name: '', type: 'Double Bed', floor: '', pricePerNight: '', pricePerBed: '', capacity: '2', bedCount: '1', isAC: true, hasAttachedBathroom: true, hasBalcony: false, hasTV: true, hasWiFi: true, amenities: '', description: '', image: '' });
    setImagePreview(''); setAdditionalImages([]); setEditingId(null); setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setImagePreview(reader.result as string); setForm({ ...form, image: reader.result as string }); }; reader.readAsDataURL(file); } };

  const handleAdditionalImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) { Array.from(files).forEach(file => { const reader = new FileReader(); reader.onloadend = () => { setAdditionalImages(prev => [...prev, reader.result as string]); }; reader.readAsDataURL(file); }); }
  };

  const handleEdit = (item: PartnerRoom) => {
    if (item.approvalStatus === 'approved') { toast.error('Cannot edit approved listings'); return; }
    setForm({ hotelName: item.hotelName, name: item.name, type: item.type, floor: item.floor, pricePerNight: String(item.pricePerNight), pricePerBed: String(item.pricePerBed), capacity: String(item.capacity), bedCount: String(item.bedCount), isAC: item.isAC, hasAttachedBathroom: item.hasAttachedBathroom, hasBalcony: item.hasBalcony, hasTV: item.hasTV, hasWiFi: item.hasWiFi, amenities: item.amenities.join(', '), description: item.description, image: item.image });
    setImagePreview(item.image); setAdditionalImages(item.images || []); setEditingId(item.id); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const allStored = getStored();
    const data: PartnerRoom = {
      id: editingId || `pr-${Date.now()}`, partnerId: user.id, partnerName: user.name, partnerEmail: user.email, businessName: user.businessName || '',
      hotelName: form.hotelName, name: form.name, type: form.type, floor: form.floor,
      pricePerNight: Number(form.pricePerNight), pricePerBed: Number(form.pricePerBed),
      capacity: Number(form.capacity), bedCount: Number(form.bedCount),
      isAC: form.isAC, hasAttachedBathroom: form.hasAttachedBathroom, hasBalcony: form.hasBalcony, hasTV: form.hasTV, hasWiFi: form.hasWiFi,
      image: form.image || '/placeholder.svg', images: additionalImages,
      amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
      description: form.description,
      approvalStatus: 'pending', adminRemarks: '',
      createdAt: editingId ? (allStored.find(i => i.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    let updated: PartnerRoom[];
    if (editingId) { updated = allStored.map(i => i.id === editingId ? data : i); toast.success('Room updated & sent for approval'); }
    else { updated = [...allStored, data]; toast.success('Room submitted for admin approval'); }
    save(updated);
    setItems(updated.filter(i => i.partnerId === user.id));
    resetForm();
  };

  const handleDelete = (id: string) => { const allStored = getStored(); const updated = allStored.filter(i => i.id !== id); save(updated); setItems(updated.filter(i => i.partnerId === user?.id)); setDeleteConfirm(null); toast.success('Room deleted'); };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.hotelName.toLowerCase().includes(search.toLowerCase()));

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Add Room</button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Room' : 'Add New Room'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Room Image</label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImagePreview(''); setForm({ ...form, image: '' }); }} className="absolute top-1 right-1 bg-foreground/70 text-primary-foreground rounded-full p-0.5"><X size={12} /></button>
                  </div>
                ) : (
                  <label className="w-32 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-brand-gold/50 transition-colors">
                    <Upload size={20} className="text-muted-foreground mb-1" /><span className="font-body text-xs text-muted-foreground">Upload</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {additionalImages.map((img, i) => (
                  <div key={i} className="relative w-20 h-16 rounded overflow-hidden border border-border">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setAdditionalImages(prev => prev.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-foreground/70 text-primary-foreground rounded-full p-0.5"><X size={10} /></button>
                  </div>
                ))}
                <label className="w-20 h-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-brand-gold/50">
                  <Plus size={16} className="text-muted-foreground" />
                  <input type="file" accept="image/*" multiple onChange={handleAdditionalImages} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Room Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Name *</label><input type="text" required value={form.hotelName} onChange={(e) => setForm({ ...form, hotelName: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Your hotel name" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Room Name *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Deluxe Room 101" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Room Type *</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm"><option>Single Bed</option><option>Double Bed</option><option>Triple Bed</option><option>Dormitory</option><option>Suite</option><option>Family Room</option></select></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Floor</label><input type="text" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Ground Floor / 1st Floor" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Capacity (persons) *</label><input type="number" min="1" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Number of Beds</label><input type="number" min="1" value={form.bedCount} onChange={(e) => setForm({ ...form, bedCount: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Night (₹) *</label><input type="number" required value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Bed (₹)</label><input type="number" value={form.pricePerBed} onChange={(e) => setForm({ ...form, pricePerBed: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Features</h4>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={form.isAC} onChange={(e) => setForm({ ...form, isAC: e.target.checked })} className="rounded border-border" /> AC</label>
                <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={form.hasAttachedBathroom} onChange={(e) => setForm({ ...form, hasAttachedBathroom: e.target.checked })} className="rounded border-border" /> Attached Bathroom</label>
                <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={form.hasBalcony} onChange={(e) => setForm({ ...form, hasBalcony: e.target.checked })} className="rounded border-border" /> Balcony</label>
                <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={form.hasTV} onChange={(e) => setForm({ ...form, hasTV: e.target.checked })} className="rounded border-border" /> TV</label>
                <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={form.hasWiFi} onChange={(e) => setForm({ ...form, hasWiFi: e.target.checked })} className="rounded border-border" /> WiFi</label>
              </div>
            </div>

            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Additional Amenities (comma separated)</label><input type="text" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Hot Water, Room Service, Towels, Bedsheets" /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Room description..." /></div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">{editingId ? 'Update & Resubmit' : 'Submit for Approval'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <BedDouble size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No rooms added yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Image</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Hotel</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Night</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="w-12 h-9 rounded overflow-hidden bg-muted">{item.image && item.image !== '/placeholder.svg' ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground" /></div>}</div></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.hotelName}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{item.type}{item.isAC ? ' (AC)' : ''}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerNight}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.approvalStatus !== 'approved' && <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>}
                      {deleteConfirm === item.id ? (
                        <div className="flex items-center gap-1"><button onClick={() => handleDelete(item.id)} className="text-xs font-body text-destructive hover:underline">Delete</button><button onClick={() => setDeleteConfirm(null)} className="text-xs font-body text-muted-foreground hover:underline">Cancel</button></div>
                      ) : (<button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>)}
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
