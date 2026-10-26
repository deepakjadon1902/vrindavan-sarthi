const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// 1. Refine Cabs.tsx
const cabsPath = path.join(repoRoot, 'frontend/src/pages/Cabs.tsx');
let cabsContent = fs.readFileSync(cabsPath, 'utf8');

// Replace top banner section with a sleek, compact sticky filter bar
const oldCabsTop = `      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle
            label="Transportation"
            title="Cabs"
            subtitle="Route, date, time. Fare confirmed before payment."
          />
          <div className="premium-toolbar mx-auto max-w-xl p-2">
            <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search cabs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="premium-field w-full pl-12 pr-4"
            />
            </div>
          </div>
        </div>
      </section>

      <section className="py-3">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="grid gap-3 rounded-lg border border-brand-gold/30 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">Need a cab now?</p>
              <p className="font-body text-sm text-muted-foreground">Send route and time. Pay after confirmation.</p>
            </div>
            <a
              href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent('Radhe Radhe, I want to book a cab with Vrindavan Sarthi.')}\`}
              target="_blank"
              rel="noreferrer"
              className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              <MessageCircle size={16} /> Confirm on WhatsApp
            </a>
            <a
              href={\`tel:\${phoneDigits}\`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50"
            >
              <Phone size={16} /> Call Travel Desk
            </a>
          </div>
        </div>
      </section>

      <section className="py-4 lg:py-5">`;

const newCabsTop = `      {/* Sticky Compact Search & Filter Bar */}
      <section className="sticky top-16 sm:top-20 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search cab by vehicle, route, or city..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  const p = new URLSearchParams(searchParams);
                  if (e.target.value.trim()) p.set('q', e.target.value);
                  else p.delete('q');
                  setSearchParams(p, { replace: true });
                }}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 pl-10 pr-4 py-2 font-body text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent('Radhe Radhe, I want to book a cab with Vrindavan Sarthi.')}\`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 font-body text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <MessageCircle size={14} className="text-emerald-700" />
                <span>24/7 WhatsApp Booking</span>
              </a>
              <a
                href={\`tel:\${phoneDigits}\`}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                <Phone size={13} className="text-slate-500" />
                <span>Travel Desk</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Verified Pilgrimage Cabs & Taxis
            </h1>
            <p className="font-body text-xs sm:text-[13px] font-medium text-slate-500 mt-0.5">
              Fixed route fares, inspected AC vehicles, and courteous drivers across Vrindavan, Mathura, and Braj Mandal.
            </p>
          </div>
          <span className="font-body text-xs font-semibold text-slate-500 self-start sm:self-auto">
            Showing {filtered.length} {filtered.length === 1 ? 'cab option' : 'cab options'}
          </span>
        </div>`;

// Normalize line endings for replacement
const normCabs = cabsContent.replace(/\r\n/g, '\n');
const normOldCabsTop = oldCabsTop.replace(/\r\n/g, '\n');

if (normCabs.includes(normOldCabsTop)) {
  cabsContent = normCabs.replace(normOldCabsTop, newCabsTop);
  // Also close main instead of section
  cabsContent = cabsContent.replace('      </section>\n    </div>', '      </main>\n    </div>');
  fs.writeFileSync(cabsPath, cabsContent, 'utf8');
  console.log('Cabs.tsx successfully refined to compact Airbnb layout!');
} else {
  console.warn('Could not match oldCabsTop in Cabs.tsx');
}

// 2. Refine CabDetail.tsx
const cabDetailPath = path.join(repoRoot, 'frontend/src/pages/CabDetail.tsx');
let cabDetailContent = fs.readFileSync(cabDetailPath, 'utf8').replace(/\r\n/g, '\n');

// Add mobile sticky bar before the closing tag of CabDetail
const mobileStickyCab = `        {/* Mobile Sticky Booking Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[11px] text-neutral-500 font-medium">Estimated Fare</p>
            <p className="font-body text-base font-bold text-slate-900">
              {typeof fare === 'number' ? \`₹\${checkoutTotal.toLocaleString('en-IN')}\` : 'On Confirmation'}
            </p>
          </div>
          <a
            href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent(whatsappMessage)}\`}
            target="_blank"
            rel="noreferrer"
            className="btn-emerald inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm"
          >
            <MessageCircle size={15} /> Confirm on WhatsApp
          </a>
        </div>
      </div>
    </div>`;

if (!cabDetailContent.includes('Mobile Sticky Booking Bar')) {
  cabDetailContent = cabDetailContent.replace('      </div>\n    </div>\n  );\n};', `${mobileStickyCab}\n  );\n};`);
  fs.writeFileSync(cabDetailPath, cabDetailContent, 'utf8');
  console.log('CabDetail.tsx successfully refined with mobile sticky bar!');
}

// 3. Refine Tours.tsx
const toursPath = path.join(repoRoot, 'frontend/src/pages/Tours.tsx');
let toursContent = fs.readFileSync(toursPath, 'utf8').replace(/\r\n/g, '\n');

