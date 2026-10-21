/**
 * Vrindavan Sarthi — Geographic Discovery Engine
 *
 * Implements real coordinate-based distance calculation (Haversine formula),
 * authentic Braj landmark coordinate anchors, user geolocation state management,
 * and intelligent landmark-based discovery section grouping.
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface LandmarkLocation {
  id: string;
  name: string;
  sectionHeading: string;
  place: 'Vrindavan' | 'Mathura' | 'Govardhan' | 'Barsana' | 'Gokul' | 'Other';
  lat: number;
  lng: number;
  subtitle: string;
  keywords: string[];
}

/**
 * Verified Geographic Coordinates of Sacred Braj Landmarks
 * Sourced from open spatial cartography of Mathura-Vrindavan Development Authority (MVDA)
 */
export const BRAJ_LANDMARK_REGISTRY: LandmarkLocation[] = [
  {
    id: 'prem_mandir',
    name: 'Prem Mandir',
    sectionHeading: 'Near Prem Mandir',
    place: 'Vrindavan',
    lat: 27.5714,
    lng: 77.6713,
    subtitle: 'Raman Reti, Chaitanya Vihar & Keshav Dham',
    keywords: [
      'prem mandir',
      'keshav dham',
      'chaitanya vihar',
      'raman reti',
      'chhatikra',
      'multilevel car parking',
      'sjd school',
    ],
  },
  {
    id: 'iskcon',
    name: 'ISKCON Temple',
    sectionHeading: 'Near ISKCON Temple',
    place: 'Vrindavan',
    lat: 27.5815,
    lng: 77.6836,
    subtitle: 'Krishna Balaram Mandir & Sheetal Chhaya',
    keywords: [
      'iskcon',
      'krishna balaram',
      'sheetal chhaya',
      'kaimar van',
      'bhaktivedanta swami marg',
    ],
  },
  {
    id: 'banke_bihari',
    name: 'Banke Bihari Temple',
    sectionHeading: 'Near Banke Bihari Temple',
    place: 'Vrindavan',
    lat: 27.5833,
    lng: 77.7013,
    subtitle: 'Historic Vrindavan Core & Temple Bazaar',
    keywords: [
      'banke bihari',
      'bihari ji',
      'vidyapeeth',
      'dussehra ghat',
      'haridas',
      'kunj gali',
      'bihari gali',
    ],
  },
  {
    id: 'radha_raman',
    name: 'Radha Raman Temple',
    sectionHeading: 'Near Radha Raman Temple',
    place: 'Vrindavan',
    lat: 27.5882,
    lng: 77.7058,
    subtitle: 'Ancient Yamuna Ghats & Nidhivan Marg',
    keywords: [
      'radha raman',
      'radharaman',
      'radha damodar',
      'radha vallabh',
      'kesi ghat',
      'yamuna ghat',
      'nidhivan',
      'seva kunj',
    ],
  },
  {
    id: 'mathura_junction',
    name: 'Mathura Junction',
    sectionHeading: 'Near Mathura Junction',
    place: 'Mathura',
    lat: 27.4924,
    lng: 77.6737,
    subtitle: 'Dholi Pyau, Mayur Vihar & Station Access',
    keywords: [
      'mathura railway',
      'railway station',
      'mathura junction',
      'dholi pyau',
      'dholipyau',
      'mayur vihar',
      'canara bank',
      'narayanapuri',
      'union bank',
      'gla university',
      'kans qila',
    ],
  },
  {
    id: 'govardhan',
    name: 'Govardhan',
    sectionHeading: 'Near Govardhan',
    place: 'Govardhan',
    lat: 27.4984,
    lng: 77.4646,
    subtitle: 'Giriraj Parikrama Marg, Daan Ghati & Mansi Ganga',
    keywords: [
      'govardhan',
      'goverdhan',
      'daan ghati',
      'giriraj',
      'mansi ganga',
      'radha kund',
      'radhakund',
      'kusum sarovar',
      'jatipura',
      'punchari',
    ],
  },
  {
    id: 'krishna_janmabhoomi',
    name: 'Shri Krishna Janmabhoomi',
    sectionHeading: 'Near Shri Krishna Janmabhoomi',
    place: 'Mathura',
    lat: 27.505,
    lng: 77.6698,
    subtitle: 'Janmasthan, Bhuteshwar & Potra Kund',
    keywords: [
      'janmabhoomi',
      'janambhoomi',
      'bhuteshwar',
      'jagannath puri',
      'potra kund',
      'gate no 1',
      'gate no - 1',
    ],
  },
];

