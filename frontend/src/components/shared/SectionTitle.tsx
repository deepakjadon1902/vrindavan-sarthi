interface SectionTitleProps {
  label?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

const SectionTitle = ({ label, title, subtitle, center = true, light = false }: SectionTitleProps) => {
  return (
    <div className={`mb-10 lg:mb-14 ${center ? 'text-center' : ''}`}>
      {label && (
        <span className="premium-kicker">
          {label}
        </span>
      )}
      <h2 className={`font-heading text-3xl md:text-4xl lg:text-5xl font-bold mt-2 leading-[1.05] ${light ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h2>
      <div className={`mt-4 flex items-center gap-3 ${center ? 'mx-auto justify-center' : ''} max-w-sm`}>
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-brand-gold" />
        <span className="h-1.5 w-10 rounded-full bg-brand-gold" />
        <span className="h-px w-16 bg-gradient-to-l from-transparent to-brand-gold" />
      </div>
      {subtitle && (
        <p className={`premium-copy mt-4 max-w-2xl text-[15px] ${center ? 'mx-auto' : ''} ${light ? 'text-primary-foreground/75' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionTitle;
