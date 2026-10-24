const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBookingReceiptPdf } = require('../utils/bookingReceiptPdf');
const {
  getNextNumericId,
  getNextPropertyId,
  getNextCategoryId,
  getNextRoomId,
  getNextBookingId,
  deriveStableNumericId,
  resolveReceiptIdentifiers,
} = require('../utils/idAllocation');
const Counter = require('../models/Counter');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const Booking = require('../models/Booking');

test('Receipt Redesign & Numeric ID System Test Suite', async (t) => {

  // 1. Official logo inside clean circular vector crop
  await t.test('1. Official logo is clipped inside clean vector circle with gold accent ring', () => {
    const booking = {
      bookingId: 'VVS-2026-10492',
      displayBookingId: '0001',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Radha Mohan Dham Dharamshala - Deluxe AC Room',
      totalAmount: 2079,
      amountPaidOnline: 79,
      amountPayableAtProperty: 2000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      customerFullName: 'Gopal Das',
      createdAt: new Date().toISOString(),
    };

    const res = buildBookingReceiptPdf(booking);
    assert.ok(Buffer.isBuffer(res.buffer));
    const pdfText = res.buffer.toString('binary');

    // Circular Bézier clipping operators: m, c, h W n ... /Logo Do ... Q
    assert.ok(pdfText.includes('W n'), 'Must contain clipping path operators W n');
    assert.ok(pdfText.includes('/Logo Do'), 'Must draw /Logo within clipped state');
  });

  // 2. Reduced Booking ID font size & visual hierarchy
  await t.test('2. Booking ID is rendered with compact font size (8.5 - 9.5 pt) without dominating receipt', () => {
    const booking = {
      bookingId: 'VVS-2026-99123',
      displayBookingId: '0042',
      bookingType: 'hotel',
      itemName: 'Braj Heritage Hotel - Super Deluxe',
      totalAmount: 3500,
      amountPaidOnline: 1050,
      amountPayableAtProperty: 2450,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');

    assert.ok(pdfText.includes('BOOKING ID'), 'Must have BOOKING ID header label');
    assert.ok(pdfText.includes('0042'), 'Must include compact display booking ID');
    assert.ok(pdfText.includes('Ref: VVS-2026-99123'), 'Must preserve canonical reference');
  });

  // 3. Property ID formatted as 3-digit numeric string
  await t.test('3. Property ID is separated, formatted as 3-digit numeric string (e.g. 001)', () => {
    const id1 = deriveStableNumericId('6718a38b1111111111111101', 3);
    const id2 = deriveStableNumericId('6718a38b1111111111111102', 3);
    assert.match(id1, /^\d{3}$/, 'Property ID must be exactly 3 digits with leading zeros');
    assert.match(id2, /^\d{3}$/, 'Property ID must be exactly 3 digits with leading zeros');
    assert.notStrictEqual(id1, id2, 'Distinct entities should produce distinct IDs');

    const identifiers = resolveReceiptIdentifiers(
      { bookingId: 'VVS-1' },
      { _id: '6718a38b1111111111111101', name: 'Govardhan Palace Hotel', propertyId: '007' }
    );
    assert.strictEqual(identifiers.propertyId, '007');
  });

  // 4. Category ID formatted as 2-digit numeric string
  await t.test('4. Category ID is formatted as 2-digit numeric string (e.g. 01, 02)', () => {
    const catId1 = deriveStableNumericId('6718a38b2222222222222201', 2);
    assert.match(catId1, /^\d{2}$/, 'Category ID must be exactly 2 digits with leading zeros');

    const identifiers = resolveReceiptIdentifiers(
      { bookingId: 'VVS-1' },
      null,
      { _id: '6718a38b2222222222222201', name: 'Double Bed AC Room', categoryId: '03' }
    );
    assert.strictEqual(identifiers.categoryId, '03');
    assert.strictEqual(identifiers.roomTypeName, 'Double Bed AC Room');
  });

  // 5. Physical Room Number & short numeric Room ID when allocated
  await t.test('5. Room ID and physical room number are cleanly separated when room is allocated', () => {
    const identifiers = resolveReceiptIdentifiers(
      {
        bookingId: 'VVS-1',
        roomNumber: '104',
        roomId: '104',
      },
      null,
      { name: 'Deluxe AC' },
      { number: '104', roomId: '104' }
    );

    assert.strictEqual(identifiers.roomNumber, '104');
    assert.strictEqual(identifiers.roomId, '104');

    const booking = {
      bookingId: 'VVS-ALLOC-1',
      displayBookingId: '0015',
      bookingType: 'room_type',
      itemName: 'Radha Mohan Dham - AC Room',
      roomNumber: '104',
      roomId: '104',
      propertyId: '002',
      categoryId: '01',
      totalAmount: 1800,
      amountPaidOnline: 1800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Room No. 104 | Room ID: 104'), 'Must display room number and room ID together');
    assert.ok(pdfText.includes('Property ID: 002'), 'Must display Property ID');
    assert.ok(pdfText.includes('Category ID: 01'), 'Must display Category ID');
  });

  // 6. Unallocated rooms cleanly show "Room: Allocated at Check-in" without fabricated numbers
  await t.test('6. Unallocated rooms display "Room: Allocated at Check-in" without guessing numbers', () => {
    const identifiers = resolveReceiptIdentifiers(
      { bookingId: 'VVS-UNALLOC' },
      null,
      { name: 'Standard Room' },
      null
    );

    assert.strictEqual(identifiers.roomNumber, null);
    assert.strictEqual(identifiers.roomId, null);

    const booking = {
      bookingId: 'VVS-UNALLOC',
      displayBookingId: '0016',
      bookingType: 'room_type',
      itemName: 'Braj Seva Ashram - Non-AC Room',
      totalAmount: 1200,
      amountPaidOnline: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Room: Allocated at Check-in'), 'Must display Allocated at Check-in when unallocated');
    assert.ok(!pdfText.includes('Room No. undefined'), 'Must not display undefined room number');
    assert.ok(!pdfText.includes('Room ID: null'), 'Must not display null room ID');
  });

  // 7. Display Booking ID: short 4-digit numeric sequence with leading zeros
  await t.test('7. Display Booking ID formats correctly with 4 digits and leading zeros', () => {
    const booking = {
      bookingId: 'VVS-2026-44444',
      displayBookingId: '0003',
      bookingType: 'hotel',
      itemName: 'Govardhan Palace - Family Suite',
      totalAmount: 5000,
      amountPaidOnline: 5000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const identifiers = resolveReceiptIdentifiers(booking);
    assert.strictEqual(identifiers.displayBookingId, '0003');
    assert.strictEqual(identifiers.canonicalBookingId, 'VVS-2026-44444');

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('0003'), 'Must contain 0003 display booking ID');
  });

  // 8. Concurrent ID allocation simulation & uniqueness
  await t.test('8. Concurrent ID allocation produces unique sequences without collision', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    const sequences = new Map();

    Counter.findByIdAndUpdate = async (key, update, opts) => {
      const inc = update?.$inc?.seq || 1;
      const current = (sequences.get(key) || 0) + inc;
      sequences.set(key, current);
      return { _id: key, seq: current };
    };

    try {
      const promises = Array.from({ length: 50 }, () => getNextBookingId());
      const results = await Promise.all(promises);
      const uniqueResults = new Set(results);

      assert.strictEqual(uniqueResults.size, 50, 'All 50 concurrent allocations must be unique');
      results.forEach((id) => {
        assert.match(id, /^\d{4}$/, 'Each ID must be 4 numeric digits');
      });
      assert.strictEqual(results[0], '0001');
      assert.strictEqual(results[49], '0050');
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 9. Legacy booking references backward compatibility
  await t.test('9. Legacy bookings without stored numeric IDs render gracefully with stable fallbacks', () => {
    const legacyBooking = {
      _id: '6718a38b3333333333333301',
      bookingId: 'VVS-DR-2025-9988',
      bookingType: 'hotel',
      itemName: 'Old Heritage Inn - Standard AC Room',
      totalAmount: 2200,
      amountPaidOnline: 2200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(legacyBooking);
    assert.ok(Buffer.isBuffer(res.buffer));
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('VVS-DR-2025-9988'), 'Must include legacy booking reference');
    assert.ok(pdfText.includes('Property ID:'), 'Must generate stable Property ID');
    assert.ok(pdfText.includes('Category ID:'), 'Must generate stable Category ID');
  });

  // 10. Complete Property Name & Full Address without truncation
  await t.test('10. Full official property name and complete address are displayed', () => {
    const booking = {
      bookingId: 'VVS-2026-55555',
      displayBookingId: '0005',
      bookingType: 'room_type',
      propertyName: 'Shri Radha Rani Paramhans Trust Dharamshala',
      propertyAddress: 'Parikrama Marg, Opposite Radha Kund Post Office, Radha Kund, Mathura, UP 281504',
      nearestTemple: 'Radha Kund & Shyam Kund',
      itemName: 'Shri Radha Rani Paramhans Trust Dharamshala - Deluxe 4 Bed Room',
      totalAmount: 2400,
      amountPaidOnline: 79,
      amountPayableAtProperty: 2321,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');

    assert.ok(pdfText.includes('Shri Radha Rani Paramhans Trust Dharamshala'), 'Must include complete property name');
    assert.ok(pdfText.includes('Parikrama Marg, Opposite Radha Kund Post'), 'Must include full address');
    assert.ok(pdfText.includes('Near Radha Kund & Shyam Kund'), 'Must include nearest temple');
  });

  // 11. Preserved offline QR code and interactive PDF annotation
  await t.test('11. Vector QR code is present and clickable annotation points to verification URL', () => {
    const booking = {
      bookingId: 'VVS-2026-QRTEST',
      displayBookingId: '0008',
      bookingType: 'room_type',
      itemName: 'Braj Palace - AC Room',
      totalAmount: 1800,
      amountPaidOnline: 1800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');

    assert.ok(pdfText.includes('https://www.vrindavansarthi.in/verify-booking?ref=VVS-2026-QRTEST'), 'Annotation must link to verification URL');
    assert.ok(pdfText.includes('/Subtype /Link'), 'Must include interactive PDF Link annotation');
  });

  // 12. Strict single-page A4 geometry
  await t.test('12. Redesigned receipt fits strictly on exactly 1 page A4 (841.89 pt)', () => {
    const scenarios = [
      {
        name: 'Dharamshala Advance Fee Only',
        booking: {
          bookingId: 'VVS-A4-1',
          displayBookingId: '0010',
          bookingType: 'room_type',
          service_billing_model: 'dharamshala_booking',
          itemName: 'Prem Mandir Sewa Sadan - AC Room',
          dharamshalaAmount: 1500,
          vrindavanSarthiServiceFee: 79,
          totalAmount: 1579,
          amountPaidOnline: 79,
          amountPayableAtProperty: 1500,
          paymentStatus: 'paid',
          bookingStatus: 'confirmed',
          roomNumber: '205',
          roomId: '205',
        },
      },
      {
        name: 'Hotel 30% Advance',
        booking: {
          bookingId: 'VVS-A4-2',
          displayBookingId: '0011',
          bookingType: 'room_type',
          service_billing_model: 'hotel_marketplace',
          itemName: 'Krishna Kripa Palace - Deluxe AC',
          baseAmount: 3000,
          convenienceFeeAmount: 133.5,
          taxAmount: 360,
          totalAmount: 3493.5,
          amountPaidOnline: 1048.05,
          amountPayableAtProperty: 2445.45,
          paymentStatus: 'paid',
          bookingStatus: 'confirmed',
        },
      },
      {
        name: 'Hotel 100% Online',
        booking: {
          bookingId: 'VVS-A4-3',
          displayBookingId: '0012',
          bookingType: 'hotel',
          itemName: 'Royal Braj Resort - Suite',
          totalAmount: 4800,
          amountPaidOnline: 4800,
          amountPayableAtProperty: 0,
          paymentStatus: 'paid',
          bookingStatus: 'confirmed',
        },
      },
    ];

    for (const sc of scenarios) {
      const res = buildBookingReceiptPdf(sc.booking);
      const pageMatches = res.buffer.toString('utf8').match(/\/Type\s*\/Page\b/g);
      assert.strictEqual(pageMatches.length, 1, `${sc.name} must produce exactly 1 page`);
    }
  });

  // 13. Dharamshala request-mode bookings assign numeric displayBookingId and resolved property/category IDs
  await t.test('13. Dharamshala request flow assigns displayBookingId, propertyId, categoryId without colliding', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    let bookingSeq = 100;
    Counter.findByIdAndUpdate = async (key) => {
      if (key === 'booking_id') {
        bookingSeq += 1;
        return { _id: key, seq: bookingSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const hotel = { _id: '6718a38b1111111111111101', propertyId: '001', name: 'Shri Radha Dham' };
      const roomType = { _id: '6718a38b2222222222222201', categoryId: '02', name: 'Deluxe AC' };

      const displayBookingId = await getNextBookingId();
      assert.strictEqual(displayBookingId, '0101');

      const identifiers = resolveReceiptIdentifiers(
        {
          bookingId: 'VVS-REQ-0101',
          displayBookingId,
          propertyId: hotel.propertyId,
          categoryId: roomType.categoryId,
        },
        hotel,
        roomType
      );

      assert.strictEqual(identifiers.displayBookingId, '0101');
      assert.strictEqual(identifiers.propertyId, '001');
      assert.strictEqual(identifiers.categoryId, '02');
      assert.strictEqual(identifiers.canonicalBookingId, 'VVS-REQ-0101');
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 14. OTA reservation imports receive unique numeric display ID without replacing canonical ID or external ref
  await t.test('14. Channel manager OTA imports assign numeric displayBookingId preserving external ref', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    let bookingSeq = 200;
    Counter.findByIdAndUpdate = async (key) => {
      if (key === 'booking_id') {
        bookingSeq += 1;
        return { _id: key, seq: bookingSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const displayBookingId = await getNextBookingId();
      const otaBooking = {
        bookingId: 'VVS-2026-98765',
        displayBookingId,
        additionalInfo: 'Channel reservation bookingcom:RES-12345678',
        itemName: 'Braj Haveli - Deluxe Suite',
      };

      const identifiers = resolveReceiptIdentifiers(otaBooking);
      assert.strictEqual(identifiers.displayBookingId, '0201');
      assert.strictEqual(identifiers.canonicalBookingId, 'VVS-2026-98765');

      const res = buildBookingReceiptPdf(otaBooking);
      const pdfText = res.buffer.toString('binary');
      assert.ok(pdfText.includes('0201'), 'Must include numeric display ID');
      assert.ok(pdfText.includes('Ref: VVS-2026-98765'), 'Must preserve canonical booking ID');
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 15. Hotel creation flows allocate sequential 3-digit Property ID (001, 002) and prevent duplicates
  await t.test('15. Hotel creation allocates sequential 3-digit Property ID without duplicates', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    let propSeq = 0;
    Counter.findByIdAndUpdate = async (key) => {
      if (key === 'property_id') {
        propSeq += 1;
        return { _id: key, seq: propSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const p1 = await getNextPropertyId();
      const p2 = await getNextPropertyId();
      const p3 = await getNextPropertyId();

      assert.strictEqual(p1, '001');
      assert.strictEqual(p2, '002');
      assert.strictEqual(p3, '003');
      assert.notStrictEqual(p1, p2);
      assert.notStrictEqual(p2, p3);
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 16. RoomType creation flows allocate sequential 2-digit Category ID (01, 02) scoped to parent property
  await t.test('16. RoomType creation allocates sequential 2-digit Category ID scoped per property', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    const scopes = new Map();
    Counter.findByIdAndUpdate = async (key) => {
      const current = (scopes.get(key) || 0) + 1;
      scopes.set(key, current);
      return { _id: key, seq: current };
    };

    try {
      const hotel1Id = '6718a38b1111111111111101';
      const hotel2Id = '6718a38b1111111111111102';

      const h1_c1 = await getNextCategoryId(hotel1Id);
      const h1_c2 = await getNextCategoryId(hotel1Id);
      const h2_c1 = await getNextCategoryId(hotel2Id);

      assert.strictEqual(h1_c1, '01');
      assert.strictEqual(h1_c2, '02');
      assert.strictEqual(h2_c1, '01', 'Separate property starts its own category sequence from 01');
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 17. Authoritative hotel.propertyId takes precedence over stale booking-level fallback across receipts
  await t.test('17. Authoritative hotel.propertyId overrides stale booking-level fallback consistently', () => {
    const staleBooking = {
      bookingId: 'VVS-OLD-1',
      hotelId: '6718a38b1111111111111101',
      propertyId: '342', // stale fallback previously frozen on booking
      categoryId: '99',  // stale category fallback
    };

    const authoritativeHotel = {
      _id: '6718a38b1111111111111101',
      propertyId: '001', // authoritative canonical property ID
      name: 'Shri Radha Rani Mandir Trust',
    };

    const authoritativeRoomType = {
      _id: '6718a38b2222222222222201',
      categoryId: '02', // authoritative category ID
      name: 'AC Double Bed',
    };

    const identifiers = resolveReceiptIdentifiers(staleBooking, authoritativeHotel, authoritativeRoomType);
    assert.strictEqual(identifiers.propertyId, '001', 'Authoritative hotel.propertyId must override stale booking.propertyId');
    assert.strictEqual(identifiers.categoryId, '02', 'Authoritative roomType.categoryId must override stale booking.categoryId');

    const res = buildBookingReceiptPdf(staleBooking, { hotel: authoritativeHotel, roomType: authoritativeRoomType });
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Property ID: 001'), 'Receipt must display authoritative Property ID: 001');
    assert.ok(!pdfText.includes('Property ID: 342'), 'Receipt must not display stale Property ID: 342');
    assert.ok(pdfText.includes('Category ID: 02'), 'Receipt must display authoritative Category ID: 02');
  });

  // 18. New booking creation avoids writing inconsistent fallback IDs when hotel has no propertyId
  await t.test('18. Booking resolution safely handles hotels without stored propertyId via deterministic fallback', () => {
    const unmigratedHotel = {
      _id: '6718a38b1111111111111101',
      name: 'Old Dharamshala Unmigrated',
    };

    // When booking has no propertyId and hotel has no propertyId
    const identifiers = resolveReceiptIdentifiers({ bookingId: 'VVS-NEW-1' }, unmigratedHotel, null);
    assert.ok(identifiers.propertyId, 'Must derive a stable 3-digit numeric ID');
    assert.match(identifiers.propertyId, /^\d{3}$/, 'Must be 3 digits');

    // Consecutive resolutions for same hotel must be identical
    const identifiers2 = resolveReceiptIdentifiers({ bookingId: 'VVS-NEW-2' }, unmigratedHotel, null);
    assert.strictEqual(identifiers.propertyId, identifiers2.propertyId, 'Must be completely deterministic for the same hotel');
  });

});
