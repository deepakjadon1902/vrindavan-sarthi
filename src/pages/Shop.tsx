import { Link } from 'react-router-dom';
import { useProductStore } from '@/store/productStore';
import { ShoppingBag, Search } from 'lucide-react';
import { useState } from 'react';

const Shop = () => {
  const { products } = useProductStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const inStock = products.filter(p => p.inStock);
  const categories = ['all', ...Array.from(new Set(inStock.map(p => p.category)))];

  const filtered = inStock
    .filter(p => category === 'all' || p.category === category)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pt-24 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl font-bold text-foreground">🛍️ Divine Shop</h1>
          <p className="font-body text-sm text-muted-foreground mt-2">Sacred items & souvenirs from Vrindavan</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" placeholder="Search products..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${category === c ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-heading text-xl text-foreground mb-2">No Products Found</p>
            <p className="font-body text-sm text-muted-foreground">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(product => (
              <Link key={product.id} to={`/shop/${product.id}`} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all group">
                <div className="h-52 overflow-hidden">
                  <img
                    src={product.images[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <span className="font-body text-[10px] bg-secondary px-2 py-0.5 rounded capitalize text-secondary-foreground">{product.category}</span>
                  <h3 className="font-heading text-base font-semibold text-foreground mt-2 truncate">{product.name}</h3>
                  <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-heading text-lg font-bold text-brand-crimson">₹{product.price.toLocaleString('en-IN')}</span>
                    <span className="font-body text-xs text-brand-green font-medium">In Stock</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Shop;
