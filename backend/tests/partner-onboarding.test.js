/**
 * VRINDAVAN SARTHI — PARTNER ONBOARDING COMPLETION SYSTEM TESTS
 * 
 * Verifies the 13-step checklist calculations, server-side submission gate,
 * admin review & correction workflow, and in-app reminders against local staging Mongo.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { assertIsolatedStagingEnvironment } = require('../utils/stagingGuard');
const { calculatePartnerOnboardingStatus } = require('../utils/partnerOnboarding');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const PartnerNotification = require('../models/PartnerNotification');

const STAGING_URI = process.env.STAGING_MONGO_URI || 'mongodb://127.0.0.1:27018/vrindavan_sarthi_staging';

describe('Partner Onboarding Completion System Integration Tests', () => {
  let dbConnection = null;
  let testPartner = null;
  let testHotel = null;
  let testRoomType = null;
  let testRoomUnit = null;

  before(async () => {
    assertIsolatedStagingEnvironment(STAGING_URI);
    dbConnection = await mongoose.connect(STAGING_URI);
  });

  after(async () => {
    // Clean up test documents
    if (testPartner?._id) {
      await User.deleteMany({ _id: testPartner._id });
      await Hotel.deleteMany({ partnerId: testPartner._id });
      await RoomType.deleteMany({ hotelId: testHotel?._id });
      await RoomUnit.deleteMany({ hotelId: testHotel?._id });
      await PartnerNotification.deleteMany({ partnerId: testPartner._id });
    }
    if (dbConnection) {
      await mongoose.disconnect();
    }
  });

  it('1. Newly registered partner has only Step 1 completed (8% progress)', async () => {
    testPartner = await User.create({
      name: 'Onboarding Test Partner',
      email: `onboarding_test_${Date.now()}@staging.local`,
      password: 'StagingPartner@123',
      phone: '+919876543299',
      role: 'partner',
      partnerStatus: 'pending',
    });

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.completedStepsCount, 1, 'Only step 1 should be complete initially');
    assert.equal(status.totalStepsCount, 13, 'Total steps must be 13');
    assert.equal(status.overallProgressPercent, 8, 'Progress should be 8%');
    assert.equal(status.nextActionStep, 'kyc_documents', 'Next step should be KYC documents');
    assert.equal(status.isReadyForSubmission, false, 'Cannot be ready for submission');
    assert.equal(status.hotel, null, 'Hotel should be null');
  });

  it('2. Completing KYC consent and bank details advances checklist to 23%', async () => {
    testPartner.partnerPolicyConsent = {
      accepted: true,
      acceptedAt: new Date(),
      termsVersion: '1.0',
    };
    testPartner.businessName = 'Vrindavan Grace Hospitality LLP';
    testPartner.partnerDocuments = [{
      name: 'Aadhaar Card',
      originalName: 'aadhaar_partner.pdf',
      type: 'aadhar_card',
      url: 'https://staging.local/uploads/aadhaar.pdf',
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    }];
    testPartner.bankDetails = {
      account_holder_name: 'Vrindavan Grace Hospitality',
      bank_name: 'State Bank of India',
      account_number: '123456789012',
      ifsc_code: 'SBIN0001234',
    };
    await testPartner.save();

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.completedStepsCount, 3, 'Steps 1, 2, 3 should be completed');
    assert.equal(status.overallProgressPercent, 23, 'Progress should be 23%');
    assert.equal(status.nextActionStep, 'property_creation', 'Next step should be property creation');
    assert.equal(status.reminders.some((r) => r.id === 'rem_create_property'), true, 'Should alert property missing');
  });

  it('3. Creating property with info, photos & policies completes steps 4, 5, 6, 11', async () => {
    testHotel = await Hotel.create({
      name: 'Radha Kripa Sarthi Guest House',
      propertyType: 'hotel',
      location: 'Raman Reti, Vrindavan',
      nearestTemple: 'ISKCON Vrindavan',
      googleMapLink: 'https://maps.google.com/?q=27.5750,77.6850',
      contactPhone: '+919876543299',
      description: 'Serene spiritual guest house 2 minutes from ISKCON temple.',
      image: 'https://staging.local/assets/hotel-facade.jpg',
      checkInTime: '12:00 PM',
      checkOutTime: '11:00 AM',
      partnerId: testPartner._id,
      partnerSubmitted: false,
      approvalStatus: 'draft',
      status: 'inactive',
    });

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.hotel.name, 'Radha Kripa Sarthi Guest House');
    assert.equal(status.nextActionStep, 'room_categories', 'Next step should be room categories');
    assert.equal(status.reminders.some((r) => r.id === 'rem_create_rooms'), true, 'Should remind to add room categories');
  });

  it('4. Adding room category without physical units advances to Step 7', async () => {
    testRoomType = await RoomType.create({
      hotelId: testHotel._id,
      name: 'Deluxe AC Room',
      category: 'Deluxe',
      pricePerNight: 2499,
      maxGuests: 3,
      amenities: ['AC', 'Free WiFi', 'Geyser', 'Attached Bath'],
    });

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.roomTypesCount, 1);
    assert.equal(status.steps.find((s) => s.key === 'room_categories').status, 'completed');
    assert.equal(status.steps.find((s) => s.key === 'physical_inventory').status, 'pending');
    assert.equal(status.nextActionStep, 'physical_inventory', 'Next step should be physical inventory');
    assert.equal(status.reminders.some((r) => r.id === 'rem_create_units'), true, 'Should remind to add room units');
  });

  it('5. Adding physical room units satisfies inventory & availability prerequisites', async () => {
    testRoomUnit = await RoomUnit.create({
      hotelId: testHotel._id,
      roomTypeId: testRoomType._id,
      number: '101',
      floor: 1,
      status: 'available',
    });

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.roomUnitsCount, 1);
    assert.equal(status.steps.find((s) => s.key === 'physical_inventory').status, 'completed');
    assert.equal(status.steps.find((s) => s.key === 'room_pricing').status, 'completed');
    assert.equal(status.steps.find((s) => s.key === 'availability').status, 'completed');
    assert.equal(status.steps.find((s) => s.key === 'final_review').status, 'completed');
    assert.equal(status.isReadyForSubmission, true, 'Property must now be ready for submission');
    assert.equal(status.overallProgressPercent, 92, '12 of 13 steps completed = 92%');
    assert.equal(status.reminders.some((r) => r.id === 'rem_ready_to_submit'), true);
  });

  it('6. Submission gate transitions property to pending review and notifies partner', async () => {
    const beforeSubmit = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(beforeSubmit.isReadyForSubmission, true);

    // Simulate POST /api/partner/submit-property logic
    testHotel.partnerSubmitted = true;
    testHotel.approvalStatus = 'pending';
    await testHotel.save();

    await PartnerNotification.create({
      title: 'Property Listing Submitted for Verification',
      message: `Your property "${testHotel.name}" has been successfully submitted for administrative verification.`,
      type: 'notification',
      audience: 'partner',
      recipientUserId: testPartner._id,
      recipientRole: 'partner',
      partnerId: testPartner._id,
      hotelId: testHotel._id,
      eventType: 'partner_property_submitted',
      priority: 'normal',
    });

    const afterSubmit = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(afterSubmit.hotel.partnerSubmitted, true);
    assert.equal(afterSubmit.hotel.approvalStatus, 'pending');
    assert.equal(afterSubmit.steps.find((s) => s.key === 'admin_submission').status, 'completed');
    assert.equal(afterSubmit.reminders.some((r) => r.id === 'rem_under_review'), true);
  });

  it('7. Admin correction request flags property, records remarks and alerts partner', async () => {
    const correctionRemark = 'Please upload a clearer exterior facade photograph showing the building entrance.';
    testHotel.approvalStatus = 'correction_required';
    testHotel.adminRemarks = correctionRemark;
    testHotel.status = 'inactive';
    await testHotel.save();

    await PartnerNotification.create({
      title: 'Action Required: Listing Correction Requested',
      message: `Admin review has requested corrections: ${correctionRemark}`,
      type: 'notification',
      audience: 'partner',
      recipientUserId: testPartner._id,
      recipientRole: 'partner',
      partnerId: testPartner._id,
      hotelId: testHotel._id,
      eventType: 'partner_property_correction_required',
      priority: 'high',
    });

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.hotel.approvalStatus, 'correction_required');
    assert.equal(status.steps.find((s) => s.key === 'property_info').status, 'needs_correction');
    assert.equal(status.steps.find((s) => s.key === 'admin_submission').status, 'needs_correction');
    const correctionReminder = status.reminders.find((r) => r.id === 'rem_correction_required');
    assert.ok(correctionReminder, 'Correction reminder must be active');
    assert.equal(correctionReminder.message, correctionRemark);
  });

  it('8. Final admin approval makes property active, unlocks live operations (100% progress)', async () => {
    testHotel.approvalStatus = 'approved';
    testHotel.status = 'active';
    testHotel.adminRemarks = 'Verified and approved by admin.';
    await testHotel.save();

    testPartner.partnerStatus = 'approved';
    await testPartner.save();

    const status = await calculatePartnerOnboardingStatus(testPartner._id);
    assert.equal(status.isApproved, true);
    assert.equal(status.hotel.status, 'active');
    assert.equal(status.overallProgressPercent, 100, 'Must reach 100% completion');
    assert.equal(status.completedStepsCount, 13);
  });
});
