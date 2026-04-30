import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { api, resolveBackendAssetUrl, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export interface AppSettings {
  siteName: string;
  motto: string;
  logoUrl: string;
  faviconUrl: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImageUrl: string;
  upiId: string;
  upiName: string;
  adminPhone: string;
  adminEmail: string;
  termsOfService: string;
  privacyPolicy: string;
}

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  saveSettings: (data: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
  uploadLogo: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  uploadFavicon: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
}

const defaultSettings: AppSettings = {
  siteName: 'Vrindavan Sarthi',
  motto: 'Your Divine Guide to Vrindavan',
  logoUrl: '',
  faviconUrl: '',
  metaTitle: 'Vrindavan Sarthi',
  metaDescription: 'Your Divine Guide to Vrindavan',
  metaKeywords: 'Vrindavan, hotels, rooms, cabs, tours, bookings, shop',
  ogImageUrl: '',
  upiId: '',
  upiName: 'Vrindavan Sarthi',
  adminPhone: '+91 9999999999',
  adminEmail: 'vrindavansarthi108@gmail.com',
  termsOfService: `1. Acceptance of Terms
By accessing and using Vrindavan Sarthi ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.

2. Services
Vrindavan Sarthi provides an online platform for booking hotels, rooms, cabs, and tour packages in Vrindavan. We act as an intermediary between users and service providers (hotels, cab drivers, tour operators).

3. User Accounts
You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.

4. Bookings & Payments
All bookings are subject to availability. Hotel and tour payments are processed via UPI. Cab fares are paid directly to the driver at the destination. Booking confirmations are sent via the platform.

5. Cancellation & Refunds
Cancellation policies vary by service provider. Refunds, if applicable, will be processed within 7-10 business days. Cab bookings can be cancelled free of charge before the pickup time.

6. Partner Responsibilities
Partners listing hotels, rooms, cabs, or tours must provide accurate information. All listings are subject to admin verification. Misrepresentation may result in removal from the platform.

7. Limitation of Liability
Vrindavan Sarthi is not liable for the quality of services provided by third-party partners. We make every effort to verify listings but do not guarantee accuracy of all information.

8. Contact
For questions about these Terms, contact us at vrindavansarthi108@gmail.com or visit our Contact page.`,
  privacyPolicy: `1. Information We Collect
We collect personal information you provide during registration: name, email, phone number, address. For partners, we also collect business details including GST number and business address.

2. How We Use Your Information
Your information is used to: process bookings, communicate booking confirmations, improve our services, send relevant updates, and comply with legal obligations.

3. Data Sharing
We share necessary booking details with service providers (hotels, cab drivers) to fulfill your reservations. We do not sell your personal data to third parties.

4. Data Security
We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

5. Cookies
We use cookies and local storage to maintain your session, remember preferences, and improve user experience on the platform.

6. Your Rights
You have the right to access, update, or delete your personal information at any time through your profile settings or by contacting our support team.

7. Contact Us
For privacy-related inquiries, contact us at vrindavansarthi108@gmail.com or through our Contact page.`,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');

const normalizeSettings = (raw: unknown): AppSettings => {
  const obj = isRecord(raw) ? raw : {};
  return {
    ...defaultSettings,
    siteName: getString(obj, 'siteName') || defaultSettings.siteName,
    motto: getString(obj, 'motto') || defaultSettings.motto,
    logoUrl: resolveBackendAssetUrl(getString(obj, 'logoUrl')),
    faviconUrl: resolveBackendAssetUrl(getString(obj, 'faviconUrl')),
    metaTitle: getString(obj, 'metaTitle') || (getString(obj, 'siteName') || defaultSettings.metaTitle),
    metaDescription: getString(obj, 'metaDescription') || (getString(obj, 'motto') || defaultSettings.metaDescription),
    metaKeywords: getString(obj, 'metaKeywords') || defaultSettings.metaKeywords,
    ogImageUrl: resolveBackendAssetUrl(getString(obj, 'ogImageUrl')),
    upiId: getString(obj, 'upiId'),
    upiName: getString(obj, 'upiName') || defaultSettings.upiName,
    adminPhone: getString(obj, 'adminPhone') || defaultSettings.adminPhone,
    adminEmail: getString(obj, 'adminEmail') || defaultSettings.adminEmail,
    termsOfService: getString(obj, 'termsOfService') || defaultSettings.termsOfService,
    privacyPolicy: getString(obj, 'privacyPolicy') || defaultSettings.privacyPolicy,
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      isLoading: false,

      refreshSettings: async () => {
        try {
          set({ isLoading: true });
          const res = await api.get('/settings');
          const settings = normalizeSettings(res.data?.data);
          set({ settings, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      saveSettings: async (data) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, error: 'Not authenticated' };
        try {
          const res = await api.put('/settings', data, withAuth(token));
          const settings = normalizeSettings(res.data?.data);
          set({ settings });
          return { success: true };
        } catch (err: unknown) {
          return { success: false, error: getApiErrorMessage(err, 'Failed to save settings') };
        }
      },

      uploadLogo: async (file) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, error: 'Not authenticated' };
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await api.post('/settings/logo', form, withAuth(token));
          const settings = normalizeSettings(res.data?.data);
          set({ settings });
          return { success: true, url: typeof res.data?.url === 'string' ? res.data.url : settings.logoUrl };
        } catch (err: unknown) {
          return { success: false, error: getApiErrorMessage(err, 'Logo upload failed') };
        }
      },

      uploadFavicon: async (file) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, error: 'Not authenticated' };
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await api.post('/settings/favicon', form, withAuth(token));
          const settings = normalizeSettings(res.data?.data);
          set({ settings });
          return { success: true, url: typeof res.data?.url === 'string' ? res.data.url : settings.faviconUrl };
        } catch (err: unknown) {
          return { success: false, error: getApiErrorMessage(err, 'Favicon upload failed') };
        }
      },
    }),
    { name: 'vvs-settings' }
  )
);
