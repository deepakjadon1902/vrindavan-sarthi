const fs = require('fs');
const path = require('path');

// 1. Update App.tsx
const appPath = path.join(__dirname, '..', 'frontend', 'src', 'App.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

if (!appCode.includes('<Route path="/bookings/:id/confirmed" element={<ProtectedRoute allowGuest>')) {
  appCode = appCode.replace(
    '<Route path="/bookings/:id/confirmed" element={<ProtectedRoute><PublicLayout><BookingConfirmation /></PublicLayout></ProtectedRoute>} />',
    '<Route path="/bookings/:id/confirmed" element={<ProtectedRoute allowGuest><PublicLayout><BookingConfirmation /></PublicLayout></ProtectedRoute>} />'
  );
  appCode = appCode.replace(
    '<Route path="/bookings/:id" element={<ProtectedRoute><PublicLayout><BookingDetail /></PublicLayout></ProtectedRoute>} />',
    '<Route path="/bookings/:id" element={<ProtectedRoute allowGuest><PublicLayout><BookingDetail /></PublicLayout></ProtectedRoute>} />'
  );
  fs.writeFileSync(appPath, appCode, 'utf8');
  console.log('Updated App.tsx with allowGuest for booking detail and confirmation');
} else {
  console.log('App.tsx already updated');
}

// 2. Update bookingStore.ts
const storePath = path.join(__dirname, '..', 'frontend', 'src', 'store', 'bookingStore.ts');
let storeCode = fs.readFileSync(storePath, 'utf8');

// Remove passwordHint from Booking interface
storeCode = storeCode.replace(/\s*passwordHint\?:\s*string;/, '');

// Remove passwordHint from normalizeBooking
storeCode = storeCode.replace(/\s*passwordHint:\s*getString\(obj\.guestAccount,\s*'passwordHint'\)\s*\|\|\s*undefined,/, '');

// Update fetchBookingById signature and implementation
storeCode = storeCode.replace(
  'fetchBookingById: (id: string) => Promise<Booking | null>;',
  'fetchBookingById: (id: string, guestAccessToken?: string) => Promise<Booking | null>;'
);

const oldFetchMethod = `  fetchBookingById: async (id) => {
    if (!id) return null;
    const token = useAuthStore.getState().token;
    if (!token) return null;

    const fromCache =
      get().myBookings.find((b) => b.id === id) ||
      get().partnerBookings.find((b) => b.id === id) ||
      get().adminBookings.find((b) => b.id === id);
    if (fromCache) return fromCache;

    try {
      const res = await api.get(\`/bookings/\${id}\`, withAuth(token));
      const booking = normalizeBooking(res.data?.data);
      if (!booking.id) return null;
      set((state) => ({ myBookings: [booking, ...state.myBookings.filter((b) => b.id !== booking.id)] }));
      return booking;
    } catch {
      return null;
    }
  },`;

const newFetchMethod = `  fetchBookingById: async (id, guestAccessToken) => {
    if (!id) return null;
    const token = useAuthStore.getState().token;
    if (!token && !guestAccessToken) return null;

    const fromCache =
      get().myBookings.find((b) => b.id === id) ||
      get().partnerBookings.find((b) => b.id === id) ||
      get().adminBookings.find((b) => b.id === id);
    if (fromCache && token) return fromCache;

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = \`Bearer \${token}\`;
      if (guestAccessToken) headers['x-guest-booking-token'] = guestAccessToken;
      const url = guestAccessToken
        ? \`/bookings/\${id}?guestAccessToken=\${encodeURIComponent(guestAccessToken)}\`
        : \`/bookings/\${id}\`;
      const res = await api.get(url, { headers });
      const booking = normalizeBooking(res.data?.data);
      if (!booking.id) return null;
      if (token) {
        set((state) => ({ myBookings: [booking, ...state.myBookings.filter((b) => b.id !== booking.id)] }));
      }
      return booking;
    } catch {
      return null;
    }
  },`;

if (storeCode.includes('fetchBookingById: async (id) => {')) {
  storeCode = storeCode.replace(oldFetchMethod, newFetchMethod);
  console.log('Replaced fetchBookingById implementation');
}

fs.writeFileSync(storePath, storeCode, 'utf8');
console.log('Updated bookingStore.ts');

// 3. Update RoomTypeDetail.tsx
const roomTypeDetailPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'RoomTypeDetail.tsx');
let rtdCode = fs.readFileSync(roomTypeDetailPath, 'utf8');

