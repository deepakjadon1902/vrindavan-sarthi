import { useSettingsStore } from '@/store/settingsStore';

const Terms = () => {
  const { settings } = useSettingsStore();
  const sections = settings.termsOfService.split(/\n\n+/).filter(Boolean);

  return (
    <div className="pt-20 pb-8 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-5">Terms of Service</h1>
        <div className="bg-card rounded-xl border border-border p-8 space-y-6 font-body text-sm text-muted-foreground leading-relaxed">
          <section className="rounded-lg border border-brand-gold/25 bg-brand-gold/10 p-4">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">Platform Fees and Dharamshala Charges</h2>
            <p>
              For Dharamshala booking requests, Vrindavan Sarthi charges a Rs. 99 platform fee after the Dharamshala or admin accepts the request. The Dharamshala stay amount, donation, room contribution, or other property charges may vary according to the Dharamshala rules and must be paid directly to the Dharamshala or property manager unless the booking screen clearly says otherwise.
            </p>
            <p className="mt-3">
              For hotel room bookings, Vrindavan Sarthi may charge a 10% platform fee on the room booking amount. The final payable amount shown before payment will apply to the booking.
            </p>
          </section>
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

export default Terms;
