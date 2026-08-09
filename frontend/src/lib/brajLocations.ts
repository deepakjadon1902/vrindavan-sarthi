export const BRAJ_LOCATION_NAMES = [
  'Vrindavan',
  'Mathura',
  'Govardhan',
  'Barsana',
  'Gokul',
  'Nandgaon',
  'Radha Kund',
  'Radhakund',
  'Kusum Sarovar',
  'Baldeo',
  'Mahavan',
  'Raya',
  'Kosi Kalan',
  'Chhata',
];

const LOCATION_ALIASES: Record<string, string> = {
  goverdhan: 'Govardhan',
  govardhan: 'Govardhan',
  barshana: 'Barsana',
  barsana: 'Barsana',
  vrindavan: 'Vrindavan',
  brindavan: 'Vrindavan',
  mathura: 'Mathura',
  gokul: 'Gokul',
  nandgaon: 'Nandgaon',
  nandagaon: 'Nandgaon',
  radhakund: 'Radha Kund',
  'radha kund': 'Radha Kund',
  'kusum sarovar': 'Kusum Sarovar',
  baldeo: 'Baldeo',
  mahavan: 'Mahavan',
  raya: 'Raya',
  'kosi kalan': 'Kosi Kalan',
  chhata: 'Chhata',
};

export const getBrajLocationName = (...values: Array<unknown>) => {
  const text = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  const lower = text.toLowerCase();

  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }

  const fallback = text.split(',')[0]?.trim();
  return fallback || 'Other Braj Locations';
};

export const sortBrajLocationNames = (a: string, b: string) => {
  const ai = BRAJ_LOCATION_NAMES.indexOf(a);
  const bi = BRAJ_LOCATION_NAMES.indexOf(b);
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  if (a === 'Other Braj Locations') return 1;
  if (b === 'Other Braj Locations') return -1;
  return a.localeCompare(b);
};

export const sortBrajLocationNamesForSearch = (query: string) => (a: string, b: string) => {
  const preferred = getBrajLocationName(query);
  if (preferred && preferred !== 'Other Braj Locations') {
    if (a === preferred && b !== preferred) return -1;
    if (b === preferred && a !== preferred) return 1;
  }
  return sortBrajLocationNames(a, b);
};
