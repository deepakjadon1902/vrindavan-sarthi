import type { Booking } from '@/store/bookingStore';

type Props = {
  booking: Booking;
  viewer?: 'admin' | 'partner' | 'user';
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const formatMoney = (value?: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const Field = ({ label, value }: { label: string; value?: string | number | boolean | null }) => (
  <div>
    <span className="block text-[11px] text-muted-foreground">{label}</span>
    <span className="font-body text-xs font-medium text-foreground break-words">
      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || '-'}
    </span>
  </div>
);

const BookingFormDetails = ({ booking, viewer = 'admin' }: Props) => {
  const canShowEmail = viewer !== 'partner' || booking.bookingStatus === 'confirmed';
  const guestDetails = booking.guestDetails || [];

  return (
    <div className="mt-4 rounded-lg border border-border bg-background/70 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Customer name" value={booking.customerFullName || booking.userName} />
        <Field label="Mobile" value={booking.customerMobile || booking.userPhone} />
        <Field label="Email" value={canShowEmail ? booking.customerEmail || booking.userEmail : 'Hidden'} />
        <Field label="Guests" value={booking.guests} />
        <Field label="Check-in" value={formatDate(booking.checkIn)} />
        <Field label="Check-out" value={formatDate(booking.checkOut)} />
        <Field label="Room no." value={booking.roomNumber} />
        <Field label="Waitlisted" value={booking.isWaitlisted} />
        <Field label="Arrival mode" value={booking.arrivalMode?.replace('_', ' ')} />
        <Field label="Vehicle no." value={booking.vehicleNumber} />
        <Field label="Arrival time" value={booking.arrivalTime} />
        <Field label="Pet" value={booking.hasPet} />
        <Field label="Adults" value={booking.totalAdults} />
        <Field label="Children" value={booking.totalChildren} />
        <Field label="Base amount" value={booking.baseAmount ? formatMoney(booking.baseAmount) : undefined} />
        <Field label={`GST${booking.taxPercent ? ` (${booking.taxPercent}%)` : ''}`} value={booking.taxAmount ? formatMoney(booking.taxAmount) : undefined} />
        <Field label="Subtotal" value={booking.checkoutSubtotal ? formatMoney(booking.checkoutSubtotal) : undefined} />
        <Field label="Convenience fee (2%)" value={booking.convenienceFeeAmount ? formatMoney(booking.convenienceFeeAmount) : undefined} />
        <Field label="Total" value={formatMoney(booking.totalAmount)} />
        <Field label="Advance" value={booking.advanceAmount ? formatMoney(booking.advanceAmount) : undefined} />
        <Field label="Balance" value={booking.balanceAmount ? formatMoney(booking.balanceAmount) : undefined} />
        <Field label="Payment option" value={booking.paymentOption === 'full_100' ? '100% full online' : '30% advance online'} />
        <Field label="UPI transaction" value={booking.upiTransactionId} />
      </div>

      {viewer === 'partner' && (
        <div className="mt-4 rounded-lg border border-brand-gold/20 bg-brand-cream/60 p-4">
          <p className="font-body text-xs font-semibold text-foreground mb-3">Partner payout breakdown</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Price" value={formatMoney(booking.checkoutSubtotal || booking.totalAmount)} />
            <Field label={`Vrindavan Sarthi Commission (${booking.platformCommissionPercent || 0}%)`} value={`- ${formatMoney(booking.platformCommissionAmount || 0)}`} />
            <Field label="Net Payout" value={formatMoney(booking.partnerNetPayout ?? Math.max(0, (booking.checkoutSubtotal || booking.totalAmount) - (booking.platformCommissionAmount || 0)))} />
          </div>
        </div>
      )}

      {booking.bookingType === 'cab' && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border pt-4">
          <Field label="Pickup" value={booking.pickupLocation} />
          <Field label="Drop" value={booking.dropLocation} />
          <Field label="Pickup date" value={booking.pickupDate} />
          <Field label="Pickup time" value={booking.pickupTime} />
          <Field label="Cab type" value={booking.cabType} />
          <Field label="Tolls" value={booking.tollOption} />
          <Field label="Cab fare" value={booking.cabFareTotal ? formatMoney(booking.cabFareTotal) : undefined} />
        </div>
      )}

      {guestDetails.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="font-body text-xs font-semibold text-foreground mb-2">Guest details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {guestDetails.map((g, idx) => (
              <div key={`${g.type}-${idx}`} className="rounded-md border border-border bg-card px-3 py-2">
                <p className="font-body text-xs font-medium text-foreground">{g.name}</p>
                <p className="font-body text-[11px] text-muted-foreground capitalize">
                  {g.type} • Age {g.age}{g.gender ? ` • ${g.gender}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {booking.additionalInfo && (
        <div className="mt-4 border-t border-border pt-4">
          <Field label="Additional info" value={booking.additionalInfo} />
        </div>
      )}
    </div>
  );
};

export default BookingFormDetails;
