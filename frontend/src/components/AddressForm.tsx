import { useMemo } from 'react';
import { INDIA_STATES_AND_UTS, getCitiesForState } from '@/lib/indiaLocations';

export type AddressFormValue = {
  firstName: string;
  lastName: string;
  state: string;
  district: string;
  streetAddress: string;
  city: string;
  cityOther?: string;
  pinCode: string;
  phone: string;
  email: string;
  orderNotes?: string;
};

type Props = {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  showOrderNotes?: boolean;
};

const AddressForm = ({ value, onChange, showOrderNotes = true }: Props) => {
  const cities = useMemo(() => getCitiesForState(value.state), [value.state]);
  const isOtherCity = value.city === 'Other';

  const set = <K extends keyof AddressFormValue>(k: K, v: AddressFormValue[K]) => {
    onChange({ ...value, [k]: v });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Name *</label>
          <input
            type="text"
            value={value.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Last Name *</label>
          <input
            type="text"
            value={value.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">State *</label>
          <select
            value={value.state}
            onChange={(e) => {
              const nextState = e.target.value;
              onChange({ ...value, state: nextState, city: '', cityOther: '' });
            }}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          >
            <option value="">Select state</option>
            {INDIA_STATES_AND_UTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">District *</label>
          <input
            type="text"
            value={value.district}
            onChange={(e) => set('district', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="District"
          />
        </div>
      </div>

      <div>
        <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Street Address *</label>
        <input
          type="text"
          value={value.streetAddress}
          onChange={(e) => set('streetAddress', e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          placeholder="House no, road, area"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Town / City *</label>
          <select
            value={value.city}
            onChange={(e) => set('city', e.target.value)}
            disabled={!value.state}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 disabled:opacity-60"
          >
            <option value="">{value.state ? 'Select city' : 'Select state first'}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {isOtherCity && (
            <input
              type="text"
              value={value.cityOther || ''}
              onChange={(e) => set('cityOther', e.target.value)}
              className="w-full mt-2 px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              placeholder="Enter your city/town"
            />
          )}
        </div>
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Pin Code *</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.pinCode}
            onChange={(e) => set('pinCode', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="281121"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Phone *</label>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="+91 XXXXX XXXXX"
          />
        </div>
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email Address *</label>
          <input
            type="email"
            value={value.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            placeholder="you@email.com"
          />
        </div>
      </div>

      {showOrderNotes && (
        <div>
          <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Order Notes (optional)</label>
          <textarea
            value={value.orderNotes || ''}
            onChange={(e) => set('orderNotes', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
            placeholder="Any special instructions…"
          />
        </div>
      )}
    </div>
  );
};

export default AddressForm;

