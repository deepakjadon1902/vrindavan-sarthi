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
      displayBookingId: '10000001',
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
      displayBookingId: '10000042',
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
    assert.ok(pdfText.includes('10000042'), 'Must include compact display booking ID');
    assert.ok(pdfText.includes('Ref: VVS-2026-99123'), 'Must preserve canonical reference');
  });

  // 3. Property ID formatted as 6-digit numeric string (e.g. 100001)
  await t.test('3. Property ID is separated, formatted as exactly 6-digit numeric string (e.g. 100001)', () => {
    const id1 = deriveStableNumericId('6718a38b1111111111111101', 6, 100000);
    const id2 = deriveStableNumericId('6718a38b1111111111111102', 6, 100000);
    assert.match(id1, /^\d{6}$/, 'Property ID must be exactly 6 digits');
    assert.match(id2, /^\d{6}$/, 'Property ID must be exactly 6 digits');
    assert.notStrictEqual(id1, id2, 'Distinct entities should produce distinct IDs');

    const identifiers = resolveReceiptIdentifiers(
      { bookingId: 'VVS-1' },
      { _id: '6718a38b1111111111111101', name: 'Govardhan Palace Hotel', propertyId: '100007' }
    );
    assert.strictEqual(identifiers.propertyId, '100007');
    assert.match(identifiers.propertyId, /^\d{6}$/);
  });

  // 4. Room Category ID formatted as 4-digit numeric string (e.g. 2001)
  await t.test('4. Category ID is formatted as exactly 4-digit numeric string (e.g. 2001)', () => {
    const catId1 = deriveStableNumericId('6718a38b2222222222222201', 4, 2000);
    assert.match(catId1, /^\d{4}$/, 'Category ID must be exactly 4 digits');

    const identifiers = resolveReceiptIdentifiers(
      { bookingId: 'VVS-1' },
      null,
      { _id: '6718a38b2222222222222201', name: 'Double Bed AC Room', categoryId: '2003' }
    );
    assert.strictEqual(identifiers.categoryId, '2003');
    assert.strictEqual(identifiers.roomTypeName, 'Double Bed AC Room');
  });

  // 5. Physical Room Number & 4-digit numeric Room ID when allocated
  await t.test('5. Room ID and physical room number are cleanly separated when room is allocated', () => {
    const identifiers = resolveReceiptIdentifiers(
      {
        bookingId: 'VVS-1',
        roomNumber: '104',
        roomId: '1004',
      },
      null,
      { name: 'Deluxe AC' },
      { number: '104', roomId: '1004' }
    );

    assert.strictEqual(identifiers.roomNumber, '104');
    assert.strictEqual(identifiers.roomId, '1004');

    const booking = {
      bookingId: 'VVS-ALLOC-1',
      displayBookingId: '10000015',
      bookingType: 'room_type',
      itemName: 'Radha Mohan Dham - AC Room',
      roomNumber: '104',
      roomId: '1004',
      propertyId: '100002',
      categoryId: '2001',
      totalAmount: 1800,
      amountPaidOnline: 1800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Room ID: 1004'), 'Must display Room ID');
    assert.ok(!pdfText.includes('Room No.'), 'Must NOT display "Room No." anywhere on invoice');
    assert.ok(pdfText.includes('Property ID: 100002'), 'Must display Property ID');
    assert.ok(pdfText.includes('Category ID: 2001'), 'Must display Category ID');
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
      displayBookingId: '10000016',
      bookingType: 'room_type',
      itemName: 'Braj Seva Ashram - Non-AC Room',
      totalAmount: 1200,
      amountPaidOnline: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Room ID: Allocated at Check-in'), 'Must display Room ID: Allocated at Check-in when unallocated');
    assert.ok(!pdfText.includes('Room No.'), 'Must NOT display "Room No." anywhere on invoice');
    assert.ok(!pdfText.includes('Room No. undefined'), 'Must not display undefined room number');
    assert.ok(!pdfText.includes('Room ID: null'), 'Must not display null room ID');
  });

  // 7. Display Booking ID: exactly 8-digit numeric sequence with leading zeros
  await t.test('7. Display Booking ID formats correctly with 8 digits and leading zeros', () => {
    const booking = {
      bookingId: 'VVS-2026-44444',
      displayBookingId: '10000003',
      bookingType: 'hotel',
      itemName: 'Govardhan Palace - Family Suite',
      totalAmount: 5000,
      amountPaidOnline: 5000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const identifiers = resolveReceiptIdentifiers(booking);
    assert.strictEqual(identifiers.displayBookingId, '10000003');
    assert.match(identifiers.displayBookingId, /^\d{8}$/);
    assert.strictEqual(identifiers.canonicalBookingId, 'VVS-2026-44444');

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('10000003'), 'Must contain 10000003 display booking ID');
  });

  // 8. Concurrent ID allocation simulation & uniqueness
  await t.test('8. Concurrent ID allocation produces unique sequences without collision', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    const sequences = new Map();

    Counter.findByIdAndUpdate = async (key, update) => {
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
        assert.match(id, /^\d{8}$/, 'Each ID must be 8 numeric digits');
      });
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
  });

  // 10. Complete Property Name & Full Address without truncation
  await t.test('10. Full official property name and complete address are displayed', () => {
    const booking = {
      bookingId: 'VVS-2026-55555',
      displayBookingId: '10000005',
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
      displayBookingId: '10000008',
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
          displayBookingId: '10000010',
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
          roomId: '1205',
        },
      },
      {
        name: 'Hotel 30% Advance',
        booking: {
          bookingId: 'VVS-A4-2',
          displayBookingId: '10000011',
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
          displayBookingId: '10000012',
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
      if (key === 'booking_id_v2') {
        bookingSeq += 1;
        return { _id: key, seq: bookingSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const hotel = { _id: '6718a38b1111111111111101', propertyId: '100001', name: 'Shri Radha Dham' };
      const roomType = { _id: '6718a38b2222222222222201', categoryId: '2002', name: 'Deluxe AC' };

      const displayBookingId = await getNextBookingId();
      assert.match(displayBookingId, /^\d{8}$/, 'Must be an 8-digit PNR numeric reference');
      assert.match(displayBookingId, /^\d{8}$/);

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

      assert.strictEqual(identifiers.displayBookingId, displayBookingId);
      assert.strictEqual(identifiers.propertyId, '100001');
      assert.strictEqual(identifiers.categoryId, '2002');
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
      if (key === 'booking_id_v2') {
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
      assert.strictEqual(identifiers.displayBookingId, displayBookingId);
      assert.match(displayBookingId, /^\d{8}$/);
      assert.strictEqual(identifiers.canonicalBookingId, 'VVS-2026-98765');

      const res = buildBookingReceiptPdf(otaBooking);
      const pdfText = res.buffer.toString('binary');
      assert.ok(pdfText.includes(displayBookingId), 'Must include numeric display ID');
      assert.ok(pdfText.includes('Ref: VVS-2026-98765'), 'Must preserve canonical booking ID');
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 15. Hotel creation flows allocate sequential 6-digit Property ID (100001, 100002)
  await t.test('15. Hotel creation allocates sequential 6-digit Property ID without duplicates', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    let propSeq = 0;
    Counter.findByIdAndUpdate = async (key) => {
      if (key === 'property_id_v2') {
        propSeq += 1;
        return { _id: key, seq: propSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const p1 = await getNextPropertyId();
      const p2 = await getNextPropertyId();
      const p3 = await getNextPropertyId();

      assert.strictEqual(p1, '100001');
      assert.strictEqual(p2, '100002');
      assert.strictEqual(p3, '100003');
      assert.match(p1, /^\d{6}$/);
      assert.match(p2, /^\d{6}$/);
      assert.match(p3, /^\d{6}$/);
      assert.notStrictEqual(p1, p2);
      assert.notStrictEqual(p2, p3);
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 16. RoomType creation flows allocate sequential 4-digit Category ID (2001, 2002)
  await t.test('16. RoomType creation allocates sequential 4-digit Category ID', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    let catSeq = 0;
    Counter.findByIdAndUpdate = async (key) => {
      if (key === 'category_id_v2') {
        catSeq += 1;
        return { _id: key, seq: catSeq };
      }
      return { _id: key, seq: 1 };
    };

    try {
      const c1 = await getNextCategoryId('hotel1');
      const c2 = await getNextCategoryId('hotel1');
      const c3 = await getNextCategoryId('hotel2');

      assert.strictEqual(c1, '2001');
      assert.strictEqual(c2, '2002');
      assert.strictEqual(c3, '2003');
      assert.match(c1, /^\d{4}$/);
      assert.match(c2, /^\d{4}$/);
      assert.match(c3, /^\d{4}$/);
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 17. Authoritative hotel.propertyId takes precedence over stale booking-level fallback across receipts
  await t.test('17. Authoritative hotel.propertyId overrides stale booking-level fallback consistently', () => {
    const staleBooking = {
      bookingId: 'VVS-OLD-1',
      hotelId: '6718a38b1111111111111101',
      propertyId: '342999', // stale fallback previously frozen on booking
      categoryId: '9999',   // stale category fallback
    };

    const authoritativeHotel = {
      _id: '6718a38b1111111111111101',
      propertyId: '100001', // authoritative canonical property ID
      name: 'Shri Radha Rani Mandir Trust',
    };

    const authoritativeRoomType = {
      _id: '6718a38b2222222222222201',
      categoryId: '2002', // authoritative category ID
      name: 'AC Double Bed',
    };

    const identifiers = resolveReceiptIdentifiers(staleBooking, authoritativeHotel, authoritativeRoomType);
    assert.strictEqual(identifiers.propertyId, '100001', 'Authoritative hotel.propertyId must override stale booking.propertyId');
    assert.strictEqual(identifiers.categoryId, '2002', 'Authoritative roomType.categoryId must override stale booking.categoryId');

    const res = buildBookingReceiptPdf(staleBooking, { hotel: authoritativeHotel, roomType: authoritativeRoomType });
    const pdfText = res.buffer.toString('binary');
    assert.ok(pdfText.includes('Property ID: 100001'), 'Receipt must display authoritative Property ID: 100001');
    assert.ok(!pdfText.includes('Property ID: 342999'), 'Receipt must not display stale Property ID');
    assert.ok(pdfText.includes('Category ID: 2002'), 'Receipt must display authoritative Category ID: 2002');
  });

  // 18. New booking creation avoids writing inconsistent fallback IDs when hotel has no propertyId
  await t.test('18. Booking resolution safely handles hotels without stored propertyId via deterministic fallback', () => {
    const unmigratedHotel = {
      _id: '6718a38b1111111111111101',
      name: 'Old Dharamshala Unmigrated',
    };

    // When booking has no propertyId and hotel has no propertyId
    const identifiers = resolveReceiptIdentifiers({ bookingId: 'VVS-NEW-1' }, unmigratedHotel, null);
    assert.ok(identifiers.propertyId, 'Must derive a stable 6-digit numeric ID');
    assert.match(identifiers.propertyId, /^\d{6}$/, 'Must be 6 digits');

    // Consecutive resolutions for same hotel must be identical
    const identifiers2 = resolveReceiptIdentifiers({ bookingId: 'VVS-NEW-2' }, unmigratedHotel, null);
    assert.strictEqual(identifiers.propertyId, identifiers2.propertyId, 'Must be completely deterministic for the same hotel');
  });

  // 19. Invoice hides Category ID when unavailable, null, or empty, and displays when genuine
  await t.test('19. Invoice hides Category ID when unavailable, null, or empty, and displays when genuine', () => {
    // Case A: With genuine Category ID
    const bookingWithCat = {
      bookingId: 'VVS-CAT-YES',
      displayBookingId: '10000021',
      bookingType: 'room_type',
      itemName: 'Hotel Kanha - Super Deluxe Room',
      totalAmount: 2500,
      amountPaidOnline: 2500,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };
    const roomTypeWithCat = {
      _id: 'rt_cat_1',
      name: 'Super Deluxe Room',
      categoryId: '2005',
    };

    const resWith = buildBookingReceiptPdf(bookingWithCat, { roomType: roomTypeWithCat });
    const textWith = resWith.buffer.toString('binary');
    assert.ok(textWith.includes('Category: Super Deluxe Room'), 'Must include category name');
    assert.ok(textWith.includes('Category ID: 2005'), 'Must include Category ID badge when genuine');

    // Case B: Without Category ID (null, undefined, unassigned)
    const bookingWithoutCat = {
      bookingId: 'VVS-CAT-NO',
      displayBookingId: '10000022',
      bookingType: 'room_type',
      itemName: 'Braj Ashram - Standard AC Room',
      totalAmount: 1500,
      amountPaidOnline: 1500,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };
    const roomTypeWithoutCat = {
      _id: 'rt_cat_2',
      name: 'Standard AC Room',
      // categoryId is deliberately omitted
    };

    const resWithout = buildBookingReceiptPdf(bookingWithoutCat, { roomType: roomTypeWithoutCat });
    const textWithout = resWithout.buffer.toString('binary');
    assert.ok(textWithout.includes('Category: Standard AC Room'), 'Must include category name');
    assert.ok(!textWithout.includes('Category ID:'), 'Must NOT display Category ID label or badge when unassigned');
    assert.ok(!textWithout.includes('Category ID: null'), 'Must NOT display null placeholder');
    assert.ok(!textWithout.includes('Category ID: undefined'), 'Must NOT display undefined placeholder');

    // Verify resolveReceiptIdentifiers does NOT invent a categoryId
    const resolvedWithout = resolveReceiptIdentifiers(bookingWithoutCat, null, roomTypeWithoutCat);
    assert.strictEqual(resolvedWithout.categoryId, null, 'Must not invent fake category ID when none exists');
  });

  // 20. ID range exhaustion safety checks
  await t.test('20. ID range exhaustion protection throws RangeError when limit is reached', async () => {
    const originalFindByIdAndUpdate = Counter.findByIdAndUpdate;
    Counter.findByIdAndUpdate = async (key) => {
      // Simulate counter that has reached maximum capacity
      return { _id: key, seq: 900000 };
    };

    try {
      await assert.rejects(
        async () => {
          await getNextNumericId('property_id_test', 6, 100000, 999999);
        },
        RangeError,
        'Must reject with RangeError when sequence value exceeds maximum allowed'
      );
    } finally {
      Counter.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // 21. Footer cleanup: both official domains once, no duplicates, no decorative stems/feathers
  await t.test('21. Footer cleanup displays both official domains once and removes decorative feathers', () => {
    const booking = {
      bookingId: 'VVS-FOOTER-1',
      displayBookingId: '69853246',
      bookingType: 'hotel',
      itemName: 'Braj Haveli - Deluxe Room',
      totalAmount: 2000,
      amountPaidOnline: 2000,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const res = buildBookingReceiptPdf(booking);
    const pdfText = res.buffer.toString('binary');

    // Both domains present once each
    // Check visible footer text Tj operator (each domain rendered once)
    const textTjIn = (pdfText.match(/\(www\.vrindavansarthi\.in\)\s*Tj/g) || []).length;
    const textTjCom = (pdfText.match(/\(www\.vrindavansarthi\.com\)\s*Tj/g) || []).length;
    assert.strictEqual(textTjIn, 1, 'www.vrindavansarthi.in must be rendered in text exactly once');
    assert.strictEqual(textTjCom, 1, 'www.vrindavansarthi.com must be rendered in text exactly once');

    // Helpline and email preserved
    assert.ok(pdfText.includes('support@vrindavansarthi.in'), 'Must include support email');
    assert.ok(pdfText.includes('+91 86798 20256'), 'Must include helpline number');
    assert.ok(pdfText.includes('GST No.09HTEPS3784R1ZD'), 'Must include GST number');
  });

  // 22. Accommodation & Stay details: Room ID, complete property address, Google Maps link, reception phone
  await t.test('22. Accommodation details render Room ID, complete address, Google Maps link, and reception phone', () => {
    const hotel = {
      _id: 'hotel-stay-1',
      propertyId: '100045',
      name: 'Shree Krishna Seva Sadan',
      fullAddress: 'Near Danghati Temple, Parikrama Marg, Govardhan, Mathura, UP 281502',
      googleMapLink: 'https://maps.google.com/?q=Danghati+Temple+Govardhan',
      partnerPhone: '9876543210',
    };
    const roomType = { _id: 'rt-1', categoryId: '2010', name: 'Deluxe AC Room' };

    const booking = {
      bookingId: 'VVS-STAY-1',
      displayBookingId: '69853246',
      bookingType: 'room_type',
      hotelId: hotel._id,
      roomNumber: '302',
      roomId: '1302',
      totalAmount: 2500,
      amountPaidOnline: 750,
      amountPayableAtProperty: 1750,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      checkIn: new Date('2026-11-10'),
      checkOut: new Date('2026-11-12'),
    };

    const res = buildBookingReceiptPdf(booking, { hotel, roomType });
    const pdfText = res.buffer.toString('binary');

    // Room ID displayed, "Room No." NOT displayed anywhere
    assert.ok(pdfText.includes('Room ID: 1302'), 'Must display Room ID');
    assert.ok(!pdfText.includes('Room No.'), 'Must NOT display "Room No." anywhere on invoice');

    // Complete property address
    assert.ok(pdfText.includes('Near Danghati Temple'), 'Must display property address');
    assert.ok(pdfText.includes('Govardhan, Mathura'), 'Must display property location in address');

    // Google Maps link directly below address
    assert.ok(pdfText.includes('View on Google Maps ->'), 'Must include Google Maps link text');
    assert.ok(pdfText.includes('https://maps.google.com/?q=Danghati+Temple+Govardhan'), 'Must include Google Maps URL');

    // Reception phone
    assert.ok(pdfText.includes('Reception Phone: +91 9876543210'), 'Must display reception phone');
  });

  // 23. Origin & Destination: customer origin saved & displayed, destination derived from property
  await t.test('23. Primary & Guest details display saved customer origin and property-derived destination', () => {
    // Case A: New booking with customer origin
    const hotelGovardhan = {
      _id: 'hotel-gov-1',
      propertyId: '100088',
      name: 'Giriraj Kripa Dham',
      location: 'Govardhan, Mathura',
      fullAddress: 'Radha Kund Road, Govardhan, Uttar Pradesh 281502',
    };
    const bookingWithOrigin = {
      bookingId: 'VVS-ORIGIN-1',
      displayBookingId: '69853246',
      bookingType: 'room_type',
      customerFullName: 'Devotee Sharma',
      customerOrigin: 'Jaipur, Rajasthan',
      totalAmount: 1500,
      amountPaidOnline: 1500,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const resA = buildBookingReceiptPdf(bookingWithOrigin, { hotel: hotelGovardhan });
    const textA = resA.buffer.toString('binary');
    assert.ok(textA.includes('Origin'), 'Must display Origin label');
    assert.ok(textA.includes('Jaipur, Rajasthan'), 'Must display customer origin');
    assert.ok(textA.includes('Destination'), 'Must display Destination label');
    assert.ok(textA.includes('Govardhan, Mathura'), 'Must display destination derived from property location');
    assert.ok(!textA.includes('Braj Dham (Mathura / Vrindavan / Govardhan)'), 'Must NOT display generic Braj Dham fallback when property location exists');

    // Case B: Older historical booking without origin (clean fallback)
    const bookingWithoutOrigin = {
      bookingId: 'VVS-LEGACY-ORIGIN',
      displayBookingId: '10000099',
      bookingType: 'room_type',
      customerFullName: 'Radha Devotee',
      totalAmount: 1800,
      amountPaidOnline: 1800,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
    };

    const resB = buildBookingReceiptPdf(bookingWithoutOrigin);
    const textB = resB.buffer.toString('binary');
    assert.ok(textB.includes('Origin'), 'Must display Origin label');
    assert.ok(textB.includes('Not provided'), 'Must display "Not provided" fallback for older bookings without origin');
  });
});
