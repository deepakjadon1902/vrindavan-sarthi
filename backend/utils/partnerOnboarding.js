const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');

/**
 * VRINDAVAN SARTHI — PARTNER ONBOARDING COMPLETION SYSTEM
 * 
 * Computes authoritative, server-side completion status for the 13-step
 * partner onboarding checklist based on real MongoDB documents.
 */
async function calculatePartnerOnboardingStatus(partnerIdOrUser, targetHotelId = null) {
  let user = null;
  if (partnerIdOrUser && !(partnerIdOrUser instanceof mongoose.Types.ObjectId) && typeof partnerIdOrUser === 'object' && partnerIdOrUser.email) {
    user = partnerIdOrUser;
  } else if (partnerIdOrUser) {
    user = await User.findById(partnerIdOrUser).lean();
  }

  if (!user) {
    throw new Error('PARTNER_NOT_FOUND: Cannot compute onboarding status for invalid partner.');
  }

  // 1. Fetch primary or targeted hotel for this partner
  const hotelQuery = { partnerId: user._id };
  if (targetHotelId && mongoose.Types.ObjectId.isValid(targetHotelId)) {
    hotelQuery._id = targetHotelId;
  }
  const hotel = await Hotel.findOne(hotelQuery).sort({ createdAt: -1 }).lean();

  // 2. Fetch room types and physical room units if hotel exists
  let roomTypes = [];
  let roomUnits = [];
  if (hotel) {
    roomTypes = await RoomType.find({ hotelId: hotel._id }).lean();
    roomUnits = await RoomUnit.find({ hotelId: hotel._id }).lean();
  }

  // Helper to build step object
  const buildStep = ({
    key,
    stepNumber,
    title,
    status, // 'completed' | 'pending' | 'needs_correction' | 'locked'
    missingDetails = [],
    actionLabel,
    actionUrl,
    correctionReason = '',
    updatedAt = null,
  }) => ({
    key,
    stepNumber,
    title,
    status,
    missingDetails,
    actionLabel,
    actionUrl,
    correctionReason,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  });

  const steps = [];

  // STEP 1: Partner Registration
  const regMissing = [];
  if (!user.name) regMissing.push('Partner name is missing');
  if (!user.email) regMissing.push('Partner email is missing');
  if (!user.phone) regMissing.push('Partner phone is missing');
  const step1Status = regMissing.length === 0 ? 'completed' : 'pending';
  steps.push(buildStep({
    key: 'registration',
    stepNumber: 1,
    title: 'Partner Registration',
    status: step1Status,
    missingDetails: regMissing,
    actionLabel: step1Status === 'completed' ? 'View Profile' : 'Complete Profile',
    actionUrl: '/partner/profile-settings',
    updatedAt: user.createdAt,
  }));

  // STEP 2: KYC and Identity Documents
  const kycMissing = [];
  const partnerStatus = String(user.partnerStatus || 'pending').toLowerCase();
  const partnerNeedsCorrection = partnerStatus === 'correction_required';
  if (!user.partnerPolicyConsent || user.partnerPolicyConsent.accepted !== true) {
    kycMissing.push('Partner policy agreement must be accepted');
  }
  if (!user.businessName && !user.businessType) {
    kycMissing.push('Business entity or legal name required');
  }
  const partnerDocs = Array.isArray(user.partnerDocuments) ? user.partnerDocuments : [];
  if (partnerDocs.length === 0) {
    kycMissing.push('Upload at least one verification document (Aadhaar, PAN, GST, or Lease)');
  }
  let step2Status = 'pending';
  if (partnerNeedsCorrection) {
    step2Status = 'needs_correction';
  } else if (kycMissing.length === 0) {
    step2Status = 'completed';
  }
  steps.push(buildStep({
    key: 'kyc_documents',
    stepNumber: 2,
    title: 'KYC & Legal Documentation',
    status: step2Status,
    missingDetails: kycMissing,
    actionLabel: step2Status === 'completed' ? 'Review KYC' : 'Update KYC Documents',
    actionUrl: '/partner/profile-settings',
    correctionReason: user.adminRemarks || '',
    updatedAt: user.updatedAt,
  }));

  // STEP 3: Bank Details
  const bank = user.bankDetails || {};
  const bankMissing = [];
  if (!bank.account_holder_name) bankMissing.push('Account holder name required');
  if (!bank.bank_name) bankMissing.push('Bank name required');
  if (!bank.account_number) bankMissing.push('Account number required');
  if (!bank.ifsc_code) bankMissing.push('IFSC code required');
  const step3Status = bankMissing.length === 0 ? 'completed' : 'pending';
  steps.push(buildStep({
    key: 'bank_details',
    stepNumber: 3,
    title: 'Bank & Payout Settlement Details',
    status: step3Status,
    missingDetails: bankMissing,
    actionLabel: step3Status === 'completed' ? 'Edit Bank Details' : 'Add Bank Details',
    actionUrl: '/partner/bank-details',
    updatedAt: bank.updatedAt || user.updatedAt,
  }));

  // STEP 4: Property Creation
  const step4Status = hotel ? 'completed' : 'pending';
  steps.push(buildStep({
    key: 'property_creation',
    stepNumber: 4,
    title: 'Property Creation',
    status: step4Status,
    missingDetails: hotel ? [] : ['Create your primary hotel or dharamshala listing'],
    actionLabel: hotel ? 'Edit Property' : 'Create Property',
    actionUrl: hotel ? `/partner/add-hotel` : '/partner/add-hotel',
    updatedAt: hotel?.createdAt || null,
  }));

  // STEP 5: Property Information
  const propInfoMissing = [];
  if (!hotel) {
    propInfoMissing.push('Property not created yet');
  } else {
    if (!hotel.name) propInfoMissing.push('Property name required');
    if (!hotel.location) propInfoMissing.push('Location / address required');
    if (!hotel.nearestTemple) propInfoMissing.push('Nearest temple / landmark required');
    if (!hotel.googleMapLink) propInfoMissing.push('Google Maps location link required');
    if (!hotel.contactPhone) propInfoMissing.push('Contact reception phone required');
    if (!hotel.description) propInfoMissing.push('Property description required');
  }
  const hotelNeedsCorrection = hotel?.approvalStatus === 'correction_required';
  let step5Status = 'locked';
  if (hotel) {
    if (hotelNeedsCorrection) {
      step5Status = 'needs_correction';
    } else {
      step5Status = propInfoMissing.length === 0 ? 'completed' : 'pending';
    }
  }
  steps.push(buildStep({
    key: 'property_info',
    stepNumber: 5,
    title: 'Property Information & Coordinates',
    status: step5Status,
    missingDetails: propInfoMissing,
    actionLabel: hotel ? 'Update Property Info' : 'Create Property First',
    actionUrl: '/partner/add-hotel',
    correctionReason: hotel?.adminRemarks || '',
    updatedAt: hotel?.updatedAt || null,
  }));

  // STEP 6: Property Photos
  const photosMissing = [];
  if (!hotel) {
    photosMissing.push('Property not created yet');
  } else {
    const hasMainImage = Boolean(hotel.image && String(hotel.image).trim());
    const hasGalleryImages = Array.isArray(hotel.images) && hotel.images.length > 0;
    if (!hasMainImage && !hasGalleryImages) {
      photosMissing.push('Upload at least one property facade or room photograph');
    }
  }
  let step6Status = 'locked';
  if (hotel) {
    step6Status = photosMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'property_photos',
    stepNumber: 6,
    title: 'Property Photographs & Facade',
    status: step6Status,
    missingDetails: photosMissing,
    actionLabel: hotel ? 'Upload Photos' : 'Locked',
    actionUrl: '/partner/add-hotel',
    updatedAt: hotel?.updatedAt || null,
  }));

  // STEP 7: Room Categories
  const roomCatMissing = [];
  if (!hotel) {
    roomCatMissing.push('Property must be created first');
  } else if (roomTypes.length === 0) {
    roomCatMissing.push('Add at least one room category (e.g. Deluxe AC, Standard Double)');
  }
  let step7Status = 'locked';
  if (hotel) {
    step7Status = roomCatMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'room_categories',
    stepNumber: 7,
    title: 'Room Categories Setup',
    status: step7Status,
    missingDetails: roomCatMissing,
    actionLabel: hotel ? (roomTypes.length > 0 ? 'Manage Categories' : 'Add Room Category') : 'Locked',
    actionUrl: hotel ? `/partner/inventory` : '/partner/add-hotel',
    updatedAt: roomTypes[0]?.updatedAt || null,
  }));

  // STEP 8: Physical Room Inventory
  const physInventoryMissing = [];
  if (!hotel || roomTypes.length === 0) {
    physInventoryMissing.push('Room categories required first');
  } else {
    // Check that every room type has at least one physical unit
    const roomTypeIdsWithUnits = new Set(roomUnits.map((u) => String(u.roomTypeId)));
    const roomTypesWithoutUnits = roomTypes.filter((rt) => !roomTypeIdsWithUnits.has(String(rt._id)));
    if (roomUnits.length === 0) {
      physInventoryMissing.push('Add physical room units (e.g. Room 101, 102) to your categories');
    } else if (roomTypesWithoutUnits.length > 0) {
      physInventoryMissing.push(`Assign physical units to category: "${roomTypesWithoutUnits[0].name}"`);
    }
  }
  let step8Status = 'locked';
  if (hotel && roomTypes.length > 0) {
    step8Status = physInventoryMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'physical_inventory',
    stepNumber: 8,
    title: 'Physical Room Inventory (Units)',
    status: step8Status,
    missingDetails: physInventoryMissing,
    actionLabel: roomTypes.length > 0 ? 'Configure Room Units' : 'Locked',
    actionUrl: '/partner/inventory',
    updatedAt: roomUnits[0]?.updatedAt || null,
  }));

  // STEP 9: Room Pricing
  const pricingMissing = [];
  if (!hotel || roomTypes.length === 0) {
    pricingMissing.push('Create room categories first');
  } else {
    const unpricedTypes = roomTypes.filter((rt) => !rt.pricePerNight || Number(rt.pricePerNight) <= 0);
    if (unpricedTypes.length > 0) {
      pricingMissing.push(`Set valid nightly tariff for "${unpricedTypes[0].name}"`);
    }
  }
  let step9Status = 'locked';
  if (hotel && roomTypes.length > 0) {
    step9Status = pricingMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'room_pricing',
    stepNumber: 9,
    title: 'Base Pricing & Tariffs',
    status: step9Status,
    missingDetails: pricingMissing,
    actionLabel: roomTypes.length > 0 ? 'Review Rates' : 'Locked',
    actionUrl: '/partner/rates',
    updatedAt: roomTypes[0]?.updatedAt || null,
  }));

  // STEP 10: Availability and Inventory Calendar
  const availMissing = [];
  if (!hotel || roomUnits.length === 0) {
    availMissing.push('Physical room units required first');
  } else {
    const activeUnits = roomUnits.filter((u) => u.status === 'active' || u.status === 'available');
    if (activeUnits.length === 0) {
      availMissing.push('At least one room unit must be marked available for booking');
    }
  }
  let step10Status = 'locked';
  if (hotel && roomUnits.length > 0) {
    step10Status = availMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'availability',
    stepNumber: 10,
    title: 'Inventory Availability & Status',
    status: step10Status,
    missingDetails: availMissing,
    actionLabel: roomUnits.length > 0 ? 'Check Availability' : 'Locked',
    actionUrl: '/partner/availability',
    updatedAt: roomUnits[0]?.updatedAt || null,
  }));

  // STEP 11: Property Policies & Rules
  const policiesMissing = [];
  if (!hotel) {
    policiesMissing.push('Property not created yet');
  } else {
    if (!hotel.checkInTime) policiesMissing.push('Check-in time required');
    if (!hotel.checkOutTime) policiesMissing.push('Check-out time required');
  }
  let step11Status = 'locked';
  if (hotel) {
    step11Status = policiesMissing.length === 0 ? 'completed' : 'pending';
  }
  steps.push(buildStep({
    key: 'property_policies',
    stepNumber: 11,
    title: 'Check-in Rules & Property Policies',
    status: step11Status,
    missingDetails: policiesMissing,
    actionLabel: hotel ? 'Update Policies' : 'Locked',
    actionUrl: '/partner/add-hotel',
    updatedAt: hotel?.updatedAt || null,
  }));

  // STEP 12: Final Review
  // Prerequisites: steps 1 through 11 must be completed
  const first11Completed = steps.every((s) => s.status === 'completed');
  const step12Status = first11Completed ? 'completed' : 'locked';
  steps.push(buildStep({
    key: 'final_review',
    stepNumber: 12,
    title: 'Listing Readiness & Final Review',
    status: step12Status,
    missingDetails: first11Completed ? [] : ['Complete all previous setup steps before final review'],
    actionLabel: first11Completed ? 'Review Listing' : 'Locked',
    actionUrl: '/partner/dashboard',
    updatedAt: null,
  }));

  // STEP 13: Submit for Admin Approval
  let step13Status = 'locked';
  let step13Missing = [];
  if (hotel?.approvalStatus === 'correction_required') {
    step13Status = 'needs_correction';
    step13Missing.push('Address admin correction notes and re-submit');
  } else if (!first11Completed) {
    step13Missing.push('All property and inventory requirements must be completed before submission');
  } else if (!hotel.partnerSubmitted && hotel.approvalStatus !== 'approved') {
    step13Status = 'pending';
    step13Missing.push('Submit your complete listing for admin review');
  } else if (hotel.approvalStatus === 'pending') {
    step13Status = 'completed'; // Submitted and awaiting review
  } else if (hotel.approvalStatus === 'approved') {
    step13Status = 'completed'; // Fully approved
  }
  steps.push(buildStep({
    key: 'admin_submission',
    stepNumber: 13,
    title: 'Submit for Admin Verification & Approval',
    status: step13Status,
    missingDetails: step13Missing,
    actionLabel: hotel?.approvalStatus === 'approved' ? 'Listing Live' : (hotel?.partnerSubmitted ? 'Under Review' : 'Submit for Approval'),
    actionUrl: '/partner/dashboard',
    correctionReason: hotel?.adminRemarks || '',
    updatedAt: hotel?.updatedAt || null,
  }));

  // Aggregate Metrics
  const completedStepsCount = steps.filter((s) => s.status === 'completed').length;
  const totalStepsCount = steps.length;
  const overallProgressPercent = Math.round((completedStepsCount / totalStepsCount) * 100);

  // Find next action step
  const nextIncomplete = steps.find((s) => s.status === 'needs_correction') ||
    steps.find((s) => s.status === 'pending') ||
    steps.find((s) => s.status === 'locked');

  const isReadyForSubmission = first11Completed && !hotel?.partnerSubmitted && hotel?.approvalStatus !== 'approved';
  const isApproved = hotel?.approvalStatus === 'approved' && user.partnerStatus === 'approved';

  // Construct in-app reminders
  const reminders = [];
  if (!hotel) {
    reminders.push({
      id: 'rem_create_property',
      type: 'warning',
      title: 'Property Listing Missing',
      message: 'You have registered as a partner. Please create your hotel or dharamshala profile to proceed with setup.',
      actionLabel: 'Create Property',
      actionUrl: '/partner/add-hotel',
    });
  } else if (roomTypes.length === 0) {
    reminders.push({
      id: 'rem_create_rooms',
      type: 'warning',
      title: 'Room Categories Required',
      message: `"${hotel.name}" has no room categories. Add at least one category (e.g. Deluxe AC, Standard Double).`,
      actionLabel: 'Add Room Category',
      actionUrl: '/partner/inventory',
    });
  } else if (roomUnits.length === 0) {
    reminders.push({
      id: 'rem_create_units',
      type: 'warning',
      title: 'Physical Inventory Missing',
      message: 'You have defined room categories, but no physical room units (e.g. Room 101, 102). Add physical inventory.',
      actionLabel: 'Add Room Units',
      actionUrl: '/partner/inventory',
    });
  } else if (step9Status === 'pending') {
    reminders.push({
      id: 'rem_pricing_missing',
      type: 'warning',
      title: 'Room Tariffs Missing',
      message: 'Configure nightly base rates for your room categories to make your rooms bookable.',
      actionLabel: 'Configure Pricing',
      actionUrl: '/partner/rates',
    });
  } else if (hotel.approvalStatus === 'correction_required') {
    reminders.push({
      id: 'rem_correction_required',
      type: 'danger',
      title: 'Admin Correction Requested',
      message: hotel.adminRemarks || 'Admin has requested corrections on your listing. Please update and re-submit.',
      actionLabel: 'Fix & Resubmit',
      actionUrl: nextIncomplete ? nextIncomplete.actionUrl : '/partner/add-hotel',
    });
  } else if (isReadyForSubmission) {
    reminders.push({
      id: 'rem_ready_to_submit',
      type: 'info',
      title: 'Listing Ready for Approval',
      message: 'All 11 setup steps are complete! Submit your property now for admin verification.',
      actionLabel: 'Submit for Approval',
      actionUrl: '/partner/dashboard',
    });
  } else if (hotel.approvalStatus === 'pending' && hotel.partnerSubmitted) {
    reminders.push({
      id: 'rem_under_review',
      type: 'info',
      title: 'Listing Under Review',
      message: 'Your property has been submitted and is currently being verified by the Vrindavan Sarthi admin team.',
      actionLabel: 'View Status',
      actionUrl: '/partner/dashboard',
    });
  }

  return {
    partnerId: user._id,
    partnerName: user.name,
    partnerEmail: user.email,
    partnerStatus: user.partnerStatus,
    hotel: hotel ? {
      _id: hotel._id,
      name: hotel.name,
      propertyType: hotel.propertyType,
      approvalStatus: hotel.approvalStatus,
      status: hotel.status,
      partnerSubmitted: hotel.partnerSubmitted,
      adminRemarks: hotel.adminRemarks,
    } : null,
    roomTypesCount: roomTypes.length,
    roomUnitsCount: roomUnits.length,
    overallProgressPercent,
    completedStepsCount,
    totalStepsCount,
    nextActionStep: nextIncomplete ? nextIncomplete.key : 'admin_submission',
    nextActionTitle: nextIncomplete ? nextIncomplete.title : 'Complete',
    nextActionUrl: nextIncomplete ? nextIncomplete.actionUrl : '/partner/dashboard',
    isReadyForSubmission,
    isApproved,
    steps,
    reminders,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  calculatePartnerOnboardingStatus,
};
