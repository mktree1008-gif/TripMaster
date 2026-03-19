export type LanguageCode = 'en' | 'ko' | 'zh' | 'ja' | 'fr' | 'de';

export type TabKey =
  | 'flight'
  | 'hotel'
  | 'places'
  | 'restaurants'
  | 'record'
  | 'diary'
  | 'tripstargram'
  | 'profile'
  | 'settings';

export type TripRole = 'viewer' | 'editor';

export type TravelTheme = 'activity' | 'healing' | 'city';

export type MusicStyle =
  | 'recommended'
  | 'cinematic-pop'
  | 'indie-folk'
  | 'lofi'
  | 'dance-pop'
  | 'orchestral'
  | 'k-pop-ballad';

export type WeatherEmoji = '☀️' | '⛅' | '🌧️' | '❄️' | '🌩️' | '🌫️';

export interface UserProfile {
  id: string;
  nickname: string;
  displayName: string | null;
  phone: string | null;
  profileImageUrl: string | null;
  locale: LanguageCode;
}

export interface TripSummary {
  id: string;
  title: string;
  destinationCountry: string | null;
  ownerId: string;
  role: TripRole;
  allowMemberPackingEdit: boolean;
  createdAt: string;
}

export interface Invite {
  id: string;
  tripId: string;
  code: string;
  role: TripRole;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedBy: string;
}

export interface FlightOption {
  id: string;
  airline: string;
  route: string;
  durationHours: number;
  stopCount: number;
  price: number;
  recommendationScore: number;
  officialUrl: string;
}

export interface HotelOption {
  id: string;
  name: string;
  city: string;
  rating: number;
  reviewCount: number;
  nightlyPrice: number;
  officialUrl: string;
}

export interface PlaceOption {
  id: string;
  countryCode: string;
  city: string;
  name: string;
  theme: TravelTheme;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  summary: string;
}

export interface RestaurantOption {
  id: string;
  countryCode: string;
  city: string;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  summary: string;
}

export interface CityImage {
  id: string;
  countryCode: string;
  city: string;
  imageUrl: string;
  caption: string;
}

export interface DiaryEntry {
  id: string;
  tripId: string;
  title: string;
  content: string;
  date: string;
  place: string;
  weatherEmoji: WeatherEmoji;
  weatherLabel: string | null;
  mediaUrls: string[];
  createdAt: string;
}

export interface RecordEntry {
  id: string;
  tripId: string;
  title: string;
  note: string;
  mediaUrls: string[];
  createdAt: string;
}

export interface CommentEntry {
  id: string;
  tripId: string;
  targetType: 'diary' | 'record' | 'music';
  targetId: string;
  content: string;
  emoji: string | null;
  authorNickname: string;
  createdAt: string;
}

export interface MusicJob {
  id: string;
  tripId: string;
  diaryId: string;
  style: MusicStyle;
  includeLyrics: boolean;
  prompt: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  resultUrl: string | null;
  title: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  category: 'contact' | 'improvement';
  title: string;
  message: string;
  createdAt: string;
}

export interface TripstargramPost {
  id: string;
  tripId: string;
  diaryId: string | null;
  imageUrl: string | null;
  mediaUrl: string | null;
  caption: string;
  hashtags: string[];
  authorNickname: string;
  createdAt: string;
}
