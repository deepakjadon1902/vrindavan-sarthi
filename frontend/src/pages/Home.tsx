// import { Link, useNavigate } from 'react-router-dom';
// import { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { Building2, CarTaxiFront, MapPinned, Users, Shield, Clock, MapPin, ChevronDown, ArrowRight, ShoppingBag, MessageCircle } from 'lucide-react';
// import SectionTitle from '@/components/shared/SectionTitle';
// import ListingCard from '@/components/shared/ListingCard';
// import TestimonialCard from '@/components/shared/TestimonialCard';
// import { useProductStore } from '@/store/productStore';
// import { api } from '@/lib/api';
// import { subscribeAppEvent } from '@/lib/broadcast';
// import { prefetchDetail } from '@/lib/detailCache';

// import heroImg from '@/assets/images/hero-vrindavan.jpg';

// const services = [
//   { icon: Building2, title: 'Hotels', desc: 'Verified hotels near sacred temples', link: '/hotels' },
//   { icon: Building2, title: 'Rooms', desc: 'Browse room types across hotels', link: '/rooms' },
//   { icon: CarTaxiFront, title: 'Cabs', desc: 'Reliable local & outstation cabs', link: '/cabs' },
//   { icon: MapPinned, title: 'Tours', desc: 'Guided spiritual tour packages', link: '/tours' },
//   { icon: ShoppingBag, title: 'Shop', desc: 'Sacred items & souvenirs', link: '/shop' },
// ];

// const stats = [
//   { label: 'Happy Pilgrims', value: '500+' },
//   { label: 'Hotels Listed', value: '50+' },
//   { label: 'Tour Packages', value: '30+' },
//   { label: '24/7 Support', value: '✓' },
// ];

// const testimonials = [
//   { name: 'Priya Sharma', location: 'Delhi', rating: 5, text: 'Vrindavan Sarthi Enterprises made our family trip to Vrindavan absolutely seamless. The hotel was right next to Banke Bihari Temple!' },
//   { name: 'Rajesh Kumar', location: 'Mumbai', rating: 5, text: 'The guided temple tour was incredible. Our guide knew every story, every detail. A truly divine experience.' },
//   { name: 'Anita Devi', location: 'Jaipur', rating: 4, text: 'Booked a cab and hotel through this platform. Everything was smooth and the prices were very reasonable.' },
// ];

// const whyUs = [
//   { icon: MapPin, title: 'Sacred Location', desc: 'Properties handpicked near the most sacred sites of Vrindavan' },
//   { icon: Shield, title: 'Verified Listings', desc: 'Every hotel, room, and cab is personally verified for quality' },
//   { icon: Clock, title: 'Easy Booking', desc: 'Book in under 2 minutes with instant confirmation' },
//   { icon: Users, title: '24/7 Support', desc: 'Our team is always available to help during your sacred journey' },
// ];

// const Home = () => {
//   const navigate = useNavigate();
//   const { products, fetchProducts } = useProductStore();
//   const [hotels, setHotels] = useState<any[]>([]);
//   const [roomTypes, setRoomTypes] = useState<any[]>([]);
//   const [cabs, setCabs] = useState<any[]>([]);
//   const [tours, setTours] = useState<any[]>([]);
//   const featuredLimit = 4;

//   const featuredProducts = products.filter(p => p.inStock).slice(0, 4);

//   useEffect(() => {
//     const loadListings = async () => {
//       // Show cached lists fast (if any), but always revalidate from API so new listings reflect quickly.
//       try {
//         const cachedHotels = localStorage.getItem('vvs_hotels');
//         if (cachedHotels) setHotels(JSON.parse(cachedHotels).slice(0, featuredLimit));
//       } catch {}
//       try {
//         const cachedRooms = localStorage.getItem('vvs_room_types');
//         if (cachedRooms) setRoomTypes(JSON.parse(cachedRooms).slice(0, featuredLimit));
//       } catch {}
//       try {
//         const cachedCabs = localStorage.getItem('vvs_cabs');
//         if (cachedCabs) setCabs(JSON.parse(cachedCabs).slice(0, featuredLimit));
//       } catch {}
//       try {
//         const cachedTours = localStorage.getItem('vvs_tours');
//         if (cachedTours) setTours(JSON.parse(cachedTours).filter((t: any) => t?.status === 'active').slice(0, featuredLimit));
//       } catch {}

//       const [hotelsRes, roomsRes, cabsRes, toursRes] = await Promise.allSettled([
//         api.get('/hotels'),
//         api.get('/room-types'),
//         api.get('/cabs'),
//         api.get('/tours', { params: { withImages: true } }),
//       ]);

//       if (hotelsRes.status === 'fulfilled') {
//         const data = Array.isArray(hotelsRes.value.data?.data) ? hotelsRes.value.data.data : [];
//         setHotels(data.slice(0, featuredLimit));
//         try { localStorage.setItem('vvs_hotels', JSON.stringify(data)); } catch {}
//       } else setHotels([]);

//       if (roomsRes.status === 'fulfilled') {
//         const data = Array.isArray(roomsRes.value.data?.data) ? roomsRes.value.data.data : [];
//         setRoomTypes(data.slice(0, featuredLimit));
//         try { localStorage.setItem('vvs_room_types', JSON.stringify(data)); } catch {}
//       } else setRoomTypes([]);

