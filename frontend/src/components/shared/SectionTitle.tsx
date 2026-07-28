interface SectionTitleProps {
  label?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

const SectionTitle = ({ label, title, subtitle, center = true, light = false }: SectionTitleProps) => {
  return (
    <div className={`mb-3 lg:mb-4 ${center ? 'text-center' : ''}`}>
      {label && (
        <span className="premium-kicker">
          {label}
        </span>
      )}
      <h2 className={`font-heading text-3xl md:text-[2.2rem] lg:text-[2.35rem] font-bold mt-1 leading-[1.08] ${light ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h2>
      <div className={`mt-2 flex items-center gap-3 ${center ? 'mx-auto justify-center' : ''} max-w-sm`}>
        <span className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold" />
        <span className="h-1.5 w-9 rounded-full bg-brand-gold" />
        <span className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold" />
      </div>
      {subtitle && (
        <p className={`premium-copy mt-2 max-w-2xl text-[13px] ${center ? 'mx-auto' : ''} ${light ? 'text-primary-foreground/75' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionTitle;
