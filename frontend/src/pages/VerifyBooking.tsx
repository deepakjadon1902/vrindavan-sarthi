import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  Phone,
  ArrowLeft,
  QrCode,
  Search,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { extractBookingReference } from '@/lib/qrCameraManager';
import CameraQRScanner from '@/components/common/CameraQRScanner';

interface VerifiedVoucher {
  verified: boolean;
  bookingId: string;
  displayBookingId?: string | null;
  propertyId?: string | null;
  categoryId?: string | null;
  roomId?: string | null;
  bookingStatus: string;
  paymentStatus: string;
  propertyName: string;
  roomType: string;
  roomNumber?: string | null;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  guests?: number;
  guestName: string;
  totalAmount: number;
  amountPaidOnline: number;
  amountPayableAtProperty: number;
  paymentMethod?: string;
  paidAt?: string;
  bookedOn?: string;
  propertyLocation?: string;
  nearestTemple?: string;
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

export default function VerifyBooking() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRef = searchParams.get('ref') || searchParams.get('id') || searchParams.get('bookingId') || '';

  const [activeRef, setActiveRef] = useState(initialRef);
  const [manualInput, setManualInput] = useState('');
  const [voucher, setVoucher] = useState<VerifiedVoucher | null>(null);
  const [loading, setLoading] = useState(Boolean(initialRef));
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = useCallback(async (rawTarget: string) => {
    const cleanRef = extractBookingReference(rawTarget);
    if (!cleanRef) {
      setError('Please enter a valid booking reference or scan a QR voucher.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveRef(cleanRef);

    try {
      const res = await api.get(`/bookings/verify/${encodeURIComponent(cleanRef)}`);
      if (res.data?.success && res.data?.data?.verified) {
        setVoucher(res.data.data);
      } else {
        setError(res.data?.message || 'Booking could not be verified.');
        setVoucher(null);
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setError(`No booking found for reference "${cleanRef}". Please check your voucher code.`);
      } else if (status === 429) {
        setError('Too many verification requests. Please wait a moment and try again.');
      } else {
        setError(err.response?.data?.message || 'Verification failed. Please check the code and try again.');
      }
      setVoucher(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef) {
      fetchVerification(initialRef);
    }
  }, [initialRef, fetchVerification]);

  const handleScanSuccess = async (decodedText: string) => {
    await fetchVerification(decodedText);
  };

  const handleReset = () => {
    setVoucher(null);
    setError(null);
    setActiveRef('');
    setManualInput('');
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-[#fcfaf7] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src="/vrindavan_sarthi_official_logo.jpg"
            alt="Vrindavan Sarthi"
            className="w-20 h-20 mx-auto rounded-full shadow-md border-2 border-[#d97706] mb-3 object-cover"
          />
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#14532d]">
            Vrindavan Sarthi Enterprises
          </h1>
          <p className="text-sm font-medium text-[#c28914]">
            Official Booking Voucher & Reservation Verification Desk
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#e5e7eb] text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#14532d] border-t-transparent mb-4" />
            <p className="text-gray-600 font-medium">Verifying booking reference with central database...</p>
            {activeRef && (
              <p className="text-xs font-mono text-gray-400 mt-1">Ref: {activeRef}</p>
            )}
          </div>
        )}

        {/* Verified Voucher View */}
        {!loading && voucher && (
          <div className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden">
            {/* Top Verification Status Banner */}
            <div className="bg-gradient-to-r from-[#14532d] to-[#15803d] text-white p-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                    <ShieldCheck className="w-4 h-4 text-[#fbbf24]" /> Authenticated Voucher
                  </div>
                  <h2 className="text-2xl font-bold font-serif mb-1">Booking Verified & Confirmed</h2>
                  <p className="text-sm text-emerald-100 font-mono tracking-wide">
                    Ref: <span className="font-bold text-white text-base">{voucher.bookingId}</span>
                    {voucher.displayBookingId && (
                      <span className="ml-2 text-xs text-emerald-200">
                        (#{voucher.displayBookingId})
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Verify Another
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Property & Accommodation Box */}
              <div className="border border-[#fed7aa] bg-[#fffaf5] rounded-xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#ea580c] uppercase tracking-wide">
                      Accommodation
                    </span>
                    <h3 className="text-xl font-bold text-[#1e293b] mt-0.5">{voucher.propertyName}</h3>
                    <p className="text-sm font-semibold text-[#475569] mt-1">
                      Room: {voucher.roomType}
                      {voucher.roomNumber ? ` (Room ${voucher.roomNumber})` : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-[#14532d] text-white text-xs font-bold rounded-lg shadow-sm">
                    {voucher.bookingStatus.toUpperCase()}
                  </span>
                </div>

                {voucher.propertyLocation && (
                  <div className="flex items-center gap-2 text-xs text-[#64748b] mt-3">
                    <MapPin className="w-4 h-4 text-[#ea580c] shrink-0" />
                    <span>{voucher.propertyLocation}</span>
                  </div>
                )}
                {voucher.nearestTemple && (
                  <div className="flex items-center gap-2 text-xs text-[#059669] mt-1 ml-6">
                    <span>Landmark: {voucher.nearestTemple}</span>
                  </div>
                )}
              </div>

              {/* Partner / Admin Fast Link to Desk */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-950">Property Partner / Staff Desk Access</p>
                    <p className="text-[11px] text-emerald-700">
                      Open in authenticated Desk Scanner to verify identity, complete check-in, and collect property balance.
                    </p>
                  </div>
                </div>
                <Link
                  to={user?.role === 'admin' ? `/admin/scan?ref=${encodeURIComponent(voucher.bookingId)}` : `/partner/scan?ref=${encodeURIComponent(voucher.bookingId)}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  Open Desk Scanner →
                </Link>
              </div>

              {/* Stay Dates Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc]">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#14532d]" /> Check-in
                  </div>
                  <div className="text-sm font-bold text-gray-900">{formatDate(voucher.checkIn)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{voucher.checkInTime || '12:00 PM'}</div>
                </div>

                <div className="border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc]">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#14532d]" /> Check-out
                  </div>
                  <div className="text-sm font-bold text-gray-900">{formatDate(voucher.checkOut)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">11:00 AM</div>
                </div>

                <div className="col-span-2 sm:col-span-1 border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc]">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mb-1">
                    <Clock className="w-3.5 h-3.5 text-[#14532d]" /> Guests
                  </div>
                  <div className="text-sm font-bold text-gray-900">{voucher.guests || 1} Devotee(s)</div>
                  <div className="text-xs text-gray-500 mt-0.5">Primary: {voucher.guestName}</div>
                </div>
              </div>

              {/* Financial Breakdown Card */}
              <div className="border border-[#e2e8f0] rounded-xl p-5 bg-white space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Payment Reconciliation
                </div>

                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-600">Total Booking Cost</span>
                  <span className="text-base font-bold text-gray-900">{formatMoney(voucher.totalAmount)}</span>
                </div>

                <div className="flex justify-between items-center text-sm py-2 px-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg">
                  <span className="text-[#047857] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Amount Paid Online (Verified)
                  </span>
                  <span className="text-base font-bold text-[#047857]">{formatMoney(voucher.amountPaidOnline)}</span>
                </div>

                <div className="flex justify-between items-center text-sm py-2 px-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                  <span className="text-[#b91c1c] font-semibold">
                    {voucher.amountPayableAtProperty > 0 ? 'Balance Payable at Property' : 'Balance Settled'}
                  </span>
                  <span className="text-base font-bold text-[#b91c1c]">
                    {formatMoney(voucher.amountPayableAtProperty)}
                  </span>
                </div>

                <div className="pt-2 text-xs text-gray-500 flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-gray-700">
                    {voucher.amountPayableAtProperty > 0
                      ? 'Platform Fee Online — Balance at Property'
                      : 'Full Online Payment'}
                  </span>
                </div>
              </div>

              {/* Devotee Assistance Contacts */}
              <div className="rounded-xl p-4 bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Need Help or Directions?</div>
                  <div className="text-xs text-gray-500">Vrindavan Sarthi 24/7 Pilgrimage Support Desk</div>
                </div>
                <a
                  href="tel:+918679820256"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#14532d] text-white text-xs font-bold rounded-lg hover:bg-[#0f3d21] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call +91 86798 20256
                </a>
              </div>

              {/* Privacy Notice */}
              <p className="text-[11px] text-gray-400 text-center pt-2">
                This verification screen contains official voucher authenticity data for check-in verification.
                Personal contact details and authentication credentials are protected under Vrindavan Sarthi Security Standards.
              </p>
            </div>
          </div>
        )}

        {/* Scanner and Lookup Form (Shown when no voucher loaded or when error occurred) */}
        {!loading && !voucher && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            {/* Error banner if previous lookup failed */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Verification Notice</p>
                  <p className="mt-0.5 text-red-700 text-xs">{error}</p>
                </div>
              </div>
            )}

            {/* Camera Scanner Component */}
            <CameraQRScanner
              onScanSuccess={handleScanSuccess}
              elementId="vs-public-qr-viewfinder"
              buttonLabel="Scan Voucher QR with Camera"
            />

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200" />
              <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Or Enter Booking Reference
              </span>
              <div className="flex-grow border-t border-gray-200" />
            </div>

            {/* Manual Lookup Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) {
                  fetchVerification(manualInput.trim());
                }
              }}
              className="space-y-3"
            >
              <label htmlFor="public-ref-input" className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                Booking Reference, PNR, or Scanned URL
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    id="public-ref-input"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. 10000001 or VS-261024-DH8201 or paste voucher URL"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#14532d] focus:border-[#14532d] transition-colors font-mono"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !manualInput.trim()}
                  className="px-5 py-2.5 bg-[#14532d] hover:bg-[#0f3d21] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Verify
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Found on your Vrindavan Sarthi booking confirmation email, SMS, or PDF invoice.
              </p>
            </form>

            <div className="pt-2 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
