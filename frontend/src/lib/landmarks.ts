export const OTHER_LANDMARK_OPTION = 'Others';

export const BRAJ_LANDMARK_GROUPS = [
  {
    place: 'Vrindavan',
    landmarks: [
      'Shri Banke Bihari Ji Temple',
      'Banke Bihari Temple',
      'ISKCON Krishna Balaram Mandir',
      'ISKCON Temple',
      'Prem Mandir',
      'Shri Radha Raman Temple',
      'Shri Radha Vallabh Temple',
      'Shri Radha Damodar Temple',
      'Shri Rangji Temple',
      'Nidhivan',
      'Seva Kunj',
      'Kesi Ghat',
      'Yamuna Ghat',
      'Madan Mohan Temple',
      'Shahji Temple',
    ],
  },
  {
    place: 'Mathura',
    landmarks: [
      'Shri Krishna Janmabhoomi Temple',
      'Janmbhoomi',
      'Shri Dwarkadhish Temple',
      'Dwarikadhish',
      'Vishram Ghat',
      'Shri Keshav Dev Temple',
      'Shri Bhuteshwar Mahadev Temple',
      'Gita Mandir',
      'Kans Qila',
      'Vishram Bazaar',
      'Potra Kund',
      'Birla Mandir',
    ],
  },
  {
    place: 'Govardhan',
    landmarks: [
      'Giriraj Ji Temple',
      'Daan Ghati Temple',
      'Govardhan Parvat',
      'Govardhan Parikrama',
      'Mansi Ganga',
      'Radha Kund',
      'Kusum Sarovar',
      'Jatipura',
      'Punchari Ka Lotha',
      'Puchari Ka Lautha',
      'Mukharvind Temple',
    ],
  },
  {
    place: 'Barsana',
    landmarks: [
      'Shri Radha Rani Temple',
      'Radha Rani Temple',
      'Barsana Temple',
      'Barshana Temple',
      'Kirti Mandir',
      'Maan Mandir',
      'Rangeeli Mahal',
      'Prem Sarovar',
      'Pili Pokhar',
      'Kushal Bihari Temple',
      'Mor Kutir',
    ],
  },
  {
    place: 'Nandgaon',
    landmarks: [
      'Nand Baba Temple',
      'Nand Bhawan',
      'Yashoda Kund',
      'Pavan Sarovar',
      'Pan Sarovar',
      'Ter Kadamba',
      'Aasheshwar Mahadev Temple',
    ],
  },
  {
    place: 'Gokul',
    landmarks: [
      'Raman Reti',
      'Nand Bhawan',
      'Chaurasi Khamba',
      'Brahmand Ghat',
      'Raman Van',
      'Thakurani Ghat',
    ],
  },
  {
    place: 'Baldeo',
    landmarks: [
      'Dauji Temple',
      'Kshirsagar',
      'Baldeo Kund',
      'Revati Kund',
      'Brahmand Ghat',
    ],
  },
  {
    place: 'Radhakund',
    landmarks: [
      'Radha Kund',
      'Shyam Kund',
      'Radha Gopinath Temple',
      'Radha Vinod Temple',
      'Kusum Sarovar',
    ],
  },
  {
    place: 'Mahavan',
    landmarks: [
      'Chaurasi Khamba',
      'Nand Bhawan',
      'Brahmand Ghat',
      'Raman Reti',
      'Nand Baba Temple',
    ],
  },
  {
    place: 'Kokilavan',
    landmarks: [
      'Kokilavan Dham',
      'Shani Dev Temple',
      'Kokilavan Shani Temple',
      'Kokilavan Kund',
      'Giriraj Ji Temple',
      'Parikrama Marg',
    ],
  },
];

export const BRAJ_LANDMARK_PLACE_NAMES = BRAJ_LANDMARK_GROUPS.map((group) => group.place);

export const LANDMARK_OPTIONS = Array.from(
  new Set(BRAJ_LANDMARK_GROUPS.flatMap((group) => group.landmarks)),
);

export const getLandmarkOptionsForPlace = (place: string) => {
  if (!place) return [];
  if (place === OTHER_LANDMARK_OPTION) return LANDMARK_OPTIONS;
  const group = BRAJ_LANDMARK_GROUPS.find((item) => item.place === place);
  return group?.landmarks || LANDMARK_OPTIONS;
};

export const getLandmarkPlaceForValue = (value?: string) => {
  if (!value) return '';
  return BRAJ_LANDMARK_GROUPS.find((group) => group.landmarks.includes(value))?.place || '';
};

const PLACE_ALIASES: Record<string, string> = {
  vrindavan: 'Vrindavan',
  brindavan: 'Vrindavan',
  mathura: 'Mathura',
  govardhan: 'Govardhan',
  goverdhan: 'Govardhan',
  barsana: 'Barsana',
  barshana: 'Barsana',
  nandgaon: 'Nandgaon',
  gokul: 'Gokul',
  baldeo: 'Baldeo',
  radhakund: 'Radhakund',
  'radha kund': 'Radhakund',
  mahavan: 'Mahavan',
  kokilavan: 'Kokilavan',
};

export const getLandmarkPlaceForText = (value?: string) => {
  const lower = String(value || '').toLowerCase();
  return Object.entries(PLACE_ALIASES).find(([alias]) => lower.includes(alias))?.[1] || '';
};

export const getLandmarkPlaceForListing = (nearestTemple?: string, location?: string) =>
  getLandmarkPlaceForValue(nearestTemple) || getLandmarkPlaceForText(location);
