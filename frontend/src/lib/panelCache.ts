type CacheEntry<T> = { v: T; t: number };

const safeParse = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getSessionCache = <T,>(key: string, maxAgeMs: number): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeParse<CacheEntry<T>>(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v ?? null;
  } catch {
    return null;
  }
};

export const setSessionCache = <T,>(key: string, value: T) => {
  try {
    const entry: CacheEntry<T> = { v: value, t: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
};

export const clearSessionCache = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};
