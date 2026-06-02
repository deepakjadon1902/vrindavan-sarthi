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
        <span className="font-body text-xs font-bold tracking-[0.22em] uppercase text-brand-crimson">
          {label}
        </span>
      )}
      <h2 className={`font-heading text-3xl md:text-4xl lg:text-5xl font-semibold mt-2 ${light ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h2>
      <div className={`golden-divider max-w-xs mt-4 ${center ? 'mx-auto' : ''}`}>
        <span className="h-2 w-2 rounded-full bg-brand-gold" />
      </div>
      {subtitle && (
        <p className={`font-body mt-3 max-w-2xl ${center ? 'mx-auto' : ''} ${light ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionTitle;
