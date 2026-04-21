import { Link } from 'react-router-dom';
import { useProductStore } from '@/store/productStore';
import { ShoppingBag, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { subscribeAppEvent } from '@/lib/broadcast';

const Shop = () => {
  const { products, fetchProducts, isLoadingProducts } = useProductStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const unsub = subscribeAppEvent('product:changed', () => {
      void fetchProducts();
    });
    const onFocus = () => void fetchProducts();
    window.addEventListener('focus', onFocus);
    return () => {
      unsub();
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchProducts]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => category === 'all' || p.category === category)
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [category, products, search]
  );

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-brand-crimson/15 blur-3xl" />

      <div className="container mx-auto px-4 max-w-7xl relative">
        <div className="text-center mb-10">
          <p className="font-ui text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-2">âœ¦ Divine Shop âœ¦</p>
          <h1 className="font-display text-5xl font-bold text-shine">Sacred Souvenirs</h1>
          <p className="font-body text-sm text-muted-foreground mt-3 max-w-xl mx-auto">Hand-picked pooja items, devotional books, and blessed memorabilia from the holy land of Vrindavan</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card/70 backdrop-blur font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-all ${category === c ? 'metallic-gold' : 'glass-panel hover:text-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {isLoadingProducts ? (
          <div className="glass-panel rounded-3xl p-16 text-center metallic-border">
            <p className="font-body text-sm text-muted-foreground">Loading products…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center metallic-border">
            <ShoppingBag size={56} className="mx-auto mb-4 text-brand-gold/40 animate-float-slow" />
            <p className="font-display text-2xl text-foreground mb-2">No Products Found</p>
            <p className="font-body text-sm text-muted-foreground">Check back soon for new arrivals from Vrindavan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <Link key={product.id} to={`/shop/${product.id}`} className="glass-panel rounded-2xl overflow-hidden water-hover group">
                <div className="h-52 overflow-hidden relative">
                  <img
                    src={product.images[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 glossy-sheen pointer-events-none" />
                </div>
                <div className="p-4">
                  <span className="font-body text-[10px] glass-chip px-2 py-0.5 rounded capitalize">{product.category}</span>
                  <h3 className="font-display text-base font-semibold text-foreground mt-2 truncate">{product.name}</h3>
                  <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-display text-lg font-bold text-brand-crimson">â‚¹{product.price.toLocaleString('en-IN')}</span>
                    <span className={`font-body text-xs font-medium ${product.inStock ? 'text-brand-green' : 'text-destructive'}`}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
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
