export type InfoTopic = 'overview' | 'history' | 'society' | 'economy';

export interface DestinationInfo {
  countryCode: string;
  country: string;
  city: string;
  overview: string;
  history: string;
  society: string;
  economy: string;
}

export const destinationInformation: DestinationInfo[] = [
  {
    countryCode: 'JP',
    country: 'Japan',
    city: 'Tokyo',
    overview: 'Tokyo blends ultramodern energy with calm temple districts, ideal for day-night contrast travel.',
    history: 'From Edo period roots to post-war reinvention, Tokyo reflects layered urban history and resilience.',
    society: 'Public etiquette and transit punctuality are core social norms. Convenience culture is very strong.',
    economy: 'Tokyo is one of the world’s largest financial and innovation hubs with deep retail and tech sectors.',
  },
  {
    countryCode: 'TH',
    country: 'Thailand',
    city: 'Bangkok',
    overview: 'Bangkok offers vibrant street life, river landmarks, and rich food culture in dense city zones.',
    history: 'Rattanakosin-era heritage and royal temple architecture remain central to Bangkok identity.',
    society: 'Warm hospitality, flexible pace, and strong local market culture shape daily interactions.',
    economy: 'Tourism, services, and urban commerce drive Bangkok’s dynamic metropolitan economy.',
  },
  {
    countryCode: 'SG',
    country: 'Singapore',
    city: 'Singapore',
    overview: 'Singapore is clean, efficient, and multicultural with compact access to major attractions.',
    history: 'A former colonial port transformed into a global city-state through trade and infrastructure strategy.',
    society: 'Multilingual communities coexist with clear civic rules and strong public services.',
    economy: 'Finance, logistics, and advanced services form a high-value, globally connected economy.',
  },
  {
    countryCode: 'FR',
    country: 'France',
    city: 'Paris',
    overview: 'Paris combines iconic monuments, walkable neighborhoods, and strong museum culture.',
    history: 'Revolution-era legacies and 19th-century urban redesign define Paris’s modern form.',
    society: 'Cafe culture, neighborhood identity, and arts appreciation remain socially influential.',
    economy: 'Tourism, luxury goods, and business services play major roles in the metro economy.',
  },
  {
    countryCode: 'GB',
    country: 'United Kingdom',
    city: 'London',
    overview: 'London provides historic landmarks, diverse food scenes, and strong theater/nightlife options.',
    history: 'Roman origins, imperial expansion, and modern redevelopment shape London’s urban layers.',
    society: 'Multicultural communities and local borough identities create varied city experiences.',
    economy: 'Global finance, media, and professional services are major economic pillars.',
  },
  {
    countryCode: 'US',
    country: 'United States',
    city: 'New York',
    overview: 'New York delivers dense city energy, skyline views, and broad arts/food diversity.',
    history: 'Immigration waves and industrial-to-service transitions shaped modern New York.',
    society: 'Neighborhood diversity and fast-paced routines define social rhythm.',
    economy: 'Finance, media, tech, and tourism together sustain a globally influential economy.',
  },
  {
    countryCode: 'KR',
    country: 'Korea',
    city: 'Seoul',
    overview: 'Seoul offers high-tech convenience, palace history, and strong late-night culture.',
    history: 'Joseon capital heritage and rapid post-war modernization both remain visible.',
    society: 'Fast digital adoption and trend-driven consumer culture are notable social traits.',
    economy: 'Electronics, content, and advanced manufacturing networks support the capital region.',
  },
];

export type PrepGuideTopic = 'caution' | 'packing' | 'visa';

export interface TravelPrepGuide {
  countryCode: string;
  country: string;
  caution: string[];
  packing: string[];
  visa: string[];
}

