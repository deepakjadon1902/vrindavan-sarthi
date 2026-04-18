import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface PartnerHotel {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerPhone: string;
  businessName: string;
  name: string;
  location: string;
  fullAddress: string;
  pricePerNight: number;
  pricePerBed: number;
  priceDoubleAC: number;
  priceDoubleNonAC: number;
  priceSingleAC: number;
  priceSingleNonAC: number;
  rating: number;
  totalRooms: number;
  checkInTime: string;
  checkOutTime: string;
  image: string;
  images: string[];
  description: string;
  amenities: string[];
  nearbyPlaces: string;
  policies: string;
  contactPhone: string;
  contactEmail: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks: string;
  createdAt: string;
}

const STORAGE_KEY = 'vvs_partner_hotels';
const getStored = (): PartnerHotel[] => { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; } catch { return []; } };
const save = (data: PartnerHotel[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const MAIN_KEY = 'vvs_hotels';
const removeFromMain = (id) => {
  try {
    const raw = localStorage.getItem(MAIN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    localStorage.setItem(MAIN_KEY, JSON.stringify(arr.filter((x) => x.id !== id)));
  } catch { /* noop */ }
};

const PartnerAddHotel = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<PartnerHotel[]>(() => getStored().filter(i => i.partnerId === user?.id));
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    const target = items.find((i) => i.id === editId);
    if (target) {
      handleEdit(target);
      // clear param so a refresh doesn't re-trigger
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, searchParams]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', location: '', fullAddress: '', pricePerNight: '', pricePerBed: '',
    priceDoubleAC: '', priceDoubleNonAC: '', priceSingleAC: '', priceSingleNonAC: '',
    totalRooms: '', checkInTime: '12:00', checkOutTime: '11:00',
    description: '', amenities: '', nearbyPlaces: '', policies: '',
    contactPhone: '', contactEmail: '', image: '',
  });

  const resetForm = () => {
    setForm({ name: '', location: '', fullAddress: '', pricePerNight: '', pricePerBed: '', priceDoubleAC: '', priceDoubleNonAC: '', priceSingleAC: '', priceSingleNonAC: '', totalRooms: '', checkInTime: '12:00', checkOutTime: '11:00', description: '', amenities: '', nearbyPlaces: '', policies: '', contactPhone: '', contactEmail: '', image: '' });
    setImagePreview('');
    setAdditionalImages([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result as string); setForm({ ...form, image: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => { setAdditionalImages(prev => [...prev, reader.result as string]); };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleEdit = (item: PartnerHotel) => {
    setForm({ name: item.name, location: item.location, fullAddress: item.fullAddress, pricePerNight: String(item.pricePerNight), pricePerBed: String(item.pricePerBed), priceDoubleAC: String(item.priceDoubleAC), priceDoubleNonAC: String(item.priceDoubleNonAC), priceSingleAC: String(item.priceSingleAC), priceSingleNonAC: String(item.priceSingleNonAC), totalRooms: String(item.totalRooms), checkInTime: item.checkInTime, checkOutTime: item.checkOutTime, description: item.description, amenities: item.amenities.join(', '), nearbyPlaces: item.nearbyPlaces, policies: item.policies, contactPhone: item.contactPhone, contactEmail: item.contactEmail, image: item.image });
    setImagePreview(item.image);
    setAdditionalImages(item.images || []);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const allStored = getStored();
    const data: PartnerHotel = {
      id: editingId || `ph-${Date.now()}`,
      partnerId: user.id,
      partnerName: user.name,
      partnerEmail: user.email,
      partnerPhone: user.phone,
      businessName: user.businessName || '',
      name: form.name, location: form.location, fullAddress: form.fullAddress,
      pricePerNight: Number(form.pricePerNight), pricePerBed: Number(form.pricePerBed),
      priceDoubleAC: Number(form.priceDoubleAC), priceDoubleNonAC: Number(form.priceDoubleNonAC),
      priceSingleAC: Number(form.priceSingleAC), priceSingleNonAC: Number(form.priceSingleNonAC),
      rating: 0, totalRooms: Number(form.totalRooms),
      checkInTime: form.checkInTime, checkOutTime: form.checkOutTime,
      image: form.image || '/placeholder.svg', images: additionalImages,
      description: form.description,
      amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
      nearbyPlaces: form.nearbyPlaces, policies: form.policies,
      contactPhone: form.contactPhone, contactEmail: form.contactEmail,
      approvalStatus: 'pending', adminRemarks: '',
      createdAt: editingId ? (allStored.find(i => i.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    let updated: PartnerHotel[];
    if (editingId) {
      updated = allStored.map(i => i.id === editingId ? data : i);
      toast.success('Hotel updated & sent for approval');
    } else {
      updated = [...allStored, data];
      toast.success('Hotel submitted for admin approval');
    }
    save(updated);
    if (editingId) removeFromMain(editingId);
    setItems(updated.filter(i => i.partnerId === user.id));
    resetForm();
  };

  const handleDelete = (id: string) => {
    const allStored = getStored();
    const updated = allStored.filter(i => i.id !== id);
    save(updated);
    removeFromMain(id);
    setItems(updated.filter(i => i.partnerId === user?.id));
    setDeleteConfirm(null);
    toast.success('Hotel deleted');
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

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
          <input type="text" placeholder="Search hotels..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Add Hotel</button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Hotel' : 'Add New Hotel'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Images */}
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Main Image *</label>
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
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Additional Images</label>
              <div className="flex flex-wrap gap-2">
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

            {/* Basic Info */}
            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Basic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Name *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Krishna Palace Hotel" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Location / Area *</label><input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Near Banke Bihari Temple, Vrindavan" /></div>
              </div>
              <div className="mt-4"><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Full Address *</label><textarea rows={2} required value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Complete address with landmark" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Total Rooms *</label><input type="number" min="1" required value={form.totalRooms} onChange={(e) => setForm({ ...form, totalRooms: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-in</label><input type="time" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm" /></div>
                  <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Check-out</label><input type="time" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm" /></div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Pricing (₹)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Per Night *</label><input type="number" required value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Per Bed</label><input type="number" value={form.pricePerBed} onChange={(e) => setForm({ ...form, pricePerBed: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Double AC</label><input type="number" value={form.priceDoubleAC} onChange={(e) => setForm({ ...form, priceDoubleAC: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Double Non-AC</label><input type="number" value={form.priceDoubleNonAC} onChange={(e) => setForm({ ...form, priceDoubleNonAC: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Single AC</label><input type="number" value={form.priceSingleAC} onChange={(e) => setForm({ ...form, priceSingleAC: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Single Non-AC</label><input type="number" value={form.priceSingleNonAC} onChange={(e) => setForm({ ...form, priceSingleNonAC: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>
            </div>

            {/* Details */}
            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Details</h4>
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description *</label><textarea rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Detailed description of the hotel..." /></div>
              <div className="mt-4"><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Amenities (comma separated) *</label><input type="text" required value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="WiFi, AC, Parking, Temple View, Restaurant, 24hr Reception" /></div>
              <div className="mt-4"><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Nearby Places</label><textarea rows={2} value={form.nearbyPlaces} onChange={(e) => setForm({ ...form, nearbyPlaces: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Banke Bihari Temple (200m), ISKCON (1km)..." /></div>
              <div className="mt-4"><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Hotel Policies</label><textarea rows={2} value={form.policies} onChange={(e) => setForm({ ...form, policies: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="No smoking, ID proof required..." /></div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Contact Phone</label><input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="+91 XXXXX XXXXX" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Contact Email</label><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="hotel@email.com" /></div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">{editingId ? 'Update & Resubmit' : 'Submit for Approval'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No hotels added yet</p>
          <p className="font-body text-xs text-muted-foreground/60 mt-1">Click "Add Hotel" to list your property</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Image</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Location</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Night</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="w-12 h-9 rounded overflow-hidden bg-muted">{item.image && item.image !== '/placeholder.svg' ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground" /></div>}</div></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.location}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerNight}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.approvalStatus !== 'approved' && (
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                      )}
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

export default PartnerAddHotel;
