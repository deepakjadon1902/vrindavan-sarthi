import { describe, it, expect } from 'vitest';
import { getHotelStartingPrice, type HotelListItem } from '@/pages/Hotels';

describe('Hotels Module: Starting Price & Tariff Calculations', () => {
  const baseHotel: HotelListItem = {
    _id: 'test_hotel_1',
    name: 'Radhe Krishna Bhawan',
    location: 'Raman Reti, Vrindavan',
    rating: 4.8,
    image: '/placeholder.svg',
  };

  it('returns undefined if showPrices is explicitly false', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      showPrices: false,
      pricePerNight: 1500,
    };
    expect(getHotelStartingPrice(hotel)).toBeUndefined();
  });

  it('returns undefined if no positive prices are configured', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 0,
      priceSingleAC: -100,
    };
    expect(getHotelStartingPrice(hotel)).toBeUndefined();
  });

  it('finds the lowest positive tariff across all room options', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 2500,
      priceDoubleAC: 3000,
      priceDoubleNonAC: 1800,
      priceSingleAC: 1500,
      priceSingleNonAC: 1200,
      pricePerBed: 450,
      taxEnabled: false,
    };
    expect(getHotelStartingPrice(hotel)).toBe(450);
  });

  it('returns undefined for Dharamshala property type', () => {
    const dharamshala: HotelListItem = {
      ...baseHotel,
      propertyType: 'dharamshala',
      pricePerNight: 500,
    };
    expect(getHotelStartingPrice(dharamshala)).toBeUndefined();
  });

  it('computes tariff for commercial stay types (hotel, home_stay, guest_house)', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      propertyType: 'hotel',
      pricePerNight: 1200,
      taxEnabled: false,
    };
    expect(getHotelStartingPrice(hotel)).toBe(1200);

    const homeStay: HotelListItem = {
      ...baseHotel,
      propertyType: 'home_stay',
      pricePerNight: 1500,
      taxEnabled: false,
    };
    expect(getHotelStartingPrice(homeStay)).toBe(1500);

    const guestHouse: HotelListItem = {
      ...baseHotel,
      propertyType: 'guest_house',
      pricePerNight: 900,
      taxEnabled: false,
    };
    expect(getHotelStartingPrice(guestHouse)).toBe(900);
  });

  it('returns base tariff when tax is disabled', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 2000,
      taxEnabled: false,
    };
    expect(getHotelStartingPrice(hotel)).toBe(2000);
  });

  it('calculates 5% GST in automatic mode for tariff <= Rs. 7,500', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 2000,
      taxEnabled: true,
      gstMode: 'automatic',
    };
    // 2000 + 5% = 2100
    expect(getHotelStartingPrice(hotel)).toBe(2100);
  });

  it('calculates 18% GST in automatic mode for tariff > Rs. 7,500', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 10000,
      taxEnabled: true,
      gstMode: 'automatic',
    };
    // 10000 + 18% = 11800
    expect(getHotelStartingPrice(hotel)).toBe(11800);
  });

  it('calculates custom tax percentage in manual mode', () => {
    const hotel: HotelListItem = {
      ...baseHotel,
      pricePerNight: 1000,
      taxEnabled: true,
      gstMode: 'manual',
      taxPercent: 12,
    };
    // 1000 + 12% = 1120
    expect(getHotelStartingPrice(hotel)).toBe(1120);
  });

  it('clamps custom tax percentage between 0% and 50%', () => {
    const hotelHighTax: HotelListItem = {
      ...baseHotel,
      pricePerNight: 1000,
      taxEnabled: true,
      gstMode: 'manual',
      taxPercent: 80, // clamped to 50%
    };
    // 1000 + 50% = 1500
    expect(getHotelStartingPrice(hotelHighTax)).toBe(1500);

    const hotelNegativeTax: HotelListItem = {
      ...baseHotel,
      pricePerNight: 1000,
      taxEnabled: true,
      gstMode: 'manual',
      taxPercent: -10, // clamped to 0%
    };
    expect(getHotelStartingPrice(hotelNegativeTax)).toBe(1000);
  });
});
