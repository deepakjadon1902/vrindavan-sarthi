import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { JsonLd } from '@/components/SEO';
import { buildBreadcrumbJsonLd, type BreadcrumbItem, normalizePathname } from '@/lib/seo';
import { getCachedListingItem, getPrefetchedDetail } from '@/lib/detailCache';

const labels: Record<string, string> = {
  hotels: 'Hotels',
  rooms: 'Rooms',
  'room-types': 'Rooms',
  cabs: 'Cabs',
  tours: 'Tours',
  shop: 'Shop',
  about: 'About',
  contact: 'Contact',
  terms: 'Terms',
  privacy: 'Privacy',
  'track-order': 'Track Order',
};

const isPublicBreadcrumbPath = (path: string) =>
  path !== '/' &&
  !/^\/(admin|partner|login|register|forgot-password|reset-password|auth|profile|bookings|my-orders)/.test(path);

type CachedListingName = {
  name?: string;
  vehicleName?: string;
};

const getCachedDynamicName = (collection: string, id?: string) => {
  if (!id) return '';
  if (collection === 'hotels') {
    const item = getPrefetchedDetail<CachedListingName>('hotels', id) || getCachedListingItem<CachedListingName>('hotels', id);
    return item?.name || '';
  }
  if (collection === 'room-types') {
    const item = getPrefetchedDetail<CachedListingName>('roomTypes', id) || getCachedListingItem<CachedListingName>('roomTypes', id);
    return item?.name || '';
  }
  if (collection === 'cabs') {
    const item = getPrefetchedDetail<CachedListingName>('cabs', id) || getCachedListingItem<CachedListingName>('cabs', id);
    return item?.vehicleName || '';
  }
  if (collection === 'tours') {
    const item = getPrefetchedDetail<CachedListingName>('tours', id) || getCachedListingItem<CachedListingName>('tours', id);
    return item?.name || '';
  }
  if (collection === 'shop') {
    const item = getPrefetchedDetail<CachedListingName>('products', id);
    return item?.name || '';
  }
  return '';
};

const fromPath = (pathname: string): BreadcrumbItem[] => {
  const path = normalizePathname(pathname);
  const parts = path.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ name: 'Home', path: '/' }];
  let current = '';
  parts.forEach((part, index) => {
    current += `/${part}`;
    const isLast = index === parts.length - 1;
    const previous = parts[index - 1];
    const dynamicName = isLast && previous ? getCachedDynamicName(previous, part) : '';
    items.push({ name: labels[part] || dynamicName || (isLast ? 'Details' : part.replace(/-/g, ' ')), path: current });
  });
  return items;
};

type SEOBreadcrumbsProps = {
  items?: BreadcrumbItem[];
};

const SEOBreadcrumbs = ({ items }: SEOBreadcrumbsProps) => {
  const location = useLocation();
  const path = normalizePathname(location.pathname);
  if (!isPublicBreadcrumbPath(path)) return null;

  const breadcrumbItems = items?.length ? items : fromPath(path);

  return (
    <>
      <JsonLd id="breadcrumbs" value={buildBreadcrumbJsonLd(breadcrumbItems)} />
      <nav aria-label="Breadcrumb" className="bg-background/90 border-b border-border pt-16 lg:pt-[4.75rem]">
        <ol className="container mx-auto px-4 flex min-h-10 items-center gap-1 overflow-x-auto text-xs font-body text-muted-foreground">
          {breadcrumbItems.map((item, index) => {
            const last = index === breadcrumbItems.length - 1;
            return (
              <li key={`${item.path}-${item.name}`} className="flex items-center gap-1 whitespace-nowrap">
                {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
                {last ? (
                  <span aria-current="page" className="font-semibold text-foreground">{item.name}</span>
                ) : (
                  <Link to={item.path} className="inline-flex items-center gap-1 hover:text-foreground">
                    {index === 0 && <Home size={13} aria-hidden="true" />}
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default SEOBreadcrumbs;
