// import { Hotel, BedDouble, Car, Map, ClipboardList, Clock, ShieldCheck, XCircle } from 'lucide-react';
// import { useAuthStore } from '@/store/authStore';
// import { useBookingStore } from '@/store/bookingStore';
// import { Link } from 'react-router-dom';
// import { useEffect, useMemo, useState } from 'react';
// import { api, withAuth } from '@/lib/api';
// import { subscribeAppEvent } from '@/lib/broadcast';
// import { getSessionCache, setSessionCache } from '@/lib/panelCache';

// const PartnerDashboard = () => {
//   const token = useAuthStore((s) => s.token);
//   const user = useAuthStore((s) => s.user);
//   const isApproved = user?.partnerStatus === 'approved';
//   const { partnerBookings, fetchPartnerBookings } = useBookingStore();
//   const [isLoading, setIsLoading] = useState(false);
//   const [listings, setListings] = useState<{ hotels: any[]; cabs: any[]; tours: any[] }>({
//     hotels: [],
//     cabs: [],
//     tours: [],
//   });

//   useEffect(() => {
//     if (!token || !isApproved) return;
//     const run = async () => {
//       try {
//         const cached = getSessionCache<{ hotels: any[]; cabs: any[]; tours: any[] }>('vvs_partner_my_listings_raw', 30_000);
//         if (cached) {
//           setListings((prev) => (
//             !prev.hotels.length && !prev.cabs.length && !prev.tours.length ? cached : prev
//           ));
//         }
//         setIsLoading(true);
//         const res = await api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } });
//         const data = res.data?.data || {};
//         const next = {
//           hotels: Array.isArray(data.hotels) ? data.hotels : [],
//           cabs: Array.isArray(data.cabs) ? data.cabs : [],
//           tours: Array.isArray(data.tours) ? data.tours : [],
//         };
//         setListings(next);
//         setSessionCache('vvs_partner_my_listings_raw', next);
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     void run();

//     const unsub = subscribeAppEvent('listing:changed', () => void run());
//     return unsub;
//   }, [isApproved, token]);

//   useEffect(() => {
//     if (!user || !isApproved) return;
//     void fetchPartnerBookings();
//   }, [fetchPartnerBookings, isApproved, user]);

//   const allItems = useMemo(
//     () => [...listings.hotels, ...listings.cabs, ...listings.tours],
//     [listings]
//   );

//   const pending = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
//   const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;

//   return (
//     <div className="space-y-8">
//       <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-6">
//         <h2 className="font-heading text-xl font-semibold text-foreground">Welcome, {user?.name} 🙏</h2>
//         <p className="font-body text-sm text-muted-foreground mt-1">
//           {user?.businessName ? `Business: ${user.businessName}` : 'Manage your listings from here'}
//         </p>
//       </div>

//       {!isApproved && (
//         <div className="bg-brand-saffron/10 border border-brand-saffron/30 rounded-xl p-4 flex items-start gap-3">
//           <ShieldCheck size={20} className="text-brand-saffron mt-0.5" />
//           <div>
//             <p className="font-body text-sm font-medium text-foreground">Partner verification is {user?.partnerStatus || 'pending'}</p>
//             <p className="font-body text-xs text-muted-foreground mt-1">
//               Admin must verify your business details and legal documents before listing hotels, inventory, or other properties.
//             </p>
//           </div>
//         </div>
//       )}

//       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
//         <div className="bg-card rounded-xl p-5 border border-border">
//           <div className="flex items-center justify-between mb-2">
//             <span className="font-body text-xs text-muted-foreground">Hotels</span>
//             <Hotel size={18} className="text-brand-gold" />
//           </div>
//           <p className="font-heading text-2xl font-bold text-foreground">{listings.hotels.length}</p>
//         </div>
//         <div className="bg-card rounded-xl p-5 border border-border">
//           <div className="flex items-center justify-between mb-2">
//             <span className="font-body text-xs text-muted-foreground">Cabs</span>
//             <Car size={18} className="text-brand-green" />
//           </div>
//           <p className="font-heading text-2xl font-bold text-foreground">{listings.cabs.length}</p>
//         </div>
//         <div className="bg-card rounded-xl p-5 border border-border">
//           <div className="flex items-center justify-between mb-2">
//             <span className="font-body text-xs text-muted-foreground">Tours</span>
//             <Map size={18} className="text-brand-crimson" />
//           </div>
//           <p className="font-heading text-2xl font-bold text-foreground">{listings.tours.length}</p>
//         </div>
//         <div className="bg-card rounded-xl p-5 border border-border">
//           <div className="flex items-center justify-between mb-2">
//             <span className="font-body text-xs text-muted-foreground">Pending</span>
//             <Clock size={18} className="text-brand-saffron" />
//           </div>
//           <p className="font-heading text-2xl font-bold text-foreground">{pending}</p>
//         </div>
//         <div className="bg-card rounded-xl p-5 border border-border">
//           <div className="flex items-center justify-between mb-2">
//             <span className="font-body text-xs text-muted-foreground">Bookings</span>
//             <ClipboardList size={18} className="text-brand-gold" />
//           </div>
//           <p className="font-heading text-2xl font-bold text-foreground">{partnerBookings.length}</p>
//         </div>
//       </div>

