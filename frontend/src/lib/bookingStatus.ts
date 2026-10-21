export const bookingStatusLabels: Record<string, string> = {
  awaiting_customer_payment: 'Awaiting customer payment',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  completed: 'Completed',
  confirmed: 'Booking Confirmed',
  expired: 'Expired',
  expired_property_no_response: 'Expired - no property response',
  no_show: 'No-show',
  payment_failed: 'Payment failed',
  pending: 'Pending payment',
  pending_property_confirmation: 'Property confirmation pending',
  rejected_by_property: 'Rejected by property',
  settled: 'Settled',
  cancelled: 'Cancelled',
};

export const formatBookingStatus = (status?: string) => {
  const key = String(status || '').trim();
  if (!key) return '-';
  return bookingStatusLabels[key] || key.replace(/_/g, ' ');
};

export const bookingStatusFilterLabels: Record<string, string> = {
  all: 'All',
  awaiting_customer_payment: 'Awaiting payment',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  completed: 'Completed',
  confirmed: 'Confirmed',
  expired: 'Expired',
  expired_property_no_response: 'No response',
  payment_failed: 'Payment failed',
  pending: 'Pending',
  pending_property_confirmation: 'Property review',
  rejected_by_property: 'Rejected',
  settled: 'Settled',
  cancelled: 'Cancelled',
};

export const formatBookingStatusFilter = (status: string) =>
  bookingStatusFilterLabels[status] || formatBookingStatus(status);

export type AuthoritativeStateCode =
  | 'pending_property_confirmation'
  | 'awaiting_customer_payment'
  | 'payment_verifying'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'completed'
  | 'settled'
  | 'payment_failed'
  | 'expired'
  | 'expired_property_no_response'
  | 'rejected_by_property'
  | 'cancelled'
  | 'reconciliation_required';

export interface AuthoritativeBookingDisplay {
  code: AuthoritativeStateCode;
  badgeLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  stepIndex: number; // 1: Request, 2: Approved, 3: Payment, 4: Confirmed
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  isAwaitingApproval: boolean;
  isAwaitingPayment: boolean;
  isConfirmed: boolean;
  isTerminal: boolean;
  canPay: boolean;
  activeTimerType: 'none' | 'request_approval' | 'payment_hold';
  activeExpiresAt?: string;
  isHoldExpired: boolean;
  isApprovalExpired: boolean;
}