// Update guest instruction message
rtdCode = rtdCode.replace(
  'Guest account will be created automatically. Use your email as username and this mobile number as password to login later and view My Bookings.',
  'Booking as a guest. You will receive a secure direct link to track your reservation. Creating an account with a custom password is fully optional.'
);

// Update guest login badge
rtdCode = rtdCode.replace(
  '<p className="font-bold">Guest login saved</p>',
  '<p className="font-bold">Guest reservation confirmed</p>'
);

// Update confirmed booking redirect with guest token
rtdCode = rtdCode.replace(
  'if (confirmedBookingId && token) navigate(`/bookings/${confirmedBookingId}/confirmed`, { replace: true });',
  'if (confirmedBookingId) { const target = token ? `/bookings/${confirmedBookingId}/confirmed` : `/bookings/${confirmedBookingId}/confirmed?token=${encodeURIComponent(guestAccessToken)}`; navigate(target, { replace: true }); }'
);

// Update tracking link with guest token
rtdCode = rtdCode.replace(
  'to={submittedBooking?.id ? `/bookings/${submittedBooking.id}` : \'/bookings\'}',
  'to={submittedBooking?.id ? `/bookings/${submittedBooking.id}${submittedBooking.guestAccessToken ? `?token=${encodeURIComponent(submittedBooking.guestAccessToken)}` : \'\'}` : \'/bookings\'}'
);

fs.writeFileSync(roomTypeDetailPath, rtdCode, 'utf8');
console.log('Updated RoomTypeDetail.tsx');

// 4. Update BookingConfirmation.tsx
const bcPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'user', 'BookingConfirmation.tsx');
let bcCode = fs.readFileSync(bcPath, 'utf8');

// Import useSearchParams
if (!bcCode.includes('useSearchParams')) {
  bcCode = bcCode.replace(
    'import { Link, useParams } from \'react-router-dom\';',
    'import { Link, useParams, useSearchParams } from \'react-router-dom\';'
  );
}

// Extract guest token and update fetchBooking
const oldBcFetch = `  const { id } = useParams();
  const { token } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBooking = async () => {
    if (!id || !token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get(\`/bookings/\${id}\`, withAuth(token));
      const raw = res.data?.data;
      setBooking(raw ? { ...raw, id: raw.id || raw._id } : null);
    } catch {
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooking();
  }, [id, token]);`;

const newBcFetch = `  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const guestToken = searchParams.get('token') || searchParams.get('guestAccessToken') || '';
  const { token } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBooking = async () => {
    if (!id || (!token && !guestToken)) {
      setIsLoading(false);
      return;
    }
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = \`Bearer \${token}\`;
      if (guestToken) headers['x-guest-booking-token'] = guestToken;
      const url = guestToken
        ? \`/bookings/\${id}?guestAccessToken=\${encodeURIComponent(guestToken)}\`
        : \`/bookings/\${id}\`;
      const res = await api.get(url, { headers });
      const raw = res.data?.data;
      setBooking(raw ? { ...raw, id: raw.id || raw._id } : null);
    } catch {
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooking();
  }, [id, token, guestToken]);`;

if (bcCode.includes(oldBcFetch)) {
  bcCode = bcCode.replace(oldBcFetch, newBcFetch);
  console.log('Updated BookingConfirmation fetch logic');
}

fs.writeFileSync(bcPath, bcCode, 'utf8');
console.log('Updated BookingConfirmation.tsx');
