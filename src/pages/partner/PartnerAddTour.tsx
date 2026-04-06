import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Map } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface PartnerTour {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerPhone: string;
  businessName: string;
  name: string;
  duration: string;
  pricePerPerson: number;
  groupSize: number;
  startPoint: string;
  endPoint: string;
  image: string;
  images: string[];
  description: string;
  itinerary: string;
  includes: string[];
  excludes: string[];
  highlights: string[];
  contactPhone: string;
  contactEmail: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks: string;
  createdAt: string;
}

const STORAGE_KEY = 'vvs_partner_tours';
const getStored = (): PartnerTour[] => { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; } catch { return []; } };
const save = (data: PartnerTour[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const PartnerAddTour = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<PartnerTour[]>(() => getStored().filter(i => i.partnerId === user?.id));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', duration: '', pricePerPerson: '', groupSize: '10',
    startPoint: '', endPoint: '',
    description: '', itinerary: '',
    includes: '', excludes: '', highlights: '',
    contactPhone: '', contactEmail: '', image: '',
  });

  const resetForm = () => {
    setForm({ name: '', duration: '', pricePerPerson: '', groupSize: '10', startPoint: '', endPoint: '', description: '', itinerary: '', includes: '', excludes: '', highlights: '', contactPhone: '', contactEmail: '', image: '' });
    setImagePreview(''); setAdditionalImages([]); setEditingId(null); setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => { setImagePreview(reader.result as string); setForm({ ...form, image: reader.result as string }); }; reader.readAsDataURL(file); }
  };

  const handleAdditionalImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) { Array.from(files).forEach(file => { const reader = new FileReader(); reader.onloadend = () => { setAdditionalImages(prev => [...prev, reader.result as string]); }; reader.readAsDataURL(file); }); }
  };

  const handleEdit = (item: PartnerTour) => {
    if (item.approvalStatus === 'approved') { toast.error('Cannot edit approved listings'); return; }
    setForm({ name: item.name, duration: item.duration, pricePerPerson: String(item.pricePerPerson), groupSize: String(item.groupSize), startPoint: item.startPoint, endPoint: item.endPoint, description: item.description, itinerary: item.itinerary, includes: item.includes.join(', '), excludes: item.excludes.join(', '), highlights: item.highlights.join(', '), contactPhone: item.contactPhone, contactEmail: item.contactEmail, image: item.image });
    setImagePreview(item.image); setAdditionalImages(item.images || []); setEditingId(item.id); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const allStored = getStored();
    const data: PartnerTour = {
      id: editingId || `pt-${Date.now()}`,
      partnerId: user.id, partnerName: user.name, partnerEmail: user.email, partnerPhone: user.phone, businessName: user.businessName || '',
      name: form.name, duration: form.duration, pricePerPerson: Number(form.pricePerPerson), groupSize: Number(form.groupSize),
      startPoint: form.startPoint, endPoint: form.endPoint,
      image: form.image || '/placeholder.svg', images: additionalImages,
      description: form.description, itinerary: form.itinerary,
      includes: form.includes.split(',').map(i => i.trim()).filter(Boolean),
      excludes: form.excludes.split(',').map(i => i.trim()).filter(Boolean),
      highlights: form.highlights.split(',').map(i => i.trim()).filter(Boolean),
      contactPhone: form.contactPhone, contactEmail: form.contactEmail,
      approvalStatus: 'pending', adminRemarks: '',
      createdAt: editingId ? (allStored.find(i => i.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    let updated: PartnerTour[];
    if (editingId) { updated = allStored.map(i => i.id === editingId ? data : i); toast.success('Tour updated & sent for approval'); }
    else { updated = [...allStored, data]; toast.success('Tour submitted for admin approval'); }
    save(updated);
    setItems(updated.filter(i => i.partnerId === user.id));
    resetForm();
  };

  const handleDelete = (id: string) => {
    const allStored = getStored();
    const updated = allStored.filter(i => i.id !== id);
    save(updated);
    setItems(updated.filter(i => i.partnerId === user?.id));
    setDeleteConfirm(null);
    toast.success('Tour deleted');
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
          <input type="text" placeholder="Search tours..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Add Tour</button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Tour' : 'Add New Tour'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Image</label>
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
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Tour Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Name *</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan Temple Tour" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Duration *</label><input type="text" required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="1 Day / 2 Days 1 Night" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price per Person (₹) *</label><input type="number" required value={form.pricePerPerson} onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Max Group Size</label><input type="number" min="1" value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Start Point</label><input type="text" value={form.startPoint} onChange={(e) => setForm({ ...form, startPoint: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan Bus Stand" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">End Point</label><input type="text" value={form.endPoint} onChange={(e) => setForm({ ...form, endPoint: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan Bus Stand" /></div>
              </div>
            </div>

            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description *</label><textarea rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Detailed tour description..." /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Itinerary</label><textarea rows={4} value={form.itinerary} onChange={(e) => setForm({ ...form, itinerary: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Day 1: Visit Banke Bihari Temple..." /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Highlights (comma separated)</label><input type="text" value={form.highlights} onChange={(e) => setForm({ ...form, highlights: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Temple Visit, Boat Ride, Aarti" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Includes (comma separated)</label><input type="text" value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Guide, Lunch, Transport" /></div>
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Excludes (comma separated)</label><input type="text" value={form.excludes} onChange={(e) => setForm({ ...form, excludes: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Personal Expenses, Tips" /></div>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Contact Phone</label><input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Contact Email</label><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
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
          <Map size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No tours added yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Tour</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Duration</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Group</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Person</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{item.duration}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">Max {item.groupSize}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerPerson}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.approvalStatus !== 'approved' && <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>}
                      {deleteConfirm === item.id ? (
                        <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-destructive text-primary-foreground rounded">Confirm</button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
