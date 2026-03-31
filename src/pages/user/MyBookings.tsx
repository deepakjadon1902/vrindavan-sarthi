import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const MyBookings = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="font-heading text-3xl font-semibold text-foreground mb-8">My Bookings</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto">
            {['All', 'Upcoming', 'Completed', 'Cancelled'].map((tab, i) => (
              <button
                key={tab}
                className={`px-4 py-2 rounded-lg font-body text-sm whitespace-nowrap transition-colors ${
                  i === 0 ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Empty State */}
          <div className="bg-card rounded-xl border border-border p-16 text-center">
            <ClipboardList size={64} className="mx-auto mb-6 text-muted-foreground/20" />
            <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">No Bookings Yet</h2>
            <p className="font-body text-muted-foreground mb-6">
              Start your sacred journey by booking a hotel, room, cab, or tour package.
            </p>
            <Link to="/hotels" className="btn-gold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2">
              Start Your Journey <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default MyBookings;
