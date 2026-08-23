export const SITE_ORIGIN = 'https://vrindavansarthi.in';
export const SITE_NAME = 'Vrindavan Sarthi Enterprises';
export const DEFAULT_DESCRIPTION =
  'Book verified hotels, dharamshalas, and rooms near temples in Govardhan, Barsana, Gokul, Mathura, Vrindavan, and across Braj.';
export const DEFAULT_OG_IMAGE = '/vrindasarthi%20logo.jpeg';
export const BRAND_PHONE = '8679820256';
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
    streetAddress: 'Raja wala mandir, Infront of Giriraj ji Maharaj',
    addressLocality: 'Goverdhan',
    addressRegion: 'Uttar Pradesh',
    postalCode: '281502',
    addressCountry: 'IN',
  },
  areaServed: ['Braj', 'Vrindavan', 'Mathura', 'Govardhan', 'Barsana', 'Gokul', 'Nandgaon'],
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
  alternateName: ['Vrindavan Sarthi Enterprises'],
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
    title: 'Braj Hotel, Dharamshala, and Room Booking | Vrindavan Sarthi',
    description: DEFAULT_DESCRIPTION,
    image: '/backgrounds/braj-govardhan-hero.jpeg',
  },
  '/hotels': {
    title: 'Hotels & Dharamshalas Across Braj',
    description: 'Find verified hotels and Dharamshalas in Braj locations like Vrindavan, Mathura, Govardhan, Barsana, Gokul and Nandgaon.',
  },
  '/rooms': {
    title: 'Rooms Across Braj | AC, Family & Budget Room Options',
    description: 'Browse verified room options across Braj with amenities, policies, location filters and simple booking support.',
  },
  '/cabs': {
    title: 'Taxi Service Across Braj | Local, Outstation & Airport Transfers',
    description: 'Book clean and reliable taxi services for Braj sightseeing, airport transfers, temple visits, Mathura tours, and complete pilgrimage travel.',
  },
  '/tours': {
    title: 'Braj Tour Packages | Spiritual Yatra Packages',
    description: 'Explore affordable Braj tour packages including Vrindavan, Mathura, Govardhan, Barsana, Gokul, Nandgaon, temple darshan, and personalized Yatra experiences.',
  },
  '/shop': {
    title: 'Sacred Braj Shop',
    description: 'Shop pooja items, devotional books, souvenirs, and sacred products from Braj.',
  },
  '/track-order': {
    title: 'Track Your Order',
    description: 'Track Vrindavan Sarthi Enterprises shop orders using your tracking ID.',
  },
  '/about': {
    title: 'About Vrindavan Sarthi Enterprises | Trusted Travel & Tourism Company',
    description: 'Learn about Vrindavan Sarthi Enterprises, your trusted travel partner for Vrindavan, Mathura, Govardhan, Barsana, Gokul, and Braj pilgrimage tours with reliable transportation and personalized service.',
  },
  '/contact': {
    title: 'Contact Vrindavan Sarthi Enterprises | Book Tours & Taxi Services',
    description: 'Contact Vrindavan Sarthi Enterprises for tour bookings, taxi reservations, customized itineraries, temple darshan assistance, and travel support across the Braj region.',
  },
  '/terms': {
    title: 'Terms & Conditions | Vrindavan Sarthi Enterprises',
    description: 'Review the booking terms, cancellation policy, payment terms, and conditions of using Vrindavan Sarthi Enterprises services.',
  },
  '/privacy': {
    title: 'Privacy Policy | Vrindavan Sarthi Enterprises',
    description: 'Read how Vrindavan Sarthi Enterprises collects, stores, and protects your personal information.',
  },
  '/cancellation-policy': {
    title: 'Cancellation Policy | Vrindavan Sarthi Enterprises',
    description: 'Review Vrindavan Sarthi cancellation rules, 12% standard cancellation charge, refund review process, and service-wise policy for hotels, rooms, cabs, tours, Dharamshala enquiries, and shop orders.',
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
    description: 'Visit Radha Rani Temple, Kirti Mandir, and the sacred town of Barsana with professional travel services from Vrindavan Sarthi Enterprises.',
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
    title: 'Frequently Asked Questions | Vrindavan Sarthi Enterprises',
    description: 'Find answers to common questions about bookings, taxi services, tour packages, cancellations, and travel planning.',
  },
  '/refund-policy': {
    title: 'Refund Policy | Vrindavan Sarthi Enterprises',
    description: 'Learn about refunds, cancellations, booking modifications, and applicable refund timelines.',
  },
  '/careers': {
    title: 'Careers at Vrindavan Sarthi Enterprises | Join Our Team',
    description: 'Explore career opportunities with Vrindavan Sarthi Enterprises in tourism, customer service, operations, and travel management.',
  },
  '/gallery': {
    title: 'Vrindavan Travel Gallery | Tour Photos & Braj Attractions',
    description: 'Explore beautiful photos of temples, pilgrimage sites, tour experiences, and attractions across Vrindavan and Braj.',
  },
  '/testimonials': {
    title: 'Customer Reviews | Vrindavan Sarthi Enterprises',
    description: 'Read genuine customer reviews and experiences from travelers who explored Braj with Vrindavan Sarthi Enterprises.',
  },
};

