import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Booking {
  id: string;
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
  upiTransactionId?: string;
  additionalInfo?: string;
  createdAt: string;
}

interface BookingState {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  cancelBooking: (id: string) => void;
  verifyPayment: (id: string) => void;
  rejectPayment: (id: string) => void;
  getBookingsByUser: (userId: string) => Booking[];
  getBookingsByPartner: (partnerId: string) => Booking[];
  getAllBookings: () => Booking[];
}

const generateBookingId = () => {
  const num = String(Math.floor(10000 + Math.random() * 90000));
  return `VVS-2025-${num}`;
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      bookings: [],

      addBooking: (data) => {
        const booking: Booking = {
          ...data,
          id: generateBookingId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ bookings: [...state.bookings, booking] }));
        return booking;
      },

      cancelBooking: (id) => {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, bookingStatus: 'cancelled' as const } : b
          ),
        }));
      },

      verifyPayment: (id) => {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, paymentStatus: 'paid' as const, bookingStatus: 'confirmed' as const } : b
          ),
        }));
      },

      rejectPayment: (id) => {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, paymentStatus: 'failed' as const, bookingStatus: 'cancelled' as const } : b
          ),
        }));
      },

      getBookingsByUser: (userId) => get().bookings.filter((b) => b.userId === userId),
      getBookingsByPartner: (partnerId) => get().bookings.filter((b) => b.partnerId === partnerId),
      getAllBookings: () => get().bookings,
    }),
    { name: 'vvs-bookings' }
  )
);
