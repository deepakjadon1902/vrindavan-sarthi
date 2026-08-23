import type { Booking } from '@/store/bookingStore';
import { PropertyTermsPreview } from '@/components/shared/PropertyTerms';

type Props = {
  booking: Booking;
  viewer?: 'admin' | 'partner' | 'user';
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const formatMoney = (value?: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

const Field = ({ label, value, valueClass = 'text-foreground' }: { label: string; value?: string | number | boolean | null; valueClass?: string }) => (
  <div>
    <span className="block text-[11px] text-muted-foreground">{label}</span>
    <span className={`font-body text-xs font-medium break-words ${valueClass}`}>
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
  const isHotelMarketplace =
    booking.service_billing_model === 'hotel_marketplace' ||
    ['hotel', 'room', 'room_type'].includes(booking.bookingType);
  const baseAmount = Number(booking.baseAmount || 0);
  const hotelGst = Number(booking.taxAmount || 0);
  const grossForHotel = Number(booking.grossForHotel ?? (baseAmount + hotelGst));
  const commissionRate = Number(booking.platformCommissionPercent || 0);
  const commissionAmount = Math.round((baseAmount * commissionRate) / 100);
  const gatewayFee = Number(booking.paymentGatewayFeeAmount || Math.round((baseAmount * 2) / 100));
  const netPayout = Math.max(0, grossForHotel - commissionAmount - gatewayFee);
  const acceptedTerms = booking.acceptedPropertyTerms;

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

      {booking.checkedInAt && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="font-body text-xs font-semibold text-blue-900 mb-3">Digital Check-In Audit</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Checked In" value={new Date(booking.checkedInAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} valueClass="text-blue-900" />
            <Field label="Guest Signature" value={booking.guestDigitalSignature} valueClass="text-blue-900" />
            <Field label="Marked By" value={booking.checkedInByPartnerName} valueClass="text-blue-900" />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background/70 p-4">
        <p className="font-body text-xs font-semibold text-foreground mb-3">Itinerary Parameters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Check-in" value={formatDate(booking.checkIn)} />
          <Field label="Check-out" value={formatDate(booking.checkOut)} />
          <Field label="Rooms booked" value={booking.roomQuantity || (booking.roomNumbers?.length || undefined)} />
          <Field label="Room number" value={booking.roomNumbers?.length ? booking.roomNumbers.join(', ') : booking.roomNumber} />
          <Field label="Vehicle number" value={booking.vehicleNumber} />
          <Field label="Arrival time" value={booking.arrivalTime} />
          <Field label="Guest count" value={booking.guests || `${booking.totalAdults || 0} / ${booking.totalChildren || 0}`} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/70 p-4">
        <p className="font-body text-xs font-semibold text-foreground mb-3">
          {isHotelMarketplace ? 'Booking Financial Summary' : 'Tax Invoice Payment Summary'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Base Amount" value={formatMoney(baseAmount)} />
          <Field label={isHotelMarketplace ? `Hotel Taxes${booking.taxPercent ? ` (${booking.taxPercent}%)` : ''}` : `GST${booking.taxPercent ? ` (${booking.taxPercent}%)` : ''}`} value={formatMoney(hotelGst)} />
          <Field label={isHotelMarketplace ? 'Platform Convenience Fee' : 'Convenience Fee'} value={formatMoney(booking.convenienceFeeAmount || 0)} />
          <Field label={isHotelMarketplace ? 'Customer Grand Total' : 'Grand Total'} value={formatMoney(booking.totalAmount)} />
          <Field label={isHotelMarketplace ? 'Online Advance Received' : 'Advance Paid'} value={formatMoney(booking.advanceAmount || 0)} />
          <Field label={isHotelMarketplace ? 'Balance to Collect at Property' : 'Balance Payable'} value={formatMoney(booking.balanceAmount || 0)} />
          <Field label="Payment option" value={booking.paymentOption === 'full_100' ? '100% full online' : '30% advance online'} />
          <Field label="UPI transaction" value={booking.upiTransactionId} />
        </div>
        {isHotelMarketplace && (
          <p className="mt-3 rounded-md border border-brand-gold/25 bg-brand-cream/60 px-3 py-2 font-body text-[11px] leading-relaxed text-muted-foreground">
            Booking Confirmation only. The hotel/property partner is responsible for accommodation tax invoice and applicable GST filing.
          </p>
        )}
      </div>

      {viewer === 'partner' && (
        <div className="rounded-lg border border-brand-gold/20 bg-brand-cream/60 p-4">
          <p className="font-body text-xs font-semibold text-foreground mb-3">Partner Settlement Summary</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Gross Booking Value (Room + Hotel Taxes)" value={formatMoney(grossForHotel)} valueClass="text-foreground" />
            <Field label={`OTA Commission (${commissionRate}% of ${formatMoney(baseAmount)})`} value={`- ${formatMoney(commissionAmount)}`} valueClass="text-destructive" />
            <Field label="Payment Gateway Fee" value={`- ${formatMoney(gatewayFee)}`} valueClass="text-destructive" />
            <Field label="Net Payout to Hotel" value={formatMoney(netPayout)} valueClass="text-brand-green" />
          </div>
          <p className="mt-3 font-body text-[11px] text-muted-foreground">Platform convenience fee is not included in hotel payout.</p>
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
            <Field label="Cab fare" value={booking.cabFareTotal ? formatMoney(booking.cabFareTotal) : undefined} />
          </div>
        </div>
      )}

      {acceptedTerms?.accepted && (
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-xs font-semibold text-foreground">Accepted Property Terms Snapshot</p>
            <span className="font-body text-[11px] text-muted-foreground">
              v{acceptedTerms.version || 1} accepted {acceptedTerms.acceptedAt ? new Date(acceptedTerms.acceptedAt).toLocaleString('en-IN') : '-'}
            </span>
          </div>
          <PropertyTermsPreview
            terms={{
              currentVersion: acceptedTerms.version || 1,
              isActive: true,
              sections: acceptedTerms.sections || {},
            }}
          />
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

