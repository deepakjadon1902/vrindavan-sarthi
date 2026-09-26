import { CalendarCheck, CheckCircle2, CreditCard, MessageCircle, ShieldCheck } from 'lucide-react';

type SimpleBookingPanelProps = {
  service: 'stay' | 'dharamshala' | 'cab' | 'tour';
  className?: string;
};

const copy = {
  stay: {
    title: 'Room booking',
    subtitle: 'Dates, guests, payment.',
    steps: ['Dates', 'Guests', 'Secure pay'],
    note: 'Your booking is created only through the secure booking engine.',
  },
  dharamshala: {
    title: 'Dharamshala request',
    subtitle: 'Request first. Contact after confirmation.',
    steps: ['Dates', 'Request', 'Connect'],
    note: 'Lister details stay private until the booking is successfully confirmed.',
  },
  cab: {
    title: 'Cab confirmation',
    subtitle: 'Route and time first. Payment after confirmation.',
    steps: ['Route', 'Confirm', 'Pay'],
    note: 'No advance is collected before the travel desk confirms availability.',
  },
  tour: {
    title: 'Tour confirmation',
    subtitle: 'Date and group size first. Plan confirmed next.',
    steps: ['Date', 'Plan', 'Pay'],
    note: 'Pickup, vehicle, and final amount are confirmed before payment.',
  },
} as const;

const icons = [CalendarCheck, MessageCircle, CreditCard];

const SimpleBookingPanel = ({ service, className = '' }: SimpleBookingPanelProps) => {
  const item = copy[service];

  return (
    <div className={`rounded-lg border border-border bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/12 text-brand-crimson">
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Booking flow</p>
          <p className="mt-0.5 font-body text-sm font-bold text-foreground">{item.title}</p>
          <p className="mt-1 font-body text-xs leading-5 text-muted-foreground">{item.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {item.steps.map((step, index) => {
          const Icon = icons[index] || CheckCircle2;
          return (
            <div key={step} className="rounded-lg border border-border bg-secondary/40 px-2 py-2 text-center">
              <Icon size={14} className="mx-auto text-brand-gold" />
              <p className="mt-1 font-body text-[11px] font-bold leading-4 text-foreground">{step}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex items-start gap-1.5 font-body text-[11px] leading-5 text-muted-foreground">
        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
        <span>{item.note}</span>
      </p>
    </div>
  );
};

export default SimpleBookingPanel;
