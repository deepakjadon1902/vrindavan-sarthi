import { describe, it, expect } from 'vitest';
import { calculateTourPriceBreakdown } from '@/pages/TourDetail';

describe('Tours Module: Price, Fee, and Advance Calculations', () => {
  it('calculates 4.45% convenience fee, 30% advance, and 70% balance for a single guest', () => {
    // Price: ₹1,500/person, 1 guest
    // Subtotal: 1,500
    // Convenience fee: Math.round(1500 * 0.0445) = Math.round(66.75) = 67
    // Total: 1,500 + 67 = 1,567
    // 30% Advance: Math.round(1567 * 0.3) = Math.round(470.1) = 470
    // Balance: 1567 - 470 = 1,097
    const result = calculateTourPriceBreakdown(1500, 1);

    expect(result.pricePerPerson).toBe(1500);
    expect(result.persons).toBe(1);
    expect(result.subtotal).toBe(1500);
    expect(result.convenienceFee).toBe(67);
    expect(result.total).toBe(1567);
    expect(result.advanceAmount).toBe(470);
    expect(result.balanceAmount).toBe(1097);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.total);
  });

  it('calculates subtotal and payment split correctly for multiple guests', () => {
    // Price: ₹2,200/person, 4 guests
    // Subtotal: 2,200 * 4 = 8,800
    // Convenience fee: Math.round(8800 * 0.0445) = Math.round(391.6) = 392
    // Total: 8,800 + 392 = 9,192
    // 30% Advance: Math.round(9192 * 0.3) = Math.round(2757.6) = 2,758
    // Balance: 9,192 - 2,758 = 6,434
    const result = calculateTourPriceBreakdown(2200, 4);

    expect(result.pricePerPerson).toBe(2200);
    expect(result.persons).toBe(4);
    expect(result.subtotal).toBe(8800);
    expect(result.convenienceFee).toBe(392);
    expect(result.total).toBe(9192);
    expect(result.advanceAmount).toBe(2758);
    expect(result.balanceAmount).toBe(6434);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.total);
  });

  it('accurately rounds half-point convenience fee and advance splits', () => {
    // Price: ₹3,500/person, 2 guests
    // Subtotal: 3,500 * 2 = 7,000
    // Convenience fee: Math.round(7000 * 0.0445) = Math.round(311.5) = 312
    // Total: 7,000 + 312 = 7,312
    // 30% Advance: Math.round(7312 * 0.3) = Math.round(2193.6) = 2,194
    // Balance: 7,312 - 2,194 = 5,118
    const result = calculateTourPriceBreakdown(3500, 2);

    expect(result.subtotal).toBe(7000);
    expect(result.convenienceFee).toBe(312);
    expect(result.total).toBe(7312);
    expect(result.advanceAmount).toBe(2194);
    expect(result.balanceAmount).toBe(5118);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.total);
  });

  it('scales accurately for large group sizes', () => {
    // Price: ₹1,000/person, 25 guests
    // Subtotal: 25,000
    // Convenience fee: Math.round(25000 * 0.0445) = Math.round(1112.5) = 1113
    // Total: 25,000 + 1113 = 26,113
    // 30% Advance: Math.round(26113 * 0.3) = Math.round(7833.9) = 7,834
    // Balance: 26,113 - 7,834 = 18,279
    const result = calculateTourPriceBreakdown(1000, 25);

    expect(result.subtotal).toBe(25000);
    expect(result.convenienceFee).toBe(1113);
    expect(result.total).toBe(26113);
    expect(result.advanceAmount).toBe(7834);
    expect(result.balanceAmount).toBe(18279);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.total);
  });

  it('returns all zeros when pricePerPerson is 0', () => {
    const result = calculateTourPriceBreakdown(0, 3);

    expect(result.pricePerPerson).toBe(0);
    expect(result.subtotal).toBe(0);
    expect(result.convenienceFee).toBe(0);
    expect(result.total).toBe(0);
    expect(result.advanceAmount).toBe(0);
    expect(result.balanceAmount).toBe(0);
  });

  it('handles null, undefined, negative, or NaN prices safely', () => {
    const nullPrice = calculateTourPriceBreakdown(null, 2);
    expect(nullPrice.pricePerPerson).toBe(0);
    expect(nullPrice.total).toBe(0);

    const undefinedPrice = calculateTourPriceBreakdown(undefined, 2);
    expect(undefinedPrice.pricePerPerson).toBe(0);
    expect(undefinedPrice.total).toBe(0);

    const negativePrice = calculateTourPriceBreakdown(-1500, 2);
    expect(negativePrice.pricePerPerson).toBe(0);
    expect(negativePrice.total).toBe(0);

    const nanPrice = calculateTourPriceBreakdown(NaN, 2);
    expect(nanPrice.pricePerPerson).toBe(0);
    expect(nanPrice.total).toBe(0);
  });

  it('safely normalizes zero, negative, or non-integer guest counts to valid minimums', () => {
    // Zero or negative guests defaults to minimum 1
    const zeroGuests = calculateTourPriceBreakdown(1500, 0);
    expect(zeroGuests.persons).toBe(1);
    expect(zeroGuests.subtotal).toBe(1500);

    const negativeGuests = calculateTourPriceBreakdown(1500, -5);
    expect(negativeGuests.persons).toBe(1);
    expect(negativeGuests.subtotal).toBe(1500);

    const nullGuests = calculateTourPriceBreakdown(1500, null);
    expect(nullGuests.persons).toBe(1);
    expect(nullGuests.subtotal).toBe(1500);

    // Fractional guest counts are safely floored
    const fractionalGuests = calculateTourPriceBreakdown(1500, 3.8);
    expect(fractionalGuests.persons).toBe(3);
    expect(fractionalGuests.subtotal).toBe(4500);
  });
});