export const privateRouteMeta: Record<string, { title: string; description: string; image?: string }> = {
  '/login': {
    title: 'Login | Secure Travel Account',
    description: 'Sign in to your Vrindavan Sarthi Enterprises account to manage bookings, orders, partner listings, and travel plans.',
  },
  '/register': {
    title: 'Create Account | Traveller & Partner Registration',
    description: 'Create a Vrindavan Sarthi Enterprises account as a traveller or verified partner for hotels, rooms, cabs, tours, and booking management.',
  },
  '/forgot-password': {
    title: 'Forgot Password | Account Recovery',
    description: 'Recover your Vrindavan Sarthi Enterprises account securely with email verification.',
  },
  '/reset-password': {
    title: 'Reset Password | Secure Account Access',
    description: 'Set a new password for your Vrindavan Sarthi Enterprises account and regain secure access.',
  },
  '/auth/google/callback': {
    title: 'Completing Google Sign In',
    description: 'Completing secure Google sign in for your Vrindavan Sarthi Enterprises account.',
  },
  '/profile': {
    title: 'My Profile | Personal & Partner Details',
    description: 'View and update your personal profile, address, partner business details, and verification documents.',
  },
  '/bookings': {
    title: 'My Bookings | Hotels, Rooms, Cabs & Tours',
    description: 'Manage your Vrindavan Sarthi Enterprises bookings, payment status, trip details, and travel history.',
  },
  '/my-orders': {
    title: 'My Orders | Sacred Shop Purchases',
    description: 'Track and manage your devotional product orders from the Vrindavan Sarthi Enterprises shop.',
  },
};

export const adminRouteMeta: Record<string, { title: string; description: string; image?: string }> = {
  '/admin/login': {
    title: 'Admin Login | Vrindavan Sarthi Enterprises Control Desk',
    description: 'Secure admin access for managing Vrindavan Sarthi Enterprises bookings, listings, partners, inventory, payments, and settings.',
  },
  '/admin': {
    title: 'Admin Dashboard | Travel Operations Overview',
    description: 'Monitor revenue, bookings, users, properties, partner activity, and travel operations from the admin dashboard.',
  },
  '/admin/hotels': {
    title: 'Manage Hotels & Dharamshalas | Admin',
    description: 'Create, update, verify, and manage hotels and dharamshalas listed on Vrindavan Sarthi Enterprises.',
  },
  '/admin/inventory': {
    title: 'Room Inventory | Admin',
    description: 'Manage hotel room types, room units, availability calendars, blocked dates, and inventory controls.',
  },
  '/admin/cabs': {
    title: 'Taxi Booking Fleet | Admin',
    description: 'Manage cab listings, vehicle details, routes, drivers, and taxi booking inventory.',
  },
  '/admin/cab-fares': {
    title: 'Taxi Rates | Admin',
    description: 'Configure taxi fares, route pricing, local transfers, airport transfers, and travel rate cards.',
  },
  '/admin/tours': {
    title: 'Tour Packages | Admin',
    description: 'Create and manage Vrindavan, Mathura, Govardhan, Barsana, Gokul, and Braj tour packages.',
  },
  '/admin/partners': {
    title: 'Partner Verification | Admin',
    description: 'Review partner profiles, business information, legal documents, and verification status.',
  },
  '/admin/partner-requests': {
    title: 'Partner Listing Requests | Admin',
    description: 'Approve or reject partner-submitted hotels, rooms, cabs, and tour listing requests.',
  },
  '/admin/bookings': {
    title: 'Bookings Management | Admin',
    description: 'Review hotel, room, cab, and tour bookings with customer details, payment status, and cancellation controls.',
  },
  '/admin/payments': {
    title: 'Payment Verification | Admin',
    description: 'Verify booking and order payments, approve UPI transactions, and manage payment rejections.',
  },
  '/admin/partner-payouts': {
    title: 'Partner Payouts | Admin',
    description: 'Track partner earnings, bank details, payout settlement status, and payment notes.',
  },
  '/admin/products': {
    title: 'Product Catalog | Admin',
    description: 'Manage devotional shop products, images, pricing, categories, stock, and product visibility.',
  },
  '/admin/orders': {
    title: 'Shop Orders | Admin',
    description: 'Manage customer product orders, payment verification, dispatch status, tracking, and cancellations.',
  },
  '/admin/users': {
    title: 'User Management | Admin',
    description: 'View and manage traveller, partner, and admin user accounts on Vrindavan Sarthi Enterprises.',
  },
  '/admin/settings': {
    title: 'Application Settings | Admin',
    description: 'Manage site branding, contact details, UPI payment settings, policies, and admin credentials.',
  },
};

