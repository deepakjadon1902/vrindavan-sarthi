import { create } from 'zustand';
import { api, resolveBackendAssetUrl, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import axios from 'axios';

export interface Booking {
  id: string; // Mongo _id
  bookingId: string; // human code like VVS-...
  bookingType: 'hotel' | 'room' | 'cab' | 'tour' | 'room_type';
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
  baseAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  checkoutSubtotal?: number;
  convenienceFeePercent?: number;
  convenienceFeeAmount?: number;
  paymentOption?: 'advance_30' | 'full_100';
  platformCommissionPercent?: number;
  platformCommissionAmount?: number;
  service_billing_model?: 'hotel_marketplace' | 'taxi_direct' | 'tour_direct' | 'ecommerce_direct';
  grossForHotel?: number;
  paymentGatewayFeeAmount?: number;
  partnerNetPayout?: number;
  payout_status?: 'pending' | 'checked_in' | 'checked_out' | 'cancelled' | 'settled';
  hotel_gstin?: string;
  hotel_invoice_number?: string;
  paymentMethod: 'online' | 'doorstep';
  paymentStatus: 'pending' | 'paid' | 'failed';
  bookingStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'completed' | 'pending' | 'settled';
  verificationStage?: 'pending_partner' | 'pending_admin' | 'verified' | 'rejected';
  partnerPaymentVerified?: boolean;
  adminPaymentVerified?: boolean;
  upiTransactionId?: string;
  additionalInfo?: string;
  createdAt: string;
  // Inventory booking extras
  hotelId?: string;
  roomTypeId?: string;
  roomUnitId?: string;
  roomUnitIds?: string[];
  roomNumber?: string;
  roomNumbers?: string[];
  roomQuantity?: number;
  isWaitlisted?: boolean;
  waitlistAssignedAt?: string;
  acceptedPropertyTerms?: {
    accepted?: boolean;
    propertyId?: string;
    customerId?: string;
    version?: number;
    acceptedAt?: string;
    sections?: Record<string, string>;
  };

  // Detailed booking form fields
  customerFullName?: string;
  customerMobile?: string;
  customerEmail?: string;
  arrivalMode?: 'personal_vehicle' | 'transport';
  vehicleNumber?: string;
  arrivalTime?: string;
  totalAdults?: number;
  totalChildren?: number;
  hasPet?: boolean;
  guestDetails?: Array<{ type: 'adult' | 'child'; name: string; age: number; gender?: 'male' | 'female' | 'other' | null }>;

  // Cab booking fields
  pickupLocation?: string;
  dropLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  cabType?: string;
  cabFareTotal?: number;
  tollOption?: 'included' | 'excluded';
  advanceAmount?: number;
  balanceAmount?: number;
  assignedVehicleName?: string;
  assignedVehicleType?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedDriverEmail?: string;

  // Cancellation
  cancellationRequested?: boolean;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationReviewedByAdmin?: boolean;
  cancelledByRole?: 'user' | 'admin' | 'partner';
  cancelledByName?: string;
  cancelledAt?: string;
  cancellationDetails?: string;
  cancellationDeductionPercent?: number;
  cancellationDeductionAmount?: number;
  refundableAmount?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getString = (obj: Record<string, unknown>, key: string) => {
  const value = obj[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const str = String(value);
    return str === '[object Object]' ? '' : str;
  }
  return '';
};
const getNumber = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'number' ? obj[key] : Number(obj[key] || 0));
const getGuestDetails = (obj: Record<string, unknown>) => {
  const value = obj.guestDetails;
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((g) => ({
      type: (getString(g, 'type') === 'child' ? 'child' : 'adult') as 'adult' | 'child',
      name: getString(g, 'name'),
      age: getNumber(g, 'age'),
      gender: (getString(g, 'gender') as 'male' | 'female' | 'other') || null,
    }))
    .filter((g) => g.name);
};

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
    baseAmount: getNumber(obj, 'baseAmount') || getNumber(obj, 'base_amount') || undefined,
    taxPercent: getNumber(obj, 'taxPercent') || undefined,
    taxAmount: getNumber(obj, 'taxAmount') || getNumber(obj, 'hotel_gst_amount') || undefined,
    checkoutSubtotal: getNumber(obj, 'checkoutSubtotal') || undefined,
    convenienceFeePercent: getNumber(obj, 'convenienceFeePercent') || undefined,
    convenienceFeeAmount: getNumber(obj, 'convenienceFeeAmount') || getNumber(obj, 'convenience_fee') || undefined,
    paymentOption: (getString(obj, 'paymentOption') as Booking['paymentOption']) || undefined,
    platformCommissionPercent: getNumber(obj, 'platformCommissionPercent') || getNumber(obj, 'commission_rate') || undefined,
    platformCommissionAmount: getNumber(obj, 'platformCommissionAmount') || getNumber(obj, 'commission_amount') || undefined,
    service_billing_model: (getString(obj, 'service_billing_model') as Booking['service_billing_model']) || undefined,
    grossForHotel: getNumber(obj, 'grossForHotel') || getNumber(obj, 'gross_for_hotel') || undefined,
    paymentGatewayFeeAmount: getNumber(obj, 'paymentGatewayFeeAmount') || getNumber(obj, 'payment_gateway_fee') || undefined,
    partnerNetPayout: getNumber(obj, 'partnerNetPayout') || getNumber(obj, 'hotel_net_payout') || undefined,
    payout_status: (getString(obj, 'payout_status') as Booking['payout_status']) || undefined,
    hotel_gstin: getString(obj, 'hotel_gstin') || undefined,
    hotel_invoice_number: getString(obj, 'hotel_invoice_number') || undefined,
    paymentMethod: (getString(obj, 'paymentMethod') as Booking['paymentMethod']) || 'online',
    paymentStatus: (getString(obj, 'paymentStatus') as Booking['paymentStatus']) || 'pending',
    bookingStatus: (getString(obj, 'bookingStatus') as Booking['bookingStatus']) || 'pending',
    verificationStage: (getString(obj, 'verificationStage') as Booking['verificationStage']) || undefined,
    partnerPaymentVerified: typeof obj.partnerPaymentVerified === 'boolean' ? obj.partnerPaymentVerified : undefined,
    adminPaymentVerified: typeof obj.adminPaymentVerified === 'boolean' ? obj.adminPaymentVerified : undefined,
    upiTransactionId: getString(obj, 'upiTransactionId') || undefined,
    additionalInfo: getString(obj, 'additionalInfo') || undefined,
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
    hotelId: getString(obj, 'hotelId') || undefined,
    roomTypeId: getString(obj, 'roomTypeId') || undefined,
    roomUnitId: getString(obj, 'roomUnitId') || undefined,
    roomUnitIds: Array.isArray(obj.roomUnitIds) ? obj.roomUnitIds.map(String) : undefined,
    roomNumber: getString(obj, 'roomNumber') || undefined,
    roomNumbers: Array.isArray(obj.roomNumbers) ? obj.roomNumbers.map(String) : undefined,
    roomQuantity: getNumber(obj, 'roomQuantity') || undefined,
    isWaitlisted: typeof obj.isWaitlisted === 'boolean' ? obj.isWaitlisted : undefined,
    waitlistAssignedAt: getString(obj, 'waitlistAssignedAt') || undefined,
    acceptedPropertyTerms: isRecord(obj.acceptedPropertyTerms) ? (obj.acceptedPropertyTerms as Booking['acceptedPropertyTerms']) : undefined,
    customerFullName: getString(obj, 'customerFullName') || undefined,
    customerMobile: getString(obj, 'customerMobile') || undefined,
    customerEmail: getString(obj, 'customerEmail') || undefined,
    arrivalMode: (getString(obj, 'arrivalMode') as Booking['arrivalMode']) || undefined,
    vehicleNumber: getString(obj, 'vehicleNumber') || undefined,
    arrivalTime: getString(obj, 'arrivalTime') || undefined,
    totalAdults: getNumber(obj, 'totalAdults') || undefined,
    totalChildren: getNumber(obj, 'totalChildren') || undefined,
    hasPet: typeof obj.hasPet === 'boolean' ? obj.hasPet : undefined,
    guestDetails: getGuestDetails(obj),
    pickupLocation: getString(obj, 'pickupLocation') || undefined,
    dropLocation: getString(obj, 'dropLocation') || undefined,
    pickupDate: getString(obj, 'pickupDate') || undefined,
    pickupTime: getString(obj, 'pickupTime') || undefined,
    cabType: getString(obj, 'cabType') || undefined,
    cabFareTotal: getNumber(obj, 'cabFareTotal') || undefined,
    tollOption: (getString(obj, 'tollOption') as Booking['tollOption']) || undefined,
    advanceAmount: getNumber(obj, 'advanceAmount') || undefined,
    balanceAmount: getNumber(obj, 'balanceAmount') || undefined,
    assignedVehicleName: getString(obj, 'assignedVehicleName') || undefined,
    assignedVehicleType: getString(obj, 'assignedVehicleType') || undefined,
    assignedDriverName: getString(obj, 'assignedDriverName') || undefined,
    assignedDriverPhone: getString(obj, 'assignedDriverPhone') || undefined,
    assignedDriverEmail: getString(obj, 'assignedDriverEmail') || undefined,
    cancellationRequested: typeof obj.cancellationRequested === 'boolean' ? obj.cancellationRequested : undefined,
    cancellationReason: getString(obj, 'cancellationReason') || undefined,
    cancellationRequestedAt: getString(obj, 'cancellationRequestedAt') || undefined,
    cancellationReviewedByAdmin: typeof obj.cancellationReviewedByAdmin === 'boolean' ? obj.cancellationReviewedByAdmin : undefined,
    cancelledByRole: (getString(obj, 'cancelledByRole') as Booking['cancelledByRole']) || undefined,
    cancelledByName: getString(obj, 'cancelledByName') || undefined,
    cancelledAt: getString(obj, 'cancelledAt') || undefined,
    cancellationDetails: getString(obj, 'cancellationDetails') || undefined,
    cancellationDeductionPercent: getNumber(obj, 'cancellationDeductionPercent') || undefined,
    cancellationDeductionAmount: getNumber(obj, 'cancellationDeductionAmount') || undefined,
    refundableAmount: getNumber(obj, 'refundableAmount') || undefined,
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
  createRoomTypeBooking: (data: Record<string, unknown>) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  createCabBooking: (data: Record<string, unknown>) => Promise<{ success: boolean; data?: Booking; error?: string }>;
  cancelBooking: (id: string, reason?: string, details?: string) => Promise<{ success: boolean; error?: string }>;
  adminCancelBooking: (id: string, reason: string, details?: string) => Promise<{ success: boolean; error?: string }>;
  updateBookingStatus: (id: string, status: Booking['bookingStatus']) => Promise<{ success: boolean; data?: Booking; error?: string }>;
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
      const res = await api.get('/bookings/my', { ...withAuth(token), params: { limit: 200, withImages: true } });
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
      const res = await api.get('/bookings/partner', { ...withAuth(token), params: { limit: 200, withImages: true } });
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
      const res = await api.get('/bookings/all', { ...withAuth(token), params: { limit: 300, withImages: true } });
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

  createRoomTypeBooking: async (data) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.post('/bookings/room-type', data, withAuth(token));
      const booking = normalizeBooking(res.data?.data);
      set((state) => ({ myBookings: [booking, ...state.myBookings] }));
      return { success: true, data: booking };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Booking failed') };
    }
  },

  createCabBooking: async (data) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.post('/bookings/cab', data, withAuth(token));
      const booking = normalizeBooking(res.data?.data);
      set((state) => ({ myBookings: [booking, ...state.myBookings] }));
      return { success: true, data: booking };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Booking failed') };
    }
  },

  cancelBooking: async (id, reason, details) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/cancel`, { reason, details }, withAuth(token));
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

  adminCancelBooking: async (id, reason, details) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/cancel`, { reason, details }, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({
        adminBookings: state.adminBookings.map((b) => (b.id === id ? updated : b)),
        myBookings: state.myBookings.map((b) => (b.id === id ? updated : b)),
        partnerBookings: state.partnerBookings.map((b) => (b.id === id ? updated : b)),
      }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Cancel failed') };
    }
  },

  updateBookingStatus: async (id, status) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/bookings/${id}/status`, { bookingStatus: status }, withAuth(token));
      const updated = normalizeBooking(res.data?.data);
      set((state) => ({
        adminBookings: state.adminBookings.map((b) => (b.id === id ? updated : b)),
        partnerBookings: state.partnerBookings.map((b) => (b.id === id ? updated : b)),
        myBookings: state.myBookings.map((b) => (b.id === id ? updated : b)),
      }));
      return { success: true, data: updated };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Status update failed') };
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
