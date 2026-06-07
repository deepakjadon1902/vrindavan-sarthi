type ListingType = 'hotels' | 'rooms' | 'roomTypes' | 'cabs' | 'tours' | 'products';

const ssKey = (type: ListingType, id: string) => `vvs_prefetch:${type}:${id}`;
const lsKey = (type: Exclude<ListingType, 'products'>) => (type === 'roomTypes' ? 'vvs_room_types' : `vvs_${type}`);

export const prefetchDetail = (type: ListingType, id: string, data: unknown) => {
  try {
    sessionStorage.setItem(ssKey(type, id), JSON.stringify(data));
  } catch {
    // ignore
  }
};

export const getPrefetchedDetail = <T = any>(type: ListingType, id?: string): T | null => {
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(ssKey(type, id));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getCachedListingItem = <T = any>(type: Exclude<ListingType, 'products'>, id?: string): T | null => {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(lsKey(type));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return (arr.find((x: any) => String(x?._id || x?.id) === String(id)) as T) || null;
  } catch {
    return null;
  }
};
