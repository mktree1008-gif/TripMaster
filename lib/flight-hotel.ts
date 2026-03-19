import { FlightOption, HotelOption } from '@/lib/types';

export const airports = [
  { code: 'ICN', city: 'Seoul', countryCode: 'KR' },
  { code: 'GMP', city: 'Seoul', countryCode: 'KR' },
  { code: 'NRT', city: 'Tokyo', countryCode: 'JP' },
  { code: 'HND', city: 'Tokyo', countryCode: 'JP' },
  { code: 'KIX', city: 'Osaka', countryCode: 'JP' },
  { code: 'BKK', city: 'Bangkok', countryCode: 'TH' },
  { code: 'SIN', city: 'Singapore', countryCode: 'SG' },
  { code: 'CDG', city: 'Paris', countryCode: 'FR' },
  { code: 'LHR', city: 'London', countryCode: 'GB' },
  { code: 'JFK', city: 'New York', countryCode: 'US' },
  { code: 'LAX', city: 'Los Angeles', countryCode: 'US' },
];

const routeBase: Record<string, { price: number; duration: number }> = {
  'ICN-NRT': { price: 220000, duration: 2.5 },
  'ICN-KIX': { price: 250000, duration: 1.9 },
  'ICN-BKK': { price: 360000, duration: 5.7 },
  'ICN-SIN': { price: 390000, duration: 6.4 },
  'ICN-CDG': { price: 940000, duration: 13.8 },
  'ICN-LHR': { price: 970000, duration: 14.1 },
  'ICN-JFK': { price: 1280000, duration: 15.1 },
  'ICN-LAX': { price: 1100000, duration: 11.7 },
};

const airlines = [
  { name: 'Korean Air', factor: 1.08, rating: 4.7, officialUrl: 'https://www.koreanair.com' },
  { name: 'Asiana Airlines', factor: 1.05, rating: 4.6, officialUrl: 'https://flyasiana.com' },
  { name: 'Japan Airlines', factor: 1.09, rating: 4.7, officialUrl: 'https://www.jal.com' },
  { name: 'Singapore Airlines', factor: 1.14, rating: 4.8, officialUrl: 'https://www.singaporeair.com' },
  { name: 'Delta Air Lines', factor: 1.03, rating: 4.5, officialUrl: 'https://www.delta.com' },
  { name: 'Lufthansa', factor: 1.04, rating: 4.5, officialUrl: 'https://www.lufthansa.com' },
];

const hotelsByCity: Record<string, Omit<HotelOption, 'id'>[]> = {
  Tokyo: [
    {
      name: 'Hotel Groove Shinjuku',
      city: 'Tokyo',
      rating: 4.5,
      reviewCount: 2140,
      nightlyPrice: 185000,
      officialUrl: 'https://www.hotelgroove.jp/en/',
    },
    {
      name: 'The Tokyo Station Hotel',
      city: 'Tokyo',
      rating: 4.8,
      reviewCount: 1880,
      nightlyPrice: 460000,
      officialUrl: 'https://www.thetokyostationhotel.jp/en/',
    },
  ],
  Osaka: [
    {
      name: 'Cross Hotel Osaka',
      city: 'Osaka',
      rating: 4.4,
      reviewCount: 1520,
      nightlyPrice: 190000,
      officialUrl: 'https://www.crosshotel.com/osaka/en/',
    },
    {
      name: 'Conrad Osaka',
      city: 'Osaka',
      rating: 4.8,
      reviewCount: 970,
      nightlyPrice: 480000,
      officialUrl: 'https://www.hilton.com/en/hotels/osacici-conrad-osaka/',
    },
  ],
  Bangkok: [
    {
      name: 'Eastin Grand Hotel Sathorn',
      city: 'Bangkok',
      rating: 4.7,
      reviewCount: 3160,
      nightlyPrice: 175000,
      officialUrl: 'https://www.eastingrandsathorn.com/',
    },
  ],
  Singapore: [
    {
      name: 'The Fullerton Hotel Singapore',
      city: 'Singapore',
      rating: 4.8,
      reviewCount: 2010,
      nightlyPrice: 410000,
      officialUrl: 'https://www.fullertonhotels.com/fullerton-hotel-singapore',
    },
  ],
  Paris: [
    {
      name: 'Hotel Madame Reve',
      city: 'Paris',
      rating: 4.7,
      reviewCount: 880,
      nightlyPrice: 520000,
      officialUrl: 'https://www.madamereve.com/en/',
    },
  ],
  London: [
    {
      name: 'The Hoxton Holborn',
      city: 'London',
      rating: 4.5,
      reviewCount: 1760,
      nightlyPrice: 360000,
      officialUrl: 'https://thehoxton.com/london/holborn/',
    },
  ],
};

function seededDecimal(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function generateFlights(params: {
  origin: string;
  destination: string;
  tripType: 'round' | 'oneway' | 'multi';
  sort: 'recommended' | 'price';
}): FlightOption[] {
  const route =
    routeBase[`${params.origin}-${params.destination}`] ??
    routeBase[`${params.destination}-${params.origin}`] ??
    { price: 480000, duration: 8.3 };

  const list = airlines.map((airline, idx) => {
    const seed = seededDecimal(`${airline.name}${params.origin}${params.destination}${params.tripType}`);
    const stopCount = seed > 0.8 ? 2 : seed > 0.45 ? 1 : 0;
    const durationHours = Number((route.duration + stopCount * 1.1 + seed).toFixed(1));
    const tripMultiplier = params.tripType === 'round' ? 1.75 : params.tripType === 'multi' ? 2.05 : 1;
    const price = Math.round(route.price * airline.factor * (0.88 + seed * 0.25) * tripMultiplier);

    const recommendationScore = Number(
      (airline.rating * 0.36 + (1 / Math.max(price, 1)) * 200000 * 0.42 + (1 / (durationHours + 1)) * 0.22).toFixed(4)
    );

    return {
      id: `${airline.name}-${idx}`,
      airline: airline.name,
      route: `${params.origin} → ${params.destination}`,
      durationHours,
      stopCount,
      price,
      recommendationScore,
      officialUrl: airline.officialUrl,
    };
  });

  if (params.sort === 'price') {
    return list.sort((a, b) => a.price - b.price);
  }
  return list.sort((a, b) => b.recommendationScore - a.recommendationScore);
}

export function generateHotels(city: string, sort: 'recommended' | 'price') {
  const base = hotelsByCity[city] ?? [];
  const list = base.map((item, idx) => ({
    id: `${item.name}-${idx}`,
    ...item,
  }));

  if (sort === 'price') {
    return list.sort((a, b) => a.nightlyPrice - b.nightlyPrice);
  }
  return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
}
