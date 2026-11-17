const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Home.tsx');
let code = fs.readFileSync(homePath, 'utf8');

// 1. Add RefreshCw to lucide-react import
if (!code.includes('RefreshCw,')) {
  code = code.replace(
    '  Phone,\n} from \'lucide-react\';',
    '  Phone,\n  RefreshCw,\n} from \'lucide-react\';'
  );
  console.log('Added RefreshCw import');
}

// 2. Add SectionSkeletonGrid and SectionOptionBFallback helpers before Home component
const helperComponents = `
const SectionSkeletonGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden shadow-sm">
        <div className="h-44 bg-neutral-200/70" />
        <div className="p-4 space-y-2.5">
          <div className="h-4 bg-neutral-200/80 rounded w-3/4" />
          <div className="h-3 bg-neutral-200/60 rounded w-1/2" />
          <div className="pt-2 flex justify-between items-center">
            <div className="h-5 bg-neutral-200/80 rounded w-1/3" />
            <div className="h-4 bg-neutral-200/60 rounded w-1/4" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SectionOptionBFallback = ({
  icon: Icon,
  title,
  description,
  onRetry,
  whatsappMessage,
  callLabel = 'Call Travel Desk',
}: {
  icon: any;
  title: string;
  description: string;
  onRetry?: () => void;
  whatsappMessage: string;
  callLabel?: string;
}) => {
  const adminPhone = useSettingsStore((s) => s.settings.adminPhone) || COMPANY_PHONE;
  const cleanPhone = String(adminPhone).replace(/\\D/g, '') || COMPANY_PHONE_DIGITS;
  const waUrl = \`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(whatsappMessage)}\`;

  return (
    <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-6 sm:p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
        <Icon size={24} />
      </div>
      <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md font-body text-xs sm:text-sm text-neutral-600 leading-relaxed">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-body text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
        >
          <MessageCircle size={15} />
          <span>Inquire via WhatsApp</span>
        </a>
        <a
          href={\`tel:\${cleanPhone}\`}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors"
        >
          <Phone size={14} />
          <span>{callLabel}</span>
        </a>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 font-body text-xs font-semibold text-amber-800 hover:bg-amber-100/60 transition-colors"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};
`;

if (!code.includes('SectionOptionBFallback')) {
  code = code.replace(
    'const Home = () => {',
    `${helperComponents}\nconst Home = () => {`
  );
  console.log('Added SectionOptionBFallback and SectionSkeletonGrid helpers');
}

// 3. Add independent loading and error states to Home component
const oldStateBlock = `  const [hotels, setHotels] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [cabs, setCabs] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const featuredLimit = 8;`;

const newStateBlock = `  const [hotels, setHotels] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [cabs, setCabs] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const featuredLimit = 8;

  const [hotelsLoading, setHotelsLoading] = useState(true);
  const [hotelsError, setHotelsError] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(false);
  const [cabsLoading, setCabsLoading] = useState(true);
  const [cabsError, setCabsError] = useState(false);
  const [toursLoading, setToursLoading] = useState(true);
  const [toursError, setToursError] = useState(false);`;

code = code.replace(oldStateBlock, newStateBlock);

