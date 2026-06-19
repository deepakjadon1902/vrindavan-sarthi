import type { Booking } from '@/store/bookingStore';

type Props = {
  booking: Booking;
  viewer?: 'admin' | 'partner' | 'user';
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const formatMoney = (value?: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

const Field = ({ label, value }: { label: string; value?: string | number | boolean | null }) => (
  <div>
    <span className="block text-[11px] text-muted-foreground">{label}</span>
    <span className="font-body text-xs font-medium text-foreground break-words">
      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || '-'}
    </span>
  </div>
);

const maskEmail = (value?: string) => {
  if (!value) return '-';
  const [name, domain] = value.split('@');
  if (!domain) return 'Hidden';
  return `${name.slice(0, 2)}***@${domain}`;
};

const BookingFormDetails = ({ booking, viewer = 'admin' }: Props) => {
  const canShowEmail = viewer !== 'partner' || booking.bookingStatus === 'confirmed';
  const guestDetails = booking.guestDetails || [];

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border bg-background/70 p-4">
        <p className="font-body text-xs font-semibold text-foreground mb-3">Guest Identity Profile</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Customer name" value={booking.customerFullName || booking.userName} />
          <Field label="Mobile" value={booking.customerMobile || booking.userPhone} />
          <Field label="Email" value={canShowEmail ? maskEmail(booking.customerEmail || booking.userEmail) : 'Hidden'} />
          <Field label="Total guests" value={booking.guests} />
          <Field label="Pet" value={booking.hasPet} />
        </div>

        {guestDetails.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="font-body text-xs font-semibold text-foreground mb-2">Passenger details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {guestDetails.map((g, idx) => (
                <div key={`${g.type}-${idx}`} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="font-body text-xs font-medium text-foreground">{g.name}</p>
                  <p className="font-body text-[11px] text-muted-foreground capitalize">
                    {g.type} | Age {g.age}{g.gender ? ` | ${g.gender}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background/70 p-4">
        <p className="font-body text-xs font-semibold text-foreground mb-3">Itinerary Parameters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Check-in" value={formatDate(booking.checkIn)} />
          <Field label="Check-out" value={formatDate(booking.checkOut)} />
          <Field label="Room designation" value={booking.roomNumber} />
          <Field label="Waitlisted" value={booking.isWaitlisted} />
          <Field label="Transport mode" value={booking.arrivalMode?.replace('_', ' ')} />
          <Field label="Vehicle no." value={booking.vehicleNumber} />
          <Field label="Arrival timestamp" value={booking.arrivalTime} />
          <Field label="Adults / Children" value={`${booking.totalAdults || 0} / ${booking.totalChildren || 0}`} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/70 p-4">
        <p className="font-body text-xs font-semibold text-foreground mb-3">Isolated Financial Ledger Breakdown</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Base Amount" value={formatMoney(booking.baseAmount || 0)} />
          <Field label={`Dynamic GST${booking.taxPercent ? ` (${booking.taxPercent}%)` : ''}`} value={formatMoney(booking.taxAmount || 0)} />
          <Field label="Dynamic Convenience Fee (2%)" value={formatMoney(booking.convenienceFeeAmount || 0)} />
          <Field label="Net Checkout Grand Total" value={formatMoney(booking.totalAmount)} />
          <Field label="Online Advance Collection Status" value={`${booking.paymentStatus} | ${formatMoney(booking.advanceAmount || 0)}`} />
          <Field label="Residual Cash Balance Collector" value={formatMoney(booking.balanceAmount || 0)} />
          <Field label="Payment option" value={booking.paymentOption === 'full_100' ? '100% full online' : '30% advance online'} />
          <Field label="UPI transaction" value={booking.upiTransactionId} />
        </div>
      </div>

      {viewer === 'partner' && (
        <div className="rounded-lg border border-brand-gold/20 bg-brand-cream/60 p-4">
          <p className="font-body text-xs font-semibold text-foreground mb-3">Partner payout breakdown</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Price" value={formatMoney(booking.checkoutSubtotal || booking.totalAmount)} />
            <Field label={`Vrindavan Sarthi Commission (${booking.platformCommissionPercent || 0}%)`} value={`- ${formatMoney(booking.platformCommissionAmount || 0)}`} />
            <Field label="Net Payout" value={formatMoney(booking.partnerNetPayout ?? Math.max(0, (booking.checkoutSubtotal || booking.totalAmount) - (booking.platformCommissionAmount || 0)))} />
          </div>
        </div>
      )}

      {booking.bookingType === 'cab' && (
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <p className="font-body text-xs font-semibold text-foreground mb-3">Cab parameters</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Pickup" value={booking.pickupLocation} />
            <Field label="Drop" value={booking.dropLocation} />
            <Field label="Pickup date" value={booking.pickupDate} />
            <Field label="Pickup time" value={booking.pickupTime} />
            <Field label="Cab type" value={booking.cabType} />
            <Field label="Tolls" value={booking.tollOption} />
            <Field label="Cab fare" value={booking.cabFareTotal ? formatMoney(booking.cabFareTotal) : undefined} />
          </div>
        </div>
      )}

      {booking.additionalInfo && (
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <Field label="Additional info" value={booking.additionalInfo} />
        </div>
      )}
    </div>
  );
};

export default BookingFormDetails;
