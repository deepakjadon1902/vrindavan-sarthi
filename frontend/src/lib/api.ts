import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

export const BACKEND_ORIGIN = (() => {
  if (!isAbsoluteUrl(API_BASE_URL)) return '';
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
})();

export const resolveBackendAssetUrl = (value?: string | null): string => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (isAbsoluteUrl(v) || v.startsWith('data:') || v.startsWith('blob:')) return v;
  // Be forgiving if the backend stored a relative uploads path without a leading slash.
  // e.g. "uploads/hotels/x.jpg" -> "/uploads/hotels/x.jpg"
  if (/^uploads[\\/]/i.test(v)) {
    const normalized = `/${v.replace(/\\/g, '/')}`;
    if (BACKEND_ORIGIN) return `${BACKEND_ORIGIN}${normalized}`;
    return normalized;
  }
  if (v.startsWith('/') && BACKEND_ORIGIN) return `${BACKEND_ORIGIN}${v}`;
  return v;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Prevent pages from hanging forever if backend/proxy is down or slow.
  // Keep it tight so the UI can fail fast and show an error toast.
  timeout: 8000,
});

export const withAuth = (token?: string | null): AxiosRequestConfig => {
  if (!token) return {};
  return { headers: { Authorization: `Bearer ${token}` } };
};
