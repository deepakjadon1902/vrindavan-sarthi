const Tour = require('../models/Tour');

const defaultTourPackages = [
  {
    name: 'Govardhan Darshan',
    destination: 'Govardhan',
    duration: '5-6 hours',
    durationDays: 1,
    pricePerPerson: 1499,
    groupSize: 4,
    cabType: 'Sedan / SUV',
    startPoint: 'Vrindavan / Mathura',
    endPoint: 'Govardhan',
    placesCovered: ['दानघाटी मंदिर', 'श्रीनाथ जी', 'मानसी गंगा', 'कुसुम सरोवर', 'राधाकुंड', 'श्यामकुंड', 'पूँछरी का लौठा'],
    highlights: ['Govardhan darshan', 'Radha Kund and Shyam Kund', 'Comfortable AC cab'],
    includes: ['AC Cab', 'Experienced Driver', '24x7 Support', 'Temple darshan guidance', 'Online Payment'],
    description: 'A focused Govardhan darshan route covering the major temples, kunds, and sacred points around Govardhan.',
    itinerary: 'दानघाटी मंदिर\nश्रीनाथ जी\nमानसी गंगा\nकुसुम सरोवर\nराधाकुंड\nश्यामकुंड\nपूँछरी का लौठा',
    image: '/placeholder.svg',
  },
  {
    name: 'Mathura - Vrindavan Darshan',
    destination: 'Mathura / Vrindavan',
    duration: '8-10 hours',
    durationDays: 1,
    pricePerPerson: 2199,
    groupSize: 4,
    cabType: 'Sedan / SUV',
    startPoint: 'Mathura / Vrindavan',
    endPoint: 'Vrindavan',
    placesCovered: ['श्रीकृष्ण जन्मभूमि', 'द्वारकाधीश मंदिर', 'प्रेम मंदिर', 'बाँके बिहारी मंदिर', 'इस्कॉन मंदिर', 'निधिवन', 'केशी घाट'],
    highlights: ['Mathura and Vrindavan in one day', 'Major Krishna temples', 'Evening darshan support'],
    includes: ['AC Cab', 'Experienced Driver', '24x7 Support', 'Temple darshan guidance', 'Online Payment'],
    description: 'Complete Mathura and Vrindavan darshan package for families and pilgrims who want the most important temples in one day.',
    itinerary: 'श्रीकृष्ण जन्मभूमि\nद्वारकाधीश मंदिर\nप्रेम मंदिर\nबाँके बिहारी मंदिर\nइस्कॉन मंदिर\nनिधिवन\nकेशी घाट',
    image: '/placeholder.svg',
  },
  {
    name: 'Gokul - Mahavan Tour',
    destination: 'Gokul / Mahavan',
    duration: '4-5 hours',
    durationDays: 1,
    pricePerPerson: 1299,
    groupSize: 4,
    cabType: 'Sedan / SUV',
    startPoint: 'Mathura',
    endPoint: 'Gokul',
    placesCovered: ['रमणरेती', 'चौरासी खंभा', 'नंद भवन', 'ब्रह्मांड घाट'],
    highlights: ['Gokul leela sthali darshan', 'Short half-day route', 'Family friendly'],
    includes: ['AC Cab', 'Experienced Driver', '24x7 Support', 'Temple darshan guidance', 'Online Payment'],
    description: 'A short and peaceful Gokul-Mahavan route covering important childhood leela places of Shri Krishna.',
    itinerary: 'रमणरेती\nचौरासी खंभा\nनंद भवन\nब्रह्मांड घाट',
    image: '/placeholder.svg',
  },
  {
    name: 'Barsana - Nandgaon Tour',
    destination: 'Barsana / Nandgaon',
    duration: '6-7 hours',
    durationDays: 1,
    pricePerPerson: 1799,
    groupSize: 4,
    cabType: 'Sedan / SUV',
    startPoint: 'Vrindavan / Mathura',
    endPoint: 'Barsana',
    placesCovered: ['श्रीजी मंदिर', 'प्रेम सरोवर', 'नंद भवन', 'कोकिलावन'],
    highlights: ['Barsana and Nandgaon darshan', 'Shri Radha Rani temple', 'Comfortable day trip'],
    includes: ['AC Cab', 'Experienced Driver', '24x7 Support', 'Temple darshan guidance', 'Online Payment'],
    description: 'A devotional route for Barsana, Nandgaon, and nearby sacred points with cab and guidance support.',
    itinerary: 'श्रीजी मंदिर\nप्रेम सरोवर\nनंद भवन\nकोकिलावन',
    image: '/placeholder.svg',
  },
  {
    name: 'Braj 84 Kos Yatra',
    destination: 'Braj Mandal',
    duration: '2-3 days',
    durationDays: 3,
    pricePerPerson: 6999,
    groupSize: 6,
    cabType: 'SUV / Tempo Traveller',
    startPoint: 'Mathura / Vrindavan',
    endPoint: 'Vrindavan',
    placesCovered: ['गोवर्धन', 'राधाकुंड', 'बरसाना', 'नंदगाँव', 'गोकुल', 'बलदेव', 'मथुरा', 'वृंदावन'],
    highlights: ['Full Braj 84 Kos route', 'Multi-day yatra planning', 'Driver and support assistance'],
    includes: ['AC Cab', 'Experienced Driver', '24x7 Support', 'Temple darshan guidance', 'Online Payment'],
    description: 'A multi-day Braj 84 Kos Yatra package covering the most important Braj Mandal places with travel support.',
    itinerary: 'गोवर्धन\nराधाकुंड\nबरसाना\nनंदगाँव\nगोकुल\nबलदेव\nमथुरा\nवृंदावन',
    image: '/placeholder.svg',
  },
];

const seedToursOnce = async () => {
  for (const item of defaultTourPackages) {
    const exists = await Tour.exists({ name: item.name, partnerSubmitted: false });
    if (exists) continue;
    await Tour.create({
      ...item,
      status: 'active',
      approvalStatus: 'approved',
      partnerSubmitted: false,
    });
  }
};

module.exports = { seedToursOnce };
