import { Star, Quote } from 'lucide-react';

interface TestimonialCardProps {
  name: string;
  avatar: string;
  rating: number;
  text: string;
  location: string;
}

const TestimonialCard = ({ name, avatar, rating, text, location }: TestimonialCardProps) => {
  return (
    <article className="group relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-[0_4px_16px_rgba(16,24,44,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-gold/45 hover:shadow-[0_8px_24px_rgba(16,24,44,0.09)]">
      <Quote className="absolute right-4 top-4 text-brand-gold/20 transition-colors group-hover:text-brand-gold/30" size={30} />
      <div className="mb-4 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < rating ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
          />
        ))}
      </div>
      <p className="mb-6 line-clamp-5 flex-1 font-body text-sm leading-6 text-muted-foreground">
        &ldquo;{text}&rdquo;
      </p>
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-gold/35 bg-brand-gold/15 font-body text-sm font-bold text-brand-gold">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : name[0]}
        </div>
        <div className="min-w-0">
          <p className="font-body text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate font-body text-xs font-medium text-muted-foreground">{location}</p>
        </div>
      </div>
    </article>
  );
};

export default TestimonialCard;
