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
    <div className="bg-card rounded-xl p-6 border border-border card-hover relative">
      <Quote className="absolute top-4 right-4 text-brand-gold/20" size={32} />
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < rating ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/30'}
          />
        ))}
      </div>
      <p className="font-body text-muted-foreground text-sm leading-relaxed mb-5 italic">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center font-brand text-brand-gold text-sm">
          {name[0]}
        </div>
        <div>
          <p className="font-body text-sm font-semibold text-foreground">{name}</p>
          <p className="font-body text-xs text-muted-foreground">{location}</p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;
