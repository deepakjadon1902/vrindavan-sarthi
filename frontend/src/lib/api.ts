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
  if (v.startsWith('/') && BACKEND_ORIGIN) return `${BACKEND_ORIGIN}${v}`;
  return v;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const withAuth = (token?: string | null): AxiosRequestConfig => {
  if (!token) return {};
  return { headers: { Authorization: `Bearer ${token}` } };
};
