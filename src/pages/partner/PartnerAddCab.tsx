import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Car } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface PartnerCab {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerPhone: string;
  businessName: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  driverLicense: string;
  routes: string[];
  pricePerKm: number;
  basePrice: number;
  image: string;
  images: string[];
  description: string;
  features: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  adminRemarks: string;
  createdAt: string;
}

const STORAGE_KEY = 'vvs_partner_cabs';
const getStored = (): PartnerCab[] => { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; } catch { return []; } };
const save = (data: PartnerCab[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const PartnerAddCab = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<PartnerCab[]>(() => getStored().filter(i => i.partnerId === user?.id));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const [form, setForm] = useState({
    vehicleName: '', vehicleType: 'Sedan', vehicleNumber: '', capacity: '4',
    driverName: '', driverPhone: '', driverLicense: '',
    routes: '', pricePerKm: '', basePrice: '',
    description: '', features: '', image: '',
  });

  const resetForm = () => {
    setForm({ vehicleName: '', vehicleType: 'Sedan', vehicleNumber: '', capacity: '4', driverName: '', driverPhone: '', driverLicense: '', routes: '', pricePerKm: '', basePrice: '', description: '', features: '', image: '' });
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

  const handleEdit = (item: PartnerCab) => {
    if (item.approvalStatus === 'approved') { toast.error('Cannot edit approved listings'); return; }
    setForm({ vehicleName: item.vehicleName, vehicleType: item.vehicleType, vehicleNumber: item.vehicleNumber, capacity: String(item.capacity), driverName: item.driverName, driverPhone: item.driverPhone, driverLicense: item.driverLicense, routes: item.routes.join(', '), pricePerKm: String(item.pricePerKm), basePrice: String(item.basePrice), description: item.description, features: item.features.join(', '), image: item.image });
    setImagePreview(item.image); setAdditionalImages(item.images || []); setEditingId(item.id); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const allStored = getStored();
    const data: PartnerCab = {
      id: editingId || `pc-${Date.now()}`,
      partnerId: user.id, partnerName: user.name, partnerEmail: user.email, partnerPhone: user.phone, businessName: user.businessName || '',
      vehicleName: form.vehicleName, vehicleType: form.vehicleType, vehicleNumber: form.vehicleNumber,
      capacity: Number(form.capacity), driverName: form.driverName, driverPhone: form.driverPhone, driverLicense: form.driverLicense,
      routes: form.routes.split(',').map(r => r.trim()).filter(Boolean),
      pricePerKm: Number(form.pricePerKm), basePrice: Number(form.basePrice),
      image: form.image || '/placeholder.svg', images: additionalImages,
      description: form.description,
      features: form.features.split(',').map(f => f.trim()).filter(Boolean),
      approvalStatus: 'pending', adminRemarks: '',
      createdAt: editingId ? (allStored.find(i => i.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    let updated: PartnerCab[];
    if (editingId) { updated = allStored.map(i => i.id === editingId ? data : i); toast.success('Cab updated & sent for approval'); }
    else { updated = [...allStored, data]; toast.success('Cab submitted for admin approval'); }
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
    toast.success('Cab deleted');
  };

  const filtered = items.filter(i => i.vehicleName.toLowerCase().includes(search.toLowerCase()));

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
          <input type="text" placeholder="Search cabs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-crimson px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Add Cab</button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{editingId ? 'Edit Cab' : 'Add New Cab'}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Image</label>
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
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Vehicle Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Name *</label><input type="text" required value={form.vehicleName} onChange={(e) => setForm({ ...form, vehicleName: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Swift Dzire / Innova" /></div>
                <div>
                  <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Type *</label>
                  <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm">
                    <option>Sedan</option><option>SUV</option><option>Hatchback</option><option>Tempo Traveller</option><option>Mini Bus</option><option>Auto Rickshaw</option><option>E-Rickshaw</option>
                  </select>
                </div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Number *</label><input type="text" required value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="UP 85 XX 1234" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Seating Capacity *</label><input type="number" min="1" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Driver Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Driver Name *</label><input type="text" required value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Driver Phone *</label><input type="tel" required value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">License Number</label><input type="text" value={form.driverLicense} onChange={(e) => setForm({ ...form, driverLicense: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Pricing & Routes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Base Price (₹) *</label><input type="number" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Starting price" /></div>
                <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price per Km (₹)</label><input type="number" value={form.pricePerKm} onChange={(e) => setForm({ ...form, pricePerKm: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              </div>
              <div className="mt-4"><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Routes (comma separated)</label><input type="text" value={form.routes} onChange={(e) => setForm({ ...form, routes: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan Local, Vrindavan-Mathura, Vrindavan-Delhi" /></div>
            </div>

            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Vehicle Features (comma separated)</label><input type="text" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="AC, Music System, GPS, First Aid Kit" /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Cab description..." /></div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">{editingId ? 'Update & Resubmit' : 'Submit for Approval'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Car size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No cabs added yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Vehicle</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Driver</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Base ₹</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.vehicleName}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{item.vehicleType}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.driverName}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.basePrice}</td>
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

export default PartnerAddCab;
