import { CityImage, PlaceOption, RestaurantOption, TravelTheme } from '@/lib/types';

export const airportCountryMap: Record<string, { countryCode: string; countryName: string }> = {
  ICN: { countryCode: 'KR', countryName: 'Korea' },
  GMP: { countryCode: 'KR', countryName: 'Korea' },
  NRT: { countryCode: 'JP', countryName: 'Japan' },
  HND: { countryCode: 'JP', countryName: 'Japan' },
  KIX: { countryCode: 'JP', countryName: 'Japan' },
  BKK: { countryCode: 'TH', countryName: 'Thailand' },
  SIN: { countryCode: 'SG', countryName: 'Singapore' },
  CDG: { countryCode: 'FR', countryName: 'France' },
  LHR: { countryCode: 'GB', countryName: 'United Kingdom' },
  JFK: { countryCode: 'US', countryName: 'United States' },
  LAX: { countryCode: 'US', countryName: 'United States' },
};

export const countryCities: Record<string, string[]> = {
  KR: ['Seoul', 'Busan', 'Jeju'],
  JP: ['Tokyo', 'Osaka', 'Kyoto', 'Fukuoka'],
  TH: ['Bangkok', 'Chiang Mai', 'Phuket'],
  SG: ['Singapore'],
  FR: ['Paris', 'Nice', 'Lyon'],
  GB: ['London', 'Manchester', 'Edinburgh'],
  US: ['New York', 'Los Angeles', 'San Francisco', 'Seattle'],
};

export const themeHeroImages: Record<TravelTheme, string[]> = {
  activity: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  ],
  healing: [
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1200&q=80',
  ],
  city: [
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80',
  ],
};

export const cityImages: CityImage[] = [
  {
    id: 'tokyo-night-1',
    countryCode: 'JP',
    city: 'Tokyo',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    caption: 'Tokyo night skyline with dazzling city lights',
  },
  {
    id: 'osaka-1',
    countryCode: 'JP',
    city: 'Osaka',
    imageUrl: 'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=1200&q=80',
    caption: 'Neon-filled Dotonbori and lively evening streets',
  },
  {
    id: 'bangkok-1',
    countryCode: 'TH',
    city: 'Bangkok',
    imageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80',
    caption: 'Temple silhouettes and riverfront sunset in Bangkok',
  },
  {
    id: 'singapore-1',
    countryCode: 'SG',
    city: 'Singapore',
    imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=80',
    caption: 'Marina Bay skyline with futuristic architecture',
  },
  {
    id: 'paris-1',
    countryCode: 'FR',
    city: 'Paris',
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    caption: 'Eiffel Tower glow and romantic Paris evening',
  },
  {
    id: 'london-1',
    countryCode: 'GB',
    city: 'London',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
    caption: 'London Eye and Thames riverside lights',
  },
  {
    id: 'seoul-1',
    countryCode: 'KR',
    city: 'Seoul',
    imageUrl: 'https://images.unsplash.com/photo-1538485399081-7c897b1cf2d7?auto=format&fit=crop&w=1200&q=80',
    caption: 'Seoul cityscape and river reflections at dusk',
  },
  {
    id: 'nyc-1',
    countryCode: 'US',
    city: 'New York',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e6?auto=format&fit=crop&w=1200&q=80',
    caption: 'New York skyline and energetic downtown vibe',
  },
  {
    id: 'la-1',
    countryCode: 'US',
    city: 'Los Angeles',
    imageUrl: 'https://images.unsplash.com/photo-1534196511436-921a4e99f297?auto=format&fit=crop&w=1200&q=80',
    caption: 'Los Angeles sunset boulevard and palm-lined cityscape',
  },
];

