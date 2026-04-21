import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials, RegisterData } from '@/types/auth.types';
import { api, withAuth } from '@/lib/api';
import axios from 'axios';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (creds: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  refreshMe: () => Promise<void>;
  completeOAuth: (token: string) => Promise<{ success: boolean; error?: string }>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');

const mapUser = (u: unknown): User => {
  const obj = isRecord(u) ? u : {};
  const addressObj = isRecord(obj.address) ? obj.address : {};

  const role = getString(obj, 'role');
  const normalizedRole = role === 'admin' || role === 'partner' || role === 'user' ? role : 'user';

  const partnerStatus = getString(obj, 'partnerStatus');
  const normalizedPartnerStatus =
    partnerStatus === 'pending' || partnerStatus === 'approved' || partnerStatus === 'rejected'
      ? partnerStatus
      : undefined;

  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    name: getString(obj, 'name'),
    email: getString(obj, 'email'),
    phone: getString(obj, 'phone'),
    address: {
      street: getString(addressObj, 'street'),
      city: getString(addressObj, 'city'),
      state: getString(addressObj, 'state'),
      pin: getString(addressObj, 'pin'),
    },
    avatar: getString(obj, 'avatar') || undefined,
    role: normalizedRole,
    businessName: getString(obj, 'businessName') || undefined,
    gstNumber: getString(obj, 'gstNumber') || undefined,
    businessType: getString(obj, 'businessType') || undefined,
    businessAddress: getString(obj, 'businessAddress') || undefined,
    businessPhone: getString(obj, 'businessPhone') || undefined,
    businessEmail: getString(obj, 'businessEmail') || undefined,
    businessDescription: getString(obj, 'businessDescription') || undefined,
    partnerStatus: normalizedPartnerStatus,
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (isRecord(data) && typeof data.message === 'string') return data.message;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (creds) => {
        try {
          set({ isLoading: true });
          const res = await api.post('/auth/login', creds);
          const token = res.data?.token;
          const user = mapUser(res.data?.user);
          if (!token || !user.id) {
            set({ isLoading: false });
            return { success: false, error: 'Login failed' };
          }
          set({ token, user, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err: unknown) {
          set({ isLoading: false });
          return { success: false, error: getApiErrorMessage(err, 'Login failed') };
        }
      },

      register: async (data) => {
        try {
          set({ isLoading: true });
          const res = await api.post('/auth/register', data);
          const token = res.data?.token;
          const user = mapUser(res.data?.user);
          if (!token || !user.id) {
            set({ isLoading: false });
            return { success: false, error: 'Registration failed' };
          }
          set({ token, user, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err: unknown) {
          set({ isLoading: false });
          return { success: false, error: getApiErrorMessage(err, 'Registration failed') };
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      refreshMe: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const res = await api.get('/auth/me', withAuth(token));
          const user = mapUser(res.data?.user);
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      completeOAuth: async (token) => {
        try {
          set({ token, isAuthenticated: true });
          await get().refreshMe();
          if (!get().user) return { success: false, error: 'OAuth login failed' };
          return { success: true };
        } catch (err: unknown) {
          return { success: false, error: getApiErrorMessage(err, 'OAuth login failed') };
        }
      },

      updateProfile: async (data) => {
        const token = get().token;
        if (!token) return { success: false, error: 'Not authenticated' };
        try {
          const res = await api.put('/auth/me', data, withAuth(token));
          const user = mapUser(res.data?.user);
          set({ user });
          return { success: true };
        } catch (err: unknown) {
          return { success: false, error: getApiErrorMessage(err, 'Update failed') };
        }
      },
    }),
    { name: 'vvs-auth' }
  )
);
