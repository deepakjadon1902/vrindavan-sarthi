const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../frontend/src/pages/RoomTypeDetail.tsx');
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldState = `  if (loading && !roomType) {
    return (
      <div className="braj-page pt-20 pb-8 text-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!roomType || !hotel) {
    return (
      <div className="braj-page pt-20 pb-8 text-center min-h-screen">
        <p className="text-2xl text-muted-foreground">Room type not found</p>
        <Link to="/rooms" className="btn-crimson inline-block mt-4 px-6 py-2 rounded-lg text-sm">
          Back to Rooms
        </Link>
      </div>
    );
  }`;

const newState = `  if (loading && !roomType) {
    return (
      <div className="min-h-screen bg-[#fdfcf9] pt-20 sm:pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 animate-pulse space-y-6">
          <div className="h-6 w-32 rounded-lg bg-neutral-200" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-8">
            <div className="space-y-4">
              <div className="aspect-[16/10] w-full rounded-2xl bg-neutral-200" />
              <div className="h-8 w-2/3 rounded-lg bg-neutral-200" />
              <div className="h-4 w-1/2 rounded-lg bg-neutral-200" />
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
              <div className="h-6 w-1/3 rounded-lg bg-neutral-200" />
              <div className="h-10 w-full rounded-xl bg-neutral-200" />
              <div className="h-10 w-full rounded-xl bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!roomType || !hotel) {
    return (
      <div className="min-h-screen bg-[#fdfcf9] pt-24 pb-16 flex items-center justify-center px-4">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 text-center max-w-md mx-auto shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-4">
            <BedDouble size={28} />
          </div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Room Type Not Found</h2>
          <p className="font-body text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            This room configuration is either no longer available or was updated. Explore other verified stays across Vrindavan and Braj.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/rooms" className="btn-emerald rounded-full px-6 py-2.5 text-xs font-bold shadow-sm">
              Explore All Rooms
            </Link>
            <Link to="/hotels" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors">
              View Stays
            </Link>
          </div>
        </div>
      </div>
    );
  }`;

if (content.includes(oldState)) {
  content = content.replace(oldState, newState);
  fs.writeFileSync(file, content, 'utf8');
  console.log('RoomTypeDetail.tsx loading and empty states refined!');
} else {
  console.warn('Could not match oldState in RoomTypeDetail.tsx');
}