/**
 * Finds a landmark by its ID, slug, or name (case and punctuation insensitive)
 */
export function findLandmark(identifier?: string | null): LandmarkLocation | undefined {
  if (!identifier) return undefined;
  const normalized = identifier.trim().toLowerCase().replace(/[-_ ]+/g, '');
  return BRAJ_LANDMARK_REGISTRY.find(
    (l) =>
      l.id.toLowerCase().replace(/[-_ ]+/g, '') === normalized ||
      l.name.toLowerCase().replace(/[-_ ]+/g, '') === normalized
  );
}

/**
 * Calculates genuine spherical distance in kilometers using the Haversine formula.
 * Formula: a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
 *          c = 2 ⋅ atan2( √a, √(1−a) )
 *          d = R ⋅ c
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 10) / 10;
}

/**
 * Formats kilometer distance cleanly for customer display (e.g., "400 m", "1.2 km").
 */
export function formatDistanceKm(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

/**
 * Attempts to extract latitude/longitude from a Google Maps link if embedded
 */
export function parseCoordinatesFromMapUrl(url?: string): GeoCoordinates | null {
  if (!url) return null;
  // Match @27.5714,77.6713 or q=27.5714,77.6713 or !3d27.5714!4d77.6713
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
  }
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
  }
  return null;
}

/**
 * Matches a property or room-type to the most accurate registered Braj landmark
 */
export function resolveItemLandmark(item: any): LandmarkLocation | null {
  const hotel = item?.hotel || item || {};
  const searchCorpus = [
    hotel?.nearestTemple,
    hotel?.location,
    hotel?.fullAddress,
    hotel?.name,
    item?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. Direct landmark name match
  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    if (searchCorpus.includes(landmark.name.toLowerCase())) {
      return landmark;
    }
  }

  // 2. Keyword/alias match
  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    for (const kw of landmark.keywords) {
      if (searchCorpus.includes(kw)) {
        return landmark;
      }
    }
  }

  // 3. Fallback based on town name in location
  if (searchCorpus.includes('govardhan') || searchCorpus.includes('goverdhan')) {
    return BRAJ_LANDMARK_REGISTRY.find((l) => l.id === 'govardhan') || null;
  }
  if (searchCorpus.includes('mathura')) {
    return BRAJ_LANDMARK_REGISTRY.find((l) => l.id === 'mathura_junction') || null;
  }
  if (searchCorpus.includes('vrindavan')) {
    return BRAJ_LANDMARK_REGISTRY.find((l) => l.id === 'prem_mandir') || null;
  }

  return null;
}

/**
 * Resolves the real or landmark-anchored coordinates of an item
 */
export function resolveItemCoordinates(item: any): GeoCoordinates | null {
  const hotel = item?.hotel || item || {};
  // 1. Direct coordinates on hotel if present
  if (typeof hotel.latitude === 'number' && typeof hotel.longitude === 'number') {
    return { latitude: hotel.latitude, longitude: hotel.longitude };
  }
  // 2. Parse from Google Maps link
  const parsed = parseCoordinatesFromMapUrl(hotel.googleMapLink);
  if (parsed) return parsed;

  // 3. Anchored to nearest landmark
  const landmark = resolveItemLandmark(item);
  if (landmark) {
    return { latitude: landmark.lat, longitude: landmark.lng };
  }

  return null;
}