export const getAuthoritativeBookingState = (booking: any): AuthoritativeBookingDisplay => {
  if (!booking) {
    return {
      code: 'pending',
      badgeLabel: 'Pending',
      heroTitle: 'Booking Details',
      heroSubtitle: 'Loading your booking information...',
      stepIndex: 1,
      variant: 'default',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: false,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  const rawBookingStatus = String(booking.bookingStatus || 'pending').trim().toLowerCase();
  const rawPaymentStatus = String(booking.paymentStatus || 'pending').trim().toLowerCase();
  const rawVerificationStage = String(booking.verificationStage || '').trim().toLowerCase();

  const now = Date.now();
  const paymentHoldExpired = Boolean(
    booking.paymentHoldExpiresAt &&
    new Date(booking.paymentHoldExpiresAt).getTime() <= now
  );
  const requestExpired = Boolean(
    booking.requestExpiresAt &&
    new Date(booking.requestExpiresAt).getTime() <= now
  );

  // 1. Definite confirmed states (payment confirmed or manual confirmed)
  const isPaidConfirmed =
    rawPaymentStatus === 'paid' ||
    ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(rawBookingStatus);

  if (isPaidConfirmed) {
    if (['checked_in', 'checked_out', 'completed', 'settled'].includes(rawBookingStatus)) {
      return {
        code: rawBookingStatus as AuthoritativeStateCode,
        badgeLabel: formatBookingStatus(rawBookingStatus),
        heroTitle: `Stay ${rawBookingStatus.replace('_', ' ')}`,
        heroSubtitle: 'Thank you for choosing Vrindavan Sarthi for your pilgrimage.',
        stepIndex: 4,
        variant: 'success',
        isAwaitingApproval: false,
        isAwaitingPayment: false,
        isConfirmed: true,
        isTerminal: rawBookingStatus !== 'checked_in',
        canPay: false,
        activeTimerType: 'none',
        isHoldExpired: false,
        isApprovalExpired: false,
      };
    }

    return {
      code: 'confirmed',
      badgeLabel: 'Booking Confirmed',
      heroTitle: 'Reservation Confirmed',
      heroSubtitle: 'Your room is confirmed and ready. Have a blessed journey to Vrindavan!',
      stepIndex: 4,
      variant: 'success',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: true,
      isTerminal: false,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // 2. Reconciliation / Payment Under Administrative Review
  if (rawPaymentStatus === 'reconciliation_required') {
    return {
      code: 'reconciliation_required',
      badgeLabel: 'Payment Under Review',
      heroTitle: 'Payment Received — Under Review',
      heroSubtitle: 'Your payment was received. Our team is finalizing your confirmation.',
      stepIndex: 3,
      variant: 'warning',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: false,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // 3. Cancelled
  if (rawBookingStatus === 'cancelled') {
    return {
      code: 'cancelled',
      badgeLabel: 'Cancelled',
      heroTitle: 'Booking Cancelled',
      heroSubtitle: 'This booking has been cancelled according to policy.',
      stepIndex: 1,
      variant: 'destructive',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: true,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // 4. Rejected by Property
  if (rawBookingStatus === 'rejected_by_property') {
    return {
      code: 'rejected_by_property',
      badgeLabel: 'Declined by Property',
      heroTitle: 'Property Unavailable',
      heroSubtitle: 'The property could not confirm your requested dates. No charges were made.',
      stepIndex: 2,
      variant: 'destructive',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: true,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // 5. Expired due to no response from property
  if (rawBookingStatus === 'expired_property_no_response' || (rawBookingStatus === 'pending_property_confirmation' && requestExpired)) {
    return {
      code: 'expired_property_no_response',
      badgeLabel: 'Expired (Property Timed Out)',
      heroTitle: 'Request Timed Out',
      heroSubtitle: 'The property did not respond in time. You can choose another property.',
      stepIndex: 2,
      variant: 'destructive',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: true,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: false,
      isApprovalExpired: true,
    };
  }

  // 6. Expired payment hold
  if (rawBookingStatus === 'expired' || (rawBookingStatus === 'awaiting_customer_payment' && paymentHoldExpired)) {
    return {
      code: 'expired',
      badgeLabel: 'Expired (Payment Hold Expired)',
      heroTitle: 'Payment Window Expired',
      heroSubtitle: 'The payment hold expired before payment was completed. The room has been released.',
      stepIndex: 3,
      variant: 'destructive',
      isAwaitingApproval: false,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: true,
      canPay: false,
      activeTimerType: 'none',
      isHoldExpired: true,
      isApprovalExpired: false,
    };
  }

  // 7. Payment Failed
  if (rawBookingStatus === 'payment_failed' || rawPaymentStatus === 'failed') {
    return {
      code: 'payment_failed',
      badgeLabel: 'Payment Failed',
      heroTitle: 'Payment Unsuccessful',
      heroSubtitle: 'Your previous payment attempt did not complete. You can try again if the hold is active.',
      stepIndex: 3,
      variant: 'destructive',
      isAwaitingApproval: false,
      isAwaitingPayment: !paymentHoldExpired,
      isConfirmed: false,
      isTerminal: paymentHoldExpired,
      canPay: !paymentHoldExpired,
      activeTimerType: !paymentHoldExpired && booking.paymentHoldExpiresAt ? 'payment_hold' : 'none',
      activeExpiresAt: booking.paymentHoldExpiresAt,
      isHoldExpired: paymentHoldExpired,
      isApprovalExpired: false,
    };
  }

  // 8. Property Approved — Awaiting Customer Payment (Hold Active)
  if (rawBookingStatus === 'awaiting_customer_payment') {
    return {
      code: 'awaiting_customer_payment',
      badgeLabel: 'Property Approved (Payment Pending)',
      heroTitle: 'Request Approved — Pay to Confirm',
      heroSubtitle: 'The host has approved your booking. Complete payment before the hold expires to confirm.',
      stepIndex: 3,
      variant: 'info',
      isAwaitingApproval: false,
      isAwaitingPayment: true,
      isConfirmed: false,
      isTerminal: false,
      canPay: true,
      activeTimerType: booking.paymentHoldExpiresAt ? 'payment_hold' : 'none',
      activeExpiresAt: booking.paymentHoldExpiresAt,
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // 9. Pending Property Confirmation (Request Submitted)
  if (rawBookingStatus === 'pending_property_confirmation') {
    return {
      code: 'pending_property_confirmation',
      badgeLabel: 'Awaiting Property Approval',
      heroTitle: 'Request Sent to Property',
      heroSubtitle: 'Your request is being reviewed by the property. We will notify you once accepted.',
      stepIndex: 2,
      variant: 'warning',
      isAwaitingApproval: true,
      isAwaitingPayment: false,
      isConfirmed: false,
      isTerminal: false,
      canPay: false,
      activeTimerType: booking.requestExpiresAt ? 'request_approval' : 'none',
      activeExpiresAt: booking.requestExpiresAt,
      isHoldExpired: false,
      isApprovalExpired: false,
    };
  }

  // Default / pending fallback
  return {
    code: 'pending_property_confirmation',
    badgeLabel: 'Processing',
    heroTitle: 'Processing Booking',
    heroSubtitle: 'Your booking is currently being processed.',
    stepIndex: 1,
    variant: 'default',
    isAwaitingApproval: false,
    isAwaitingPayment: false,
    isConfirmed: false,
    isTerminal: false,
    canPay: false,
    activeTimerType: 'none',
    isHoldExpired: false,
    isApprovalExpired: false,
  };
};
