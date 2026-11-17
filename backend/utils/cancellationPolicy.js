/**
 * Vrindavan Sarthi - Cancellation, No-Show, and Refund Policy Utilities
 * Implements owner-approved business rules for:
 * 1. 100% Online Booking Cancellation (Tiered refund based on scheduled check-in)
 * 2. 100% Online Prepaid No-Show (Grace period verification and hotel net entitlement)
 * 3. Exact boundary behavior (>48h: 75%, 24h-48h: 50%, <24h: 0%)
 */

const DEFAULT_CHECK_IN_TIME = '12:00';
const DEFAULT_NO_SHOW_GRACE_PERIOD_HOURS = 6;

/**
 * Extracts and returns the scheduled property check-in datetime in India Standard Time (UTC+05:30).
 * Handles both Date objects and ISO strings.
 */
const getScheduledCheckInDateTime = (booking, hotel = null) => {
  if (!booking?.checkIn) {
    throw new Error('Booking has no valid checkIn date');
  }

  const checkInDate = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
  if (isNaN(checkInDate.getTime())) {
    throw new Error('Invalid booking checkIn date');
  }

  const year = checkInDate.getUTCFullYear();
  const month = String(checkInDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(checkInDate.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let rawTime = String(booking.checkInTime || hotel?.checkInTime || DEFAULT_CHECK_IN_TIME).trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  const normalizedTime = match
    ? `${match[1].padStart(2, '0')}:${match[2]}`
    : DEFAULT_CHECK_IN_TIME;

  // Braj region properties operate in India Standard Time (UTC+05:30)
  return new Date(`${dateStr}T${normalizedTime}:00+05:30`);
};

/**
 * Calculates hours remaining between cancellation time and scheduled check-in.
 */
const calculateHoursUntilCheckIn = ({ booking, cancellationTime = new Date(), hotel = null }) => {
  const scheduledCheckIn = getScheduledCheckInDateTime(booking, hotel);
  const cancelDate = cancellationTime instanceof Date ? cancellationTime : new Date(cancellationTime);
  const diffMs = scheduledCheckIn.getTime() - cancelDate.getTime();
  const hours = diffMs / (1000 * 60 * 60);

  return {
    scheduledCheckIn,
    cancellationTime: cancelDate,
    diffMs,
    hours,
  };
};

/**
 * Calculates cancellation refund and deduction based on owner-approved business rules:
 * - Property/platform failure: 100% refund of captured online amount (0% deduction)
 * - 30% advance booking customer cancellation: 0% refund (100% deduction of advance)
 * - 100% full online booking customer cancellation:
 *     > 48 hours before check-in: 75% refund (25% deduction)
 *     24 hours up to and including 48 hours (24 <= h <= 48): 50% refund (50% deduction)
 *     < 24 hours before check-in: 0% refund (100% deduction)
 *
 * Exact boundary handling:
 *   h = 48.000 -> 50% refund
 *   h = 24.000 -> 50% refund
 *   h = 48.001 -> 75% refund
 *   h = 23.999 -> 0% refund
 */
const calculateCancellationRefund = ({
  booking,
  cancellationTime = new Date(),
  isPropertyOrPlatformFailure = false,
  hotel = null,
}) => {
  const paidOnline = Math.max(
    0,
    Math.round(
      Number(
        booking.amountPaidOnline ||
        booking.advanceAmount ||
        (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
      )
    )
  );

  const { scheduledCheckIn, cancellationTime: cancelDate, hours } = calculateHoursUntilCheckIn({
    booking,
    cancellationTime,
    hotel,
  });

  let refundPercent = 0;
  let cancellationDeductionPercent = 100;
  let policyTier = 'less_than_24h';

  if (isPropertyOrPlatformFailure) {
    refundPercent = 100;
    cancellationDeductionPercent = 0;
    policyTier = 'platform_or_property_failure';
  } else if (booking.paymentOption === 'advance_30') {
    refundPercent = 0;
    cancellationDeductionPercent = 100;
    policyTier = 'advance_30_non_refundable';
  } else {
    // 100% online booking tiered policy
    if (hours > 48) {
      refundPercent = 75;
      cancellationDeductionPercent = 25;
      policyTier = 'more_than_48h';
    } else if (hours >= 24 && hours <= 48) {
      // Exactly 48h and exactly 24h are in the 50% refund tier
      refundPercent = 50;
      cancellationDeductionPercent = 50;
      policyTier = 'between_24h_and_48h';
    } else {
      refundPercent = 0;
      cancellationDeductionPercent = 100;
      policyTier = 'less_than_24h';
    }
  }

  const rawRefundable = Math.round((paidOnline * refundPercent) / 100);
  const refundableAmount = Math.max(0, Math.min(paidOnline, rawRefundable));
  const cancellationDeductionAmount = Math.max(0, paidOnline - refundableAmount);

  return {
    paidOnline,
    refundableAmount,
    cancellationDeductionAmount,
    cancellationDeductionPercent,
    refundPercent,
    policyTier,
    scheduledCheckIn,
    cancellationTime: cancelDate,
    hoursBeforeCheckIn: hours,
  };
};

/**
 * Checks whether a booking is eligible to be marked as no-show.
 * Enforces the rule that a customer cannot be marked no-show until
 * scheduled check-in time + grace period has expired.
 */
const evaluateNoShowEligibility = ({
  booking,
  currentTime = new Date(),
  gracePeriodHours = DEFAULT_NO_SHOW_GRACE_PERIOD_HOURS,
  hotel = null,
}) => {
  const scheduledCheckIn = getScheduledCheckInDateTime(booking, hotel);
  const graceMs = Number(gracePeriodHours) * 60 * 60 * 1000;
  const deadline = new Date(scheduledCheckIn.getTime() + graceMs);
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);

  const isGracePeriodActive = now.getTime() < deadline.getTime();

  return {
    scheduledCheckIn,
    gracePeriodHours: Number(gracePeriodHours),
    noShowDeadline: deadline,
    currentTime: now,
    isGracePeriodActive,
  };
};

/**
 * Calculates no-show financial reconciliation:
 * - Customer receives 0% refund of captured online amount
 * - Hotel is entitled to room tariff minus platform commission
 * - Vrindavan Sarthi platform bears the gateway processing fee
 * - Unpaid balances for 30% advance are never auto-charged
 */
const calculateNoShowSettlement = ({ booking }) => {
  const paidOnline = Math.max(
    0,
    Math.round(
      Number(
        booking.amountPaidOnline ||
        booking.advanceAmount ||
        (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
      )
    )
  );

  const grossForHotel = Math.max(
    0,
    Math.round(Number(booking.grossForHotel || booking.baseAmount || 0))
  );
  const platformCommissionAmount = Math.max(
    0,
    Math.round(Number(booking.platformCommissionAmount || 0))
  );

  // Platform bears the gateway fee; partner payout never deducts it
  const hotelNetPayout = Math.max(0, grossForHotel - platformCommissionAmount);

  return {
    refundableAmount: 0,
    cancellationDeductionAmount: paidOnline,
    cancellationDeductionPercent: 100,
    refundPercent: 0,
    grossForHotel,
    platformCommissionAmount,
    hotelNetPayout,
    payout_status: 'checked_out',
  };
};

module.exports = {
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_NO_SHOW_GRACE_PERIOD_HOURS,
  getScheduledCheckInDateTime,
  calculateHoursUntilCheckIn,
  calculateCancellationRefund,
  evaluateNoShowEligibility,
  calculateNoShowSettlement,
};
