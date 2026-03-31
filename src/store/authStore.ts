import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials, RegisterData } from '@/types/auth.types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (creds: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

// Temporary mock users storage — will be replaced with real DB
const MOCK_USERS_KEY = 'vvs_users';

const getStoredUsers = (): Array<User & { password: string }> => {
  try {
    const data = localStorage.getItem(MOCK_USERS_KEY);
    return data ? JSON.parse(data) : getDefaultUsers();
  } catch {
    return getDefaultUsers();
  }
};

const getDefaultUsers = (): Array<User & { password: string }> => [
  {
    id: 'admin-001',
    name: 'Deepak Jadon',
    email: 'deepakjadon1907@gmail.com',
    phone: '+91 9999999999',
    address: { street: 'Vrindavan Main Road', city: 'Vrindavan', state: 'Uttar Pradesh', pin: '281121' },
    role: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    password: 'deepakjadon1907@',
  },
];

const saveUsers = (users: Array<User & { password: string }>) => {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (creds) => {
        set({ isLoading: true });
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 800));
        const users = getStoredUsers();
        const found = users.find(
          (u) => u.email === creds.email && u.password === creds.password
        );
        if (found) {
          const { password: _, ...user } = found;
          set({ user, isAuthenticated: true, isLoading: false });
          return { success: true };
        }
        set({ isLoading: false });
        return { success: false, error: 'Invalid email or password' };
      },

      register: async (data) => {
        set({ isLoading: true });
        await new Promise((r) => setTimeout(r, 800));
        const users = getStoredUsers();
        if (users.find((u) => u.email === data.email)) {
          set({ isLoading: false });
          return { success: false, error: 'Email already registered' };
        }
        const newUser = {
          id: `user-${Date.now()}`,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: { street: data.street, city: data.city, state: data.state, pin: data.pin },
          role: 'user' as const,
          createdAt: new Date().toISOString(),
          password: data.password,
        };
        users.push(newUser);
        saveUsers(users);
        const { password: _, ...user } = newUser;
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true };
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      updateProfile: (data) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },
    }),
    { name: 'vvs-auth' }
  )
);