export const curatedPlaces: PlaceOption[] = [
  {
    id: 'jp-tokyo-shibuya-sky',
    countryCode: 'JP',
    city: 'Tokyo',
    name: 'Shibuya Sky',
    theme: 'city',
    rating: 4.8,
    reviewCount: 6450,
    imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?auto=format&fit=crop&w=900&q=80',
    summary: '360° observation deck for dazzling city-night views.',
  },
  {
    id: 'jp-tokyo-okutama',
    countryCode: 'JP',
    city: 'Tokyo',
    name: 'Okutama Hiking Trail',
    theme: 'activity',
    rating: 4.7,
    reviewCount: 2310,
    imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
    summary: 'Refreshing mountain hike with riverside nature routes.',
  },
  {
    id: 'jp-kyoto-arashiyama',
    countryCode: 'JP',
    city: 'Kyoto',
    name: 'Arashiyama Bamboo Grove',
    theme: 'healing',
    rating: 4.7,
    reviewCount: 10220,
    imageUrl: 'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=900&q=80',
    summary: 'Serene bamboo paths with calm, meditative atmosphere.',
  },
  {
    id: 'th-phuket-snorkeling',
    countryCode: 'TH',
    city: 'Phuket',
    name: 'Coral Island Snorkeling',
    theme: 'activity',
    rating: 4.6,
    reviewCount: 4150,
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80',
    summary: 'Half-day marine activity with clear-water snorkeling.',
  },
  {
    id: 'th-chiangmai-doiinthanon',
    countryCode: 'TH',
    city: 'Chiang Mai',
    name: 'Doi Inthanon National Park',
    theme: 'healing',
    rating: 4.8,
    reviewCount: 2980,
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
    summary: 'Waterfalls, cool forest air, and scenic viewpoints.',
  },
  {
    id: 'sg-singapore-marina-bay',
    countryCode: 'SG',
    city: 'Singapore',
    name: 'Marina Bay Night Walk',
    theme: 'city',
    rating: 4.8,
    reviewCount: 5590,
    imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=900&q=80',
    summary: 'Iconic skyline loop with waterfront lights and music shows.',
  },
  {
    id: 'fr-paris-seine',
    countryCode: 'FR',
    city: 'Paris',
    name: 'Seine Riverside Evening Cruise',
    theme: 'city',
    rating: 4.7,
    reviewCount: 12310,
    imageUrl: 'https://images.unsplash.com/photo-1503917988258-f87a78e3c995?auto=format&fit=crop&w=900&q=80',
    summary: 'Classic sightseeing route with sparkling monuments.',
  },
  {
    id: 'gb-edinburgh-arthurs-seat',
    countryCode: 'GB',
    city: 'Edinburgh',
    name: "Arthur's Seat Hike",
    theme: 'activity',
    rating: 4.8,
    reviewCount: 4210,
    imageUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80',
    summary: 'Active hill climb with dramatic city panorama at summit.',
  },
  {
    id: 'us-sf-golden-gate',
    countryCode: 'US',
    city: 'San Francisco',
    name: 'Golden Gate View Trail',
    theme: 'healing',
    rating: 4.7,
    reviewCount: 3380,
    imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=900&q=80',
    summary: 'Ocean breeze and bridge views for a relaxed day out.',
  },
];

export const curatedRestaurants: RestaurantOption[] = [
  {
    id: 'jp-tokyo-sushi-dai',
    countryCode: 'JP',
    city: 'Tokyo',
    name: 'Sushi Dai',
    cuisine: 'Japanese Sushi',
    rating: 4.7,
    reviewCount: 5240,
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80',
    summary: 'Top-rated sushi experience loved by international travelers.',
  },
  {
    id: 'jp-osaka-mizuno',
    countryCode: 'JP',
    city: 'Osaka',
    name: 'Mizuno',
    cuisine: 'Okonomiyaki',
    rating: 4.6,
    reviewCount: 4015,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    summary: 'Famous local spot with consistently strong reviews.',
  },
  {
    id: 'th-bangkok-jeh-o',
    countryCode: 'TH',
    city: 'Bangkok',
    name: 'Jeh O Chula',
    cuisine: 'Thai Local',
    rating: 4.5,
    reviewCount: 6150,
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
    summary: 'Late-night Thai icon known for flavorful signature noodles.',
  },
  {
    id: 'sg-singapore-odette',
    countryCode: 'SG',
    city: 'Singapore',
    name: 'Odette',
    cuisine: 'French Fine Dining',
    rating: 4.8,
    reviewCount: 2210,
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
    summary: 'Award-winning fine dining experience with polished service.',
  },
  {
    id: 'fr-paris-le-relais',
    countryCode: 'FR',
    city: 'Paris',
    name: 'Le Relais de l’Entrecôte',
    cuisine: 'French Steak Frites',
    rating: 4.6,
    reviewCount: 8930,
    imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
    summary: 'Beloved classic with high review consistency among visitors.',
  },
  {
    id: 'gb-london-dishoom',
    countryCode: 'GB',
    city: 'London',
    name: 'Dishoom Covent Garden',
    cuisine: 'Bombay-inspired',
    rating: 4.7,
    reviewCount: 12100,
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
    summary: 'Popular all-day dining with excellent traveler feedback.',
  },
  {
    id: 'us-nyc-katz',
    countryCode: 'US',
    city: 'New York',
    name: 'Katz’s Delicatessen',
    cuisine: 'American Deli',
    rating: 4.6,
    reviewCount: 14900,
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
    summary: 'Historic NYC institution frequently recommended by reviewers.',
  },
];

export function getPlaces(params: { countryCode?: string; city?: string; theme?: TravelTheme | 'all' }) {
  return curatedPlaces
    .filter((item) => (params.countryCode ? item.countryCode === params.countryCode : true))
    .filter((item) => (params.city ? item.city === params.city : true))
    .filter((item) => (params.theme && params.theme !== 'all' ? item.theme === params.theme : true))
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
}

export function getRestaurants(params: { countryCode?: string; city?: string }) {
  return curatedRestaurants
    .filter((item) => (params.countryCode ? item.countryCode === params.countryCode : true))
    .filter((item) => (params.city ? item.city === params.city : true))
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
}

export function getCityImages(countryCode?: string, city?: string) {
  return cityImages.filter((item) => (countryCode ? item.countryCode === countryCode : true)).filter((item) => (city ? item.city === city : true));
}