// 4. Replace loadListings with decoupled independent parallel fetchers
const oldEffectBlock = /useEffect\(\(\) => \{[\s\S]*?const loadListings = async \(\) => \{[\s\S]*?void loadListings\(\);[\s\S]*?return \(\) => \{[\s\S]*?\};\s*\}, \[fetchProducts, shopEnabled\]\);/;

const newEffectBlock = `  const fetchHotelsList = async () => {
    try {
      setHotelsLoading(true);
      setHotelsError(false);
      const res = await api.get('/hotels');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setHotels(data);
      try { localStorage.setItem('vvs_hotels', JSON.stringify(data)); } catch {}
    } catch {
      setHotelsError(true);
    } finally {
      setHotelsLoading(false);
    }
  };

  const fetchRoomsList = async () => {
    try {
      setRoomsLoading(true);
      setRoomsError(false);
      const res = await api.get('/room-types');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRoomTypes(data.slice(0, featuredLimit));
      try { localStorage.setItem('vvs_room_types', JSON.stringify(data)); } catch {}
    } catch {
      setRoomsError(true);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchCabsList = async () => {
    try {
      setCabsLoading(true);
      setCabsError(false);
      const res = await api.get('/cabs');
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setCabs(data.slice(0, featuredLimit));
      try { localStorage.setItem('vvs_cabs', JSON.stringify(data)); } catch {}
    } catch {
      setCabsError(true);
    } finally {
      setCabsLoading(false);
    }
  };

  const fetchToursList = async () => {
    try {
      setToursLoading(true);
      setToursError(false);
      const res = await api.get('/tours', { params: { withImages: true } });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const active = data.filter((t: any) => t?.status === 'active').slice(0, featuredLimit);
      setTours(active);
      try { localStorage.setItem('vvs_tours', JSON.stringify(data)); } catch {}
    } catch {
      setToursError(true);
    } finally {
      setToursLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cachedHotels = localStorage.getItem('vvs_hotels');
      if (cachedHotels) {
        const parsed = JSON.parse(cachedHotels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHotels(parsed);
          setHotelsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedRooms = localStorage.getItem('vvs_room_types');
      if (cachedRooms) {
        const parsed = JSON.parse(cachedRooms);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoomTypes(parsed.slice(0, featuredLimit));
          setRoomsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedCabs = localStorage.getItem('vvs_cabs');
      if (cachedCabs) {
        const parsed = JSON.parse(cachedCabs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCabs(parsed.slice(0, featuredLimit));
          setCabsLoading(false);
        }
      }
    } catch {}
    try {
      const cachedTours = localStorage.getItem('vvs_tours');
      if (cachedTours) {
        const parsed = JSON.parse(cachedTours);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTours(parsed.filter((t: any) => t?.status === 'active').slice(0, featuredLimit));
          setToursLoading(false);
        }
      }
    } catch {}

    void fetchHotelsList();
    void fetchRoomsList();
    void fetchCabsList();
    void fetchToursList();
    if (shopEnabled) void fetchProducts();

    const reloadAll = () => {
      void fetchHotelsList();
      void fetchRoomsList();
      void fetchCabsList();
      void fetchToursList();
    };

    const unsubListings = subscribeAppEvent('listing:changed', reloadAll);
    const onFocus = () => reloadAll();
    window.addEventListener('focus', onFocus);

    return () => {
      unsubListings();
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchProducts, shopEnabled]);`;

code = code.replace(oldEffectBlock, newEffectBlock);

// 5. Update Hotels section fallback
const oldHotelsFallback = `          {/* Location-Wise Discovery Sections */}
          {hotelDiscoverySections.length > 0 ? (
            <div className="divide-y divide-neutral-200/70">
              {hotelDiscoverySections.map((section) => (
                <LocationDiscoverySection
                  key={section.id}
                  id={section.id}
                  heading={section.heading}
                  subtitle={section.subtitle}
                  distanceLabel={section.distanceLabel}
                  viewAllUrl={section.filterUrl}
                  viewAllCount={section.items.length}
                  items={section.items}
                  renderItem={(hotel) => (
                    <ListingCard
                      key={hotel._id}
                      variant="hotel"
                      image={hotel.image}
                      images={hotel.images}
                      name={hotel.name}
                      badge={getPropertyTypeLabel(hotel?.propertyType)}
                      location={hotel.location}
                      price={getHotelStartingPrice(hotel)}
                      priceLabel={
                        isDharamshalaType(hotel?.propertyType)
                          ? ''
                          : hotel?.taxEnabled
                          ? '/night incl. GST'
                          : '/night'
                      }
                      pricePlaceholder={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Contribution on confirmation'
                          : undefined
                      }
                      priceHelp={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Verified Ashram'
                          : undefined
                      }
                      rating={Number(hotel.rating || 0)}
                      reviewCount={Number(hotel.reviewCount || 0)}
                      amenities={hotel.amenities || []}
                      onViewDetails={() => {
                        prefetchDetail('hotels', hotel._id, hotel);
                        navigate(\`/hotels/\${hotel._id}\`);
                      }}
                    />
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8 text-center text-sm text-slate-500">
              Loading verified properties in Braj...
            </div>
          )}`;

const newHotelsFallback = `          {/* Location-Wise Discovery Sections */}
          {hotelsLoading && hotelDiscoverySections.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : hotelDiscoverySections.length > 0 ? (
            <div className="divide-y divide-neutral-200/70">
              {hotelDiscoverySections.map((section) => (
                <LocationDiscoverySection
                  key={section.id}
                  id={section.id}
                  heading={section.heading}
                  subtitle={section.subtitle}
                  distanceLabel={section.distanceLabel}
                  viewAllUrl={section.filterUrl}
                  viewAllCount={section.items.length}
                  items={section.items}
                  renderItem={(hotel) => (
                    <ListingCard
                      key={hotel._id}
                      variant="hotel"
                      image={hotel.image}
                      images={hotel.images}
                      name={hotel.name}
                      badge={getPropertyTypeLabel(hotel?.propertyType)}
                      location={hotel.location}
                      price={getHotelStartingPrice(hotel)}
                      priceLabel={
                        isDharamshalaType(hotel?.propertyType)
                          ? ''
                          : hotel?.taxEnabled
                          ? '/night incl. GST'
                          : '/night'
                      }
                      pricePlaceholder={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Contribution on confirmation'
                          : undefined
                      }
                      priceHelp={
                        isDharamshalaType(hotel?.propertyType)
                          ? 'Verified Ashram'
                          : undefined
                      }
                      rating={Number(hotel.rating || 0)}
                      reviewCount={Number(hotel.reviewCount || 0)}
                      amenities={hotel.amenities || []}
                      onViewDetails={() => {
                        prefetchDetail('hotels', hotel._id, hotel);
                        navigate(\`/hotels/\${hotel._id}\`);
                      }}
                    />
                  )}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={Building2}
              title="Verified Accommodations in Braj"
              description="Looking for verified Dharamshalas, Ashrams or commercial hotels near Prem Mandir, Banke Bihari or ISKCON? Tap below to check direct room availability with our local desk."
              whatsappMessage="Hare Krishna, please help me check verified hotel and dharamshala room availability in Vrindavan."
              callLabel="Call Accommodations Desk"
              onRetry={fetchHotelsList}
            />
          )}`;

code = code.replace(oldHotelsFallback, newHotelsFallback);

// 6. Update Room Types fallback
const oldRoomsFallback = `          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading available room configurations...
            </div>
          )}`;

const newRoomsFallback = `          ) : roomsLoading ? (
            <SectionSkeletonGrid count={4} />
          ) : (
            <SectionOptionBFallback
              icon={BedDouble}
              title="Room Configurations Available upon Request"
              description="AC Deluxe, Family Quad suites, and Ashram donor rooms are available. Contact our coordinator to match your dates and party size."
              whatsappMessage="Hare Krishna, I want to check room types and family suite options in Vrindavan."
              callLabel="Call Reservations Desk"
              onRetry={fetchRoomsList}
            />
          )}`;

code = code.replace(oldRoomsFallback, newRoomsFallback);

// 7. Update Cabs fallback
const oldCabsFallback = `          {cabs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {cabs.map((cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' • ') || 'Braj Region Routes'}
                  price={0}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, cab.capacity ? \`\${cab.capacity} Seater AC\` : undefined].filter(Boolean) as string[]}
                  badge="30% Advance"
                  badgeColor="green"
                  variant="cab"
                  onViewDetails={() => {
                    prefetchDetail('cabs', cab._id, cab);
                    navigate(\`/cabs/\${cab._id}\`);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-slate-500">
              Updating available cab fleet. Call helpline for urgent cab booking.
            </div>
          )}`;

const newCabsFallback = `          {cabsLoading && cabs.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : cabs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {cabs.map((cab) => (
                <ListingCard
                  key={cab._id}
                  image={cab.image}
                  images={cab.images}
                  name={cab.vehicleName}
                  location={cab.routes?.join(' • ') || 'Braj Region Routes'}
                  price={0}
                  priceLabel=""
                  rating={0}
                  reviewCount={0}
                  amenities={[cab.vehicleType, cab.capacity ? \`\${cab.capacity} Seater AC\` : undefined].filter(Boolean) as string[]}
                  badge="30% Advance"
                  badgeColor="green"
                  variant="cab"
                  onViewDetails={() => {
                    prefetchDetail('cabs', cab._id, cab);
                    navigate(\`/cabs/\${cab._id}\`);
                  }}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={CarTaxiFront}
              title="Fixed-Fare Cabs on Direct Booking"
              description="Delhi Airport pickups, Mathura Junction transfers, and Govardhan Parikrama cabs available with verified drivers."
              whatsappMessage="Hare Krishna, I need to book a fixed-fare cab for Braj travel / Delhi Airport."
              callLabel="Call Cab Desk"
              onRetry={fetchCabsList}
            />
          )}`;

code = code.replace(oldCabsFallback, newCabsFallback);

// 8. Update Tours fallback
const oldToursFallback = `          {tours.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {tours.map((tour) => (
                <ListingCard
                  key={tour._id}
                  image={tour.image}
                  images={tour.images}
                  name={tour.name}
                  location={tour.destination || 'Braj Mandal'}
                  price={tour.pricePerPerson}
                  priceLabel="/person"
                  rating={0}
                  reviewCount={0}
                  badge={tour.duration}
                  amenities={tour.includes || []}
                  variant="tour"
                  onViewDetails={() => {
                    prefetchDetail('tours', tour._id, tour);
                    navigate(\`/tours/\${tour._id}\`);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-slate-500">
              Yatra packages updating. Contact coordinator for custom itinerary.
            </div>
          )}`;

const newToursFallback = `          {toursLoading && tours.length === 0 ? (
            <SectionSkeletonGrid count={4} />
          ) : tours.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {tours.map((tour) => (
                <ListingCard
                  key={tour._id}
                  image={tour.image}
                  images={tour.images}
                  name={tour.name}
                  location={tour.destination || 'Braj Mandal'}
                  price={tour.pricePerPerson}
                  priceLabel="/person"
                  rating={0}
                  reviewCount={0}
                  badge={tour.duration}
                  amenities={tour.includes || []}
                  variant="tour"
                  onViewDetails={() => {
                    prefetchDetail('tours', tour._id, tour);
                    navigate(\`/tours/\${tour._id}\`);
                  }}
                />
              ))}
            </div>
          ) : (
            <SectionOptionBFallback
              icon={MapPinned}
              title="Custom Yatra Plans with Dedicated Guide"
              description="Guided Braj Darshan, 84 Kos Parikrama, and temple itineraries organized with AC cab and hotel pickup."
              whatsappMessage="Hare Krishna, I would like to inquire about guided Yatra packages in Braj."
              callLabel="Call Yatra Coordinator"
              onRetry={fetchToursList}
            />
          )}`;

code = code.replace(oldToursFallback, newToursFallback);

fs.writeFileSync(homePath, code, 'utf8');
console.log('Successfully updated Home.tsx with Option B fallback cards and parallel fetching');
