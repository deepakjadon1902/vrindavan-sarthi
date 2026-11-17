const fs = require('fs');
const path = require('path');

const bdPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'user', 'BookingDetail.tsx');
let code = fs.readFileSync(bdPath, 'utf8');

// 1. Add useSearchParams to react-router-dom import
code = code.replace(
  "import { Link, useNavigate, useParams } from 'react-router-dom';",
  "import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';"
);

// 2. Add Download to lucide-react import
code = code.replace(
  "  ExternalLink,\n} from 'lucide-react';",
  "  ExternalLink,\n  Download,\n} from 'lucide-react';"
);

// 3. Add guestToken and isDownloadingInvoice state
const oldStateBlock = `  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const adminPhone = useSettingsStore((s) => s.settings.adminPhone);
  const { fetchBookingById, cancelBooking } = useBookingStore();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);`;

const newStateBlock = `  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const guestToken = searchParams.get('token') || searchParams.get('guestAccessToken') || '';
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const adminPhone = useSettingsStore((s) => s.settings.adminPhone);
  const { fetchBookingById, cancelBooking } = useBookingStore();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);`;

code = code.replace(oldStateBlock, newStateBlock);

// 4. Update refreshBooking and useEffect to pass guestToken
const oldRefresh = `  const refreshBooking = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsRefreshing(true);
      const b = await fetchBookingById(id);
      if (b) setBooking(b);
    } catch {
      // Keep existing booking on network blip
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      const b = await fetchBookingById(id);
      setBooking(b);
      setIsLoading(false);
    };
    void run();
  }, [fetchBookingById, id]);`;

const newRefresh = `  const refreshBooking = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsRefreshing(true);
      const b = await fetchBookingById(id, guestToken);
      if (b) setBooking(b);
    } catch {
      // Keep existing booking on network blip
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setIsLoading(true);
      const b = await fetchBookingById(id, guestToken);
      setBooking(b);
      setIsLoading(false);
    };
    void run();
  }, [fetchBookingById, id, guestToken]);`;

code = code.replace(oldRefresh, newRefresh);

// 5. Add handleDownloadInvoice function
const invoiceFunction = `  const handleDownloadInvoice = async () => {
    if (!id) return;
    try {
      setIsDownloadingInvoice(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = \`Bearer \${token}\`;
      if (guestToken) headers['x-guest-booking-token'] = guestToken;
      const url = guestToken
        ? \`/bookings/\${id}/invoice?guestAccessToken=\${encodeURIComponent(guestToken)}\`
        : \`/bookings/\${id}/invoice\`;

      const response = await api.get(url, {
        headers,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', \`invoice-\${booking?.bookingId || id}.pdf\`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Invoice downloaded successfully');
    } catch (err: any) {
      toast.error('Could not download invoice. Please try again or contact support.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };
`;

code = code.replace(
  '  const copyBookingId = () => {',
  `${invoiceFunction}\n  const copyBookingId = () => {`
);

// 6. Add PDF Invoice button in hero header
const oldHeroActions = `              {/* Status Action / Refresh */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <button
                  onClick={() => refreshBooking()}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  title="Check live status from server"
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-brand-crimson' : ''} />
                  <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
                </button>
                <Link
                  to={viewItemHref}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  <span>View Listing</span>
                </Link>
              </div>`;

const newHeroActions = `              {/* Status Action / Refresh */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                <button
                  onClick={() => refreshBooking()}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  title="Check live status from server"
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-brand-crimson' : ''} />
                  <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
                </button>
                <button
                  onClick={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-crimson/30 bg-brand-crimson/5 px-3.5 py-2 font-body text-xs font-semibold text-brand-crimson hover:bg-brand-crimson hover:text-white transition-colors disabled:opacity-50"
                  title="Download official PDF invoice / payment receipt"
                >
                  <Download size={13} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                  <span>{isDownloadingInvoice ? 'Generating...' : 'PDF Invoice'}</span>
                </button>
                <Link
                  to={viewItemHref}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 font-body text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  <span>View Listing</span>
                </Link>
              </div>`;

code = code.replace(oldHeroActions, newHeroActions);

// 7. Add prominent Download PDF Invoice button in Confirmed section
const oldConfirmedSection = `                  ) : state.isConfirmed ? (
                    /* Case 4: Booking Confirmed */
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-center">
                        <CheckCircle2 size={24} className="mx-auto text-brand-green mb-1.5" />
                        <p className="font-heading text-sm font-bold text-foreground">Reservation Confirmed</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5">Your room is guaranteed for check-in.</p>
                      </div>`;

const newConfirmedSection = `                  ) : state.isConfirmed ? (
                    /* Case 4: Booking Confirmed */
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-center">
                        <CheckCircle2 size={24} className="mx-auto text-brand-green mb-1.5" />
                        <p className="font-heading text-sm font-bold text-foreground">Reservation Confirmed</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5">Your room is guaranteed for check-in.</p>
                      </div>

                      <button
                        onClick={handleDownloadInvoice}
                        disabled={isDownloadingInvoice}
                        className="w-full py-3 rounded-2xl bg-brand-crimson text-white font-body text-sm font-bold hover:bg-brand-crimson/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                      >
                        <Download size={16} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                        <span>{isDownloadingInvoice ? 'Generating Invoice...' : 'Download PDF Invoice'}</span>
                      </button>`;

code = code.replace(oldConfirmedSection, newConfirmedSection);

fs.writeFileSync(bdPath, code, 'utf8');
console.log('Successfully updated BookingDetail.tsx with invoice download and guest access');