export const travelPrepGuides: Record<string, TravelPrepGuide> = {
  JP: {
    countryCode: 'JP',
    country: 'Japan',
    caution: [
      'Rush-hour trains are crowded (weekday 07:30-09:00). Leave earlier for major attractions.',
      'Many restaurants are compact. Large luggage and loud calls can be uncomfortable in small spaces.',
      'Carry small cash backup because some local shops still prefer cardless payment.',
    ],
    packing: ['Portable umbrella (sudden rain)', 'Comfortable walking shoes', 'Transit IC card or mobile wallet setup'],
    visa: [
      'Short-stay entry may be visa-free depending on passport. Verify before booking.',
      'Prepare return-ticket and accommodation proof for immigration checks.',
    ],
  },
  TH: {
    countryCode: 'TH',
    country: 'Thailand',
    caution: [
      'Heat and humidity can be intense. Plan mid-day indoor breaks.',
      'Temple visits require respectful dress (shoulders/knees covered).',
      'Use licensed taxis/ride-hailing and confirm route during high traffic hours.',
    ],
    packing: ['Light breathable clothes', 'Sun protection and hydration bottle', 'Temple-appropriate cover layer'],
    visa: [
      'Visa exemption/e-visa rules depend on nationality and stay length.',
      'Keep passport validity (usually 6+ months) and onward/return ticket ready.',
    ],
  },
  SG: {
    countryCode: 'SG',
    country: 'Singapore',
    caution: [
      'Follow public rules carefully (cleanliness and restricted areas are strictly managed).',
      'Afternoon rain can happen quickly; keep indoor alternatives in your plan.',
      'Peak-hour MRT can be busy; stagger commute times for comfort.',
    ],
    packing: ['Foldable umbrella', 'Light jacket for indoor A/C', 'Universal plug adapter'],
    visa: [
      'Most travelers need to complete the SG Arrival Card before entry.',
      'Check visa requirements by nationality on official ICA channels.',
    ],
  },
  FR: {
    countryCode: 'FR',
    country: 'France',
    caution: [
      'Popular museums can sell out by time slot. Reserve tickets early.',
      'Watch personal belongings in crowded transit/tourist zones.',
      'Some stores close earlier on Sundays or have limited hours.',
    ],
    packing: ['Comfortable walking shoes', 'Crossbody anti-theft bag', 'Light scarf/jacket for evening'],
    visa: [
      'Schengen entry rules vary by passport and length of stay.',
      'Carry hotel confirmation and travel insurance details when possible.',
    ],
  },
  GB: {
    countryCode: 'GB',
    country: 'United Kingdom',
    caution: [
      'Weather changes quickly in the same day.',
      'Transit fares rise during peak hours; off-peak can save budget.',
      'Book major shows/events early to secure better seats and prices.',
    ],
    packing: ['Compact raincoat or umbrella', 'Contactless payment card', 'Comfortable layers for variable weather'],
    visa: [
      'Entry rules may include ETA depending on nationality.',
      'Check passport validity and official UK entry guidance before departure.',
    ],
  },
  US: {
    countryCode: 'US',
    country: 'United States',
    caution: [
      'City distances can be large; route planning affects fatigue and cost.',
      'Late-night neighborhood safety varies by area; check local guidance.',
      'Restaurant tax/tip expectations are typically added to menu prices.',
    ],
    packing: ['Portable charger', 'Comfortable sneakers', 'Digital/printed ID backup and emergency contacts'],
    visa: [
      'ESTA/visa requirement depends on nationality and travel purpose.',
      'Keep return ticket, lodging info, and itinerary details accessible.',
    ],
  },
  KR: {
    countryCode: 'KR',
    country: 'Korea',
    caution: [
      'Subway transfers can involve long corridors; allow transfer buffer time.',
      'Peak dining hours can mean waiting lines at popular spots.',
      'Seasonal air quality changes may affect outdoor plans.',
    ],
    packing: ['T-money card setup', 'Light mask for air-quality days', 'Comfortable shoes for stairs and slopes'],
    visa: [
      'K-ETA or visa requirement varies by country/passport status.',
      'Check official immigration notice for latest entry and exemption status.',
    ],
  },
  DEFAULT: {
    countryCode: 'DEFAULT',
    country: 'Destination',
    caution: [
      'Check transportation strike/holiday schedules close to departure date.',
      'Keep emergency contacts and insurance details offline as backup.',
    ],
    packing: ['Passport + backup copy', 'Universal adapter + charging kit', 'Essential medication and small first-aid'],
    visa: [
      'Always verify entry requirements on official government/embassy websites.',
      'Confirm passport validity, onward/return ticket, and stay duration limits.',
    ],
  },
};

