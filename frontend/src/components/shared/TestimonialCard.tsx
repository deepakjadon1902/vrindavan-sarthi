import { BadgeCheck, Star } from 'lucide-react';

interface TestimonialCardProps {
  name: string;
  avatar: string;
  rating: number;
  text: string;
  location: string;
}

const TestimonialCard = ({ name, avatar, rating, text, location }: TestimonialCardProps) => {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="group relative flex h-full min-h-[230px] flex-col overflow-hidden rounded-lg border border-border/70 bg-white p-5 shadow-[0_10px_30px_rgba(16,24,44,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/55 hover:shadow-[0_18px_42px_rgba(16,24,44,0.12)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4285f4] via-[#fbbc05] to-[#34a853]" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-gold/30 to-brand-crimson/15 font-body text-sm font-extrabold text-brand-crimson ring-2 ring-white shadow-md">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-body text-sm font-extrabold text-foreground">{name}</p>
              <BadgeCheck size={15} className="shrink-0 fill-[#1a73e8] text-white" />
            </div>
            <p className="truncate font-body text-xs font-medium text-muted-foreground">{location}</p>
          </div>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-white font-body text-sm font-black text-[#4285f4] shadow-sm">
          G
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              className={i < rating ? 'fill-[#fbbc05] text-[#fbbc05]' : 'text-muted-foreground/25'}
            />
          ))}
        </div>
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-bold text-emerald-700">
          Google verified
        </span>
      </div>

      <p className="line-clamp-5 flex-1 font-body text-sm leading-6 text-muted-foreground">
        &ldquo;{text}&rdquo;
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="font-body text-xs font-semibold text-muted-foreground">Reviewed after booking</span>
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
      </div>
    </article>
  );
};

export default TestimonialCard;
