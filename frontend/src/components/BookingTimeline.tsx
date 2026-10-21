import React from 'react';
import { Check, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import type { AuthoritativeBookingDisplay } from '@/lib/bookingStatus';

export interface BookingTimelineProps {
  booking: any;
  state: AuthoritativeBookingDisplay;
  className?: string;
}

export const BookingTimeline: React.FC<BookingTimelineProps> = ({
  booking,
  state,
  className = '',
}) => {
  if (!booking) return null;

  const formatDate = (isoString?: string | Date) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const steps = [
    {
      title: 'Request Submitted',
      description: 'Reservation details sent to host',
      timestamp: formatDate(booking.createdAt),
      status: 'completed',
    },
    {
      title: 'Host Approval',
      description: state.isAwaitingApproval
        ? 'Host reviewing room availability'
        : state.code === 'rejected_by_property'
        ? 'Property could not accommodate dates'
        : state.code === 'expired_property_no_response'
        ? 'Property review timed out'
        : 'Dates approved by property partner',
      timestamp: formatDate(booking.propertyRespondedAt),
      status: state.isAwaitingApproval
        ? 'current'
        : state.code === 'rejected_by_property' || state.code === 'expired_property_no_response'
        ? 'failed'
        : 'completed',
    },
    {
      title: 'Payment & Confirmation',
      description: state.isConfirmed
        ? 'Payment verified online'
        : state.code === 'reconciliation_required'
        ? 'Payment received; awaiting admin verification'
        : state.isHoldExpired
        ? 'Payment window lapsed'
        : state.isAwaitingPayment
        ? 'Awaiting customer payment'
        : 'Online payment required to confirm',
      timestamp: formatDate(booking.paidAt || booking.confirmedAt),
      status: state.isConfirmed
        ? 'completed'
        : state.code === 'reconciliation_required'
        ? 'warning'
        : state.isAwaitingPayment
        ? 'current'
        : state.isHoldExpired
        ? 'failed'
        : state.stepIndex < 3
        ? 'upcoming'
        : 'failed',
    },
    {
      title: 'Ready for Check-in',
      description: state.isConfirmed
        ? 'Host contact and booking voucher unlocked'
        : 'Unlocked upon confirmed payment',
      timestamp: formatDate(booking.checkIn),
      status: state.isConfirmed ? 'completed' : 'upcoming',
    },
  ];

  return (
    <div className={`rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand-crimson" />
          <span>Booking Progress</span>
        </h3>
        <span className="font-body text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
          Step {Math.min(4, Math.max(1, state.stepIndex))} of 4
        </span>
      </div>

      <ol className="relative border-l border-border/80 ml-3 sm:ml-4 space-y-6">
        {steps.map((step, idx) => {
          const isDone = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isFailed = step.status === 'failed';
          const isWarning = step.status === 'warning';

          return (
            <li key={idx} className="ml-6">
              <span
                className={`absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-brand-green text-white ring-4 ring-brand-green/20'
                    : isCurrent
                    ? 'bg-brand-gold text-foreground ring-4 ring-brand-gold/30 animate-pulse'
                    : isFailed
                    ? 'bg-destructive text-white ring-4 ring-destructive/20'
                    : isWarning
                    ? 'bg-brand-saffron text-white ring-4 ring-brand-saffron/20'
                    : 'bg-muted text-muted-foreground ring-4 ring-background'
                }`}
              >
                {isDone ? (
                  <Check size={14} strokeWidth={3} />
                ) : isCurrent ? (
                  <Clock size={14} strokeWidth={2.5} />
                ) : isFailed ? (
                  <AlertCircle size={14} strokeWidth={2.5} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </span>

              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h4
                  className={`font-heading text-sm font-semibold ${
                    isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </h4>
                {step.timestamp && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {step.timestamp}
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-body text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default BookingTimeline;
