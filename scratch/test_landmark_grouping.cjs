const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

const BRAJ_LANDMARK_REGISTRY = [
  {
    id: 'kirti_mandir',
    name: 'Kirti Mandir',
    sectionHeading: 'Near Kirti Mandir',
    place: 'Barsana',
    lat: 27.6447,
    lng: 77.3752,
    subtitle: 'Barsana Dham, Rangeeli Mahal & Shri Radha Rani Marg',
    keywords: ['kirti mandir', 'kirti temple', 'kirti'],
  },
  {
    id: 'radha_rani',
    name: 'Radha Rani Temple',
    sectionHeading: 'Near Radha Rani Temple',
    place: 'Barsana',
    lat: 27.6486,
    lng: 77.3712,
    subtitle: 'Braj Barsana, Ladli Ji Mandir & Bhanukhar',
    keywords: ['radha rani', 'shri radha rani', 'barsana temple', 'barshana temple', 'ladli ji', 'ladli ji mandir', 'maan mandir', 'barsana', 'barshana'],
  },
  {
    id: 'prem_mandir',
    name: 'Prem Mandir',
    sectionHeading: 'Near Prem Mandir',
    place: 'Vrindavan',
    lat: 27.5714,
    lng: 77.6713,
    subtitle: 'Raman Reti, Chaitanya Vihar & Keshav Dham',
    keywords: ['prem mandir', 'keshav dham', 'chaitanya vihar'],
  },
  {
    id: 'iskcon',
    name: 'ISKCON Temple',
    sectionHeading: 'Near ISKCON Temple',
    place: 'Vrindavan',
    lat: 27.5815,
    lng: 77.6836,
    subtitle: 'Krishna Balaram Mandir & Sheetal Chhaya',
    keywords: ['iskcon', 'krishna balaram', 'sheetal chhaya', 'kaimar van', 'bhaktivedanta'],
  },
  {
    id: 'banke_bihari',
    name: 'Banke Bihari Temple',
    sectionHeading: 'Near Banke Bihari Temple',
    place: 'Vrindavan',
    lat: 27.5833,
    lng: 77.7013,
    subtitle: 'Historic Vrindavan Core & Temple Bazaar',
    keywords: ['banke bihari', 'bihari ji', 'vidyapeeth', 'dussehra ghat', 'haridas', 'kunj gali', 'bihari gali'],
  },
  {
    id: 'radha_raman',
    name: 'Radha Raman Temple',
    sectionHeading: 'Near Radha Raman Temple',
    place: 'Vrindavan',
    lat: 27.5882,
    lng: 77.7058,
    subtitle: 'Ancient Yamuna Ghats & Nidhivan Marg',
    keywords: ['radha raman', 'radharaman', 'kesi ghat', 'yamuna ghat', 'nidhivan', 'seva kunj'],
  },
  {
    id: 'mathura_junction',
    name: 'Mathura Junction',
    sectionHeading: 'Near Mathura Junction',
    place: 'Mathura',
    lat: 27.4924,
    lng: 77.6737,
    subtitle: 'Dholi Pyau, Mayur Vihar & Station Access',
    keywords: ['mathura junction', 'mathura railway', 'mathura railways station', 'railway station', 'dholi pyau', 'dholipyau', 'mayur vihar', 'canera bank', 'canara bank', 'narayanapuri', 'union bank', 'kans qila'],
  },
  {
    id: 'govardhan',
    name: 'Govardhan',
    sectionHeading: 'Near Govardhan',
    place: 'Govardhan',
    lat: 27.4984,
    lng: 77.4646,
    subtitle: 'Giriraj Parikrama Marg, Daan Ghati & Mansi Ganga',
    keywords: ['govardhan', 'goverdhan', 'daan ghati', 'giriraj', 'mansi ganga', 'radha kund', 'radhakund', 'kusum sarovar', 'jatipura', 'punchari', 'puchari', 'mukharvind'],
  },
  {
    id: 'krishna_janmabhoomi',
    name: 'Shri Krishna Janmabhoomi',
    sectionHeading: 'Near Shri Krishna Janmabhoomi',
    place: 'Mathura',
    lat: 27.505,
    lng: 77.6698,
    subtitle: 'Janmasthan, Bhuteshwar & Potra Kund',
    keywords: ['janmabhoomi', 'janambhoomi', 'bhuteshwar', 'jagannath puri', 'potra kund', 'keshav dev'],
  },
  {
    id: 'dwarkadhish',
    name: 'Shri Dwarkadhish Temple',
    sectionHeading: 'Near Shri Dwarkadhish Temple',
    place: 'Mathura',
    lat: 27.5042,
    lng: 77.6841,
    subtitle: 'Vishram Ghat & Yamuna Kinare',
    keywords: ['dwarkadhish', 'dwarikadhish', 'vishram ghat', 'vishram bazaar'],
  },
];