export interface LocationSectionGroup<T> {
  id: string;
  heading: string;
  subtitle: string;
  landmark: LandmarkLocation | null;
  distanceKm?: number;
  distanceLabel?: string;
  items: T[];
  filterUrl: string;
}

/**
 * Groups room types or properties into landmark discovery sections.
 * When userCoords are available:
 *   - Introduces "Near Your Current Location" with the closest listings
 *   - Ranks subsequent sections by real Haversine proximity to the user
 *   - Computes authentic distanceKm
 */
export function groupItemsIntoLocationSections<T extends { _id: string }>(
  items: T[],
  userCoords: GeoCoordinates | null,
  routePrefix: '/rooms' | '/hotels' = '/rooms'
): LocationSectionGroup<T>[] {
  if (!items.length) return [];

  // Map items to their primary landmark
  const landmarkBuckets = new Map<string, { landmark: LandmarkLocation; items: T[] }>();
  const unassigned: T[] = [];

  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    landmarkBuckets.set(landmark.id, { landmark, items: [] });
  }

  for (const item of items) {
    const landmark = resolveItemLandmark(item);
    if (landmark && landmarkBuckets.has(landmark.id)) {
      landmarkBuckets.get(landmark.id)!.items.push(item);
    } else {
      unassigned.push(item);
    }
  }

  const sections: LocationSectionGroup<T>[] = [];

  // If user granted GPS coordinates:
  if (userCoords) {
    // Collect all items with resolved coordinates and sort by distance
    const itemsWithDistance = items
      .map((item) => {
        const coords = resolveItemCoordinates(item);
        if (!coords) return null;
        const dist = calculateHaversineDistanceKm(
          userCoords.latitude,
          userCoords.longitude,
          coords.latitude,
          coords.longitude
        );
        return { item, dist };
      })
      .filter((entry): entry is { item: T; dist: number } => entry !== null)
      .sort((a, b) => a.dist - b.dist);

    if (itemsWithDistance.length > 0) {
      const closest = itemsWithDistance.slice(0, 6);
      const minDistance = closest[0].dist;
      sections.push({
        id: 'near_me',
        heading: 'Near Your Location',
        subtitle: `Stays ranked by real GPS proximity (${formatDistanceKm(minDistance)} onwards)`,
        landmark: null,
        distanceKm: minDistance,
        distanceLabel: formatDistanceKm(minDistance),
        items: closest.map((c) => c.item),
        filterUrl: `${routePrefix}?landmark=near_me`,
      });
    }
  }

  // Build landmark sections
  const landmarkSections: LocationSectionGroup<T>[] = [];

  for (const { landmark, items: bucketItems } of landmarkBuckets.values()) {
    // Only display sections that have available properties or are primary Braj destinations
    if (bucketItems.length === 0) continue;

    let distKm: number | undefined;
    let distLabel: string | undefined;

    if (userCoords) {
      distKm = calculateHaversineDistanceKm(
        userCoords.latitude,
        userCoords.longitude,
        landmark.lat,
        landmark.lng
      );
      distLabel = formatDistanceKm(distKm);
    }

    landmarkSections.push({
      id: landmark.id,
      heading: landmark.sectionHeading,
      subtitle: landmark.subtitle,
      landmark,
      distanceKm: distKm,
      distanceLabel: distLabel,
      items: bucketItems,
      filterUrl: `${routePrefix}?landmark=${landmark.id}`,
    });
  }

  // If user coordinates exist, sort landmark sections by proximity to user
  if (userCoords) {
    landmarkSections.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }

  sections.push(...landmarkSections);

  // If there are unassigned items, present them in a clean "More Stays in Braj" section
  if (unassigned.length > 0) {
    sections.push({
      id: 'more_braj_stays',
      heading: 'More Stays Across Braj',
      subtitle: 'Additional verified accommodations in surrounding Braj Dham areas',
      landmark: null,
      items: unassigned,
      filterUrl: routePrefix,
    });
  }

  return sections;
}
