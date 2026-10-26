import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, MapPin, Calendar, Clock, Home, AlertCircle, Phone, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

interface VerifiedVoucher {
  verified: boolean;
  bookingId: string;
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
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || searchParams.get('id') || searchParams.get('bookingId') || '';
  const [voucher, setVoucher] = useState<VerifiedVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setError('No booking reference provided in QR code URL.');
      setLoading(false);
      return;
    }

    const fetchVerification = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/bookings/verify/${encodeURIComponent(ref.trim())}`);
        if (res.data?.success && res.data?.data?.verified) {
          setVoucher(res.data.data);
        } else {
          setError(res.data?.message || 'Booking could not be verified.');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Booking not found or verification failed.');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [ref]);

  return (
    <div className="min-h-screen bg-[#fcfaf7] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
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

        {loading ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#e5e7eb] text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#14532d] border-t-transparent mb-4" />
            <p className="text-gray-600 font-medium">Verifying booking reference with central database...</p>
          </div>
        ) : error || !voucher ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-200 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Notice</h2>
            <p className="text-gray-600 mb-6">{error || 'Unable to authenticate booking reference.'}</p>
            <p className="text-sm text-gray-500 mb-6">
              If you hold a valid confirmation receipt, please contact Vrindavan Sarthi 24/7 Helpline at{' '}
              <a href="tel:+918679820256" className="text-[#14532d] font-bold underline">
                +91 86798 20256
              </a>.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#14532d] text-white rounded-xl font-medium hover:bg-[#0f3d21] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go to Homepage
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden">
            {/* Top Verification Status Banner */}
            <div className="bg-gradient-to-r from-[#14532d] to-[#15803d] text-white p-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4 text-[#fbbf24]" /> Authenticated Voucher
              </div>
              <h2 className="text-2xl font-bold font-serif mb-1">Booking Verified & Confirmed</h2>
              <p className="text-sm text-emerald-100 font-mono tracking-wide">
                Ref: <span className="font-bold text-white text-base">{voucher.bookingId}</span>
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Property & Accommodation Box */}
              <div className="border border-[#fed7aa] bg-[#fffaf5] rounded-xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#ea580c] uppercase tracking-wide">Accommodation</span>
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
      </div>
    </div>
  );
}
