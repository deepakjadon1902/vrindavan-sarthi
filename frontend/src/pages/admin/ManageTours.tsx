import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Map } from 'lucide-react';
import { toast } from 'sonner';

interface Tour {
  id: string;
  name: string;
  duration: string;
  pricePerPerson: number;
  groupSize: number;
  image: string;
  description: string;
  itinerary: string;
  includes: string[];
  status: 'active' | 'inactive';
}

const STORAGE_KEY = 'vvs_tours';
const getStored = (): Tour[] => { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; } catch { return []; } };
const save = (data: Tour[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const ManageTours = () => {
  const [items, setItems] = useState<Tour[]>(getStored);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState({ name: '', duration: '', pricePerPerson: '', groupSize: '10', description: '', itinerary: '', includes: '', status: 'active' as Tour['status'], image: '' });

  const resetForm = () => { setForm({ name: '', duration: '', pricePerPerson: '', groupSize: '10', description: '', itinerary: '', includes: '', status: 'active', image: '' }); setImagePreview(''); setEditingId(null); setShowForm(false); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setImagePreview(reader.result as string); setForm({ ...form, image: reader.result as string }); }; reader.readAsDataURL(file); } };

  const handleEdit = (item: Tour) => { setForm({ name: item.name, duration: item.duration, pricePerPerson: String(item.pricePerPerson), groupSize: String(item.groupSize), description: item.description, itinerary: item.itinerary, includes: item.includes.join(', '), status: item.status, image: item.image }); setImagePreview(item.image); setEditingId(item.id); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Tour = { id: editingId || `tour-${Date.now()}`, name: form.name, duration: form.duration, pricePerPerson: Number(form.pricePerPerson), groupSize: Number(form.groupSize), image: form.image || '/placeholder.svg', description: form.description, itinerary: form.itinerary, includes: form.includes.split(',').map(i => i.trim()).filter(Boolean), status: form.status };
    let updated: Tour[];
    if (editingId) { updated = items.map(i => i.id === editingId ? data : i); toast.success('Tour updated'); }
    else { updated = [...items, data]; toast.success('Tour added'); }
    setItems(updated); save(updated); resetForm();
  };

  const handleDelete = (id: string) => { const updated = items.filter(i => i.id !== id); setItems(updated); save(updated); setDeleteConfirm(null); toast.success('Tour deleted'); };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Image</label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border"><img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /><button type="button" onClick={() => { setImagePreview(''); setForm({ ...form, image: '' }); }} className="absolute top-1 right-1 bg-foreground/70 text-primary-foreground rounded-full p-0.5"><X size={12} /></button></div>
                ) : (
                  <label className="w-32 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-brand-gold/50 transition-colors"><Upload size={20} className="text-muted-foreground mb-1" /><span className="font-body text-xs text-muted-foreground">Upload</span><input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></label>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Tour Name</label><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Vrindavan Darshan" /></div>
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Duration</label><input type="text" required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="2 Days / 1 Night" /></div>
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Price / Person (₹)</label><input type="number" required value={form.pricePerPerson} onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
              <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Group Size</label><input type="number" min="1" required value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" /></div>
            </div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Itinerary</label><textarea rows={4} value={form.itinerary} onChange={(e) => setForm({ ...form, itinerary: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Day 1: ...\nDay 2: ..." /></div>
            <div><label className="font-body text-sm font-medium text-foreground mb-1.5 block">Includes (comma separated)</label><input type="text" value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Guide, Transport, Meals" /></div>
            <div className="flex items-center gap-2"><label className="font-body text-sm font-medium text-foreground">Status:</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Tour['status'] })} className="px-3 py-1.5 rounded-lg border border-border bg-background font-body text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-crimson px-6 py-2.5 rounded-lg text-sm">{editingId ? 'Update' : 'Add Tour'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center"><Map size={48} className="mx-auto mb-4 text-muted-foreground/30" /><p className="font-body text-muted-foreground">No tours added yet</p></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Image</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Duration</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Person</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="w-12 h-9 rounded overflow-hidden bg-muted">{item.image && item.image !== '/placeholder.svg' ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground" /></div>}</div></td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.duration}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerPerson}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className={`font-body text-xs px-2 py-1 rounded-full ${item.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'}`}>{item.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
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

export default ManageTours;
