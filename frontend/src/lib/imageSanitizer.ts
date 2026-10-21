/**
 * Image Sanitization & Accommodation Photo Priority Utility
 *
 * Ensures that portrait photos of individuals incorrectly assigned as property images
 * are filtered out and replaced with genuine accommodation photos or neutral fallbacks.
 */

// Known Cloudinary hashes/identifiers of portraits of individuals uploaded accidentally
const KNOWN_PORTRAIT_IDENTIFIERS = [
  'dei2cctwiuhumx2qs26c',
  'simy177ejn4xmyq7s4tt',
  'zucmqv2r4p4t66cso7tf',
  'dw8jh2fbhltiq2lpjgab',
];

export const isPortraitPersonPhoto = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return KNOWN_PORTRAIT_IDENTIFIERS.some((id) => lower.includes(id));
};

export const sanitizeListingImage = (
  primaryUrl?: string | null,
  galleryUrls?: Array<string | null | undefined>,
  fallback = '/placeholder.svg'
): string => {
  if (primaryUrl && !isPortraitPersonPhoto(primaryUrl)) {
    return primaryUrl;
  }
  if (Array.isArray(galleryUrls)) {
    const validInGallery = galleryUrls.find((url) => Boolean(url) && !isPortraitPersonPhoto(url));
    if (validInGallery) return validInGallery;
  }
  return fallback;
};

export const filterSafeGallery = (
  urls: Array<string | null | undefined>,
  fallback = '/placeholder.svg'
): string[] => {
  const safe = urls
    .filter((u): u is string => Boolean(u) && typeof u === 'string' && !isPortraitPersonPhoto(u) && u !== '/placeholder.svg' && !u.includes('undefined'));
  const unique = Array.from(new Set(safe));
  return unique.length > 0 ? unique : [fallback];
};