export interface CommunityTip {
  id: string;
  countryCode: string;
  city: string;
  nickname: string;
  message: string;
  sourceType: 'community' | 'global';
}

export const globalTipsSeed: CommunityTip[] = [
  {
    id: 'tip-1',
    countryCode: 'JP',
    city: 'Tokyo',
    nickname: 'GlobeNomad',
    message: 'Rush hour can be intense. Start major attractions before 9 AM for smoother flow.',
    sourceType: 'global',
  },
  {
    id: 'tip-2',
    countryCode: 'TH',
    city: 'Bangkok',
    nickname: 'ThaiFoodHunter',
    message: 'Use river ferries near sunset for great views and often less traffic stress.',
    sourceType: 'global',
  },
  {
    id: 'tip-3',
    countryCode: 'FR',
    city: 'Paris',
    nickname: 'MuseumWalker',
    message: 'Reserve museum entry slots online early, especially for weekend visits.',
    sourceType: 'global',
  },
  {
    id: 'tip-4',
    countryCode: 'GB',
    city: 'London',
    nickname: 'TubeGuide',
    message: 'Contactless pay on transit is often faster than ticket machines for short stays.',
    sourceType: 'global',
  },
];

export interface TransportationOption {
  mode: string;
  reason: string;
  estimatedCost: string;
  bookingUrl: string;
}

export const transportationByCountry: Record<string, TransportationOption[]> = {
  JP: [
    {
      mode: 'Rail + IC Card',
      reason: 'Most reliable for city-center movement with high punctuality.',
      estimatedCost: 'USD 8-25/day',
      bookingUrl: 'https://www.jreast.co.jp/multi/en/',
    },
    {
      mode: 'Airport Limousine Bus',
      reason: 'Comfortable luggage handling from airport to city hotels.',
      estimatedCost: 'USD 18-35/ride',
      bookingUrl: 'https://www.limousinebus.co.jp/guide/en/',
    },
  ],
  TH: [
    {
      mode: 'BTS + MRT',
      reason: 'Avoids major road congestion during peak hours.',
      estimatedCost: 'USD 4-12/day',
      bookingUrl: 'https://www.bts.co.th/eng/',
    },
    {
      mode: 'Ride-hailing',
      reason: 'Useful for late night or less-connected neighborhoods.',
      estimatedCost: 'USD 3-15/ride',
      bookingUrl: 'https://www.grab.com/th/en/',
    },
  ],
  SG: [
    {
      mode: 'MRT + Bus',
      reason: 'Fast and integrated network for most attractions.',
      estimatedCost: 'USD 6-14/day',
      bookingUrl: 'https://www.smrt.com.sg/',
    },
  ],
  FR: [
    {
      mode: 'Metro + RER',
      reason: 'Covers central and suburban zones efficiently.',
      estimatedCost: 'USD 8-20/day',
      bookingUrl: 'https://www.ratp.fr/en',
    },
  ],
  GB: [
    {
      mode: 'Underground + Rail',
      reason: 'Best coverage across major sightseeing districts.',
      estimatedCost: 'USD 9-24/day',
      bookingUrl: 'https://tfl.gov.uk/',
    },
  ],
  US: [
    {
      mode: 'Subway/Metro + Walk',
      reason: 'Urban cores are best explored by transit plus short walks.',
      estimatedCost: 'USD 7-20/day',
      bookingUrl: 'https://www.mta.info/',
    },
  ],
  KR: [
    {
      mode: 'Subway + Bus (T-money)',
      reason: 'Most destinations are connected with affordable transfers.',
      estimatedCost: 'USD 5-12/day',
      bookingUrl: 'https://www.t-money.co.kr/',
    },
  ],
};

