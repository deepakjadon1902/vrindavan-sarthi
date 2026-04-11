import { useState } from 'react';
import { useProductStore, Product } from '@/store/productStore';
import { Plus, Edit3, Trash2, ShoppingBag, Image, X } from 'lucide-react';
import { toast } from 'sonner';

const ManageProducts = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useProductStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', images: [] as string[], inStock: true });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, images: [...prev.images, reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.category) { toast.error('Fill required fields'); return; }
    if (editId) {
      updateProduct(editId, { ...form, price: Number(form.price) });
      toast.success('Product updated');
    } else {
      addProduct({ ...form, price: Number(form.price) });
      toast.success('Product added');
    }
    resetForm();
  };

  const handleEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description, price: String(p.price), category: p.category, images: p.images, inStock: p.inStock });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    toast.success('Product deleted');
  };

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', category: '', images: [], inStock: true });
    setEditId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Products</h2>
          <p className="font-body text-xs text-muted-foreground">{products.length} product(s)</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-heading text-lg font-semibold text-foreground">{editId ? 'Edit Product' : 'Add New Product'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">Product Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Product name" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">Category *</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="e.g. Pooja Items, Souvenirs" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">Price (₹) *</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="0" />
            </div>
            <div className="flex items-center gap-3">
              <label className="font-body text-xs text-muted-foreground">In Stock?</label>
              <button onClick={() => setForm({ ...form, inStock: !form.inStock })} className={`px-4 py-2 rounded-lg text-sm font-body transition-colors ${form.inStock ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive'}`}>
                {form.inStock ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Product description..." />
          </div>

          <div>
            <label className="font-body text-xs text-muted-foreground block mb-2">Product Images</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-primary-foreground flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                <Image size={20} className="text-muted-foreground mb-1" />
                <span className="font-body text-[10px] text-muted-foreground">Upload</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSubmit} className="btn-crimson px-6 py-2.5 rounded-xl text-sm">{editId ? 'Update' : 'Add'} Product</button>
            <button onClick={resetForm} className="px-6 py-2.5 rounded-xl text-sm border border-border font-body hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Products</p>
          <p className="font-body text-sm text-muted-foreground">Add your first product to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="h-40 overflow-hidden">
                <img src={p.images[0] || '/placeholder.svg'} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-heading text-sm font-semibold text-foreground truncate">{p.name}</h4>
                    <span className="font-body text-[10px] bg-secondary px-2 py-0.5 rounded capitalize">{p.category}</span>
                  </div>
                  <span className="font-heading text-base font-bold text-brand-crimson flex-shrink-0">₹{p.price.toLocaleString('en-IN')}</span>
                </div>
                <p className="font-body text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${p.inStock ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive'}`}>
                    {p.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(p)} className="p-1.5 rounded hover:bg-muted transition-colors"><Edit3 size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors"><Trash2 size={14} className="text-destructive" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageProducts;
