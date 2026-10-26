import { describe, it, expect } from 'vitest';
import {
  resolveItemLandmark,
  groupItemsIntoLocationSections,
  findLandmark,
  BRAJ_LANDMARK_REGISTRY,
} from '@/lib/geoDiscovery';

describe('Geographic Landmark Discovery & Placement Engine', () => {
  it('correctly maps "Near Kirti Mandir" to the Kirti Mandir landmark section', () => {
    const hotel = {
      _id: 'kirti_hotel_1',
      name: 'Radhe Shyam Ashram',
      nearestTemple: 'Near Kirti Mandir',
      location: 'Barsana',
    };
    const lm = resolveItemLandmark(hotel);
    expect(lm).not.toBeNull();
    expect(lm?.id).toBe('kirti_mandir');
    expect(lm?.name).toBe('Kirti Mandir');
    expect(lm?.sectionHeading).toBe('Near Kirti Mandir');
  });

  it('correctly maps "Kirti Mandir" without prefix to Kirti Mandir landmark section', () => {
    const hotel = {
      _id: 'kirti_hotel_2',
      name: 'Kirti Dham Stay',
      nearestTemple: 'Kirti Mandir',
      location: 'Barsana Marg',
    };
    const lm = resolveItemLandmark(hotel);
    expect(lm).not.toBeNull();
    expect(lm?.id).toBe('kirti_mandir');
    expect(lm?.sectionHeading).toBe('Near Kirti Mandir');
  });

  it('correctly maps room types whose parent hotel is configured Near Kirti Mandir', () => {
    const roomType = {
      _id: 'rt_kirti_1',
      name: 'Deluxe AC Room',
      hotel: {
        _id: 'h_kirti',
        name: 'Barsana Palace',
        nearestTemple: 'Near Kirti Mandir',
      },
    };
    const lm = resolveItemLandmark(roomType);
    expect(lm).not.toBeNull();
    expect(lm?.id).toBe('kirti_mandir');
  });

  it('correctly maps other supported Braj landmarks without guessing by address', () => {
    const cases = [
      { nearestTemple: 'Prem Mandir', expectedId: 'prem_mandir' },
      { nearestTemple: 'ISKCON Temple', expectedId: 'iskcon' },
      { nearestTemple: 'Shri Banke Bihari Ji Temple', expectedId: 'banke_bihari' },
      { nearestTemple: 'Shri Radha Raman Temple', expectedId: 'radha_raman' },
      { nearestTemple: 'Mathura Junction', expectedId: 'mathura_junction' },
      { nearestTemple: 'Dholipyau', expectedId: 'mathura_junction' },
      { nearestTemple: 'Shri Krishna Janmabhoomi Temple', expectedId: 'krishna_janmabhoomi' },
      { nearestTemple: 'Barshana Temple', expectedId: 'radha_rani' },
      { nearestTemple: 'Giriraj Ji Temple', expectedId: 'govardhan' },
      { nearestTemple: 'Shri Dwarkadhish Temple', expectedId: 'dwarkadhish' },
    ];

    for (const c of cases) {
      const lm = resolveItemLandmark({ _id: 'test', nearestTemple: c.nearestTemple });
      expect(lm?.id, `Failed for ${c.nearestTemple}`).toBe(c.expectedId);
    }
  });

  it('does NOT guess landmark proximity based on location or hotel name when nearestTemple is unset or Others', () => {
    // Hotel has "Vrindavan" and "Prem Mandir Road" in address, but NO nearestTemple
    const hotelWithoutTemple = {
      _id: 'no_temple_hotel',
      name: 'Grand City Hotel',
      location: 'Vrindavan near Prem Mandir bypass',
      fullAddress: 'Chaitanya Vihar, Vrindavan',
      nearestTemple: '',
    };
    expect(resolveItemLandmark(hotelWithoutTemple)).toBeNull();

    // Hotel with "Others" selection
    const hotelOthers = {
      _id: 'others_hotel',
      name: 'Mathura Residency',
      location: 'Mathura station area',
      nearestTemple: 'Others',
    };
    expect(resolveItemLandmark(hotelOthers)).toBeNull();
  });

  it('groups items into respective sections and keeps unassigned in "More Stays Across Braj" without duplication', () => {
    const listings = [
      { _id: 'h1', name: 'Kirti View', nearestTemple: 'Near Kirti Mandir' },
      { _id: 'h2', name: 'Prem Stay', nearestTemple: 'Prem Mandir' },
      { _id: 'h3', name: 'Janmasthan Inn', nearestTemple: 'Shri Krishna Janmabhoomi Temple' },
      { _id: 'h4', name: 'Barsana Guest House', nearestTemple: 'Barshana Temple' },
      { _id: 'h5', name: 'Highway Rest Stop', nearestTemple: 'Others' },
      { _id: 'h6', name: 'Rural Braj Farmstay', nearestTemple: '' },
    ];

    const sections = groupItemsIntoLocationSections(listings, null, '/hotels');

    // Check section headings
    const sectionIds = sections.map((s) => s.id);
    expect(sectionIds).toContain('kirti_mandir');
    expect(sectionIds).toContain('prem_mandir');
    expect(sectionIds).toContain('krishna_janmabhoomi');
    expect(sectionIds).toContain('radha_rani');
    expect(sectionIds).toContain('more_braj_stays');

    // Verify Kirti Mandir section contains h1
    const kirtiSec = sections.find((s) => s.id === 'kirti_mandir');
    expect(kirtiSec?.items.map((i) => i._id)).toEqual(['h1']);

    // Verify "More Stays Across Braj" contains ONLY unassigned h5 and h6
    const moreSec = sections.find((s) => s.id === 'more_braj_stays');
    expect(moreSec?.items.map((i) => i._id)).toEqual(['h5', 'h6']);

    // Verify no card appears in more than one section
    const allAssignedIds = sections.flatMap((s) => s.items.map((i) => i._id));
    const uniqueIds = new Set(allAssignedIds);
    expect(allAssignedIds.length).toBe(uniqueIds.size);
    expect(allAssignedIds.length).toBe(listings.length);
  });

  it('findLandmark locates Kirti Mandir by id and name', () => {
    expect(findLandmark('kirti_mandir')?.name).toBe('Kirti Mandir');
    expect(findLandmark('Kirti Mandir')?.id).toBe('kirti_mandir');
    expect(findLandmark('near_kirti_mandir')?.id).toBe('kirti_mandir');
  });
});