function createDynamicLandmark(rawName) {
  const cleanName = rawName.replace(/^near\s+/i, '').trim();
  const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    id,
    name: cleanName,
    sectionHeading: `Near ${cleanName}`,
    place: 'Other',
    lat: 27.58,
    lng: 77.69,
    subtitle: 'Braj Dham & Temple Surroundings',
    keywords: [cleanName.toLowerCase()],
  };
}

function resolveItemLandmark(item) {
  const hotel = item?.hotel || item || {};
  const nearest = String(hotel?.nearestTemple || item?.nearestTemple || '').trim();
  if (!nearest || nearest.toLowerCase() === 'others' || nearest.toLowerCase() === 'other') {
    return null;
  }

  const clean = nearest.replace(/^near\s+/i, '').trim().toLowerCase();

  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    if (
      landmark.name.toLowerCase() === clean ||
      landmark.id.toLowerCase() === clean ||
      landmark.name.toLowerCase().replace(/[-_ ]+/g, '') === clean.replace(/[-_ ]+/g, '')
    ) {
      return landmark;
    }
  }

  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    for (const kw of landmark.keywords) {
      if (clean.includes(kw) || kw.includes(clean)) {
        return landmark;
      }
    }
  }

  if (clean.length >= 3) {
    return createDynamicLandmark(nearest);
  }

  return null;
}

function groupItemsIntoLocationSections(items, userCoords, routePrefix = '/hotels') {
  if (!items.length) return [];

  const landmarkBuckets = new Map();
  const unassigned = [];

  for (const landmark of BRAJ_LANDMARK_REGISTRY) {
    landmarkBuckets.set(landmark.id, { landmark, items: [] });
  }

  for (const item of items) {
    const landmark = resolveItemLandmark(item);
    if (landmark) {
      if (!landmarkBuckets.has(landmark.id)) {
        landmarkBuckets.set(landmark.id, { landmark, items: [] });
      }
      landmarkBuckets.get(landmark.id).items.push(item);
    } else {
      unassigned.push(item);
    }
  }

  const sections = [];
  for (const { landmark, items: bucketItems } of landmarkBuckets.values()) {
    if (bucketItems.length === 0) continue;
    sections.push({
      id: landmark.id,
      heading: landmark.sectionHeading,
      subtitle: landmark.subtitle,
      items: bucketItems,
      filterUrl: `${routePrefix}?landmark=${landmark.id}`,
    });
  }

  if (unassigned.length > 0) {
    sections.push({
      id: 'more_braj_stays',
      heading: 'More Stays Across Braj',
      subtitle: 'Additional verified accommodations in surrounding Braj Dham areas',
      items: unassigned,
      filterUrl: routePrefix,
    });
  }

  return sections;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const hotels = await mongoose.connection.collection('hotels').find({}).toArray();
  
  // Also add a mock hotel with "Near Kirti Mandir" to test the Kirti Mandir requirement!
  const testKirtiHotel = {
    _id: 'mock_kirti_1',
    name: 'Kirti Dham Guesthouse',
    nearestTemple: 'Near Kirti Mandir',
    location: 'Near Kirti Mandir, Barsana',
    propertyType: 'hotel'
  };

  const allHotels = [...hotels, testKirtiHotel];

  const sections = groupItemsIntoLocationSections(allHotels, null, '/hotels');
  console.log(`Generated ${sections.length} discovery sections:`);
  sections.forEach((sec, idx) => {
    console.log(`\nSection ${idx + 1}: [${sec.id}] "${sec.heading}" (${sec.items.length} items)`);
    sec.items.forEach(h => console.log(`  - ${h.name} (nearestTemple: "${h.nearestTemple}")`));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
