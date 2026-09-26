import { CalendarCheck, CheckCircle2, CreditCard, MessageCircle } from 'lucide-react';

type SimpleBookingPanelProps = {
  service: 'stay' | 'dharamshala' | 'cab' | 'tour';
  className?: string;
};

const copy = {
  stay: {
    title: 'Simple room booking',
    subtitle: 'Select dates, share guest details, then continue with secure confirmation.',
    steps: ['Choose dates', 'Add guest details', 'Pay securely'],
    note: 'Support is available by call or WhatsApp if anything is unclear.',
  },
  dharamshala: {
    title: 'Simple Dharamshala booking',
    subtitle: 'Submit a request first. Property contact details are shown after successful confirmation.',
    steps: ['Choose dates', 'Submit request', 'Contact after confirmation'],
    note: 'This keeps the lister details private until the booking is confirmed.',
  },
  cab: {
    title: 'Simple cab booking',
    subtitle: 'Share route and time, get fare confirmation, then pay only after confirmation.',
    steps: ['Share route', 'Confirm fare', 'Pay after confirmation'],
    note: 'No advance is needed until the travel desk confirms the booking.',
  },
  tour: {
    title: 'Simple tour booking',
    subtitle: 'Share date and group size, confirm the plan, then pay after the details are clear.',
    steps: ['Share date', 'Confirm plan', 'Pay after confirmation'],
    note: 'The support team confirms pickup, vehicle, and final amount first.',
  },
} as const;

const icons = [CalendarCheck, MessageCircle, CreditCard];

const SimpleBookingPanel = ({ service, className = '' }: SimpleBookingPanelProps) => {
  const item = copy[service];

  return (
    <div className={`rounded-xl border border-brand-gold/25 bg-brand-gold/10 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-crimson shadow-sm">
          <CheckCircle2 size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-body text-sm font-bold text-foreground">{item.title}</p>
          <p className="mt-1 font-body text-xs leading-5 text-muted-foreground">{item.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {item.steps.map((step, index) => {
          const Icon = icons[index] || CheckCircle2;
          return (
            <div key={step} className="rounded-lg border border-white/70 bg-white px-2 py-2 text-center shadow-sm">
              <Icon size={15} className="mx-auto text-brand-gold" />
              <p className="mt-1 font-body text-[11px] font-semibold leading-4 text-foreground">{step}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-body text-[11px] leading-5 text-muted-foreground">{item.note}</p>
    </div>
  );
};

export default SimpleBookingPanel;
