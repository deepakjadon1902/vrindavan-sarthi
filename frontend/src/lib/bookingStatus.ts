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
