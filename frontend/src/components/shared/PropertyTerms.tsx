export type PropertyTermsSections = {
  generalTerms: string;
  checkInRequirements: string;
  checkOutRules: string;
  cancellationPolicy: string;
  guestPolicies: string;
  idVerificationRequirements: string;
  ageRestrictions: string;
  propertyRules: string;
  additionalInstructions: string;
};

export type PropertyTermsValue = {
  currentVersion?: number;
  isActive?: boolean;
  sections?: Partial<PropertyTermsSections>;
  history?: Array<{ version: number; isActive?: boolean; sections?: Partial<PropertyTermsSections>; publishedAt?: string }>;
};

export type NormalizedPropertyTerms = {
  currentVersion: number;
  isActive: boolean;
  sections: PropertyTermsSections;
  history: NonNullable<PropertyTermsValue['history']>;
};

export const propertyTermsFields: Array<{ key: keyof PropertyTermsSections; label: string; placeholder: string }> = [
  { key: 'generalTerms', label: 'General Terms & Conditions', placeholder: 'Example: Booking is subject to property rules and payment verification.' },
  { key: 'checkInRequirements', label: 'Check-in Requirements', placeholder: 'Example: Check-in after 12:00 PM with valid ID for every adult guest.' },
  { key: 'checkOutRules', label: 'Check-out Rules', placeholder: 'Example: Check-out before 11:00 AM. Late check-out depends on availability.' },
  { key: 'cancellationPolicy', label: 'Cancellation & Refund Policy', placeholder: 'Example: Advance payment is non-refundable after confirmation.' },
  { key: 'guestPolicies', label: 'Guest/Visitor Policies', placeholder: 'Example: Outside visitors are allowed only after property approval.' },
  { key: 'idVerificationRequirements', label: 'ID Verification Requirements', placeholder: 'Example: Aadhaar, passport, or government-issued ID is required.' },
  { key: 'ageRestrictions', label: 'Age Restrictions', placeholder: 'Example: Primary guest must be 18+.' },
  { key: 'propertyRules', label: 'Property-Specific Rules', placeholder: 'Example: Alcohol, smoking, or loud music may be restricted.' },
  { key: 'additionalInstructions', label: 'Additional Instructions', placeholder: 'Example: Call property desk before late arrival.' },
];

export const emptyPropertyTermsSections = (): PropertyTermsSections =>
  propertyTermsFields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {} as PropertyTermsSections);

export const normalizePropertyTerms = (value?: PropertyTermsValue | null): NormalizedPropertyTerms => ({
  currentVersion: Number(value?.currentVersion || 1),
  isActive: typeof value?.isActive === 'undefined' ? true : Boolean(value.isActive),
  sections: { ...emptyPropertyTermsSections(), ...(value?.sections || {}) },
  history: Array.isArray(value?.history) ? value.history : [],
});

export const hasPropertyTermsText = (value?: PropertyTermsValue | null) => {
  const terms = normalizePropertyTerms(value);
  return propertyTermsFields.some((field) => String(terms.sections[field.key] || '').trim());
};

export const PropertyTermsPreview = ({ terms }: { terms?: PropertyTermsValue | null }) => {
  const normalized = normalizePropertyTerms(terms);
  const visible = propertyTermsFields.filter((field) => String(normalized.sections[field.key] || '').trim());

  if (!normalized.isActive || visible.length === 0) {
    return <p className="font-body text-sm text-muted-foreground">No active property-specific terms are published yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 font-body text-[11px] font-bold text-brand-green">
          Active version {normalized.currentVersion}
        </span>
      </div>
      {visible.map((field) => (
        <div key={field.key} className="rounded-lg border border-border bg-white/80 p-3">
          <p className="font-body text-xs font-bold text-foreground">{field.label}</p>
          <p className="mt-1 whitespace-pre-line font-body text-xs leading-5 text-muted-foreground">{normalized.sections[field.key]}</p>
        </div>
      ))}
    </div>
  );
};

type PropertyTermsEditorProps = {
  value: PropertyTermsValue;
  onChange: (next: PropertyTermsValue) => void;
};

export const PropertyTermsEditor = ({ value, onChange }: PropertyTermsEditorProps) => {
  const normalized = normalizePropertyTerms(value);
  const setSection = (key: keyof PropertyTermsSections, text: string) => {
    onChange({ ...normalized, sections: { ...normalized.sections, [key]: text } });
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">Property Terms & Booking Policies</p>
          <p className="font-body text-xs text-muted-foreground">
            These rules are saved per property and shown to customers before booking.
          </p>
        </div>
        <label className="flex items-center gap-2 font-body text-sm font-semibold text-foreground">
          <input
            type="checkbox"
            checked={normalized.isActive}
            onChange={(e) => onChange({ ...normalized, isActive: e.target.checked })}
          />
          Active
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {propertyTermsFields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block font-body text-xs font-bold text-foreground">{field.label}</span>
            <textarea
              rows={3}
              value={normalized.sections[field.key] || ''}
              onChange={(e) => setSection(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-white/80 p-3">
        <p className="mb-2 font-body text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
        <PropertyTermsPreview terms={normalized} />
      </div>

      {normalized.history.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Version History</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {normalized.history
              .slice()
              .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
              .slice(0, 5)
              .map((item) => (
                <span key={`${item.version}-${item.publishedAt || ''}`} className="rounded-full border border-border bg-white px-3 py-1 font-body text-xs text-muted-foreground">
                  v{item.version || 1} {item.isActive === false ? 'Inactive' : 'Active'}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