//       {isLoading && (
//         <div className="bg-card rounded-xl border border-border p-4">
//           <p className="font-body text-xs text-muted-foreground">Refreshing listings…</p>
//         </div>
//       )}

//       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//         <Link to="/partner/hotels" className="bg-card rounded-xl p-5 border border-border card-hover text-center">
//           <Hotel size={28} className="mx-auto mb-2 text-brand-gold" />
//           <p className="font-heading text-sm font-semibold text-foreground">Add Hotel</p>
//         </Link>
//         <Link to="/partner/inventory" className="bg-card rounded-xl p-5 border border-border card-hover text-center">
//           <BedDouble size={28} className="mx-auto mb-2 text-brand-saffron" />
//           <p className="font-heading text-sm font-semibold text-foreground">Manage Inventory</p>
//         </Link>
//       </div>

//       {rejected > 0 && (
//         <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
//           <XCircle size={20} className="text-destructive mt-0.5" />
//           <div>
//             <p className="font-body text-sm font-medium text-foreground">{rejected} listing(s) rejected</p>
//             <p className="font-body text-xs text-muted-foreground mt-1">
//               Check your listings page for details and resubmit after making changes.
//             </p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default PartnerDashboard;


import { Hotel, BedDouble, ClipboardList, Clock, ShieldCheck, XCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, withAuth } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { getSessionCache, setSessionCache } from '@/lib/panelCache';

