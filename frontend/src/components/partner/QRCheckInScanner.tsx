import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  CreditCard,
  Calendar,
  Clock,
  Phone,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Loader2,
  Banknote,
  IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import { extractBookingReference } from '@/lib/qrCameraManager';
import CameraQRScanner from '@/components/common/CameraQRScanner';

export interface QRBookingData {
  id: string;
  bookingId: string;
  displayBookingId?: string | null;
  bookingStatus: string;
  paymentStatus: string;
  bookingType?: string;
  service_billing_model?: string;
  propertyName: string;
  roomType: string;
  roomNumber?: string | null;
  propertyLocation?: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  guests: number;
  totalAdults: number;
  totalChildren: number;
  totalAmount: number;
  amountPaidOnline: number;
  amountPaidToProperty: number;
  remainingPropertyBalance: number;
  isEligibleForCheckIn: boolean;
  isEligibleForPaymentCollection: boolean;
  checkedInAt?: string | null;
  checkedInByPartnerName?: string | null;
  balanceCollections?: Array<{
    amount: number;
    collectedAt?: string;
    collectedByName?: string;
    paymentMethod?: string;
    receiptNumber?: string;
    notes?: string;
  }>;
}

interface QRCheckInScannerProps {
  isAdmin?: boolean;
}

const formatMoney = (val?: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

const formatDate = (val?: string) => {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
};

const formatTime = (val?: string) => {
  if (!val) return '';
  try {
    return new Date(val).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export const QRCheckInScanner: React.FC<QRCheckInScannerProps> = ({ isAdmin = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuthStore();

  // State
  const [manualInput, setManualInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [booking, setBooking] = useState<QRBookingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check-in modal
  const [isCheckInConfirmOpen, setIsCheckInConfirmOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Payment collection form
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi_qr' | 'pos_card' | 'bank_transfer'>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);

  // Lookup booking reference from backend
  const lookupBooking = useCallback(
    async (refInput: string) => {
      const targetRef = extractBookingReference(refInput);
      if (!targetRef) {
        toast.error('Please enter a valid booking reference or scan a QR voucher.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await api.get(`/bookings/qr-lookup/${encodeURIComponent(targetRef)}`, withAuth(token));
        if (res.data?.success && res.data?.data) {
          const loadedBooking: QRBookingData = res.data.data;
          setBooking(loadedBooking);
          setCollectionAmount(loadedBooking.remainingPropertyBalance || 0);
          toast.success(`Booking ${loadedBooking.bookingId} loaded successfully`);
        } else {
          setError(res.data?.message || 'Booking not found');
          setBooking(null);
        }
      } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.message;

        if (status === 403) {
          setError(msg || 'You are not authorized to access this booking. It belongs to another property partner.');
        } else if (status === 404) {
          setError(msg || `No booking found for reference "${targetRef}". Please check the voucher code.`);
        } else if (status === 400) {
          setError(msg || 'Invalid booking reference format.');
        } else {
          setError(msg || 'Unable to lookup booking. Please check your internet connection and try again.');
        }
        setBooking(null);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  // Handle URL query param `?ref=...`
  useEffect(() => {
    const urlRef = searchParams.get('ref') || searchParams.get('id') || searchParams.get('bookingId');
    if (urlRef) {
      setManualInput(urlRef);
      lookupBooking(urlRef);
    }
  }, [searchParams, lookupBooking]);

  // Check-in action handler
  const handleCheckIn = async () => {
    if (!booking) return;
    setIsCheckingIn(true);
    try {
      const res = await api.put(`/bookings/${booking.id}/check-in`, {}, withAuth(token));
      if (res.data?.success) {
        toast.success(`Check-in confirmed for ${booking.guestName}!`);
        setIsCheckInConfirmOpen(false);
        // Refresh booking details
        await lookupBooking(booking.bookingId);
      } else {
        toast.error(res.data?.message || 'Check-in failed');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      if (status === 409) {
        toast.error(`Check-in conflict: ${msg}`);
      } else {
        toast.error(`Check-in failed: ${msg}`);
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Payment collection action handler
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (collectionAmount <= 0) {
      toast.error('Payment amount must be greater than ₹0.');
      return;
    }

    if (collectionAmount > booking.remainingPropertyBalance) {
      toast.error(
        `Amount cannot exceed remaining balance of ${formatMoney(booking.remainingPropertyBalance)}.`
      );
      return;
    }

    setIsCollectingPayment(true);
    try {
      const payload = {
        amountCollected: Number(collectionAmount),
        paymentMethod,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: collectionNotes.trim() || undefined,
        idempotencyKey: `desk-${booking.id}-${Date.now()}`,
      };

      const res = await api.put(`/bookings/${booking.id}/collect-balance`, payload, withAuth(token));
      if (res.data?.success) {
        toast.success(`Payment of ${formatMoney(collectionAmount)} recorded successfully!`);
        setReceiptNumber('');
        setCollectionNotes('');
        // Refresh booking details
        await lookupBooking(booking.bookingId);
      } else {
        toast.error(res.data?.message || 'Failed to record payment');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Payment collection failed: ${msg}`);
    } finally {
      setIsCollectingPayment(false);
    }
  };

  // Reset to scan another booking
  const handleReset = () => {
    setBooking(null);
    setError(null);
    setManualInput('');
    setSearchParams({});
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isAdmin ? 'Admin QR Booking Desk & Check-in' : 'Partner Check-in & Desk Collection'}
            </h1>
            <p className="text-sm text-gray-500">
              Scan guest voucher QR code or enter booking reference to verify identity, complete check-in, and reconcile desk balance payments.
            </p>
          </div>
        </div>
      </div>

      {/* Lookup Controls: Camera Scanner + Manual Input */}
      {!booking && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
          {/* Camera Scanner View */}
          <CameraQRScanner
            onScanSuccess={lookupBooking}
            elementId="vs-desk-qr-viewfinder"
            buttonLabel="Open Camera Scanner"
          />

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Or Search by Reference
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Manual Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupBooking(manualInput);
            }}
            className="space-y-3"
          >
            <label htmlFor="ref-input" className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
              Booking Reference or Scanned URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  id="ref-input"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. VS-261024-DH8201 or 10000001 or paste voucher URL"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-colors font-mono"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !manualInput.trim()}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" /> Lookup
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Accepts Booking Reference (VS-XXXXX), Display Number, or full QR URL printed on customer vouchers.
            </p>
          </form>

          {/* Error Notice */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Lookup Unsuccessful</p>
                <p className="mt-0.5 text-red-700 text-xs">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Details & Check-in / Payment Actions */}
      {booking && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Header Status Bar */}
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                  <div>
                    <span className="text-xs uppercase font-semibold text-emerald-200 tracking-wider">
                      Verified Booking Reference
                    </span>
                    <h2 className="text-lg font-bold font-mono tracking-wide">
                      {booking.bookingId}
                      {booking.displayBookingId && (
                        <span className="ml-2 text-xs font-normal text-emerald-100">
                          (#{booking.displayBookingId})
                        </span>
                      )}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      booking.bookingStatus === 'checked_in'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : booking.bookingStatus === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {booking.bookingStatus.replace(/_/g, ' ')}
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1.5 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                    title="Lookup another booking"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Check-in Status Alert */}
              {booking.bookingStatus === 'checked_in' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-blue-900">Guest Checked In</p>
                      <p className="text-xs text-blue-700">
                        Completed on {formatDate(booking.checkedInAt || '')} at {formatTime(booking.checkedInAt || '')}
                        {booking.checkedInByPartnerName && ` by ${booking.checkedInByPartnerName}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                    Key / Room Handed Over
                  </span>
                </div>
              )}

              {/* Property & Room Details */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Property & Room Assignment
                </span>
                <div className="mt-1 flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{booking.propertyName}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Room Type: <span className="font-semibold text-gray-800">{booking.roomType}</span>
                    </p>
                    {booking.propertyLocation && (
                      <p className="text-xs text-gray-500 mt-0.5">{booking.propertyLocation}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Assigned Room</span>
                    <span className="text-sm font-bold text-emerald-800 font-mono">
                      {booking.roomNumber ? `Room ${booking.roomNumber}` : 'Assign at Desk'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Devotee Guest Contact Information */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Guest Contact Details
                </span>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-gray-500 block">Primary Guest</span>
                    <span className="text-sm font-bold text-gray-900">{booking.guestName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Phone Number</span>
                    {booking.guestPhone ? (
                      <a
                        href={`tel:${booking.guestPhone}`}
                        className="text-sm font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        <Phone className="w-3.5 h-3.5" /> {booking.guestPhone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Not provided</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Email Address</span>
                    {booking.guestEmail ? (
                      <span className="text-xs text-gray-700 font-mono truncate block" title={booking.guestEmail}>
                        {booking.guestEmail}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stay Dates & Devotee Count */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Check-in
                  </div>
                  <div className="text-sm font-bold text-gray-900">{formatDate(booking.checkIn)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{booking.checkInTime || '12:00 PM'}</div>
                </div>

                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Check-out
                  </div>
                  <div className="text-sm font-bold text-gray-900">{formatDate(booking.checkOut)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">11:00 AM</div>
                </div>

                <div className="col-span-2 sm:col-span-1 border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold mb-0.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" /> Guests
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {booking.guests} Devotee{booking.guests > 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {booking.totalAdults} Adult{booking.totalAdults > 1 ? 's' : ''}
                    {booking.totalChildren > 0 && `, ${booking.totalChildren} Child`}
                  </div>
                </div>
              </div>

              {/* Authoritative Financial Reconciliation Ledger */}
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-700" /> Payment Reconciliation Ledger
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    Status: {booking.paymentStatus.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs text-gray-500 block">Total Booking</span>
                    <span className="text-base font-bold text-gray-900 mt-0.5 block">
                      {formatMoney(booking.totalAmount)}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-xs text-emerald-700 block">Paid Online</span>
                    <span className="text-base font-bold text-emerald-800 mt-0.5 block">
                      {formatMoney(booking.amountPaidOnline)}
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-xs text-blue-700 block">Paid at Desk</span>
                    <span className="text-base font-bold text-blue-800 mt-0.5 block">
                      {formatMoney(booking.amountPaidToProperty)}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-xl border ${
                      booking.remainingPropertyBalance > 0
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-emerald-50 border-emerald-300'
                    }`}
                  >
                    <span
                      className={`text-xs block font-semibold ${
                        booking.remainingPropertyBalance > 0 ? 'text-amber-800' : 'text-emerald-800'
                      }`}
                    >
                      Remaining Balance
                    </span>
                    <span
                      className={`text-base font-bold mt-0.5 block ${
                        booking.remainingPropertyBalance > 0 ? 'text-amber-900' : 'text-emerald-800'
                      }`}
                    >
                      {formatMoney(booking.remainingPropertyBalance)}
                    </span>
                  </div>
                </div>

                {/* Prior balance collection history if present */}
                {Array.isArray(booking.balanceCollections) && booking.balanceCollections.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 block mb-2">
                      Prior Desk Collections
                    </span>
                    <div className="space-y-1.5">
                      {booking.balanceCollections.map((col, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-3 bg-gray-50 rounded-lg text-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Receipt className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-semibold">{formatMoney(col.amount)}</span>
                            <span className="text-gray-400">via</span>
                            <span className="capitalize">{col.paymentMethod?.replace('_', ' ')}</span>
                            {col.receiptNumber && (
                              <span className="font-mono text-gray-500">#{col.receiptNumber}</span>
                            )}
                          </div>
                          <span className="text-gray-400">
                            {formatDate(col.collectedAt)} {formatTime(col.collectedAt)}
                            {col.collectedByName && ` (${col.collectedByName})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION 1: Check-in Guest */}
              {booking.isEligibleForCheckIn && (
                <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-700" /> Guest Identity Verified
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Confirm physical arrival of {booking.guestName} and hand over property keys.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCheckInConfirmOpen(true)}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark Guest Check-in
                  </button>
                </div>
              )}

              {/* ACTION 2: Collect Desk Payment */}
              {booking.isEligibleForPaymentCollection ? (
                <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-700" /> Collect Balance at Property Desk
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Remaining balance to collect:{' '}
                        <span className="font-bold text-amber-900 font-mono">
                          {formatMoney(booking.remainingPropertyBalance)}
                        </span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-100 rounded-lg">
                      Payment Required
                    </span>
                  </div>

                  <form onSubmit={handleCollectPayment} className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Amount to Collect (₹)
                        </label>
                        <div className="relative">
                          <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                          <input
                            type="number"
                            min="1"
                            max={booking.remainingPropertyBalance}
                            value={collectionAmount}
                            onChange={(e) => setCollectionAmount(Number(e.target.value))}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e: any) => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                        >
                          <option value="cash">Cash Collection</option>
                          <option value="upi_qr">Property UPI / QR</option>
                          <option value="pos_card">Card Swipe / POS</option>
                          <option value="bank_transfer">Direct Bank Transfer</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Receipt / Ref Number (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. REC-10492"
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Desk Staff Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Collected at front desk"
                          value={collectionNotes}
                          onChange={(e) => setCollectionNotes(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCollectingPayment || collectionAmount <= 0}
                      className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isCollectingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Recording Payment...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Record {formatMoney(collectionAmount)} Payment
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : booking.remainingPropertyBalance === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Full booking balance settled. No payment due at the property desk.
                </div>
              ) : null}

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Lookup Next Voucher
                </button>
                <div className="text-[11px] text-gray-400">
                  Audit logged under {user?.name || user?.email || 'authenticated user'} ({user?.role || 'staff'})
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Confirmation Modal */}
      {isCheckInConfirmOpen && booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Guest Check-in</h3>
                <p className="text-xs text-gray-500">Vrindavan Sarthi Official Desk Record</p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl space-y-2 text-xs border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Guest:</span>
                <span className="font-bold text-gray-900">{booking.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Property:</span>
                <span className="font-semibold text-gray-800">{booking.propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Room:</span>
                <span className="font-semibold text-gray-800">{booking.roomType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Booking Ref:</span>
                <span className="font-mono font-semibold text-gray-800">{booking.bookingId}</span>
              </div>
            </div>

            {booking.remainingPropertyBalance > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Pending Desk Balance: {formatMoney(booking.remainingPropertyBalance)}</p>
                  <p className="mt-0.5 text-amber-700">
                    You can still mark check-in now and collect the balance before or during the stay.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsCheckInConfirmOpen(false)}
                disabled={isCheckingIn}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {isCheckingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking in...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm & Check-in
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCheckInScanner;