export interface EntertainmentItem {
  id: string;
  type: 'movie' | 'book';
  countryCode: string;
  city: string;
  title: string;
  reason: string;
  link: string;
}

export const entertainmentItems: EntertainmentItem[] = [
  {
    id: 'movie-lost-in-translation',
    type: 'movie',
    countryCode: 'JP',
    city: 'Tokyo',
    title: 'Lost in Translation',
    reason: 'Tokyo city mood, neon loneliness, and emotional travel atmosphere.',
    link: 'https://www.imdb.com/title/tt0335266/',
  },
  {
    id: 'movie-midnight-in-paris',
    type: 'movie',
    countryCode: 'FR',
    city: 'Paris',
    title: 'Midnight in Paris',
    reason: 'Romantic city walk vibe and artistic nostalgia in Paris.',
    link: 'https://www.imdb.com/title/tt1605783/',
  },
  {
    id: 'movie-begin-again-ny',
    type: 'movie',
    countryCode: 'US',
    city: 'New York',
    title: 'Begin Again',
    reason: 'Urban healing journey and music-driven city rediscovery.',
    link: 'https://www.imdb.com/title/tt1980929/',
  },
  {
    id: 'book-ikigai',
    type: 'book',
    countryCode: 'JP',
    city: 'Tokyo',
    title: 'Ikigai',
    reason: 'Great for rest/healing travelers seeking balance and purpose.',
    link: 'https://www.goodreads.com/book/show/30257963-ikigai',
  },
  {
    id: 'book-alchemist',
    type: 'book',
    countryCode: 'GB',
    city: 'London',
    title: 'The Alchemist',
    reason: 'A travel-and-purpose themed book for people leaving routine life behind.',
    link: 'https://www.goodreads.com/book/show/865.The_Alchemist',
  },
  {
    id: 'book-art-of-rest',
    type: 'book',
    countryCode: 'KR',
    city: 'Seoul',
    title: 'The Art of Rest',
    reason: 'Recommended for stress-recovery and slow-paced trip mindset.',
    link: 'https://www.goodreads.com/book/show/42348580-the-art-of-rest',
  },
];

export interface FallbackEventItem {
  id: string;
  countryCode: string;
  city: string;
  title: string;
  category: string;
  date: string;
  venue: string;
  priceText: string;
  bookingUrl: string;
  source: string;
}

export const fallbackEvents: FallbackEventItem[] = [
  {
    id: 'event-tokyo-art-week',
    countryCode: 'JP',
    city: 'Tokyo',
    title: 'Tokyo Contemporary Art Week',
    category: 'Exhibition',
    date: '2026-04-18',
    venue: 'Roppongi Art District',
    priceText: 'From USD 18',
    bookingUrl: 'https://www.timeout.com/tokyo/art',
    source: 'Curated fallback',
  },
  {
    id: 'event-bangkok-jazz',
    countryCode: 'TH',
    city: 'Bangkok',
    title: 'Bangkok Riverside Jazz Night',
    category: 'Performance',
    date: '2026-05-02',
    venue: 'Riverside Hall',
    priceText: 'From USD 12',
    bookingUrl: 'https://www.timeout.com/bangkok/music',
    source: 'Curated fallback',
  },
  {
    id: 'event-paris-photo',
    countryCode: 'FR',
    city: 'Paris',
    title: 'Paris Photography Expo',
    category: 'Exhibition',
    date: '2026-06-10',
    venue: 'Grand Palais Area',
    priceText: 'From USD 20',
    bookingUrl: 'https://www.sortiraparis.com/en',
    source: 'Curated fallback',
  },
];
