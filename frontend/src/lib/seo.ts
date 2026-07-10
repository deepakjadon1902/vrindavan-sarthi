export const SITE_ORIGIN = 'https://vrindavansarthi.in';
export const SITE_NAME = 'Vrindavan Sarthi';
export const DEFAULT_DESCRIPTION =
  'Book verified hotels, rooms, cabs, tours, and sacred products for a smooth Vrindavan pilgrimage.';
export const DEFAULT_OG_IMAGE = '/vrindasarthi%20logo.jpeg';
export const BRAND_PHONE = '+91 9876543210';
export const BRAND_EMAIL = 'vrindavansarthi108@gmail.com';

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export type JsonLdValue = Record<string, unknown> | Record<string, unknown>[];

export const normalizePathname = (pathname: string) => {
  const clean = `/${String(pathname || '/').split('?')[0].split('#')[0].replace(/^\/+/, '')}`;
  if (clean !== '/' && clean.endsWith('/')) return clean.slice(0, -1);
  return clean;
};

export const absoluteUrl = (path = '/') => {
  const normalized = normalizePathname(path);
  return `${SITE_ORIGIN}${normalized === '/' ? '/' : normalized}`;
};

export const absoluteAssetUrl = (asset?: string | null) => {
  const value = String(asset || '').trim();
  if (!value) return absoluteUrl(DEFAULT_OG_IMAGE);
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${SITE_ORIGIN}${path.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/')}`;
};

export const stripHtml = (value?: string | null) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const truncate = (value: string, max = 155) => {
  const clean = stripHtml(value);
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
};

export const titleTemplate = (title: string) => {
  const clean = stripHtml(title);
  if (!clean) return SITE_NAME;
  return clean.includes(SITE_NAME) ? clean : `${clean} | ${SITE_NAME}`;
};

export const buildBreadcrumbJsonLd = (items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

export const buildOrganizationJsonLd = (logoUrl?: string, email = BRAND_EMAIL, phone = BRAND_PHONE) => ({
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness', 'TravelAgency'],
  '@id': `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: {
    '@type': 'ImageObject',
    url: absoluteAssetUrl(logoUrl || DEFAULT_OG_IMAGE),
  },
  image: absoluteAssetUrl(logoUrl || DEFAULT_OG_IMAGE),
  email,
  telephone: phone,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Vrindavan',
    addressRegion: 'Uttar Pradesh',
    addressCountry: 'IN',
  },
  areaServed: ['Vrindavan', 'Mathura', 'Uttar Pradesh'],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: phone,
      email,
      contactType: 'customer support',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    },
  ],
});

export const buildWebsiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_ORIGIN}/#website`,
  name: SITE_NAME,
  alternateName: ['VrindavanSarthi', 'Vrindavan Sarthi'],
  url: SITE_ORIGIN,
  publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_ORIGIN}/hotels?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildFaqJsonLd = (items: Array<{ question: string; answer: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

export const publicRouteMeta: Record<string, { title: string; description: string; image?: string }> = {
  '/': {
    title: 'Vrindavan Hotels, Rooms, Cabs, Tours and Sacred Shop',
    description: DEFAULT_DESCRIPTION,
    image: '/backgrounds/hero-vrindavan.jpg',
  },
  '/hotels': {
    title: 'Hotels in Vrindavan Near Temples',
    description: 'Find verified Vrindavan hotels near Banke Bihari Temple, ISKCON, Prem Mandir, and other sacred places.',
  },
  '/rooms': {
    title: 'Rooms in Vrindavan',
    description: 'Browse room types from verified Vrindavan hotels with transparent pricing, amenities, and booking options.',
  },
  '/cabs': {
    title: 'Vrindavan Cab Booking',
    description: 'Book reliable local and outstation cabs for Vrindavan, Mathura, Govardhan, Barsana, and nearby pilgrimage routes.',
  },
  '/tours': {
    title: 'Vrindavan Tour Packages',
    description: 'Explore guided spiritual tour packages for Vrindavan temples, parikrama routes, Mathura, Gokul, Barsana, and Govardhan.',
  },
  '/shop': {
    title: 'Sacred Vrindavan Shop',
    description: 'Shop pooja items, devotional books, souvenirs, and sacred products from Vrindavan.',
  },
  '/track-order': {
    title: 'Track Your Order',
    description: 'Track Vrindavan Sarthi shop orders using your tracking ID.',
  },
  '/about': {
    title: 'About Vrindavan Sarthi',
    description: 'Learn about Vrindavan Sarthi, your trusted companion for hotels, rooms, cabs, tours, and devotional shopping in Vrindavan.',
  },
  '/contact': {
    title: 'Contact Vrindavan Sarthi',
    description: 'Contact Vrindavan Sarthi for pilgrimage support, bookings, partner listings, and customer service.',
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'Read the Vrindavan Sarthi terms for bookings, payments, cancellations, partner listings, and platform use.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'Read how Vrindavan Sarthi collects, uses, protects, and shares personal information.',
  },
};

export const noIndexRoutePrefixes = [
  '/admin',
  '/partner',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/profile',
  '/bookings',
  '/my-orders',
];

export const isNoIndexPath = (pathname: string) => {
  const path = normalizePathname(pathname);
  return noIndexRoutePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const getRouteMeta = (pathname: string) => {
  const path = normalizePathname(pathname);
  if (publicRouteMeta[path]) return publicRouteMeta[path];
  if (path.startsWith('/hotels/')) {
    return { title: 'Vrindavan Hotel Details', description: 'View verified hotel details, room options, amenities, location, and booking information in Vrindavan.' };
  }
  if (path.startsWith('/room-types/')) {
    return { title: 'Vrindavan Room Details', description: 'View room details, amenities, availability, pricing, and booking options for a verified Vrindavan stay.' };
  }
  if (path.startsWith('/cabs/')) {
    return { title: 'Vrindavan Cab Details', description: 'View cab details, routes, capacity, fare information, and booking options for Vrindavan travel.' };
  }
  if (path.startsWith('/tours/')) {
    return { title: 'Vrindavan Tour Details', description: 'View itinerary, inclusions, duration, price, and booking options for a Vrindavan tour package.' };
  }
  if (path.startsWith('/shop/')) {
    return { title: 'Vrindavan Product Details', description: 'View product details, price, availability, and ordering options from the Vrindavan Sarthi shop.' };
  }
  return { title: 'Page Not Found', description: 'The requested Vrindavan Sarthi page could not be found.' };
};
