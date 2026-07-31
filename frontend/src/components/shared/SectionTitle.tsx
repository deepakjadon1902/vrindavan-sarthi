interface SectionTitleProps {
  label?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

const SectionTitle = ({ label, title, subtitle, center = true, light = false }: SectionTitleProps) => {
  return (
    <div className={`mb-4 lg:mb-5 ${center ? 'text-center' : ''}`}>
      {label && (
        <span className="premium-kicker">
          {label}
        </span>
      )}
      <h2 className={`font-heading text-3xl md:text-[2.1rem] lg:text-[2.25rem] font-bold mt-1 leading-[1.08] ${light ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h2>
      <div className={`mt-2 flex items-center gap-2 ${center ? 'mx-auto justify-center' : ''} max-w-sm`}>
        <span className="h-px w-16 bg-brand-gold/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-crimson" />
      </div>
      {subtitle && (
        <p className={`premium-copy mt-2 max-w-2xl text-sm ${center ? 'mx-auto' : ''} ${light ? 'text-primary-foreground/75' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionTitle;
