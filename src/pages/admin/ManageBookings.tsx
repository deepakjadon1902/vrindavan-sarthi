import { ClipboardList } from 'lucide-react';

const ManageBookings = () => {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <p className="font-heading text-xl text-foreground mb-2">No Bookings Yet</p>
        <p className="font-body text-sm text-muted-foreground">
          Bookings will appear here when users make reservations through the platform.
        </p>
      </div>
    </div>
  );
};

export default ManageBookings;