export const partnerRouteMeta: Record<string, { title: string; description: string; image?: string }> = {
  '/partner': {
    title: 'Partner Dashboard | Business Travel Desk',
    description: 'Partner overview for verification status, listings, bookings, payments, and Vrindavan Sarthi Enterprises business operations.',
  },
  '/partner/hotels': {
    title: 'My Hotels | Partner',
    description: 'Submit and manage partner hotel or dharamshala listings for admin verification.',
  },
  '/partner/cabs': {
    title: 'My Cabs | Partner',
    description: 'Submit and manage partner cab listings, routes, vehicle details, and driver information.',
  },
  '/partner/inventory': {
    title: 'Partner Inventory | Rooms & Availability',
    description: 'Manage partner room types, room units, blocked dates, and live availability after admin verification.',
  },
  '/partner/listings': {
    title: 'My Listings | Partner',
    description: 'Review partner-submitted hotels, rooms, cabs, and tours with approval status and admin remarks.',
  },
  '/partner/bookings': {
    title: 'Partner Bookings | Guest Reservations',
    description: 'View and verify partner bookings, guest details, payment status, and reservation updates.',
  },
  '/partner/payments': {
    title: 'Partner Payments | Earnings Overview',
    description: 'Track partner booking payments, settlements, commissions, and payout status.',
  },
  '/partner/bank-details': {
    title: 'Bank Details | Partner Payout Setup',
    description: 'Add or update partner bank account details used for payout settlements.',
  },
  '/partner/profile-settings': {
    title: 'Partner Profile Settings | Public Host Profile',
    description: 'Customize the public partner host profile shown with approved room and property listings.',
  },
  '/partner/communications': {
    title: 'Partner Notices | Admin Communications',
    description: 'Read admin notices, verification updates, booking alerts, and partner communications.',
  },
};

export const routeMeta = {
  ...publicRouteMeta,
  ...privateRouteMeta,
  ...adminRouteMeta,
  ...partnerRouteMeta,
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
  '/cancellation-policy',
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
  if (routeMeta[path]) return routeMeta[path];
  if (path.startsWith('/hotels/')) {
    return { title: 'Braj Property Details', description: 'View verified hotel or Dharamshala details, room options, amenities, location, and booking information across Braj.' };
  }
  if (path.startsWith('/room-types/')) {
    return { title: 'Braj Room Details', description: 'View room details, amenities, availability, pricing, and booking options for a verified Braj stay.' };
  }
  if (path.startsWith('/cabs/')) {
    return { title: 'Braj Cab Details', description: 'View cab details, routes, capacity, fare information, and booking options for Braj travel.' };
  }
  if (path.startsWith('/tours/')) {
    return { title: 'Braj Tour Details', description: 'View itinerary, inclusions, duration, price, and booking options for a Braj tour package.' };
  }
  if (path.startsWith('/shop/')) {
    return { title: 'Braj Product Details', description: 'View product details, price, availability, and ordering options from the Vrindavan Sarthi Enterprises shop.' };
  }
  if (path.startsWith('/bookings/')) {
    return { title: 'Booking Details | Reservation & Payment Status', description: 'View your booking summary, customer details, payment status, cancellation status, and travel reservation information.' };
  }
  return {
    title: 'Page Not Found | Vrindavan Sarthi Enterprises',
    description: "The page you're looking for doesn't exist. Explore our tour packages, taxi services, and travel guides instead.",
  };
};