const PartnerDashboard = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isApproved = user?.partnerStatus === 'approved';
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<{ hotels: any[]; cabs: any[]; tours: any[] }>({
    hotels: [],
    cabs: [],
    tours: [],
  });

  useEffect(() => {
    if (!token || !isApproved) return;
    const run = async () => {
      try {
        const cached = getSessionCache<{ hotels: any[]; cabs: any[]; tours: any[] }>('vvs_partner_my_listings_raw', 30_000);
        if (cached) {
          setListings((prev) =>
            !prev.hotels.length && !prev.cabs.length && !prev.tours.length ? cached : prev,
          );
        }
        setIsLoading(true);
        const res = await api.get('/partner/my-listings', { ...withAuth(token), params: { limit: 300 } });
        const data = res.data?.data || {};
        const next = {
          hotels: Array.isArray(data.hotels) ? data.hotels : [],
          cabs:   Array.isArray(data.cabs)   ? data.cabs   : [],
          tours:  Array.isArray(data.tours)  ? data.tours  : [],
        };
        setListings(next);
        setSessionCache('vvs_partner_my_listings_raw', next);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
    const unsub = subscribeAppEvent('listing:changed', () => void run());
    return unsub;
  }, [isApproved, token]);

  useEffect(() => {
    if (!user || !isApproved) return;
    void fetchPartnerBookings();
  }, [fetchPartnerBookings, isApproved, user]);

  const allItems = useMemo(
    () => [...listings.hotels, ...listings.cabs, ...listings.tours],
    [listings],
  );

  const pending  = allItems.filter((i: any) => i.approvalStatus === 'pending').length;
  const rejected = allItems.filter((i: any) => i.approvalStatus === 'rejected').length;
  const approved = allItems.filter((i: any) => i.approvalStatus === 'approved').length;

  /* Greeting based on time */
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-xl border border-brand-gold/30 bg-brand-cream px-6 py-5">
        <div className="relative z-10">
          <p className="font-body text-xs font-semibold uppercase tracking-widest text-brand-gold mb-1">
            {greeting}
          </p>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {user?.name} 🙏
          </h2>
          {user?.businessName && (
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              {user.businessName}
            </p>
          )}
        </div>
        {/* decorative ring */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border-[16px] border-brand-gold/10" />
        <div className="pointer-events-none absolute -right-2 -bottom-6 h-20 w-20 rounded-full border-[10px] border-brand-gold/10" />
      </div>

      {/* ── Partner not approved banner ── */}
      {!isApproved && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-saffron/30 bg-brand-saffron/10 px-4 py-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-saffron" />
          <div>
            <p className="font-body text-sm font-semibold text-foreground">
              Partner verification is{' '}
              <span className="capitalize">{user?.partnerStatus || 'pending'}</span>
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Admin must verify your business details and legal documents before you can list hotels or manage inventory.
            </p>
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* Hotels */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Hotels
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                <Hotel size={16} className="text-brand-gold" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-foreground leading-none">
              {listings.hotels.length}
            </p>
          </div>
          <div className="border-t border-border px-4 py-2 bg-muted/30">
            <p className="font-body text-[10px] text-muted-foreground">Total listings</p>
          </div>
        </div>

        {/* Bookings */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Bookings
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-crimson/10 flex items-center justify-center">
                <ClipboardList size={16} className="text-brand-crimson" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-foreground leading-none">
              {partnerBookings.length}
            </p>
          </div>
          <div className="border-t border-border px-4 py-2 bg-muted/30">
            <p className="font-body text-[10px] text-muted-foreground">All time</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pending
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock size={16} className="text-amber-500" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-foreground leading-none">
              {pending}
            </p>
          </div>
          <div className="border-t border-border px-4 py-2 bg-muted/30">
            <p className="font-body text-[10px] text-muted-foreground">Awaiting approval</p>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Approved
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-600" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-foreground leading-none">
              {approved}
            </p>
          </div>
          <div className="border-t border-border px-4 py-2 bg-muted/30">
            <p className="font-body text-[10px] text-muted-foreground">Live listings</p>
          </div>
        </div>

      </div>

      {/* ── Refreshing indicator ── */}
      {isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-brand-gold animate-pulse" />
          <p className="font-body text-xs text-muted-foreground">Refreshing listings…</p>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div>
        <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Quick actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <Link
            to="/partner/hotels"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-gold/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-gold/20">
              <Hotel size={22} className="text-brand-gold" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">Add Hotel</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">List a new property</p>
            </div>
            <TrendingUp size={14} className="ml-auto text-muted-foreground/40 group-hover:text-brand-gold transition-colors" />
          </Link>

          <Link
            to="/partner/inventory"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand-saffron/50 hover:bg-brand-saffron/5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-saffron/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-saffron/20">
              <BedDouble size={22} className="text-brand-saffron" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">Manage Inventory</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">Update rooms &amp; availability</p>
            </div>
            <TrendingUp size={14} className="ml-auto text-muted-foreground/40 group-hover:text-brand-saffron transition-colors" />
          </Link>

        </div>
      </div>

      {/* ── Hotel listings summary ── */}
      {listings.hotels.length > 0 && (
        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Your hotels
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {listings.hotels.slice(0, 5).map((h: any) => (
              <div key={h.id || h._id} className="flex items-center gap-3 px-4 py-3">
                {h.images?.[0] ? (
                  <img
                    src={h.images[0]}
                    alt={h.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <Hotel size={16} className="text-brand-gold" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm font-semibold text-foreground truncate">{h.name || 'Unnamed Hotel'}</p>
                  {h.location && (
                    <p className="font-body text-[11px] text-muted-foreground truncate">{h.location}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-[10px] font-semibold capitalize
                    ${h.approvalStatus === 'approved'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : h.approvalStatus === 'rejected'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                >
                  {h.approvalStatus || 'pending'}
                </span>
              </div>
            ))}
            {listings.hotels.length > 5 && (
              <div className="px-4 py-2.5 bg-muted/30">
                <Link to="/partner/hotels" className="font-body text-xs text-brand-gold hover:underline">
                  View all {listings.hotels.length} hotels →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rejected banner ── */}
      {rejected > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <XCircle size={20} className="mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="font-body text-sm font-semibold text-foreground">
              {rejected} listing{rejected > 1 ? 's' : ''} rejected
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Check your listings page for details and resubmit after making changes.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default PartnerDashboard;