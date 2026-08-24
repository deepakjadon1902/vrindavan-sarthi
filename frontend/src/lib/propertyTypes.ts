export type StayPropertyType = 'hotel' | 'dharamshala' | 'home_stay' | 'guest_house';

export const propertyTypeOptions: Array<{ value: StayPropertyType; label: string }> = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'dharamshala', label: 'Dharamshala' },
  { value: 'home_stay', label: 'Home Stay' },
  { value: 'guest_house', label: 'Guest House' },
];

export const isDharamshalaType = (value?: string | null) => value === 'dharamshala';

export const isHotelWorkflowType = (value?: string | null) => !isDharamshalaType(value || 'hotel');

export const getPropertyTypeLabel = (value?: string | null) =>
  propertyTypeOptions.find((option) => option.value === value)?.label || 'Hotel';