const oldToursTop = `      <section className="section-cream py-4 lg:py-5">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle label="Tours" title="Tour Packages" subtitle="Date, group size, plan, then payment." />
          <div className="premium-toolbar mx-auto grid max-w-5xl gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <input type="text" placeholder="Search tours" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="premium-field h-11 w-full pl-10 pr-3" />
            </div>
            <label className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Destination</option>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Budget</option>
                <option value="1500">Up to Rs. 1,500</option>
                <option value="2500">Up to Rs. 2,500</option>
                <option value="2501">Above Rs. 2,500</option>
              </select>
            </label>
            <label className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={cabType} onChange={(e) => setCabType(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Cab Type</option>
                {cabTypes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="premium-field h-11 w-full pl-9 pr-3">
                <option value="all">Duration</option>
                <option value="1">1 Day</option>
                <option value="2">2 Days</option>
                <option value="3">3 Days</option>
              </select>
            </label>
          </div>
        </div>
      </section>
      <section className="py-3">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="grid gap-3 rounded-lg border border-brand-gold/30 bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">Plan your tour in one step</p>
              <p className="font-body text-sm text-muted-foreground">Share date and group size. Confirm the plan before payment.</p>
            </div>
            <a
              href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent('Radhe Radhe, I want to book a tour package with Vrindavan Sarthi.')}\`}
              target="_blank"
              rel="noreferrer"
              className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              <MessageCircle size={16} /> Confirm on WhatsApp
            </a>
            <a
              href={\`tel:\${phoneDigits}\`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 font-body text-sm font-semibold text-foreground hover:border-brand-gold/50"
            >
              <Phone size={16} /> Call Tour Desk
            </a>
          </div>
        </div>
      </section>
      <section className="py-4 lg:py-5">`;

const newToursTop = `      {/* Sticky Compact Search & Filter Bar */}
      <section className="sticky top-16 sm:top-20 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-center">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search yatra packages, places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 pl-9 pr-3 py-1.5 font-body text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all"
              />
            </div>
            <div>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 px-3 py-1.5 font-body text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
              >
                <option value="all">All Destinations</option>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 px-3 py-1.5 font-body text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
              >
                <option value="all">All Durations</option>
                <option value="1">1 Day</option>
                <option value="2">2 Days</option>
                <option value="3">3 Days</option>
              </select>
            </div>
            <div>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-full border border-neutral-300 bg-neutral-50/80 px-3 py-1.5 font-body text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
              >
                <option value="all">All Budgets</option>
                <option value="1500">Up to ₹1,500</option>
                <option value="2500">Up to ₹2,500</option>
                <option value="2501">Above ₹2,500</option>
              </select>
            </div>
            <div>
              <a
                href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent('Radhe Radhe, I want to book a tour package with Vrindavan Sarthi.')}\`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-body text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs whitespace-nowrap"
              >
                <MessageCircle size={13} className="text-emerald-700 shrink-0" />
                <span>WhatsApp Tour Desk</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Guided Braj Darshan & Yatra Packages
            </h1>
            <p className="font-body text-xs sm:text-[13px] font-medium text-slate-500 mt-0.5">
              Curated spiritual itineraries with verified private vehicles, coordinators, and temple assistance.
            </p>
          </div>
          <span className="font-body text-xs font-semibold text-slate-500 self-start sm:self-auto">
            Showing {filtered.length} {filtered.length === 1 ? 'yatra package' : 'yatra packages'}
          </span>
        </div>`;

if (toursContent.includes(oldToursTop)) {
  toursContent = toursContent.replace(oldToursTop, newToursTop);
  toursContent = toursContent.replace('      </section>\n    </div>', '      </main>\n    </div>');
  fs.writeFileSync(toursPath, toursContent, 'utf8');
  console.log('Tours.tsx successfully refined to compact Airbnb layout!');
} else {
  console.warn('Could not match oldToursTop in Tours.tsx');
}

// 4. Refine TourDetail.tsx
const tourDetailPath = path.join(repoRoot, 'frontend/src/pages/TourDetail.tsx');
let tourDetailContent = fs.readFileSync(tourDetailPath, 'utf8').replace(/\r\n/g, '\n');

const mobileStickyTour = `        {/* Mobile Sticky Booking Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[11px] text-neutral-500 font-medium">Estimated Total ({persons} {persons === 1 ? 'Guest' : 'Guests'})</p>
            <p className="font-body text-base font-bold text-slate-900">
              {total > 0 ? \`₹\${total.toLocaleString('en-IN')}\` : 'On Confirmation'}
            </p>
          </div>
          <a
            href={\`https://wa.me/\${whatsappDigits}?text=\${encodeURIComponent(whatsappMessage)}\`}
            target="_blank"
            rel="noreferrer"
            className="btn-emerald inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm"
          >
            <MessageCircle size={15} /> Confirm on WhatsApp
          </a>
        </div>
      </div>
    </div>`;

if (!tourDetailContent.includes('Mobile Sticky Booking Bar')) {
  tourDetailContent = tourDetailContent.replace('      </div>\n    </div>\n  );\n};', `${mobileStickyTour}\n  );\n};`);
  fs.writeFileSync(tourDetailPath, tourDetailContent, 'utf8');
  console.log('TourDetail.tsx successfully refined with mobile sticky bar!');
}

console.log('All Airbnb refinements applied successfully!');
