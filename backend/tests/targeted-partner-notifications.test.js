const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Mock data structures and logic testing for Targeted Partner Notifications
test('Targeted Partner Notifications - Security, Recipient Isolation & Deduplication', async (t) => {
  const adminUserId = new mongoose.Types.ObjectId();
  const partnerAId = new mongoose.Types.ObjectId();
  const partnerBId = new mongoose.Types.ObjectId();
  const propertyAId = new mongoose.Types.ObjectId();
  const propertyBId = new mongoose.Types.ObjectId();

  const mockUsers = [
    { _id: adminUserId, name: 'Platform Admin', email: 'admin@vrindavansarthi.com', role: 'admin' },
    { _id: partnerAId, name: 'Giriraj Partner', email: 'giriraj@test.com', role: 'partner', businessName: 'Shri Giriraj Sewa Sadan' },
    { _id: partnerBId, name: 'Radha Krishna Partner', email: 'radhakrishna@test.com', role: 'partner', businessName: 'Radha Krishna Dham' },
  ];

  const mockProperties = [
    {
      _id: propertyAId,
      name: 'Shri Giriraj Sewa Sadan',
      propertyType: 'dharamshala',
      propertyId: '100001',
      partnerId: partnerAId,
      partnerName: 'Giriraj Partner',
      partnerEmail: 'giriraj@test.com',
    },
    {
      _id: propertyBId,
      name: 'Radha Krishna Dham',
      propertyType: 'hotel',
      propertyId: '100002',
      partnerId: partnerBId,
      partnerName: 'Radha Krishna Partner',
      partnerEmail: 'radhakrishna@test.com',
    },
  ];

  const notificationsStore = [];

  // Helper simulating POST /api/partner/notifications
  const sendNotification = async ({ user, body }) => {
    // 1. Role enforcement: Admin only
    if (!user || user.role !== 'admin') {
      const err = new Error('Access denied: Admin role required');
      err.statusCode = 403;
      throw err;
    }

    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    const type = String(body?.type || 'notification').trim() === 'notice' ? 'notice' : 'notification';
    const targetType = String(body?.targetType || body?.audience || 'all').trim().toLowerCase();
    const priority = ['normal', 'high', 'critical'].includes(String(body?.priority || '').toLowerCase())
      ? String(body.priority).toLowerCase()
      : 'normal';

    // 2. Title & Message validation
    if (!title || !message) {
      const err = new Error('Title and message are required');
      err.statusCode = 400;
      throw err;
    }

    // 3. Idempotency deduplication check
    const idempotencyKey = String(body?.idempotencyKey || '').trim();
    if (idempotencyKey) {
      const existing = notificationsStore.find((n) => n.eventKey === idempotencyKey);
      if (existing) {
        return { statusCode: 200, data: existing, idempotent: true };
      }
    }

    let audience = 'all_partners';
    let partnerId = null;
    let recipientUserId = null;
    let hotelId = null;
    const metadata = {
      targetType,
      sentByAdminName: user.name,
      sentByAdminEmail: user.email,
    };

    if (targetType === 'all' || targetType === 'all_partners') {
      audience = 'all_partners';
      metadata.targetDescription = 'All Registered Partners';
    } else if (targetType === 'property' || targetType === 'hotel' || targetType === 'dharamshala') {
      const rawPropertyId = String(body?.hotelId || body?.propertyId || '').trim();
      if (!rawPropertyId || !mongoose.Types.ObjectId.isValid(rawPropertyId)) {
        const err = new Error('Valid property ID is required');
        err.statusCode = 400;
        throw err;
      }

      const hotel = mockProperties.find((h) => String(h._id) === rawPropertyId);
      if (!hotel) {
        const err = new Error('Selected property was not found');
        err.statusCode = 404;
        throw err;
      }
      if (!hotel.partnerId) {
        const err = new Error(`The property "${hotel.name}" has no registered partner assigned.`);
        err.statusCode = 400;
        throw err;
      }

      const partnerUser = mockUsers.find((u) => String(u._id) === String(hotel.partnerId));
      if (!partnerUser) {
        const err = new Error('The partner account for this property was not found.');
        err.statusCode = 404;
        throw err;
      }

      audience = 'partner';
      partnerId = partnerUser._id;
      recipientUserId = partnerUser._id;
      hotelId = hotel._id;
      metadata.targetDescription = `${hotel.name} (${hotel.propertyType || 'Property'})`;
      metadata.propertyName = hotel.name;
      metadata.propertyType = hotel.propertyType || 'hotel';
      metadata.propertyId = hotel.propertyId || '';
      metadata.partnerName = partnerUser.name;
    } else if (targetType === 'partner') {
      const rawPartnerId = String(body?.partnerId || body?.recipientUserId || '').trim();
      if (!rawPartnerId || !mongoose.Types.ObjectId.isValid(rawPartnerId)) {
        const err = new Error('Valid partner ID is required');
        err.statusCode = 400;
        throw err;
      }

      const partnerUser = mockUsers.find((u) => String(u._id) === rawPartnerId && u.role === 'partner');
      if (!partnerUser) {
        const err = new Error('Partner account not found');
        err.statusCode = 404;
        throw err;
      }

      audience = 'partner';
      partnerId = partnerUser._id;
      recipientUserId = partnerUser._id;
      metadata.targetDescription = partnerUser.businessName || partnerUser.name;
      metadata.partnerName = partnerUser.name;
    } else {
      const err = new Error(`Invalid recipient target type: ${targetType}`);
      err.statusCode = 400;
      throw err;
    }

    const created = {
      _id: new mongoose.Types.ObjectId(),
      eventKey: idempotencyKey || undefined,
      title,
      message,
      type,
      audience,
      partnerId,
      recipientUserId,
      hotelId,
      metadata,
      priority,
      createdByUserId: user._id,
      createdAt: new Date().toISOString(),
    };

    notificationsStore.push(created);
    return { statusCode: 201, data: created, idempotent: false };
  };

  // Helper simulating Partner query (GET /api/partner/notifications & notices)
  const getPartnerCommunications = ({ partnerUser, type }) => {
    return notificationsStore.filter((n) => {
      if (n.type !== type) return false;
      const isBroadcast = n.audience === 'all_partners';
      const isTargetedToPartner = n.audience === 'partner' && (
        String(n.partnerId) === String(partnerUser._id) ||
        String(n.recipientUserId) === String(partnerUser._id)
      );
      return isBroadcast || isTargetedToPartner;
    });
  };

  // --- SUBTEST 1: Non-admin cannot send notifications ---
  await t.test('1. Non-admin users are strictly rejected with 403', async () => {
    await assert.rejects(
      async () => {
        await sendNotification({
          user: mockUsers[1], // partner
          body: { title: 'Hack', message: 'Spam' },
        });
      },
      (err) => err.statusCode === 403
    );
  });

  // --- SUBTEST 2: Empty title and message validation ---
  await t.test('2. Empty title or message returns 400', async () => {
    await assert.rejects(
      async () => {
        await sendNotification({
          user: mockUsers[0],
          body: { title: '', message: 'Some text' },
        });
      },
      (err) => err.statusCode === 400
    );

    await assert.rejects(
      async () => {
        await sendNotification({
          user: mockUsers[0],
          body: { title: 'Title', message: '' },
        });
      },
      (err) => err.statusCode === 400
    );
  });

  // --- SUBTEST 3: Invalid recipient IDs are rejected ---
  await t.test('3. Invalid recipient IDs are rejected with 400/404', async () => {
    // Malformed ID
    await assert.rejects(
      async () => {
        await sendNotification({
          user: mockUsers[0],
          body: { title: 'Title', message: 'Msg', targetType: 'property', hotelId: 'invalid-id-123' },
        });
      },
      (err) => err.statusCode === 400
    );

    // Non-existent ID
    await assert.rejects(
      async () => {
        await sendNotification({
          user: mockUsers[0],
          body: { title: 'Title', message: 'Msg', targetType: 'property', hotelId: new mongoose.Types.ObjectId().toString() },
        });
      },
      (err) => err.statusCode === 404
    );
  });

  // --- SUBTEST 4: Admin sends broadcast notification ---
  await t.test('4. Admin can send broadcast notification to all partners', async () => {
    const res = await sendNotification({
      user: mockUsers[0],
      body: {
        title: 'Platform Maintenance',
        message: 'Scheduled downtime tonight at 2 AM',
        targetType: 'all',
        type: 'notification',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.data.audience, 'all_partners');
    assert.equal(res.data.partnerId, null);

    // Both Partner A and Partner B receive it
    const pANotifs = getPartnerCommunications({ partnerUser: mockUsers[1], type: 'notification' });
    const pBNotifs = getPartnerCommunications({ partnerUser: mockUsers[2], type: 'notification' });
    assert.ok(pANotifs.some((n) => n.title === 'Platform Maintenance'));
    assert.ok(pBNotifs.some((n) => n.title === 'Platform Maintenance'));
  });

  // --- SUBTEST 5: Admin sends targeted notice to Property Partner A ---
  await t.test('5. Admin sends targeted notice to Property Partner A with strict recipient isolation', async () => {
    const res = await sendNotification({
      user: mockUsers[0],
      body: {
        title: 'Dharamshala Registry Verification',
        message: 'Please update your occupancy register for Giriraj Sewa Sadan.',
        targetType: 'property',
        hotelId: propertyAId.toString(),
        type: 'notice',
        priority: 'high',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.data.audience, 'partner');
    assert.equal(String(res.data.partnerId), String(partnerAId));
    assert.equal(String(res.data.hotelId), String(propertyAId));
    assert.equal(res.data.metadata.propertyName, 'Shri Giriraj Sewa Sadan');

    // Recipient isolation:
    // Partner A sees the targeted notice
    const pANotices = getPartnerCommunications({ partnerUser: mockUsers[1], type: 'notice' });
    assert.ok(pANotices.some((n) => n.title === 'Dharamshala Registry Verification'));

    // Partner B MUST NOT see Partner A's notice!
    const pBNotices = getPartnerCommunications({ partnerUser: mockUsers[2], type: 'notice' });
    assert.ok(!pBNotices.some((n) => n.title === 'Dharamshala Registry Verification'));
  });

  // --- SUBTEST 6: Deduplication / Idempotency protection ---
  await t.test('6. Repeated submissions with same idempotencyKey do not create duplicates', async () => {
    const key = 'idem_key_unique_8829';
    const first = await sendNotification({
      user: mockUsers[0],
      body: {
        title: 'Payout Dispatched',
        message: 'Your weekly payout has been processed.',
        targetType: 'partner',
        partnerId: partnerAId.toString(),
        type: 'notification',
        idempotencyKey: key,
      },
    });

    assert.equal(first.statusCode, 201);
    assert.equal(first.idempotent, false);
    const countBefore = notificationsStore.length;

    // Retry / duplicate submission with same idempotencyKey
    const second = await sendNotification({
      user: mockUsers[0],
      body: {
        title: 'Payout Dispatched',
        message: 'Your weekly payout has been processed.',
        targetType: 'partner',
        partnerId: partnerAId.toString(),
        type: 'notification',
        idempotencyKey: key,
      },
    });

    assert.equal(second.statusCode, 200);
    assert.equal(second.idempotent, true);
    assert.equal(notificationsStore.length, countBefore, 'Duplicate notification record must NOT be inserted');
    assert.equal(String(second.data._id), String(first.data._id));
  });
});
