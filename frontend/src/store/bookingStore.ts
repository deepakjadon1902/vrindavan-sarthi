import { create } from 'zustand';
import { api, resolveBackendAssetUrl, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import axios from 'axios';

export interface Booking {
  id: string; // Mongo _id
  bookingId: string; // human code like VVS-...
  bookingType: 'hotel' | 'room' | 'cab' | 'tour';
  itemId: string;
  itemName: string;
  itemImage: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  partnerId?: string;
  partnerName?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  totalAmount: number;
  paymentMethod: 'online' | 'doorstep';
  paymentStatus: 'pending' | 'paid' | 'failed';
  bookingStatus: 'confirmed' | 'cancelled' | 'completed' | 'pending';
  verificationStage?: 'pending_partner' | 'pending_admin' | 'verified' | 'rejected';
  partnerPaymentVerified?: boolean;
  adminPaymentVerified?: boolean;
  upiTransactionId?: string;
  additionalInfo?: string;
  createdAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');
const getNumber = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'number' ? obj[key] : Number(obj[key] || 0));

const normalizeBooking = (b: unknown): Booking => {
  const obj = isRecord(b) ? b : {};
  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    bookingId: getString(obj, 'bookingId') || getString(obj, 'id'),
    bookingType: (getString(obj, 'bookingType') as Booking['bookingType']) || 'hotel',
    itemId: getString(obj, 'itemId'),
    itemName: getString(obj, 'itemName'),
    itemImage: resolveBackendAssetUrl(getString(obj, 'itemImage')),
    userId: getString(obj, 'userId'),
    userName: getString(obj, 'userName'),
    userEmail: getString(obj, 'userEmail'),
    userPhone: getString(obj, 'userPhone'),
    partnerId: getString(obj, 'partnerId') || undefined,
    partnerName: getString(obj, 'partnerName') || undefined,
    checkIn: getString(obj, 'checkIn') || undefined,
    checkOut: getString(obj, 'checkOut') || undefined,
    guests: getNumber(obj, 'guests') || undefined,
    totalAmount: getNumber(obj, 'totalAmount'),
    paymentMethod: (getString(obj, 'paymentMethod') as Booking['paymentMethod']) || 'online',
    paymentStatus: (getString(obj, 'paymentStatus') as Booking['paymentStatus']) || 'pending',
    bookingStatus: (getString(obj, 'bookingStatus') as Booking['bookingStatus']) || 'pending',
    verificationStage: (getString(obj, 'verificationStage') as Booking['verificationStage']) || undefined,
    partnerPaymentVerified: typeof obj.partnerPaymentVerified === 'boolean' ? obj.partnerPaymentVerified : undefined,
    adminPaymentVerified: typeof obj.adminPaymentVerified === 'boolean' ? obj.adminPaymentVerified : undefined,
    upiTransactionId: getString(obj, 'upiTransactionId') || undefined,
    additionalInfo: getString(obj, 'additionalInfo') || undefined,
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as any)?.message;
    if (typeof msg === 'string') return msg;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

interface BookingState {
  myBookings: Booking[];
  partnerBookings: Booking[];
  adminBookings: Booking[];
  isLoading: boolean;

  fetchMyBookings: () => Promise<void>;
  fetchPartnerBookings: () => Promise<void>;
  fetchAllBookings: () => Promise<void>;
  fetchBookingById: (id: string) => Promise<Booking | null>;

  createBooking: (data: Omit<Booking, 'id' | 'bookingId' | 'createdAt' | 'userId' | 'userName' | 'userEmail' | 'userPhone'>) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  cancelBooking: (id: string) => Promise<{ success: boolean; error?: string }>;
  submitPayment: (id: string, upiTransactionId: string) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  verifyPayment: (id: string) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  rejectPayment: (id: string) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  partnerVerifyPayment: (id: string) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  partnerRejectPayment: (id: string) => Promise<{ success: boolean; data?: Booking; error?: string }>;
}

export const useBookingStore = create<BookingState>()((set, get) => ({
  myBookings: [],
  partnerBookings: [],
  adminBookings: [],
  isLoading: false,

  fetchMyBookings: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get('/bookings/my', withAuth(token));
      const bookings = (res.data?.data || []).map(normalizeBooking);
      set({ myBookings: bookings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchPartnerBookings: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get('/bookings/partner', withAuth(token));
      const bookings = (res.data?.data || []).map(normalizeBooking);
      set({ partnerBookings: bookings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchAllBookings: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get('/bookings/all', withAuth(token));
      const bookings = (res.data?.data || []).map(normalizeBooking);
      set({ adminBookings: bookings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchBookingById: async (id) => {
    if (!id) return null;
    const token = useAuthStore.getState().token;
    if (!token) return null;

    const fromCache =
      get().myBookings.find((b) => b.id === id) ||
      get().partnerBookings.find((b) => b.id === id) ||
      get().adminBookings.find((b) => b.id === id);
    if (fromCache) return fromCache;

    try {
      const res = await api.get(`/bookings/${id}`, withAuth(token));
      const booking = normalizeBooking(res.data?.data);
      if (!booking.id) return null;
      set((state) => ({ myBookings: [booking, ...state.myBookings.filter((b) => b.id !== booking.id)] }));
      return booking;
    } catch {
      return null;
    }
  },

  createBooking: async (data) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.post('/bookings', data, withAuth(token));
      const booking = normalizeBooking(res.data?.data);
      set((state) => ({ myBookings: [booking, ...state.myBookings] }));
      return { success: true, data: booking };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Booking failed') };
    }
  },

  cancelBooking: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/cancel`, {}, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({
        myBookings: state.myBookings.map((b) => (b.id === id ? updated : b)),
        partnerBookings: state.partnerBookings.map((b) => (b.id === id ? updated : b)),
        adminBookings: state.adminBookings.map((b) => (b.id === id ? updated : b)),
      }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Cancel failed') };
    }
  },

  submitPayment: async (id, upiTransactionId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/payment`, { upiTransactionId }, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({ myBookings: state.myBookings.map((b) => (b.id === id ? updated : b)) }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Payment update failed') };
    }
  },

  verifyPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/verify`, {}, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({ adminBookings: state.adminBookings.map((b) => (b.id === id ? updated : b)) }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Verify failed') };
    }
  },

  rejectPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/reject`, {}, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({ adminBookings: state.adminBookings.map((b) => (b.id === id ? updated : b)) }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Reject failed') };
    }
  },

  partnerVerifyPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/partner-verify`, {}, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({
        partnerBookings: state.partnerBookings.map((b) => (b.id === id ? updated : b)),
      }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Verify failed') };
    }
  },

  partnerRejectPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/partner-reject`, {}, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({
        partnerBookings: state.partnerBookings.map((b) => (b.id === id ? updated : b)),
      }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Reject failed') };
    }
  },
}));
