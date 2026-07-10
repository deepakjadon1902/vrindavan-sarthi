export const SITE_ORIGIN = 'https://vrindavansarthi.in';
export const SITE_NAME = 'Vrindavan Sarthi';
export const DEFAULT_DESCRIPTION =
  'Discover the best Vrindavan tour packages, temple darshan, taxi services, Mathura sightseeing, Govardhan Parikrama, Barsana tours, and customized Braj pilgrimage experiences with Vrindavan Sarthi.';
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

export const truncate = (value: string, max = 220) => {
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
    title: 'Vrindavan Sarthi | Vrindavan Tour Packages, Taxi Service & Braj Darshan',
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
    title: 'Taxi Service in Vrindavan | Local, Outstation & Airport Transfers',
    description: 'Book clean and reliable taxi services in Vrindavan for local sightseeing, airport transfers, temple visits, Mathura tours, and complete Braj travel.',
  },
  '/tours': {
    title: 'Vrindavan Tour Packages | Spiritual & Braj Yatra Packages',
    description: 'Explore affordable Vrindavan tour packages including Mathura, Govardhan, Barsana, Gokul, Nandgaon, temple darshan, and personalized Braj Yatra experiences.',
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
    title: 'About Vrindavan Sarthi | Trusted Travel & Tourism Company',
    description: 'Learn about Vrindavan Sarthi, your trusted travel partner for Vrindavan, Mathura, Govardhan, Barsana, Gokul, and Braj pilgrimage tours with reliable transportation and personalized service.',
  },
  '/contact': {
    title: 'Contact Vrindavan Sarthi | Book Tours & Taxi Services',
    description: 'Contact Vrindavan Sarthi for tour bookings, taxi reservations, customized itineraries, temple darshan assistance, and travel support across the Braj region.',
  },
  '/terms': {
    title: 'Terms & Conditions | Vrindavan Sarthi',
    description: 'Review the booking terms, cancellation policy, payment terms, and conditions of using Vrindavan Sarthi services.',
  },
  '/privacy': {
    title: 'Privacy Policy | Vrindavan Sarthi',
    description: 'Read how Vrindavan Sarthi collects, stores, and protects your personal information.',
  },
  '/one-day-tour': {
    title: 'One Day Vrindavan Tour Package | Same Day Braj Darshan',
    description: 'Experience the best one-day Vrindavan and Mathura sightseeing tour with temples, local attractions, and comfortable transportation.',
  },
  '/mathura-tour': {
    title: 'Mathura Tour Package | Shri Krishna Janmabhoomi & Sightseeing',
    description: 'Visit Shri Krishna Janmabhoomi, Dwarkadhish Temple, Vishram Ghat, and other sacred destinations with guided Mathura tour packages.',
  },
  '/vrindavan-tour': {
    title: 'Vrindavan Sightseeing Tour | Banke Bihari, ISKCON & Prem Mandir',
    description: 'Discover the famous temples of Vrindavan including Banke Bihari Temple, Prem Mandir, ISKCON Temple, Radha Raman Temple, and more.',
  },
  '/govardhan-tour': {
    title: 'Govardhan Parikrama Tour Package | Giriraj Darshan',
    description: 'Plan your Govardhan Parikrama with comfortable transportation, temple visits, and customized pilgrimage services.',
  },
  '/barsana-tour': {
    title: 'Barsana Tour Package | Radha Rani Temple Darshan',
    description: 'Visit Radha Rani Temple, Kirti Mandir, and the sacred town of Barsana with professional travel services from Vrindavan Sarthi.',
  },
  '/gokul-tour': {
    title: 'Gokul Tour Package | Krishna Childhood Places',
    description: "Explore Gokul, Raman Reti, Chintaharan Temple, and other sacred destinations associated with Lord Krishna's childhood.",
  },
  '/nandgaon-tour': {
    title: 'Nandgaon Tour Package | Nand Bhawan & Braj Darshan',
    description: 'Experience the spiritual heritage of Nandgaon with guided tours and comfortable transportation.',
  },
  '/blogs': {
    title: 'Vrindavan Travel Blog | Pilgrimage Tips & Travel Guides',
    description: 'Read travel guides, temple information, Braj pilgrimage tips, local attractions, festivals, and travel recommendations.',
  },
  '/faq': {
    title: 'Frequently Asked Questions | Vrindavan Sarthi',
    description: 'Find answers to common questions about bookings, taxi services, tour packages, cancellations, and travel planning.',
  },
  '/refund-policy': {
    title: 'Refund Policy | Vrindavan Sarthi',
    description: 'Learn about refunds, cancellations, booking modifications, and applicable refund timelines.',
  },
  '/careers': {
    title: 'Careers at Vrindavan Sarthi | Join Our Team',
    description: 'Explore career opportunities with Vrindavan Sarthi in tourism, customer service, operations, and travel management.',
  },
  '/gallery': {
    title: 'Vrindavan Travel Gallery | Tour Photos & Braj Attractions',
    description: 'Explore beautiful photos of temples, pilgrimage sites, tour experiences, and attractions across Vrindavan and Braj.',
  },
  '/testimonials': {
    title: 'Customer Reviews | Vrindavan Sarthi',
    description: 'Read genuine customer reviews and experiences from travelers who explored Braj with Vrindavan Sarthi.',
  },
};

export const indexablePublicPaths = new Set([
  '/',
  '/hotels',
  '/rooms',
  '/cabs',
  '/tours',
  '/shop',
  '/track-order',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
]);

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
  return {
    title: 'Page Not Found | Vrindavan Sarthi',
    description: "The page you're looking for doesn't exist. Explore our tour packages, taxi services, and travel guides instead.",
  };
};
