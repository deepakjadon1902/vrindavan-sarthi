import { describe, it, expect } from 'vitest';
import {
  calculateCabFareBreakdown,
  comparableKey,
  vehicleKey,
} from '@/pages/CabDetail';

describe('Cabs Module: Fare & Advance Payment Calculations', () => {
  it('calculates 4.45% convenience fee, 30% advance, and 70% balance for a standard fare', () => {
    // Fare: ₹2,000
    // Convenience fee: Math.round(2000 * 0.0445) = 89
    // Checkout total: 2000 + 89 = 2,089
    // 30% Advance: Math.round(2089 * 0.3) = Math.round(626.7) = 627
    // Balance: 2089 - 627 = 1,462
    const result = calculateCabFareBreakdown(2000);

    expect(result.fare).toBe(2000);
    expect(result.convenienceFee).toBe(89);
    expect(result.checkoutTotal).toBe(2089);
    expect(result.advanceAmount).toBe(627);
    expect(result.balanceAmount).toBe(1462);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.checkoutTotal);
  });

  it('handles rounding accurately for odd fare values', () => {
    // Fare: ₹1,550
    // Convenience fee: Math.round(1550 * 0.0445) = Math.round(68.975) = 69
    // Checkout total: 1550 + 69 = 1,619
    // 30% Advance: Math.round(1619 * 0.3) = Math.round(485.7) = 486
    // Balance: 1619 - 486 = 1,133
    const result = calculateCabFareBreakdown(1550);

    expect(result.fare).toBe(1550);
    expect(result.convenienceFee).toBe(69);
    expect(result.checkoutTotal).toBe(1619);
    expect(result.advanceAmount).toBe(486);
    expect(result.balanceAmount).toBe(1133);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.checkoutTotal);
  });

  it('correctly calculates small fares without negative balance', () => {
    // Fare: ₹500
    // Convenience fee: Math.round(500 * 0.0445) = 22
    // Checkout total: 500 + 22 = 522
    // 30% Advance: Math.round(522 * 0.3) = Math.round(156.6) = 157
    // Balance: 522 - 157 = 365
    const result = calculateCabFareBreakdown(500);

    expect(result.fare).toBe(500);
    expect(result.convenienceFee).toBe(22);
    expect(result.checkoutTotal).toBe(522);
    expect(result.advanceAmount).toBe(157);
    expect(result.balanceAmount).toBe(365);
    expect(result.advanceAmount + result.balanceAmount).toBe(result.checkoutTotal);
  });

  it('returns all zeros when fare is 0', () => {
    const result = calculateCabFareBreakdown(0);

    expect(result.fare).toBe(0);
    expect(result.convenienceFee).toBe(0);
    expect(result.checkoutTotal).toBe(0);
    expect(result.advanceAmount).toBe(0);
    expect(result.balanceAmount).toBe(0);
  });

  it('returns safe fallback zeros when fare is null or undefined (unselected or pending fare)', () => {
    const nullResult = calculateCabFareBreakdown(null);
    expect(nullResult.fare).toBeNull();
    expect(nullResult.convenienceFee).toBe(0);
    expect(nullResult.checkoutTotal).toBe(0);
    expect(nullResult.advanceAmount).toBe(0);
    expect(nullResult.balanceAmount).toBe(0);

    const undefinedResult = calculateCabFareBreakdown(undefined);
    expect(undefinedResult.fare).toBeNull();
    expect(undefinedResult.convenienceFee).toBe(0);
    expect(undefinedResult.checkoutTotal).toBe(0);
    expect(undefinedResult.advanceAmount).toBe(0);
    expect(undefinedResult.balanceAmount).toBe(0);
  });

  it('handles invalid negative numbers or non-finite inputs safely', () => {
    const negativeResult = calculateCabFareBreakdown(-500);
    expect(negativeResult.fare).toBeNull();
    expect(negativeResult.convenienceFee).toBe(0);
    expect(negativeResult.checkoutTotal).toBe(0);

    const nanResult = calculateCabFareBreakdown(NaN);
    expect(nanResult.fare).toBeNull();
    expect(nanResult.convenienceFee).toBe(0);
    expect(nanResult.checkoutTotal).toBe(0);
  });
});

describe('Cabs Module: Key Normalization Utilities', () => {
  it('normalizes comparable keys by trimming, lowercasing, and stripping punctuation', () => {
    expect(comparableKey('  Vrindavan - Mathura Road  ')).toBe('vrindavan mathura road');
    expect(comparableKey('Prem Mandir (Braj)')).toBe('prem mandir braj');
    expect(comparableKey('Govardhan / Radhakund')).toBe('govardhan radhakund');
    expect(comparableKey('')).toBe('');
    expect(comparableKey(null)).toBe('');
    expect(comparableKey(undefined)).toBe('');
  });

  it('normalizes vehicle keys by removing category stop-words', () => {
    expect(vehicleKey('Innova Crysta 7 Seater')).toBe('innova crysta 7');
    expect(vehicleKey('Dzire Sedan AC Cab')).toBe('dzire sedan ac');
    expect(vehicleKey('Tempo Traveller 12 Seater Taxi')).toBe('tempo traveller 12');
    expect(vehicleKey('Ertiga 6 Seat Car')).toBe('ertiga 6');
    expect(vehicleKey('Commercial Vehicle')).toBe('commercial');
    expect(vehicleKey('Sedan Car')).toBe('sedan');
  });

  it('handles edge cases and whitespace gracefully in vehicle keys', () => {
    expect(vehicleKey('   ')).toBe('');
    expect(vehicleKey(null)).toBe('');
    expect(vehicleKey(undefined)).toBe('');
    expect(vehicleKey('7-Seater AC Taxi!')).toBe('7 ac');
  });
});