//       if (cabsRes.status === 'fulfilled') {
//         const data = Array.isArray(cabsRes.value.data?.data) ? cabsRes.value.data.data : [];
//         setCabs(data.slice(0, featuredLimit));
//         try { localStorage.setItem('vvs_cabs', JSON.stringify(data)); } catch {}
//       } else setCabs([]);

//       if (toursRes.status === 'fulfilled') {
//         const data = Array.isArray(toursRes.value.data?.data) ? toursRes.value.data.data : [];
//         const active = data.filter((t: any) => t?.status === 'active').slice(0, featuredLimit);
//         setTours(active);
//         try { localStorage.setItem('vvs_tours', JSON.stringify(data)); } catch {}
//       } else setTours([]);
//     };

//     void fetchProducts();
//     void loadListings();

//     const unsubListings = subscribeAppEvent('listing:changed', () => void loadListings());
//     const unsubProducts = subscribeAppEvent('product:changed', () => void fetchProducts());
//     const onFocus = () => {
//       void loadListings();
//       void fetchProducts();
//     };
//     window.addEventListener('focus', onFocus);

//     return () => {
//       unsubListings();
//       unsubProducts();
//       window.removeEventListener('focus', onFocus);
//     };
//   }, [fetchProducts]);

//   const getRoomPrice = (roomType: any) => {
//     const base = Number(roomType?.pricePerNight || 0);
//     const hotel = roomType?.hotel || {};
//     if (!hotel?.taxEnabled) return base;
//     const percent = Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
//     return Math.round(base + (base * percent) / 100);
//   };

//   return (
//     <div>
//       {/* ===== HERO ===== */}
//       <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-20">
//         <img src={heroImg} alt="Vrindavan temples at sunset" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
//         <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/45 to-brand-black/90" />
//         <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
//           <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="font-body text-sm tracking-[0.3em] uppercase text-brand-gold mb-4">
//             ✦ Vrindavan, Mathura, UP ✦
//           </motion.p>
//           <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="font-brand text-4xl md:text-6xl lg:text-7xl text-brand-gold mb-4 leading-tight">
//             Vrindavan Sarthi Enterprises
//           </motion.h1>
//           <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="font-heading italic text-2xl md:text-3xl text-white mb-3">
//             Your Divine Guide to Vrindavan
//           </motion.h2>
//           <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="font-body text-white text-sm md:text-base tracking-wider mb-10">
//             Hotels • Rooms • Cabs • Tours — All in One Place
//           </motion.p>
//           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
//             <Link to="/hotels" className="btn-gold px-8 py-3.5 rounded-xl text-base font-semibold">Explore Now →</Link>
//             <a href="https://wa.me/918218303066" target="_blank" rel="noreferrer" className="px-8 py-3.5 rounded-lg text-base font-body font-semibold border border-white/35 text-white hover:border-brand-gold hover:text-brand-gold transition-all inline-flex items-center gap-2">
//               <MessageCircle size={18} /> WhatsApp Now
//             </a>
//           </motion.div>
//         </div>
//         <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
//           <ChevronDown className="text-brand-gold" size={28} />
//         </motion.div>
//       </section>

//       {/* ===== STATS ===== */}
//       <section className="bg-brand-black py-6">
//         <div className="container mx-auto px-4">
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
//             {stats.map((stat) => (
//               <div key={stat.label} className="text-center">
//                 <p className="font-heading text-3xl md:text-4xl font-bold text-brand-gold">{stat.value}</p>
//                 <p className="font-body text-sm text-white/70 mt-1">{stat.label}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ===== SERVICES ===== */}
//       <section className="py-16 lg:py-24 bg-royal-dark">
//         <div className="container mx-auto px-4">
//           <SectionTitle label="Our Services" title="Everything You Need in Vrindavan" subtitle="From comfortable stays to guided temple tours, we've got your sacred journey covered" />
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//             {services.map((service, i) => {
//               const isLast = i === services.length - 1;
//               const lastPos =
//                 isLast
//                   ? 'sm:col-span-2 sm:justify-self-center sm:max-w-md lg:col-span-2 lg:col-start-2 lg:justify-self-center lg:max-w-md'
//                   : '';
//               return (
//               <Link key={service.title} to={service.link} className={`travel-card p-6 text-center card-hover group ${lastPos}`}>
//                 <div className="w-14 h-14 rounded-md bg-brand-saffron/12 flex items-center justify-center mx-auto mb-4 group-hover:bg-brand-saffron/20 transition-colors">
//                   <service.icon className="text-brand-saffron" size={24} />
//                 </div>
//                 <h3 className="font-heading text-lg font-semibold text-foreground mb-1.5">{service.title}</h3>
//                 <p className="font-body text-sm text-muted-foreground">{service.desc}</p>
//               </Link>
//               );
//             })}
//           </div>
//         </div>
//       </section>

