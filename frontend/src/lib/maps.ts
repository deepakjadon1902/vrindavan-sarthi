type MapInput = {
  mapValue?: string;
  name?: string;
  location?: string;
  nearestTemple?: string;
};

const genericMapText = /^(map|google map|google maps|location|hotel location)$/i;
const coordinatePattern = /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,\d+z)?|[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)|(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

export const buildMapQuery = ({ mapValue, name, location, nearestTemple }: MapInput) => {
  const rawInput = String(mapValue || '').trim();
  const placeQuery = [
    name,
    location,
    nearestTemple ? `near ${nearestTemple}` : '',
    'Braj',
    'Uttar Pradesh',
    'India',
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  const raw = !rawInput || genericMapText.test(rawInput) ? placeQuery : rawInput;
  const coordinateMatch = raw.match(coordinatePattern);
  if (coordinateMatch) {
    const lat = coordinateMatch[1] || coordinateMatch[3] || coordinateMatch[5];
    const lng = coordinateMatch[2] || coordinateMatch[4] || coordinateMatch[6];
    if (lat && lng) return `${lat},${lng}`;
  }

  try {
    const url = new URL(raw);
    const query = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('ll') || '';
    if (query) return query;
    if (url.hostname.includes('google') || url.hostname.includes('goo.gl') || url.hostname.includes('maps.app.goo.gl')) {
      return placeQuery || raw;
    }
  } catch {
    // Plain address text is expected.
  }

  return placeQuery ? `${placeQuery}${raw && raw !== placeQuery ? `, ${raw}` : ''}` : raw;
};

export const getGoogleMapEmbedSrc = (input: MapInput) => {
  const raw = String(input.mapValue || '').trim();
  if (raw.includes('/maps/embed')) return raw;
  const query = buildMapQuery(input);
  if (!query) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
};

export const getGoogleMapNavigationUrl = (input: MapInput) => {
  const query = buildMapQuery(input);
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};
