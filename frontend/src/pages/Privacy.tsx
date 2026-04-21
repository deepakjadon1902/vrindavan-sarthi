import { useSettingsStore } from '@/store/settingsStore';

const Privacy = () => {
  const { settings } = useSettingsStore();
  const sections = settings.privacyPolicy.split(/\n\n+/).filter(Boolean);

  return (
    <div className="pt-24 pb-16 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
        <div className="bg-card rounded-xl border border-border p-8 space-y-6 font-body text-sm text-muted-foreground leading-relaxed">
          {sections.map((section, i) => {
            const lines = section.split('\n');
            const title = lines[0];
            const body = lines.slice(1).join('\n');
            const isTitle = /^\d+\./.test(title);
            return (
              <section key={i}>
                {isTitle ? (
                  <>
                    <h2 className="font-heading text-xl font-semibold text-foreground mb-3">{title}</h2>
                    <p>{body}</p>
                  </>
                ) : (
                  <p>{section}</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Privacy;
