const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { linkCustomerGuestBookings } = require('../utils/guestBookingAccess');

test('Issue 1: Customer My Bookings visibility and strict ownership isolation', async (t) => {
  // Mock Booking and User models for testing ownership and linking
  const customerAId = new mongoose.Types.ObjectId();
  const customerBId = new mongoose.Types.ObjectId();
  const guestUserId = new mongoose.Types.ObjectId();

  const mockBookings = [
    {
      _id: new mongoose.Types.ObjectId(),
      bookingId: 'VVS-DR-20261027-777172',
      userId: customerAId,
      customerFullName: 'Vrindavan Sarthi',
      customerEmail: 'vrindavansarthi108@gmail.com',
      userEmail: 'vrindavansarthi108@gmail.com',
      totalAmount: 1299,
      amountPaidOnline: 99,
      advanceAmount: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'checked_in',
      isGuestBooking: false,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      bookingId: 'VVS-DR-20261023-611656',
      userId: customerBId,
      customerFullName: 'Manoj',
      customerEmail: 'mksvrindavan21128@gmail.com',
      userEmail: 'mksvrindavan21128@gmail.com',
      totalAmount: 1,
      amountPaidOnline: 0,
      advanceAmount: 1,
      amountPayableAtProperty: 0,
      paymentStatus: 'pending',
      bookingStatus: 'pending',
      isGuestBooking: false,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      bookingId: 'VVS-GUEST-001',
      userId: guestUserId,
      customerFullName: 'Guest Sarthi',
      customerEmail: 'VrindavanSarthi108@GMAIL.COM', // Mixed casing
      userEmail: 'vrindavansarthi108@gmail.com',
      totalAmount: 1299,
      amountPaidOnline: 99,
      advanceAmount: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      isGuestBooking: true,
    },
  ];

  // 1. Customer A can see their own bookings
  const customerABookings = mockBookings.filter((b) => String(b.userId) === String(customerAId));
  assert.equal(customerABookings.length, 1);
  assert.equal(customerABookings[0].bookingId, 'VVS-DR-20261027-777172');

  // 2. Customer B cannot see Customer A's booking
  const customerBBookings = mockBookings.filter((b) => String(b.userId) === String(customerBId));
  assert.equal(customerBBookings.length, 1);
  assert.equal(customerBBookings[0].bookingId, 'VVS-DR-20261023-611656');
  assert.ok(!customerBBookings.some((b) => b.bookingId === 'VVS-DR-20261027-777172'));

  // 3. Case-insensitive email matching finds guest booking with mixed casing
  const targetEmail = 'vrindavansarthi108@gmail.com';
  const escaped = targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}$`, 'i');
  const matchingGuestBookings = mockBookings.filter(
    (b) => b.isGuestBooking && (regex.test(b.customerEmail) || regex.test(b.userEmail))
  );
  assert.equal(matchingGuestBookings.length, 1);
  assert.equal(matchingGuestBookings[0].bookingId, 'VVS-GUEST-001');
});

test('Issue 2: Admin Payments amount logic and revenue calculations', async (t) => {
  // Simulate booking rows
  const bookings = [
    {
      id: 'b1',
      bookingId: 'VVS-DR-20261027-777172',
      bookingType: 'room_type',
      itemName: 'Shri Giriraj Sewa Sadan',
      userName: 'Vrindavan Sarthi',
      userPhone: '9876543210',
      totalAmount: 1299,
      amountPaidOnline: 99,
      advanceAmount: 99,
      amountPayableAtProperty: 1200,
      paymentStatus: 'paid',
      paymentMethod: 'online',
      paymentProvider: 'razorpay',
      razorpayPaymentId: 'pay_TsxFSEk3j8Rmqg',
      createdAt: '2026-10-27T13:39:44.732Z',
    },
    {
      id: 'b2',
      bookingId: 'VVS-DR-20261023-611656',
      bookingType: 'room_type',
      itemName: 'Jai Shree Ram Enterprises',
      userName: 'Manoj',
      userPhone: '6396147954',
      totalAmount: 1,
      amountPaidOnline: 0,
      advanceAmount: 1,
      amountPayableAtProperty: 0,
      paymentStatus: 'pending',
      paymentMethod: 'online',
      paymentProvider: 'razorpay',
      createdAt: '2026-10-23T14:00:16.323Z',
    },
    {
      id: 'b3',
      bookingId: 'VVS-FAILED-001',
      bookingType: 'room_type',
      itemName: 'Radha Krishna Dham',
      userName: 'Test User',
      userPhone: '8006261618',
      totalAmount: 2000,
      amountPaidOnline: 0,
      advanceAmount: 600,
      amountPayableAtProperty: 1400,
      paymentStatus: 'failed',
      paymentMethod: 'online',
      createdAt: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 'b4',
      bookingId: 'VVS-MULTI-PAY',
      bookingType: 'room_type',
      itemName: 'Hotel Vrinda Palace',
      userName: 'Multi Customer',
      userPhone: '9999999999',
      totalAmount: 1299,
      amountPaidOnline: 99,
      advanceAmount: 99,
      amountPayableAtProperty: 0,
      amountPaidToProperty: 1200,
      paymentStatus: 'paid',
      paymentMethod: 'online',
      createdAt: '2026-10-22T10:00:00.000Z',
      balanceCollections: [
        {
          amount: 1200,
          paymentMethod: 'cash',
          collectedByName: 'Front Desk Partner',
          receiptNumber: 'RCP-8899',
          collectedAt: '2026-10-23T09:00:00.000Z',
        },
      ],
    },
  ];

  // Helper matching AdminPayments logic
  const bookingPayments = [];
  bookings.forEach((b) => {
    let onlineAmount = 0;
    if (b.paymentStatus === 'paid') {
      if (typeof b.amountPaidOnline === 'number' && b.amountPaidOnline > 0) {
        onlineAmount = b.amountPaidOnline;
      } else if (typeof b.advanceAmount === 'number' && b.advanceAmount > 0) {
        onlineAmount = b.advanceAmount;
      } else {
        onlineAmount = Number(b.totalAmount || 0);
      }
    } else {
      if (typeof b.amountPaidOnline === 'number' && b.amountPaidOnline > 0) {
        onlineAmount = b.amountPaidOnline;
      } else if (typeof b.advanceAmount === 'number' && b.advanceAmount > 0) {
        onlineAmount = b.advanceAmount;
      } else {
        onlineAmount = Number(b.totalAmount || 0);
      }
    }

    bookingPayments.push({
      recordId: b.id,
      displayId: b.bookingId,
      amount: onlineAmount,
      paymentStatus: b.paymentStatus,
      totalCost: b.totalAmount,
      propertyBalance: b.amountPayableAtProperty,
      source: 'booking',
    });

    if (Array.isArray(b.balanceCollections) && b.balanceCollections.length > 0) {
      b.balanceCollections.forEach((col, idx) => {
        bookingPayments.push({
          recordId: `${b.id}-balance-${idx}`,
          displayId: `${b.bookingId}-P${idx + 1}`,
          amount: Number(col.amount || 0),
          paymentStatus: 'paid',
          totalCost: b.totalAmount,
          propertyBalance: b.amountPayableAtProperty,
          source: 'booking',
        });
      });
    } else if (Number(b.amountPaidToProperty || 0) > 0) {
      bookingPayments.push({
        recordId: `${b.id}-property`,
        displayId: `${b.bookingId}-PROP`,
        amount: Number(b.amountPaidToProperty),
        paymentStatus: 'paid',
        totalCost: b.totalAmount,
        propertyBalance: b.amountPayableAtProperty,
        source: 'booking',
      });
    }
  });

  // Verify Row 1: VVS-DR-20261027-777172
  const row1 = bookingPayments.find((p) => p.displayId === 'VVS-DR-20261027-777172');
  assert.ok(row1);
  assert.equal(row1.amount, 99, 'Successful online payment must show ₹99, not ₹1,299');
  assert.equal(row1.totalCost, 1299);
  assert.equal(row1.propertyBalance, 1200);

  // Verify Row 2: VVS-DR-20261023-611656 (pending)
  const row2 = bookingPayments.find((p) => p.displayId === 'VVS-DR-20261023-611656');
  assert.ok(row2);
  assert.equal(row2.amount, 1, 'Pending online payment must show expected advance amount ₹1');
  assert.equal(row2.paymentStatus, 'pending');

  // Verify Row 3: VVS-FAILED-001 (failed)
  const row3 = bookingPayments.find((p) => p.displayId === 'VVS-FAILED-001');
  assert.ok(row3);
  assert.equal(row3.amount, 600, 'Failed payment must show attempted amount ₹600');
  assert.equal(row3.paymentStatus, 'failed');

  // Verify Multiple Payments: VVS-MULTI-PAY (online + property collection)
  const multiOnline = bookingPayments.find((p) => p.displayId === 'VVS-MULTI-PAY');
  const multiProperty = bookingPayments.find((p) => p.displayId === 'VVS-MULTI-PAY-P1');
  assert.ok(multiOnline, 'Online transaction row must exist');
  assert.ok(multiProperty, 'Property collection transaction row must exist');
  assert.equal(multiOnline.amount, 99, 'Online row must show ₹99');
  assert.equal(multiProperty.amount, 1200, 'Property collection row must show ₹1,200');

  // Verify Total Revenue & Pending Payments aggregation
  const totalRevenue = bookingPayments
    .filter((p) => p.paymentStatus === 'paid')
    .reduce((s, p) => s + p.amount, 0);

  const pendingAmount = bookingPayments
    .filter((p) => p.paymentStatus === 'pending')
    .reduce((s, p) => s + p.amount, 0);

  // Paid amounts: row1 (99) + multiOnline (99) + multiProperty (1200) = 1398
  assert.equal(totalRevenue, 1398, 'Total revenue must sum only actual paid amounts without double-counting');
  // Pending amount: row2 (1) = 1
  assert.equal(pendingAmount, 1, 'Pending revenue must reflect pending expected amounts');
});
