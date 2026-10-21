import React, { useEffect, useState, useRef } from 'react';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

export interface BookingCountdownTimerProps {
  expiresAt?: string | Date | null;
  startedAt?: string | Date | null;
  onExpire?: () => void;
  label?: string;
  className?: string;
  compact?: boolean;
  timerType?: 'payment_hold' | 'request_approval';
  totalMinutes?: number;
}

export const BookingCountdownTimer: React.FC<BookingCountdownTimerProps> = ({
  expiresAt,
  startedAt,
  onExpire,
  label,
  className = '',
  compact = false,
  timerType = 'payment_hold',
  totalMinutes,
}) => {
  const getSecondsLeft = (): number => {
    if (!expiresAt) return 0;
    const target = new Date(expiresAt).getTime();
    if (isNaN(target)) return 0;
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(getSecondsLeft);
  const hasTriggeredExpire = useRef(false);

  useEffect(() => {
    hasTriggeredExpire.current = false;
    const initial = getSecondsLeft();
    setSecondsLeft(initial);

    if (initial <= 0) {
      hasTriggeredExpire.current = true;
      onExpire?.();
      return;
    }

    const interval = setInterval(() => {
      const remaining = getSecondsLeft();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasTriggeredExpire.current) {
          hasTriggeredExpire.current = true;
          onExpire?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = secondsLeft <= 0;
  const isCritical = secondsLeft > 0 && secondsLeft <= 60;
  const isWarning = secondsLeft > 60 && secondsLeft <= 180;

  // Compute baseline total duration:
  // If totalMinutes is given, use it. Otherwise, if secondsLeft > 900 (15m), use 30m; if timerType is request_approval, use 5m; else 15m.
  const effectiveTotalMinutes =
    totalMinutes && totalMinutes > 0
      ? totalMinutes
      : timerType === 'request_approval'
      ? 5
      : secondsLeft > 15 * 60
      ? 30
      : 15;

  const totalHoldSeconds = effectiveTotalMinutes * 60;
  const progressPercent = Math.min(100, Math.max(0, (secondsLeft / totalHoldSeconds) * 100));

  const isRequestTimer = timerType === 'request_approval';
  const defaultLabel = isRequestTimer ? 'Host Response Window' : 'Payment Hold Active';
  const displayLabel = label || defaultLabel;

  if (compact) {
    if (isExpired) {
      return (
        <span className={`inline-flex items-center gap-1.5 font-body text-xs font-semibold text-destructive ${className}`}>
          <AlertCircle size={13} className="shrink-0" />
          <span>{isRequestTimer ? 'Request timed out' : 'Hold expired'}</span>
        </span>
      );
    }

    const urgencyColor = isCritical
      ? 'text-destructive font-bold animate-pulse'
      : isWarning
      ? 'text-brand-saffron font-bold'
      : isRequestTimer
      ? 'text-brand-saffron font-semibold'
      : 'text-brand-crimson font-semibold';

    return (
      <span className={`inline-flex items-center gap-1.5 font-body text-xs ${urgencyColor} ${className}`}>
        <Clock size={13} className="shrink-0" />
        <span>{formattedTime} {isRequestTimer ? 'for host reply' : 'left to pay'}</span>
      </span>
    );
  }

  if (isExpired) {
    return (
      <div className={`rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5 text-left shadow-sm ${className}`}>
        <div className="flex items-center gap-2.5 text-destructive">
          <AlertCircle size={20} className="shrink-0" />
          <h4 className="font-heading text-sm sm:text-base font-bold">
            {isRequestTimer ? 'Property Response Window Expired' : 'Payment Hold Expired'}
          </h4>
        </div>
        <p className="mt-1.5 font-body text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {isRequestTimer
            ? 'The property did not respond within the allocated time window. No payment was charged. You can choose another property or date.'
            : 'The payment hold has expired and reserved inventory has been released. Please initiate a new booking request.'}
        </p>
      </div>
    );
  }

  const borderClass = isCritical
    ? 'border-destructive/40 bg-destructive/5 shadow-destructive/5'
    : isWarning
    ? 'border-brand-saffron/40 bg-brand-saffron/5 shadow-brand-saffron/5'
    : isRequestTimer
    ? 'border-brand-saffron/30 bg-brand-saffron/5 shadow-sm'
    : 'border-brand-gold/30 bg-brand-cream/60 shadow-sm';

  const textClass = isCritical
    ? 'text-destructive'
    : isWarning
    ? 'text-brand-saffron'
    : isRequestTimer
    ? 'text-brand-saffron'
    : 'text-brand-crimson';

  const barColor = isCritical
    ? 'bg-destructive'
    : isWarning
    ? 'bg-brand-saffron'
    : isRequestTimer
    ? 'bg-brand-saffron'
    : 'bg-brand-gold';

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${borderClass} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isCritical ? 'bg-destructive/15 text-destructive' : 'bg-brand-gold/15 text-brand-crimson'}`}>
            {isCritical ? (
              <AlertTriangle size={18} className="animate-pulse" />
            ) : isRequestTimer ? (
              <Clock size={18} className={textClass} />
            ) : (
              <Clock size={18} className={textClass} />
            )}
          </div>
          <div>
            <span className="font-heading text-sm sm:text-base font-bold text-foreground block">
              {displayLabel}
            </span>
            <span className="font-body text-[11px] text-muted-foreground block">
              {isRequestTimer ? 'Awaiting property host availability confirmation' : 'Complete payment before hold expires'}
            </span>
          </div>
        </div>

        <div className={`font-mono text-xl sm:text-2xl font-extrabold tracking-tight ${textClass} ${isCritical ? 'animate-pulse' : ''}`}>
          {formattedTime}
        </div>
      </div>

      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${barColor}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-2.5 font-body text-xs text-muted-foreground leading-relaxed">
        {isCritical ? (
          <span className="font-semibold text-destructive">
            ⚠️ Attention: Less than 1 minute remaining! Please complete now.
          </span>
        ) : isWarning ? (
          <span className="font-medium text-brand-saffron">
            Notice: Less than 3 minutes left in this active window.
          </span>
        ) : isRequestTimer ? (
          <span>
            The host has been notified. If no response is received, the request safely times out without charge.
          </span>
        ) : (
          <span>
            Your room dates are temporarily held. Complete payment before the timer reaches zero to confirm your reservation.
          </span>
        )}
      </p>
    </div>
  );
};

export default BookingCountdownTimer;