//       {/* ===== FEATURED HOTELS ===== */}
//       <section className="py-16 lg:py-24 relative overflow-hidden bg-royal-dark">
//         <img src="/backgrounds/hotel-room.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
//         <div className="absolute inset-0 bg-white/75" />
//         <div className="container mx-auto px-4 relative">
//           <SectionTitle label="Featured Stays" title="Handpicked Hotels in Vrindavan" subtitle="Comfortable and affordable stays near the most sacred temples" />
//           {hotels.length > 0 ? (
//             <>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//                 {hotels.map((hotel) => (
//                   <ListingCard
//                     key={hotel._id}
//                     image={hotel.image}
//                     images={hotel.images}
//                     name={hotel.name}
//                     location={hotel.location}
//                     rating={hotel.rating}
//                     reviewCount={hotel.reviewCount || 0}
//                     amenities={hotel.amenities || []}
//                     onViewDetails={() => {
//                       prefetchDetail('hotels', hotel._id, hotel);
//                       navigate(`/hotels/${hotel._id}`);
//                     }}
//                   />
//                 ))}
//               </div>
//               <div className="text-center mt-10">
//                 <Link to="/hotels" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Hotels <ArrowRight size={18} /></Link>
//               </div>
//             </>
//           ) : (
//             <div className="text-center py-12">
//               <p className="font-body text-muted-foreground mb-4">No hotels listed yet. Check back soon!</p>
//               <Link to="/hotels" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Hotels <ArrowRight size={16} /></Link>
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ===== FEATURED ROOMS ===== */}
//       <section className="py-16 lg:py-24 bg-royal-dark">
//         <div className="container mx-auto px-4">
//           <SectionTitle label="Room Options" title="Browse Rooms" subtitle="Choose comfortable room types from verified Vrindavan hotels" />
//           {roomTypes.length > 0 ? (
//             <>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//                 {roomTypes.map((roomType) => (
//                   <ListingCard
//                     key={roomType._id}
//                     image={roomType?.images?.[0] || roomType?.hotel?.image}
//                     images={roomType?.images?.length ? roomType.images : roomType?.hotel?.images}
//                     name={roomType.name}
//                     location={`${roomType?.hotel?.name || ''}${roomType?.hotel?.location ? ` - ${roomType.hotel.location}` : ''}`}
//                     price={getRoomPrice(roomType)}
//                     priceLabel={roomType?.hotel?.taxEnabled ? '/night incl. GST' : '/night'}
//                     rating={0}
//                     reviewCount={0}
//                     amenities={roomType?.amenities || roomType?.hotel?.amenities || []}
//                     meta={Number(roomType?.totalCount || 0) > 0 ? `${roomType.totalCount} rooms` : undefined}
//                     ctaLabel="Book Room"
//                     onViewDetails={() => {
//                       prefetchDetail('roomTypes', roomType._id, roomType);
//                       navigate(`/room-types/${roomType._id}`);
//                     }}
//                   />
//                 ))}
//               </div>
//               <div className="text-center mt-10">
//                 <Link to="/rooms" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Rooms <ArrowRight size={18} /></Link>
//               </div>
//             </>
//           ) : (
//             <div className="text-center py-12">
//               <p className="font-body text-muted-foreground mb-4">No rooms listed yet. Check back soon!</p>
//               <Link to="/rooms" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Rooms <ArrowRight size={16} /></Link>
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ===== FEATURED CABS ===== */}
//       <section className="py-16 lg:py-24 bg-royal-dark">
//         <div className="container mx-auto px-4">
//           <SectionTitle label="Transportation" title="Available Cabs" subtitle="Reliable cabs listed by verified partners" />
//           {cabs.length > 0 ? (
//             <>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//                 {cabs.map((cab) => (
//                   <ListingCard
//                     key={cab._id}
//                     image={cab.image}
//                     images={cab.images}
//                     name={cab.vehicleName}
//                     location={cab.routes?.join(' • ') || ''}
//                     price={0}
//                     priceLabel=""
//                     rating={0}
//                     reviewCount={0}
//                     amenities={[cab.vehicleType, `${cab.capacity} Seater`]}
//                     badge="30% Advance"
//                     badgeColor="green"
//                     onViewDetails={() => {
//                       prefetchDetail('cabs', cab._id, cab);
//                       navigate(`/cabs/${cab._id}`);
//                     }}
//                   />
//                 ))}
//               </div>
//               <div className="text-center mt-10">
//                 <Link to="/cabs" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Cabs <ArrowRight size={18} /></Link>
//               </div>
//             </>
//           ) : (
//             <div className="text-center py-12">
//               <p className="font-body text-muted-foreground mb-4">No cabs listed yet. Check back soon!</p>
//               <Link to="/cabs" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Cabs <ArrowRight size={16} /></Link>
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ===== FEATURED TOURS ===== */}
//       <section className="py-16 lg:py-24 relative overflow-hidden bg-royal-dark">
//         <img src="/backgrounds/parikrama.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-14" />
//         <div className="absolute inset-0 bg-white/80" />
//         <div className="container mx-auto px-4 relative">
//           <SectionTitle label="Spiritual Journeys" title="Popular Tour Packages" subtitle="Experience the divine essence of Vrindavan with our guided tours" />
//           {tours.length > 0 ? (
//             <>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//                 {tours.map((tour) => (
//                   <ListingCard
//                     key={tour._id}
//                     image={tour.image}
//                     images={tour.images}
//                     name={tour.name}
//                     location={tour.duration}
//                     price={tour.pricePerPerson}
//                     priceLabel="/person"
//                     rating={0}
//                     reviewCount={0}
//                     badge={tour.duration}
//                     amenities={tour.includes || []}
//                     onViewDetails={() => {
//                       prefetchDetail('tours', tour._id, tour);
//                       navigate(`/tours/${tour._id}`);
//                     }}
//                   />
//                 ))}
//               </div>
//               <div className="text-center mt-10">
//                 <Link to="/tours" className="btn-gold px-8 py-3 rounded-xl inline-flex items-center gap-2">View All Tours <ArrowRight size={18} /></Link>
//               </div>
//             </>
//           ) : (
//             <div className="text-center py-12">
//               <p className="font-body text-muted-foreground mb-4">No tours listed yet. Check back soon!</p>
//               <Link to="/tours" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">Browse Tours <ArrowRight size={16} /></Link>
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ===== FEATURED PRODUCTS (Shop) ===== */}
//       {featuredProducts.length > 0 && (
//         <section className="py-16 lg:py-24 relative overflow-hidden bg-royal-dark">
//           <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 rounded-full bg-brand-gold/15 blur-3xl" />
//           <div className="container mx-auto px-4 relative">
//             <SectionTitle label="Divine Shop" title="Sacred Souvenirs from Vrindavan" subtitle="Take a piece of Vrindavan's blessings home with you" />
//             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//               {featuredProducts.map((p) => (
//                 <Link key={p.id} to={`/shop/${p.id}`} className="glass-panel rounded-lg overflow-hidden water-hover group">
//                   <div className="aspect-[4/3] overflow-hidden relative bg-white">
//                     <img src={p.images[0] || '/placeholder.svg'} alt={p.name} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500" />
//                     <div className="absolute inset-0 glossy-sheen pointer-events-none" />
//                     <span className="absolute top-2 left-2 glass-chip px-2 py-0.5 rounded-full font-body text-[10px] capitalize">{p.category}</span>
//                   </div>
//                   <div className="p-4">
//                     <h3 className="font-display text-base font-semibold text-foreground truncate">{p.name}</h3>
//                     <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
//                     <div className="flex items-center justify-between mt-3">
//                       <span className="font-display text-lg font-bold text-brand-crimson">₹{p.price.toLocaleString('en-IN')}</span>
//                       <span className="font-body text-[10px] text-brand-green font-medium flex items-center gap-1"><ShoppingBag size={11} />Buy</span>
//                     </div>
//                   </div>
//                 </Link>
//               ))}
//             </div>
//             <div className="text-center mt-10">
//               <Link to="/shop" className="metallic-gold px-8 py-3 rounded-xl inline-flex items-center gap-2 font-semibold">Visit Shop <ArrowRight size={18} /></Link>
//             </div>
//           </div>
//         </section>
//       )}

