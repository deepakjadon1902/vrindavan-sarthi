import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const withAuth = (token?: string | null): AxiosRequestConfig => {
  if (!token) return {};
  return { headers: { Authorization: `Bearer ${token}` } };
};

