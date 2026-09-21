interface SectionTitleProps {
  label?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

const SectionTitle = ({ label, title, subtitle, center = true, light = false }: SectionTitleProps) => {
  return (
    <div className={`mb-6 lg:mb-8 ${center ? 'text-center' : ''}`}>
      {label && (
        <span className="premium-kicker">
          {label}
        </span>
      )}
      <h2 className={`font-heading text-3xl font-semibold leading-tight md:text-4xl ${label ? 'mt-2' : ''} ${light ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h2>
      <div className={`mt-3 flex items-center gap-2 ${center ? 'mx-auto justify-center' : ''} max-w-sm`}>
        <span className="h-px w-16 bg-brand-gold/65" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
      </div>
      {subtitle && (
        <p className={`premium-copy mt-3 max-w-2xl text-sm md:text-[15px] ${center ? 'mx-auto' : ''} ${light ? 'text-primary-foreground/75' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionTitle;
