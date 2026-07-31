import { Link } from 'react-router-dom';
import { useProductStore } from '@/store/productStore';
import { ShoppingBag, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { resolveBackendAssetUrl } from '@/lib/api';

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
    <div className="min-h-screen bg-background pb-6 pt-20">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="text-center mb-3">
          <p className="font-ui text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-2"> Divine Shop </p>
          <h1 className="font-display text-4xl font-bold text-shine">Sacred Souvenirs</h1>
          <p className="font-body text-sm text-muted-foreground mt-3 max-w-xl mx-auto">Hand-picked pooja items, devotional books, and blessed memorabilia from the holy land of Vrindavan</p>
        </div>

        <div className="premium-toolbar mb-3 flex flex-col gap-2 p-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="premium-field w-full pl-10 pr-4 font-body text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${category === c ? 'bg-brand-gold text-foreground font-semibold' : 'border border-border bg-white text-muted-foreground hover:text-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {isLoadingProducts ? (
          <div className="premium-surface p-12 text-center">
            <p className="font-body text-sm text-muted-foreground">Loading products...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="premium-surface p-12 text-center">
            <ShoppingBag size={48} className="mx-auto mb-4 text-brand-gold/70" />
            <p className="font-display text-2xl text-foreground mb-2">No Products Found</p>
            <p className="font-body text-sm text-muted-foreground">Check back soon for new arrivals from Vrindavan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((product) => (
              <Link
                key={product.id}
                to={`/shop/${product.id}`}
                onClick={() => prefetchDetail('products', product.id, product)}
                className="premium-surface overflow-hidden transition-transform hover:-translate-y-0.5 group"
              >
                <div className="aspect-[16/11] overflow-hidden relative bg-white">
                  <img
                    src={resolveBackendAssetUrl(product.images[0]) || '/placeholder.svg'}
                    alt={product.name}
                    className="w-full h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.svg')}
                  />
                </div>
                <div className="p-2 sm:p-2.5">
                  <span className="font-body text-[10px] glass-chip px-2 py-0.5 rounded capitalize">{product.category}</span>
                  <h3 className="font-display text-[13px] sm:text-sm font-semibold text-foreground mt-1.5 sm:mt-2 truncate">{product.name}</h3>
                  <p className="font-body text-[10px] sm:text-[11px] text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex flex-col items-start gap-0.5 mt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:mt-3">
                    <span className="font-display text-[13px] sm:text-sm font-bold text-brand-crimson">Rs. {product.price.toLocaleString('en-IN')}</span>
                    <span className={`font-body text-[10px] sm:text-xs font-medium ${product.inStock ? 'text-brand-green' : 'text-destructive'}`}>
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
