const Settings = require('../models/Settings');

const PARTNER_COMMISSION_PERCENT = 10;
const GST_THRESHOLD_AMOUNT = 7500;
const LOW_GST_PERCENT = 5;
const HIGH_GST_PERCENT = 18;
const CONVENIENCE_FEE_PERCENT = 4.45;

const calculateConvenienceFee = (amount) =>
  Math.round((Math.max(0, Number(amount || 0)) * CONVENIENCE_FEE_PERCENT) / 100);

const calculateGatewayFee = (amount) =>
  Math.round((Math.max(0, Number(amount || 0)) * 2) / 100);

const clampPercent = (value, fallback = 0, max = 100) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, n);
};

const getPaymentOption = (value, allowed = ['advance_30', 'full_100']) => {
  const option = String(value || '').trim();
  return allowed.includes(option) ? option : '';
};

const getHotelTaxPercent = async (hotel, roomType) => {
  if (!hotel?.taxEnabled) return 0;
  if (String(hotel?.gstMode || '').trim().toLowerCase() === 'automatic') {
    const pricePerNight = Number(roomType?.pricePerNight || 0);
    return pricePerNight <= GST_THRESHOLD_AMOUNT ? LOW_GST_PERCENT : HIGH_GST_PERCENT;
  }
  const hotelPercent = Number(hotel?.taxPercent);
  if (Number.isFinite(hotelPercent) && hotelPercent >= 0) return Math.min(50, hotelPercent);
  try {
    const s = await Settings.findOne().select('hotelTaxPercent').lean();
    const p = Number(s?.hotelTaxPercent ?? 12);
    if (!Number.isFinite(p) || p < 0) return 0;
    return Math.min(50, p);
  } catch {
    return 12;
  }
};

const buildMoneyFields = ({ subtotal, baseAmount, taxAmount = 0, paymentOption = 'advance_30', commissionPercent = 0, gatewayFeeAmount }) => {
  const checkoutSubtotal = Math.round(Math.max(0, Number(subtotal || 0)));
  const roomAmount = Math.round(Math.max(0, Number(baseAmount ?? (checkoutSubtotal - Number(taxAmount || 0)))));
  const convenienceFeeAmount = calculateConvenienceFee(roomAmount);
  const totalAmount = checkoutSubtotal + convenienceFeeAmount;
  const advancePercent = paymentOption === 'full_100' ? 100 : 30;
  const advanceAmount = Math.round(totalAmount * (advancePercent / 100));
  const balanceAmount = Math.max(0, totalAmount - advanceAmount);
  const hotelTaxAmount = Math.round(Math.max(0, Number(taxAmount || 0)));
  const grossForHotel = roomAmount + hotelTaxAmount;
  const platformCommissionPercent = clampPercent(commissionPercent, PARTNER_COMMISSION_PERCENT, 100);
  const platformCommissionAmount = Math.round((roomAmount * platformCommissionPercent) / 100);
  const paymentGatewayFeeAmount = Math.max(0, Math.round(Number.isFinite(Number(gatewayFeeAmount)) ? Number(gatewayFeeAmount) : calculateGatewayFee(roomAmount)));
  const partnerNetPayout = Math.max(0, grossForHotel - platformCommissionAmount - paymentGatewayFeeAmount);

  return {
    base_amount: roomAmount,
    hotel_gst_amount: hotelTaxAmount,
    convenience_fee: convenienceFeeAmount,
    customer_total: totalAmount,
    advance_paid: advanceAmount,
    balance_at_property: balanceAmount,
    commission_rate: platformCommissionPercent,
    commission_amount: platformCommissionAmount,
    payment_gateway_fee: paymentGatewayFeeAmount,
    gross_for_hotel: grossForHotel,
    hotel_net_payout: partnerNetPayout,
    payout_status: 'pending',
    checkoutSubtotal,
    convenienceFeePercent: CONVENIENCE_FEE_PERCENT,
    convenienceFeeAmount,
    totalAmount,
    paymentOption,
    advancePercent,
    advanceAmount,
    balanceAmount,
    platformCommissionPercent,
    platformCommissionAmount,
    grossForHotel,
    paymentGatewayFeeAmount,
    partnerNetPayout,
  };
};

const calculateLodgingPrice = async ({
  hotel,
  roomType,
  nights,
  roomQuantity,
  paymentOption = 'advance_30',
  gatewayFeeAmount,
}) => {
  const safeNights = Math.max(1, Math.floor(Number(nights || 1)));
  const safeQuantity = Math.max(1, Math.floor(Number(roomQuantity || 1)));
  const baseAmount = Math.max(0, Number(roomType?.pricePerNight || 0)) * safeNights * safeQuantity;
  const taxPercent = await getHotelTaxPercent(hotel, roomType);
  const taxAmount = Math.round((baseAmount * taxPercent) / 100);
  const subtotal = Math.round(baseAmount + taxAmount);
  const money = buildMoneyFields({
    subtotal,
    baseAmount,
    taxAmount,
    paymentOption,
    commissionPercent: hotel?.partnerId ? PARTNER_COMMISSION_PERCENT : hotel?.platform_commission_percentage,
    gatewayFeeAmount,
  });

  return {
    baseAmount,
    taxPercent,
    taxAmount,
    subtotal,
    ...money,
  };
};

const calculateLodgingPriceFromBase = async ({
  hotel,
  roomType,
  baseAmount,
  paymentOption = 'advance_30',
  gatewayFeeAmount,
}) => {
  const safeBaseAmount = Math.max(0, Math.round(Number(baseAmount || 0)));
  const taxPercent = await getHotelTaxPercent(hotel, roomType);
  const taxAmount = Math.round((safeBaseAmount * taxPercent) / 100);
  const subtotal = Math.round(safeBaseAmount + taxAmount);
  const money = buildMoneyFields({
    subtotal,
    baseAmount: safeBaseAmount,
    taxAmount,
    paymentOption,
    commissionPercent: hotel?.partnerId ? PARTNER_COMMISSION_PERCENT : hotel?.platform_commission_percentage,
    gatewayFeeAmount,
  });

  return {
    baseAmount: safeBaseAmount,
    taxPercent,
    taxAmount,
    subtotal,
    ...money,
  };
};

module.exports = {
  PARTNER_COMMISSION_PERCENT,
  CONVENIENCE_FEE_PERCENT,
  calculateConvenienceFee,
  calculateGatewayFee,
  getPaymentOption,
  getHotelTaxPercent,
  buildMoneyFields,
  calculateLodgingPrice,
  calculateLodgingPriceFromBase,
};