//       {/* ===== WHY US ===== */}
//       <section className="py-16 lg:py-24 relative overflow-hidden bg-royal-dark">
//         <img src="/backgrounds/temple-interior.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
//         <div className="absolute inset-0 bg-white/80" />
//         <div className="container mx-auto px-4 relative">
//           <SectionTitle label="Why Choose Us" title="Your Trusted Companion in Vrindavan" />
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//             {whyUs.map((item) => (
//               <div key={item.title} className="text-center p-6">
//                 <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
//                   <item.icon className="text-primary" size={24} />
//                 </div>
//                 <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
//                 <p className="font-body text-sm text-muted-foreground">{item.desc}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ===== TESTIMONIALS ===== */}
//       <section className="py-16 lg:py-24 bg-royal-dark">
//         <div className="container mx-auto px-4">
//           <SectionTitle label="Testimonials" title="What Our Pilgrims Say" subtitle="Real experiences from real devotees" />
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {testimonials.map((t) => (
//               <TestimonialCard key={t.name} {...t} avatar="" />
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ===== CTA BANNER ===== */}
//       <section className="relative py-20 lg:py-28 overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-r from-brand-saffron to-primary" />
//         <div className="relative z-10 container mx-auto px-4 text-center">
//           <h2 className="font-heading text-3xl md:text-5xl font-bold text-primary-foreground mb-4">Begin Your Sacred Journey Today</h2>
//           <p className="font-body text-primary-foreground/80 mb-8 max-w-xl mx-auto">Book your stay, cab, or temple tour in Vrindavan with complete peace of mind</p>
//           <Link to="/hotels" className="btn-gold px-10 py-4 rounded-xl text-lg inline-flex items-center gap-2">Get Started <ArrowRight size={20} /></Link>
//         </div>
//       </section>
//     </div>
//   );
// };

// export default Home;


import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, CarTaxiFront, MapPinned, Users, Shield, Clock, MapPin, ChevronDown, ArrowRight, ShoppingBag, MessageCircle, Search, BedDouble } from 'lucide-react';
import SectionTitle from '@/components/shared/SectionTitle';
import ListingCard from '@/components/shared/ListingCard';
import TestimonialCard from '@/components/shared/TestimonialCard';
import { useProductStore } from '@/store/productStore';
import { api } from '@/lib/api';
import { subscribeAppEvent } from '@/lib/broadcast';
import { prefetchDetail } from '@/lib/detailCache';
import { COMPANY_PHONE_DIGITS } from '@/lib/brand';
import { useSettingsStore } from '@/store/settingsStore';

import heroImg from '@/assets/images/hero-vrindavan.jpg';

const services = [
  {
    icon: Building2,
    title: 'Stay Near The Temples',
    desc: 'Verified hotels, dharamshalas, and rooms close to Banke Bihari, ISKCON, and Prem Mandir.',
    link: '/hotels',
    cta: 'Explore stays',
  },
  {
    icon: CarTaxiFront,
    title: 'Private Cab Support',
    desc: 'Fixed route-wise cab booking for Mathura, Govardhan, Barsana, Gokul, airport transfers, and local darshan.',
    link: '/cabs',
    cta: 'View cabs',
  },
  {
    icon: MapPinned,
    title: 'Curated Braj Yatra',
    desc: 'Plan guided spiritual itineraries with destinations, duration, budget, and local travel support in one flow.',
    link: '/tours',
    cta: 'See packages',
  },
  {
    icon: ShoppingBag,
    title: 'Sacred Vrindavan Shop',
    desc: 'Order devotional products, souvenirs, and pooja essentials with tracking and admin-verified payments.',
    link: '/shop',
    cta: 'Visit shop',
  },
];

const plannerServices = [
  { key: 'hotels', label: 'Hotels', path: '/hotels', icon: Building2, hint: 'Verified stays near temples' },
  { key: 'rooms', label: 'Rooms', path: '/rooms', icon: BedDouble, hint: 'Live room options' },
  { key: 'cabs', label: 'Cabs', path: '/cabs', icon: CarTaxiFront, hint: 'Local and outstation rides' },
  { key: 'tours', label: 'Tours', path: '/tours', icon: MapPinned, hint: 'Guided Braj experiences' },
  { key: 'shop', label: 'Shop', path: '/shop', icon: ShoppingBag, hint: 'Sacred products' },
] as const;

type PlannerServiceKey = (typeof plannerServices)[number]['key'];

const stats = [
  { label: 'Happy Pilgrims', value: '500+' },
  { label: 'Hotels Listed', value: '50+' },
  { label: 'Tour Packages', value: '30+' },
  { label: '24/7 Support', value: '✓' },
];

const testimonials = [
  { name: 'Priya Sharma', location: 'Delhi', rating: 5, text: 'Vrindavan Sarthi Enterprises made our family trip to Vrindavan absolutely seamless. The hotel was right next to Banke Bihari Temple!' },
  { name: 'Rajesh Kumar', location: 'Mumbai', rating: 5, text: 'The guided temple tour was incredible. Our guide knew every story, every detail. A truly divine experience.' },
  { name: 'Anita Devi', location: 'Jaipur', rating: 4, text: 'Booked a cab and hotel through this platform. Everything was smooth and the prices were very reasonable.' },
];

const whyUs = [
  { icon: MapPin, title: 'Sacred Location', desc: 'Properties handpicked near the most sacred sites of Vrindavan' },
  { icon: Shield, title: 'Verified Listings', desc: 'Every hotel, room, and cab is personally verified for quality' },
  { icon: Clock, title: 'Easy Booking', desc: 'Book in under 2 minutes with instant confirmation' },
  { icon: Users, title: '24/7 Support', desc: 'Our team is always available to help during your sacred journey' },
];

const Home = () => {
  const navigate = useNavigate();
  const { products, fetchProducts } = useProductStore();
  const shopEnabled = useSettingsStore((s) => s.settings.shopEnabled);
  const [plannerService, setPlannerService] = useState<PlannerServiceKey>('hotels');
  const [plannerQuery, setPlannerQuery] = useState('');
  const [hotels, setHotels] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [cabs, setCabs] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const featuredLimit = 4;

  const visibleServices = shopEnabled ? services : services.filter((service) => service.link !== '/shop');
  const visiblePlannerServices = shopEnabled ? plannerServices : plannerServices.filter((service) => service.key !== 'shop');
  const serviceGridClass = visibleServices.length >= 4
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'
    : 'mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
  const featuredProducts = shopEnabled ? products.filter(p => p.inStock).slice(0, 4) : [];
  const activePlanner = visiblePlannerServices.find((item) => item.key === plannerService) || visiblePlannerServices[0];

  const runPlannerSearch = () => {
    const query = plannerQuery.trim();
    navigate(query && plannerService !== 'shop' ? `${activePlanner.path}?q=${encodeURIComponent(query)}` : activePlanner.path);
  };

  const navigatePlanner = (key: PlannerServiceKey) => {
    const item = visiblePlannerServices.find((service) => service.key === key) || visiblePlannerServices[0];
    setPlannerService(key);
    navigate(item.path);
  };

  useEffect(() => {
    if (!shopEnabled && plannerService === 'shop') setPlannerService('hotels');
  }, [plannerService, shopEnabled]);

  useEffect(() => {
    const loadListings = async () => {
      // Show cached lists fast (if any), but always revalidate from API so new listings reflect quickly.
      try {
        const cachedHotels = localStorage.getItem('vvs_hotels');
        if (cachedHotels) setHotels(JSON.parse(cachedHotels).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedRooms = localStorage.getItem('vvs_room_types');
        if (cachedRooms) setRoomTypes(JSON.parse(cachedRooms).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedCabs = localStorage.getItem('vvs_cabs');
        if (cachedCabs) setCabs(JSON.parse(cachedCabs).slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }
      try {
        const cachedTours = localStorage.getItem('vvs_tours');
        if (cachedTours) setTours(JSON.parse(cachedTours).filter((t: any) => t?.status === 'active').slice(0, featuredLimit));
      } catch {
        // Ignore stale cache and revalidate from the API below.
      }

      const [hotelsRes, roomsRes, cabsRes, toursRes] = await Promise.allSettled([
        api.get('/hotels'),
        api.get('/room-types'),
        api.get('/cabs'),
        api.get('/tours', { params: { withImages: true } }),
      ]);

      if (hotelsRes.status === 'fulfilled') {
        const data = Array.isArray(hotelsRes.value.data?.data) ? hotelsRes.value.data.data : [];
        setHotels(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_hotels', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setHotels([]);

      if (roomsRes.status === 'fulfilled') {
        const data = Array.isArray(roomsRes.value.data?.data) ? roomsRes.value.data.data : [];
        setRoomTypes(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_room_types', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setRoomTypes([]);

      if (cabsRes.status === 'fulfilled') {
        const data = Array.isArray(cabsRes.value.data?.data) ? cabsRes.value.data.data : [];
        setCabs(data.slice(0, featuredLimit));
        try { localStorage.setItem('vvs_cabs', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setCabs([]);

      if (toursRes.status === 'fulfilled') {
        const data = Array.isArray(toursRes.value.data?.data) ? toursRes.value.data.data : [];
        const active = data.filter((t: any) => t?.status === 'active').slice(0, featuredLimit);
        setTours(active);
        try { localStorage.setItem('vvs_tours', JSON.stringify(data)); } catch {
          // Local storage can fail in private mode or quota pressure.
        }
      } else setTours([]);
    };

    if (shopEnabled) void fetchProducts();
    void loadListings();

    const unsubListings = subscribeAppEvent('listing:changed', () => void loadListings());
    const unsubProducts = subscribeAppEvent('product:changed', () => {
      if (shopEnabled) void fetchProducts();
    });
    const onFocus = () => {
      void loadListings();
      if (shopEnabled) void fetchProducts();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      unsubListings();
      unsubProducts();
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchProducts, shopEnabled]);

  const getRoomPrice = (roomType: any) => {
    const base = Number(roomType?.pricePerNight || 0);
    const hotel = roomType?.hotel || {};
    if (!hotel?.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  const getHotelStartingPrice = (hotel: any) => {
    const prices = [
      hotel?.pricePerNight,
      hotel?.pricePerBed,
      hotel?.priceDoubleAC,
      hotel?.priceDoubleNonAC,
      hotel?.priceSingleAC,
      hotel?.priceSingleNonAC,
    ]
      .map((price) => Number(price || 0))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return undefined;
    const base = Math.min(...prices);
    if (!hotel?.taxEnabled) return base;
    const percent = Math.min(50, Math.max(0, Number(hotel?.taxPercent ?? 12)));
    return Math.round(base + (base * percent) / 100);
  };

  return (
    <div>

      {/* ===== HERO ===== */}
      <section className="relative flex items-center justify-center overflow-hidden pb-6 pt-20 sm:pb-8 lg:min-h-[560px] lg:pt-20 xl:min-h-[590px]">
        <img src={heroImg} alt="Vrindavan temples at sunset" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/45 to-brand-black/90" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="font-body text-[11px] sm:text-xs tracking-[0.24em] uppercase text-black mb-2"
          >
             Vrindavan, Mathura, UP 
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
            className="font-brand text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-black mb-2 leading-tight"
          >
            Vrindavan Sarthi
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="font-heading italic text-xl md:text-2xl text-white mb-2"
          >
            Trusted Hotel, Dharamshala & Room Booking in Vrindavan
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="font-body text-white text-xs md:text-sm tracking-wide mb-6"
          >
            Verified stays near temples, family rooms, AC rooms, and budget Dharamshalas in one simple platform
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/hotels" className="btn-gold px-6 py-3 rounded-xl text-sm font-semibold">
              Explore Now
            </Link>
            <a
              href={`https://wa.me/91${COMPANY_PHONE_DIGITS}`}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-lg text-sm font-body font-semibold border border-white/35 text-white hover:border-brand-gold hover:text-brand-gold transition-all inline-flex items-center gap-2"
            >
              <MessageCircle size={18} /> WhatsApp Now
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15 }}
            className="travel-search-panel mx-auto mt-5 max-w-4xl rounded-xl border border-white/18 bg-white/95 p-2.5 text-left shadow-2xl backdrop-blur-xl"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {visiblePlannerServices.map((item) => {
                const Icon = item.icon;
                const active = item.key === plannerService;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigatePlanner(item.key)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                      active
                        ? 'border-brand-gold bg-brand-gold/14 text-foreground shadow-sm'
                        : 'border-border bg-white hover:border-brand-gold/50 hover:bg-secondary/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-body text-xs font-bold">
                      <Icon size={14} className={active ? 'text-brand-saffron' : 'text-muted-foreground'} /> {item.label}
                    </span>
                    <span className="mt-0.5 block font-body text-[10px] leading-tight text-muted-foreground">{item.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1fr_auto]">
              <label className="relative block">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-saffron" size={16} />
                <input
                  value={plannerQuery}
                  onChange={(e) => setPlannerQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runPlannerSearch();
                  }}
                  placeholder="Search temple area, hotel, cab route, or tour..."
                  className="h-12 w-full rounded-lg border border-border bg-white pl-10 pr-3 font-body text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
                />
              </label>
              <button
                type="button"
                onClick={runPlannerSearch}
                className="btn-gold h-12 rounded-lg px-5 font-body text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <Search size={17} /> Search
              </button>
            </div>

            <div className="mt-2.5 flex justify-end border-t border-border/70 pt-2.5">
              <a href={`https://wa.me/91${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-bold text-brand-green hover:bg-brand-green/10">
                <MessageCircle size={14} /> WhatsApp support
              </a>
            </div>
          </motion.div>
        </div>
        <motion.div
          animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 md:block"
        >
          <ChevronDown className="text-brand-gold" size={28} />
        </motion.div>
      </section>

      {/* ===== STATS ===== */}
      <section className="bg-brand-black py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={stat.label} className={`text-center py-2 ${i !== stats.length - 1 ? 'md:border-r md:border-white/10' : ''}`}>
                <p className="font-heading text-3xl md:text-4xl font-bold text-brand-gold">{stat.value}</p>
                <p className="font-body text-sm text-white/60 mt-1 tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== JOURNEY CARDS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Travel Desk"
            title="Plan The Complete Vrindavan Journey"
            subtitle="Useful booking paths, verified information, and local support arranged around how travellers actually decide."
          />
          <div className={serviceGridClass}>
            {visibleServices.map((service) => (
              <Link
                key={service.title}
                to={service.link}
                className="travel-card group flex min-h-[170px] flex-col rounded-lg border border-border/70 p-4 text-left hover:border-brand-gold/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-saffron/12 group-hover:bg-brand-saffron/20 transition-colors">
                    <service.icon className="text-brand-saffron" size={22} />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 font-body text-[11px] font-bold text-muted-foreground">
                    Verified flow
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold leading-tight text-foreground">{service.title}</h3>
                <p className="mt-2 flex-1 font-body text-sm leading-relaxed text-muted-foreground">{service.desc}</p>
                <span className="mt-3 inline-flex items-center gap-2 font-body text-sm font-bold text-brand-crimson">
                  {service.cta} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED HOTELS ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/hotel-room.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-white/75" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle
            label="Featured Stays"
            title="Handpicked Hotels in Vrindavan"
            subtitle="Comfortable and affordable stays near the most sacred temples"
          />
          {hotels.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {hotels.map((hotel) => (
                  <ListingCard
                    key={hotel._id}
                    variant="hotel"
                    image={hotel.image}
                    images={hotel.images}
                    name={hotel.name}
                    location={hotel.location}
                    price={getHotelStartingPrice(hotel)}
                    priceLabel={hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                    rating={Number(hotel.rating || 0)}
                    reviewCount={Number(hotel.reviewCount || 0)}
                    amenities={hotel.amenities || []}
                    onViewDetails={() => {
                      prefetchDetail('hotels', hotel._id, hotel);
                      navigate(`/hotels/${hotel._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/hotels" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Hotels <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No hotels listed yet. Check back soon!</p>
              <Link to="/hotels" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Hotels <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED ROOMS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Room Options"
            title="Browse Rooms"
            subtitle="Choose comfortable room types from verified Vrindavan hotels"
          />
          {roomTypes.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {roomTypes.map((roomType) => (
                  <ListingCard
                    key={roomType._id}
                    image={roomType?.images?.[0] || roomType?.hotel?.image}
                    images={roomType?.images?.length ? roomType.images : roomType?.hotel?.images}
                    name={roomType.name}
                    location={`${roomType?.hotel?.name || ''}${roomType?.hotel?.location ? ` - ${roomType.hotel.location}` : ''}`}
                    price={getRoomPrice(roomType)}
                    priceLabel={roomType?.hotel?.taxEnabled ? '/night incl. GST' : '/night'}
                    rating={0}
                    reviewCount={0}
                    amenities={roomType?.amenities || roomType?.hotel?.amenities || []}
                    meta={Number(roomType?.totalCount || 0) > 0 ? `${roomType.totalCount} rooms` : undefined}
                    ctaLabel="Book Room"
                    onViewDetails={() => {
                      prefetchDetail('roomTypes', roomType._id, roomType);
                      navigate(`/room-types/${roomType._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/rooms" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Rooms <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No rooms listed yet. Check back soon!</p>
              <Link to="/rooms" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Rooms <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED CABS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Transportation"
            title="Available Cabs"
            subtitle="Reliable cabs listed by verified partners"
          />
          {cabs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cabs.map((cab) => (
                  <ListingCard
                    key={cab._id}
                    image={cab.image}
                    images={cab.images}
                    name={cab.vehicleName}
                    location={cab.routes?.join(' - ') || ''}
                    price={0}
                    priceLabel=""
                    rating={0}
                    reviewCount={0}
                    amenities={[cab.vehicleType, `${cab.capacity} Seater`]}
                    badge="30% Advance"
                    badgeColor="green"
                    onViewDetails={() => {
                      prefetchDetail('cabs', cab._id, cab);
                      navigate(`/cabs/${cab._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/cabs" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Cabs <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No cabs listed yet. Check back soon!</p>
              <Link to="/cabs" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Cabs <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED TOURS ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/parikrama.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-14" />
        <div className="absolute inset-0 bg-white/80" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle
            label="Spiritual Journeys"
            title="Popular Tour Packages"
            subtitle="Experience the divine essence of Vrindavan with our guided tours"
          />
          {tours.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tours.map((tour) => (
                  <ListingCard
                    key={tour._id}
                    image={tour.image}
                    images={tour.images}
                    name={tour.name}
                    location={tour.duration}
                    price={tour.pricePerPerson}
                    priceLabel="/person"
                    rating={0}
                    reviewCount={0}
                    badge={tour.duration}
                    amenities={tour.includes || []}
                    onViewDetails={() => {
                      prefetchDetail('tours', tour._id, tour);
                      navigate(`/tours/${tour._id}`);
                    }}
                  />
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/tours" className="btn-gold px-8 py-3.5 rounded-xl inline-flex items-center gap-2 text-[15px] font-semibold">
                  View All Tours <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-[14px] text-muted-foreground mb-4">No tours listed yet. Check back soon!</p>
              <Link to="/tours" className="btn-gold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
                Browse Tours <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ===== FEATURED PRODUCTS (Shop) ===== */}
      {featuredProducts.length > 0 && (
        <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
          <div className="container mx-auto px-4 relative">
            <SectionTitle
              label="Divine Shop"
              title="Sacred Souvenirs from Vrindavan"
              subtitle="Take a piece of Vrindavan's blessings home with you"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/shop/${p.id}`}
                  className="premium-surface overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 group"
                >
                  <div className="aspect-[4/3] overflow-hidden relative bg-white">
                    <img
                      src={p.images[0] || '/placeholder.svg'}
                      alt={p.name}
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-2 left-2 rounded-full border border-white/60 bg-white/95 px-2.5 py-1 font-body text-[10px] capitalize font-semibold text-foreground shadow-sm">
                      {p.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-[15px] font-bold text-foreground truncate">{p.name}</h3>
                    <p className="font-body text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-display text-[17px] font-extrabold text-brand-crimson">
                        Rs. {p.price.toLocaleString('en-IN')}
                      </span>
                      <span className="font-body text-[11px] text-brand-green font-semibold flex items-center gap-1">
                        <ShoppingBag size={12} /> Buy
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-4">
              <Link to="/shop" className="btn-gold px-8 py-3.5 rounded-lg inline-flex items-center gap-2 font-semibold text-[15px]">
                Visit Shop <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== WHY US ===== */}
      <section className="py-5 lg:py-7 relative overflow-hidden bg-royal-dark">
        <img src="/backgrounds/temple-interior.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-white/80" />
        <div className="container mx-auto px-4 relative">
          <SectionTitle label="Why Choose Us" title="Your Trusted Companion in Vrindavan" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyUs.map((item) => (
              <div
                key={item.title}
                className="text-center p-5 rounded-lg border border-border/50 bg-card/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/16 group-hover:scale-105 transition-all duration-200">
                  <item.icon className="text-primary" size={24} />
                </div>
                <h3 className="font-heading text-[17px] font-bold text-foreground mb-2">{item.title}</h3>
                <p className="font-body text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-5 lg:py-7 bg-royal-dark">
        <div className="container mx-auto px-4">
          <SectionTitle
            label="Testimonials"
            title="What Our Pilgrims Say"
            subtitle="Real experiences from real devotees"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard key={t.name} {...t} avatar="" />
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRUST STORY BANNER ===== */}
      <section className="relative overflow-hidden bg-background py-6 lg:py-8">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_hsl(222_42%_10%_/_0.08)]">
            <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
              <div className="relative min-h-[320px] overflow-hidden p-6 sm:p-8 lg:p-10">
                <img
                  src={heroImg}
                  alt="Vrindavan temple view"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-brand-black/76" />
                <div className="relative max-w-2xl">
                  <p className="mb-3 font-body text-[11px] font-bold uppercase tracking-[0.22em] text-brand-crimson">
                    Our Dream
                  </p>
                  <h2 className="mb-4 font-heading text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                    To make every Vrindavan visit feel guided, honest, and cared for.
                  </h2>
                  <p className="font-body text-[14px] leading-7 text-white sm:text-[15px]">
                    Vrindavan Sarthi Enterprises was created to bring hotels, rooms, cabs, tours{shopEnabled ? ', and sacred products' : ''} into one dependable place. Our motivation is simple: pilgrims should spend their energy on darshan, family, and devotion, not on confusion, hidden details, or last-minute uncertainty.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/about" className="btn-gold inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold">
                      Know Our Story <ArrowRight size={16} />
                    </Link>
                    <Link to="/contact" className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50 hover:text-brand-crimson">
                      Talk to Support <MessageCircle size={16} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-0 border-t border-border bg-white lg:border-l lg:border-t-0">
                {[
                  { icon: Shield, title: 'Verified Before Listing', desc: `Hotels, room types, cabs, tours${shopEnabled ? ', and products' : ''} are reviewed before customers rely on them.` },
                  { icon: Clock, title: 'Clear Booking Flow', desc: 'Dates, prices, payment status, invoices, and support details stay visible in a clean structure.' },
                  { icon: Users, title: 'Human Help When Needed', desc: 'For enquiry, booking support, order support, or payment help, users can reach the team directly.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 border-b border-border p-5 last:border-b-0 sm:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/12 text-brand-crimson">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-heading text-[16px] font-bold text-foreground">{item.title}</h3>
                      <p className="mt-1 font-body text-[13px] leading-6 text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid border-t border-border bg-muted/30 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Stays', value: 'Temple-side verified options' },
                { label: 'Rooms', value: 'Room inventory with availability' },
                { label: 'Cabs & Tours', value: 'Braj travel planning support' },
                ...(shopEnabled ? [{ label: 'Shop', value: 'Tracked devotional orders' }] : []),
              ].map((item) => (
                <div key={item.label} className="border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-brand-crimson">{item.label}</p>
                  <p className="mt-1 font-body text-[13px] font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;


