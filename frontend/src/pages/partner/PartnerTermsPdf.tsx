import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { Download, FileText } from 'lucide-react';

const PartnerTermsPdf = () => {
  const { settings, refreshSettings } = useSettingsStore();
  const content = `Vrindavan Sarthi Partner Terms & Conditions\n\n${settings.partnerTerms}\n\nPartner Policies\n\n${settings.partnerPolicies}`;

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const download = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vrindavan-sarthi-partner-terms.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Partner Terms & Conditions</h2>
          <p className="font-body text-xs text-muted-foreground">
            Dedicated partner document. This is separate from the public privacy policy.
          </p>
        </div>
        <button type="button" onClick={download} className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm">
          <Download size={16} />
          Download
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 font-body text-sm font-semibold text-foreground">
          <FileText size={16} className="text-brand-gold" />
          Latest Admin Published Content
        </div>
        <div className="grid gap-5 p-5">
          <section>
            <h3 className="font-heading text-lg font-bold text-foreground">Terms & Conditions</h3>
            <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-body text-sm leading-7 text-muted-foreground">
              {settings.partnerTerms}
            </div>
          </section>
          <section>
            <h3 className="font-heading text-lg font-bold text-foreground">Policies</h3>
            <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-body text-sm leading-7 text-muted-foreground">
              {settings.partnerPolicies}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PartnerTermsPdf;
