const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/pages/user/BookingConfirmation.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
const importTarget = "import { CheckCircle2, ClipboardList, CreditCard, Home, Mail, Phone, Calendar, ArrowRight, ShieldCheck, Clock, MapPin, Navigation, ExternalLink } from 'lucide-react';";
const importReplacement = "import { CheckCircle2, ClipboardList, CreditCard, Home, Mail, Phone, Calendar, ArrowRight, ShieldCheck, Clock, MapPin, Navigation, ExternalLink, Download } from 'lucide-react';\nimport { toast } from 'sonner';";

if (!content.includes(importTarget)) {
  console.error('importTarget not found');
  process.exit(1);
}
content = content.replace(importTarget, importReplacement);

// 2. Add download handler and state
const stateTarget = "  const [isLoading, setIsLoading] = useState(true);";
const stateReplacement = `  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!booking) return;
    try {
      setIsDownloadingInvoice(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = \`Bearer \${token}\`;
      if (guestToken) headers['x-guest-booking-token'] = guestToken;
      const targetId = booking.id || booking._id || id;
      const url = guestToken
        ? \`/bookings/\${targetId}/invoice?guestAccessToken=\${encodeURIComponent(guestToken)}\`
        : \`/bookings/\${targetId}/invoice\`;

      const response = await api.get(url, {
        headers,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const filename = \`booking-receipt-\${booking.bookingId || targetId}.pdf\`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Booking receipt downloaded successfully');
    } catch (err: any) {
      let msg = 'Could not download receipt. Please try again or contact support.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json?.message) msg = json.message;
        } catch {
          // fallback
        }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      toast.error(msg);
    } finally {
      setIsDownloadingInvoice(false);
    }
  };`;

if (!content.includes(stateTarget)) {
  console.error('stateTarget not found');
  process.exit(1);
}
content = content.replace(stateTarget, stateReplacement);

// 3. Add eligibility check right after customer declarations
const eligTarget = "  const showContact = Boolean(partnerPhone && (state.isConfirmed || booking.bookingStatus === 'awaiting_customer_payment'));";
const eligReplacement = `  const showContact = Boolean(partnerPhone && (state.isConfirmed || booking.bookingStatus === 'awaiting_customer_payment'));

  const rawBookingStatus = String(booking.bookingStatus || '').toLowerCase();
  const rawPaymentStatus = String(booking.paymentStatus || '').toLowerCase();
  const canDownloadReceipt = Boolean(
    booking &&
    rawPaymentStatus !== 'failed' &&
    (
      rawPaymentStatus === 'paid' ||
      paidAmount > 0 ||
      ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(rawBookingStatus)
    ) &&
    !(
      ['pending', 'pending_property_confirmation', 'awaiting_customer_payment', 'rejected_by_property', 'expired', 'expired_property_no_response'].includes(rawBookingStatus) &&
      rawPaymentStatus !== 'paid'
    )
  );`;

if (!content.includes(eligTarget)) {
  console.error('eligTarget not found');
  process.exit(1);
}
content = content.replace(eligTarget, eligReplacement);

// 4. Update the buttons section
const buttonTarget = `                <div className="mt-6 space-y-2">
                  <Link
                    to={\`/bookings/\${booking.id}\`}
                    className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-crimson px-4 font-body text-sm font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm"
                  >
                    <span>View Booking Details</span>
                    <ArrowRight size={16} />
                  </Link>`;

const buttonReplacement = `                <div className="mt-6 space-y-2">
                  {canDownloadReceipt && (
                    <button
                      onClick={handleDownloadInvoice}
                      disabled={isDownloadingInvoice}
                      className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-crimson px-4 font-body text-sm font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm disabled:opacity-60"
                    >
                      <Download size={16} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                      <span>{isDownloadingInvoice ? 'Generating Receipt...' : 'Download Booking Receipt (PDF)'}</span>
                    </button>
                  )}
                  <Link
                    to={\`/bookings/\${booking.id}\`}
                    className={\`w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-body text-sm font-semibold transition-colors \${
                      canDownloadReceipt
                        ? 'border border-border bg-card text-foreground hover:bg-secondary'
                        : 'bg-brand-crimson font-bold text-white hover:bg-brand-crimson/90 shadow-sm'
                    }\`}
                  >
                    <span>View Booking Details</span>
                    <ArrowRight size={16} />
                  </Link>`;

if (!content.includes(buttonTarget)) {
  console.error('buttonTarget not found');
  process.exit(1);
}
content = content.replace(buttonTarget, buttonReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated BookingConfirmation.tsx with download receipt button');
