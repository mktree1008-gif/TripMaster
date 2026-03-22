'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AuthPanel } from '@/components/auth/auth-panel';
import { CommentsThread } from '@/components/comments/comments-thread';
import { airportCountryMap, cityImages, countryCities } from '@/lib/curated-data';
import { generateFlights, generateHotels, airports } from '@/lib/flight-hotel';
import { PrepGuideTopic, transportationByCountry, travelPrepGuides } from '@/lib/info-plan-data';
import { t, languageOrder } from '@/lib/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  CommentEntry,
  DiaryEntry,
  FlightOption,
  HotelOption,
  LanguageCode,
  MusicJob,
  RecordEntry,
  TabKey,
  TripstargramPost,
  TripSummary,
  UserProfile,
} from '@/lib/types';
import { apiFetch } from '@/lib/client-api';
import { translateText } from '@/lib/translate-client';

const mainTabs: Array<{ key: TabKey; fallbackLabel: string; shortLabel: string; icon: string }> = [
  { key: 'flight', fallbackLabel: 'Flight', shortLabel: 'Flight', icon: '✈️' },
  { key: 'hotel', fallbackLabel: 'Hotel', shortLabel: 'Hotel', icon: '🏨' },
  { key: 'places', fallbackLabel: 'PlanHelper', shortLabel: 'Plan', icon: '🧭' },
  { key: 'restaurants', fallbackLabel: 'Information', shortLabel: 'Info', icon: '🌍' },
];

const extraTabs = ['information', 'plan', 'transportation', 'tips', 'entertainment', 'event'] as const;
type ExtraTabKey = (typeof extraTabs)[number];

const surveyQuestions = [
  'How intense do you want each day? (relaxed / balanced / active)',
  'Do you prefer photo spots or hidden local neighborhoods?',
  'How much shopping/cafe time do you want?',
  'How important is nightlife in this trip?',
  'How often do you want rest breaks?',
];

const corePackingDefaults = [
  'Passport / ID + copy',
  'Wallet (cards + emergency cash)',
  'Phone charger + power bank',
  'Universal adapter / voltage converter',
  'Toiletries kit (toothbrush, toothpaste, shampoo, conditioner)',
  'Skincare / sunscreen',
  'Basic medicine + first-aid',
  'Comfortable shoes and daily outfits',
];

interface PackingItem {
  id: string;
  text: string;
  checked: boolean;
}

const weatherEmojiOptions = ['☀️', '⛅', '🌧️', '❄️', '🌩️', '🌫️'];
const weatherEmojiLabels: Record<string, string> = {
  '☀️': 'Sunny',
  '⛅': 'Partly cloudy',
  '🌧️': 'Rainy',
  '❄️': 'Snowy',
  '🌩️': 'Stormy',
  '🌫️': 'Foggy',
};
const cityToAirportMap: Record<string, string> = {
  Seoul: 'ICN',
  Tokyo: 'NRT',
  Osaka: 'KIX',
  Bangkok: 'BKK',
  Singapore: 'SIN',
  Paris: 'CDG',
  London: 'LHR',
  'New York': 'JFK',
  'Los Angeles': 'LAX',
};

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  Seoul: { lat: 37.5665, lng: 126.978 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  Osaka: { lat: 34.6937, lng: 135.5023 },
  Bangkok: { lat: 13.7563, lng: 100.5018 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  London: { lat: 51.5072, lng: -0.1276 },
  'New York': { lat: 40.7128, lng: -74.006 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
};

function formatKRW(value: number) {
  return `₩${new Intl.NumberFormat('ko-KR').format(value)}`;
}

function formatDateChipText(value: string) {
  if (!value) return 'TBD';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToDataUrls(files: FileList | null) {
  if (!files || files.length === 0) return [];
  const tasks = Array.from(files).map((file) => readFileAsDataUrl(file));
  return Promise.all(tasks);
}

function buildLocalPlan(input: {
  countryCode: string;
  city: string;
  departureDate: string;
  returnDate: string;
  returnFlightTime: string;
  mode: 'specific' | 'simple';
  mood: string;
  companion: string;
  peopleCount: number;
  stylePreference: string;
  budgetKrw: number;
  likesNightView: boolean;
  likesAlcohol: boolean;
  foodFocus: 'low' | 'medium' | 'high';
  selectedPlaces: string[];
}) {
  const start = new Date(input.departureDate);
  const end = new Date(input.returnDate);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayCount = Math.max(1, Math.min(14, Math.floor((end.getTime() - start.getTime()) / oneDay) + 1));
  const isRelaxed = /heal|rest|stress/i.test(input.mood);

  const itinerary = Array.from({ length: dayCount }, (_, idx) => {
    const day = idx + 1;
    const isLastDay = day === dayCount;
    const placeHint = input.selectedPlaces[idx % Math.max(input.selectedPlaces.length, 1)] ?? `${input.city} highlight`;

    if (isLastDay) {
      return {
        day,
        title: `Departure day (${input.returnFlightTime} flight)`,
        blocks: [
          '08:30 - Easy breakfast nearby',
          `10:00 - Last walk around ${placeHint}`,
          '13:00 - Airport transfer',
          `${input.returnFlightTime} - Return flight`,
        ],
      };
    }

    const foodBlock =
      input.foodFocus === 'high'
        ? '12:30 - Signature food route (market + famous restaurant)'
        : input.foodFocus === 'medium'
          ? '12:30 - Local lunch recommendation'
          : '12:30 - Light meal near next attraction';

    const eveningBlock = input.likesAlcohol
      ? input.likesNightView
        ? '20:00 - Rooftop bar + skyline'
        : '20:00 - Local pub street'
      : input.likesNightView
        ? '20:00 - Night observatory / city walk'
        : '20:00 - Rest and recharge';

    if (input.mode === 'simple') {
      return {
        day,
        title: `Day ${day} relaxed route (${input.companion}, ${input.peopleCount}pax)`,
        blocks: ['10:00 - Slow brunch', `12:00 - Main destination: ${placeHint}`, foodBlock, '16:00 - Cafe break', eveningBlock],
      };
    }

    return {
      day,
      title: `Day ${day} detailed route (${input.stylePreference})`,
      blocks: [
        '08:30 - Local breakfast',
        `10:00 - Core activity at ${placeHint}`,
        foodBlock,
        '13:30 - Transit to next area',
        '15:00 - Secondary attraction',
        '18:30 - Dinner reservation',
        eveningBlock,
      ],
    };
  });

  const transportation = transportationByCountry[input.countryCode] ?? [
    {
      mode: 'Public transit + walk',
      reason: 'Most convenient default option for city travel.',
      estimatedCost: 'USD 6-20/day',
      bookingUrl: 'https://www.google.com/travel/',
    },
  ];

  const perDayBase = isRelaxed ? 180000 : 250000;
  const styleMultiplier = input.mode === 'specific' ? 1.18 : 0.94;
  const peopleMultiplier = 0.7 + input.peopleCount * 0.65;
  const foodMultiplier = input.foodFocus === 'high' ? 1.2 : input.foodFocus === 'medium' ? 1.08 : 0.95;
  const nightlifeMultiplier = input.likesNightView ? 1.05 : 1;
  const alcoholMultiplier = input.likesAlcohol ? 1.08 : 1;
  const estimatedCostKrw = Math.round(
    dayCount * perDayBase * styleMultiplier * peopleMultiplier * foodMultiplier * nightlifeMultiplier * alcoholMultiplier
  );
  const usagePercent = Math.round(Math.min(estimatedCostKrw / Math.max(input.budgetKrw, 1), 2) * 100);
  const overBudgetKrw = Math.max(estimatedCostKrw - input.budgetKrw, 0);

  return {
    itinerary,
    transportation,
    budget: {
      budgetKrw: input.budgetKrw,
      estimatedCostKrw,
      overBudgetKrw,
      usagePercent,
    },
    recommendationSummary: isRelaxed
      ? `Relaxed schedule tuned for ${input.foodFocus} food focus${input.likesNightView ? ', night-view friendly' : ''}.`
      : `Efficient sightseeing schedule tuned for ${input.foodFocus} food focus${input.likesAlcohol ? ' and nightlife' : ''}.`,
  };
}

const demoTripsStorageKey = 'tripmaster-demo-trips-v1';
const demoRecordsStoragePrefix = 'tripmaster-demo-records-v1:';
const demoDiariesStoragePrefix = 'tripmaster-demo-diaries-v1:';

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function TripMasterApp() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const backendConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('example.supabase.co')
  );
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const copy = t(language);

  const [activeTab, setActiveTab] = useState<TabKey>('flight');
  const [activeExtraTab, setActiveExtraTab] = useState<ExtraTabKey>('information');

  const [nickname, setNickname] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [newTripTitle, setNewTripTitle] = useState('My Trip');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusToast, setStatusToast] = useState<{ id: number; message: string; tone: 'success' | 'error' | 'info' } | null>(
    null
  );
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [updatingPackingPermission, setUpdatingPackingPermission] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [deletingAllTrips, setDeletingAllTrips] = useState(false);
  const [planHelperSubTab, setPlanHelperSubTab] = useState<'places' | 'activities' | 'restaurants' | 'transportation'>(
    'places'
  );
  const [informationSubTab, setInformationSubTab] = useState<'information' | 'event' | 'tips'>('information');

  const [flightOrigin, setFlightOrigin] = useState('ICN');
  const [flightDestination, setFlightDestination] = useState('NRT');
  const [flightTripType, setFlightTripType] = useState<'round' | 'oneway' | 'multi'>('round');
  const [flightSort, setFlightSort] = useState<'recommended' | 'price'>('recommended');
  const [flightResults, setFlightResults] = useState<FlightOption[]>([]);
  const [countryCode, setCountryCode] = useState('JP');

  const [hotelCity, setHotelCity] = useState('Tokyo');
  const [hotelSort, setHotelSort] = useState<'recommended' | 'price'>('recommended');
  const [hotelResults, setHotelResults] = useState<HotelOption[]>([]);
  const [flightNotes, setFlightNotes] = useState({
    packed: false,
    seatMemo: '',
    terminalMemo: '',
    reminder: '',
  });
  const [hotelNotes, setHotelNotes] = useState({
    requests: '',
    lateCheckIn: '',
    nearbyNote: '',
  });

  const [placesTheme, setPlacesTheme] = useState<'activity' | 'healing' | 'city' | 'all'>('all');
  const [placesCity, setPlacesCity] = useState('Tokyo');
  const [placesViewMode, setPlacesViewMode] = useState<'list' | 'images'>('list');
  const [placesResponse, setPlacesResponse] = useState<{ places: any[]; cityImages: any[]; heroImages: string[] }>({
    places: [],
    cityImages: [],
    heroImages: [],
  });
  const [selectedPlaceNames, setSelectedPlaceNames] = useState<string[]>([]);

  const [restaurantsCity, setRestaurantsCity] = useState('Tokyo');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const [informationTopic, setInformationTopic] = useState<'overview' | 'history' | 'society' | 'economy'>('overview');
  const [informationData, setInformationData] = useState<any>(null);

  const [planMode, setPlanMode] = useState<'specific' | 'simple'>('simple');
  const [planPrepTopic, setPlanPrepTopic] = useState<PrepGuideTopic>('caution');
  const [basePackingTemplate, setBasePackingTemplate] = useState<string[]>(corePackingDefaults);
  const [packingByTrip, setPackingByTrip] = useState<Record<string, PackingItem[]>>({});
  const [newPackingText, setNewPackingText] = useState('');
  const [newTemplatePackingText, setNewTemplatePackingText] = useState('');
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>(['balanced', 'photo spots', 'moderate', 'optional', 'regular breaks']);
  const [travelMood, setTravelMood] = useState('healing');
  const [travelPurpose, setTravelPurpose] = useState('rest');
  const [companion, setCompanion] = useState('couple');
  const [peopleCount, setPeopleCount] = useState(2);
  const [stylePreference, setStylePreference] = useState('balanced');
  const [budgetKrw, setBudgetKrw] = useState(2500000);
  const [likesNightView, setLikesNightView] = useState(true);
  const [likesAlcohol, setLikesAlcohol] = useState(false);
  const [foodFocus, setFoodFocus] = useState<'low' | 'medium' | 'high'>('medium');
  const [departureDate, setDepartureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 4);
    return date.toISOString().slice(0, 10);
  });
  const [returnFlightTime, setReturnFlightTime] = useState('18:00');
  const [planResult, setPlanResult] = useState<any>(null);
  const [transportOptions, setTransportOptions] = useState<any[]>([]);
  const [selectedTransportKey, setSelectedTransportKey] = useState('');
  const [transportMemo, setTransportMemo] = useState('');

  const [tips, setTips] = useState<any[]>([]);
  const [tipMessage, setTipMessage] = useState('');
  const [translatedTips, setTranslatedTips] = useState<Record<string, string>>({});
  const [entertainmentType, setEntertainmentType] = useState<'movie' | 'book'>('movie');
  const [entertainmentItems, setEntertainmentItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsSource, setEventsSource] = useState('');

  const [recordTitle, setRecordTitle] = useState('');
  const [recordNote, setRecordNote] = useState('');
  const [recordFiles, setRecordFiles] = useState<FileList | null>(null);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [translatedRecordNote, setTranslatedRecordNote] = useState<Record<string, string>>({});

  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryDate, setDiaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [diaryPlace, setDiaryPlace] = useState('Tokyo');
  const [diaryWeatherEmoji, setDiaryWeatherEmoji] = useState('☀️');
  const [diaryWeatherLabel, setDiaryWeatherLabel] = useState<string | null>(null);
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryFiles, setDiaryFiles] = useState<FileList | null>(null);
  const [diaryImagePreviews, setDiaryImagePreviews] = useState<string[]>([]);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [translatedDiaryContent, setTranslatedDiaryContent] = useState<Record<string, string>>({});
  const [tripstargramPosts, setTripstargramPosts] = useState<TripstargramPost[]>([]);
  const [tripstargramMode, setTripstargramMode] = useState<'auto' | 'manual'>('auto');
  const [tripstargramDiaryId, setTripstargramDiaryId] = useState('');
  const [tripstargramCaption, setTripstargramCaption] = useState('');
  const [tripstargramFiles, setTripstargramFiles] = useState<FileList | null>(null);
  const [translatedTripstargramCaption, setTranslatedTripstargramCaption] = useState<Record<string, string>>({});

  const [musicStyle, setMusicStyle] = useState<
    'recommended' | 'cinematic-pop' | 'indie-folk' | 'lofi' | 'dance-pop' | 'orchestral' | 'k-pop-ballad'
  >('recommended');
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [musicJobs, setMusicJobs] = useState<MusicJob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);

  const [supportCategory, setSupportCategory] = useState<'contact' | 'improvement'>('contact');
  const [supportTitle, setSupportTitle] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportHistory, setSupportHistory] = useState<any[]>([]);

  function inferStatusTone(message: string): 'success' | 'error' | 'info' {
    const normalized = message.toLowerCase();
    if (
      normalized.includes('fail') ||
      normalized.includes('error') ||
      normalized.includes('not') ||
      normalized.includes('required') ||
      normalized.includes('denied') ||
      normalized.includes('unable')
    ) {
      return 'error';
    }
    if (
      normalized.includes('success') ||
      normalized.includes('created') ||
      normalized.includes('saved') ||
      normalized.includes('accepted') ||
      normalized.includes('updated') ||
      normalized.includes('generated')
    ) {
      return 'success';
    }
    return 'info';
  }

  useEffect(() => {
    const initialCountry = airportCountryMap[flightDestination]?.countryCode ?? 'JP';
    setCountryCode(initialCountry);
    setFlightResults(generateFlights({ origin: flightOrigin, destination: flightDestination, tripType: flightTripType, sort: flightSort }));
    setHotelResults(generateHotels(hotelCity, hotelSort));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFlightResults(generateFlights({ origin: flightOrigin, destination: flightDestination, tripType: flightTripType, sort: flightSort }));
    const destCountry = airportCountryMap[flightDestination]?.countryCode;
    if (destCountry) {
      setCountryCode(destCountry);
    }
  }, [flightOrigin, flightDestination, flightTripType, flightSort]);

  useEffect(() => {
    setHotelResults(generateHotels(hotelCity, hotelSort));
  }, [hotelCity, hotelSort]);

  async function loadProfile() {
    const res = await apiFetch<UserProfile>(supabase, '/api/profile', { method: 'GET' });
    if (res.ok && res.data) {
      setProfile(res.data);
      setLanguage(res.data.locale);
      setNickname(res.data.nickname);
      return true;
    }
    if (res.message) {
      showStatus(res.message);
    }
    return false;
  }

  async function loadTrips() {
    const res = await apiFetch<TripSummary[]>(supabase, '/api/trips', { method: 'GET' });
    if (res.ok && res.data) {
      const tripsData = res.data ?? [];
      setTrips(tripsData);
      setSelectedTripId((prev) => {
        if (prev && tripsData.some((trip) => trip.id === prev)) {
          return prev;
        }
        return tripsData[0]?.id ?? '';
      });
      return true;
    }
    if (res.message) {
      showStatus(res.message);
    }
    return false;
  }

  async function ensureProfileFromSession(sessionUser: any) {
    const fallbackNickname =
      sessionUser?.user_metadata?.preferred_username ||
      sessionUser?.user_metadata?.name ||
      sessionUser?.email?.split('@')[0] ||
      'traveler';

    await apiFetch(supabase, '/api/auth/sync-profile', {
      method: 'POST',
      body: JSON.stringify({
        nickname: String(fallbackNickname).replace(/\s+/g, '').toLowerCase().slice(0, 32),
        displayName: sessionUser?.user_metadata?.name ?? fallbackNickname,
        locale: language,
      }),
    });
  }

  function showStatus(message: string, tone?: 'success' | 'error' | 'info') {
    setStatusMessage(message);
    setStatusToast({
      id: Date.now(),
      message,
      tone: tone ?? inferStatusTone(message),
    });
  }

  function requireSignIn() {
    if (!backendConfigured) {
      showStatus('Cloud backend is not connected yet. Add real Supabase keys first.');
      return false;
    }
    if (nickname) return true;
    showStatus('Please sign in first.');
    return false;
  }

  function requireTripSelected() {
    if (selectedTripId) return true;
    showStatus('Create or select a trip first in Trip Workspace.');
    return false;
  }

  function applyTripUpdate(updatedTrip: TripSummary) {
    setTrips((prev) => prev.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip)));
  }

  useEffect(() => {
    const init = async () => {
      if (!backendConfigured) {
        const localTrips = readLocalJson<TripSummary[]>(demoTripsStorageKey, []);
        setTrips(localTrips);
        if (localTrips.length) {
          setSelectedTripId(localTrips[0].id);
        }
        showStatus('Demo mode: backend is not connected, so data is saved locally on this device.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const loadedProfile = await loadProfile();
        if (!loadedProfile) {
          await ensureProfileFromSession(session.user);
          await loadProfile();
        }
        await loadTrips();
      }
    };
    init();
  }, [supabase, backendConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTripId) {
      setRecords([]);
      setDiaries([]);
      setMusicJobs([]);
      setTripstargramPosts([]);
      return;
    }
    if (!backendConfigured) {
      setRecords(readLocalJson<RecordEntry[]>(`${demoRecordsStoragePrefix}${selectedTripId}`, []));
      setDiaries(readLocalJson<DiaryEntry[]>(`${demoDiariesStoragePrefix}${selectedTripId}`, []));
      setMusicJobs([]);
      setTripstargramPosts([]);
      return;
    }
    loadRecords();
    loadDiaries();
    loadMusicJobs();
    loadTripstargram();
  }, [selectedTripId, backendConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!statusMessage) return;
    setStatusToast((prev) => {
      if (prev?.message === statusMessage) return prev;
      return {
        id: Date.now(),
        message: statusMessage,
        tone: inferStatusTone(statusMessage),
      };
    });
  }, [statusMessage]);

  useEffect(() => {
    if (!statusToast) return;
    const timeout = window.setTimeout(() => {
      setStatusToast((prev) => (prev?.id === statusToast.id ? null : prev));
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [statusToast]);

  useEffect(() => {
    if (!diaries.length) {
      setTripstargramDiaryId('');
      return;
    }
    if (tripstargramMode === 'auto' && !tripstargramDiaryId) {
      setTripstargramDiaryId(diaries[0].id);
    }
  }, [diaries, tripstargramMode, tripstargramDiaryId]);

  useEffect(() => {
    loadPlaces();
    loadRestaurants();
    loadInformation();
    loadTransportation();
    loadTips();
    loadEntertainment();
    loadEvents();
  }, [countryCode, placesCity, placesTheme, restaurantsCity, informationTopic, entertainmentType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const templateRaw = window.localStorage.getItem('tripmaster-packing-template-v1');
      if (templateRaw) {
        const parsed = JSON.parse(templateRaw);
        if (Array.isArray(parsed)) {
          const next = parsed
            .map((item) => String(item).trim())
            .filter(Boolean);
          if (next.length > 0) {
            setBasePackingTemplate(Array.from(new Set(next)));
          }
        }
      }

      const perTripRaw = window.localStorage.getItem('tripmaster-packing-by-trip-v1');
      if (perTripRaw) {
        const parsed = JSON.parse(perTripRaw) as Record<string, PackingItem[]>;
        if (parsed && typeof parsed === 'object') {
          setPackingByTrip(parsed);
        }
      }
    } catch {
      // Ignore local cache parse errors and continue with default seeds.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tripmaster-packing-template-v1', JSON.stringify(basePackingTemplate));
  }, [basePackingTemplate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tripmaster-packing-by-trip-v1', JSON.stringify(packingByTrip));
  }, [packingByTrip]);

  useEffect(() => {
    if (!selectedTripId) return;
    const checklistKey = `${selectedTripId}:${countryCode}`;
    setPackingByTrip((prev) => {
      if (prev[checklistKey]) {
        return prev;
      }
      const guide = travelPrepGuides[countryCode] ?? travelPrepGuides.DEFAULT;
      const seeded = Array.from(new Set([...basePackingTemplate, ...guide.packing]));
      return {
        ...prev,
        [checklistKey]: seeded.map((text, index) => ({
          id: `${checklistKey}:seed:${index}`,
          text,
          checked: false,
        })),
      };
    });
  }, [selectedTripId, countryCode, basePackingTemplate]);

  useEffect(() => {
    if (!autoTranslate) {
      setTranslatedDiaryContent({});
      setTranslatedRecordNote({});
      setTranslatedTips({});
      setTranslatedTripstargramCaption({});
      return;
    }
    const run = async () => {
      const diaryPairs = await Promise.all(
        diaries.map(async (entry) => [entry.id, await translateText(entry.content, language)] as const)
      );
      const recordPairs = await Promise.all(
        records.map(async (entry) => [entry.id, await translateText(entry.note, language)] as const)
      );
      const tipPairs = await Promise.all(tips.map(async (tip) => [tip.id, await translateText(tip.message, language)] as const));
      const tripstargramPairs = await Promise.all(
        tripstargramPosts.map(async (post) => [post.id, await translateText(post.caption, language)] as const)
      );
      setTranslatedDiaryContent(Object.fromEntries(diaryPairs));
      setTranslatedRecordNote(Object.fromEntries(recordPairs));
      setTranslatedTips(Object.fromEntries(tipPairs));
      setTranslatedTripstargramCaption(Object.fromEntries(tripstargramPairs));
    };
    run();
  }, [autoTranslate, diaries, records, tips, tripstargramPosts, language]);

  async function onSignedIn(nextNickname: string) {
    setNickname(nextNickname);
    setShowAuthPanel(false);
    await loadProfile();
    await loadTrips();
  }

  async function onSignedOut() {
    setNickname(null);
    setShowAuthPanel(true);
    setProfile(null);
    setTrips([]);
    setSelectedTripId('');
    setTripstargramPosts([]);
  }

  function clearLocalTripCaches(tripIds: string[]) {
    if (typeof window === 'undefined' || tripIds.length === 0) return;
    for (const tripId of tripIds) {
      window.localStorage.removeItem(`${demoRecordsStoragePrefix}${tripId}`);
      window.localStorage.removeItem(`${demoDiariesStoragePrefix}${tripId}`);
    }
    setPackingByTrip((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !tripIds.some((tripId) => key.startsWith(`${tripId}:`)))
      );
      return next;
    });
  }

  async function createTrip() {
    const title = newTripTitle.trim();
    if (!title) {
      showStatus('Please enter a trip title first.');
      return;
    }

    if (!backendConfigured) {
      const localTrip: TripSummary = {
        id: `local-trip-${Date.now()}`,
        title,
        destinationCountry: countryCode,
        ownerId: 'local-user',
        role: 'editor',
        allowMemberPackingEdit: false,
        createdAt: new Date().toISOString(),
      };
      setTrips((prev) => {
        const next = [localTrip, ...prev];
        writeLocalJson(demoTripsStorageKey, next);
        return next;
      });
      setSelectedTripId(localTrip.id);
      showStatus('Successfully created trip (demo mode).', 'success');
      return;
    }

    if (!requireSignIn()) return;
    const res = await apiFetch<TripSummary>(supabase, '/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        title,
        destinationCountry: countryCode,
      }),
    });
    if (res.ok && res.data) {
      await loadTrips();
      setSelectedTripId(res.data.id);
      showStatus('Successfully created trip.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to create trip');
    }
  }

  async function deleteSelectedTrip() {
    if (!requireTripSelected()) return;

    const selected = trips.find((trip) => trip.id === selectedTripId);
    if (!selected) {
      showStatus('Selected trip was not found.');
      return;
    }

    const okDelete = window.confirm(`Delete "${selected.title}"? This action cannot be undone.`);
    if (!okDelete) return;

    if (!backendConfigured) {
      const nextTrips = trips.filter((trip) => trip.id !== selectedTripId);
      setTrips(nextTrips);
      setSelectedTripId(nextTrips[0]?.id ?? '');
      writeLocalJson(demoTripsStorageKey, nextTrips);
      clearLocalTripCaches([selectedTripId]);
      showStatus('Selected trip deleted successfully.', 'success');
      return;
    }

    if (!requireSignIn()) return;
    setDeletingTrip(true);
    try {
      const res = await apiFetch<{ deleted: boolean; tripId: string }>(supabase, '/api/trips', {
        method: 'DELETE',
        body: JSON.stringify({
          tripId: selectedTripId,
        }),
      });
      if (res.ok) {
        await loadTrips();
        showStatus('Selected trip deleted successfully.', 'success');
      } else {
        showStatus(res.message ?? 'Failed to delete selected trip');
      }
    } finally {
      setDeletingTrip(false);
    }
  }

  async function deleteAllTrips() {
    if (!trips.length) {
      showStatus('No trips to delete.');
      return;
    }

    const okDelete = window.confirm('Delete ALL your created trips? This action cannot be undone.');
    if (!okDelete) return;

    if (!backendConfigured) {
      const tripIds = trips.map((trip) => trip.id);
      setTrips([]);
      setSelectedTripId('');
      writeLocalJson(demoTripsStorageKey, []);
      clearLocalTripCaches(tripIds);
      showStatus('All trips deleted successfully.', 'success');
      return;
    }

    if (!requireSignIn()) return;
    setDeletingAllTrips(true);
    try {
      const res = await apiFetch<{ deletedCount: number }>(supabase, '/api/trips', {
        method: 'DELETE',
        body: JSON.stringify({
          deleteAll: true,
        }),
      });
      if (res.ok) {
        await loadTrips();
        const deletedCount = res.data?.deletedCount ?? 0;
        showStatus(`${deletedCount} trips deleted successfully.`, 'success');
      } else {
        showStatus(res.message ?? 'Failed to delete all trips');
      }
    } finally {
      setDeletingAllTrips(false);
    }
  }

  async function updateTripDestination() {
    if (!requireTripSelected()) return;

    if (!backendConfigured) {
      setTrips((prev) => {
        const next = prev.map((trip) =>
          trip.id === selectedTripId ? { ...trip, destinationCountry: countryCode } : trip
        );
        writeLocalJson(demoTripsStorageKey, next);
        return next;
      });
      showStatus('Demo mode: destination synced locally.');
      return;
    }

    const res = await apiFetch<TripSummary>(supabase, '/api/trips', {
      method: 'PATCH',
      body: JSON.stringify({
        tripId: selectedTripId,
        destinationCountry: countryCode,
      }),
    });
    if (res.ok && res.data) {
      applyTripUpdate(res.data);
      showStatus('Destination synced to trip.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to sync destination');
    }
  }

  async function updateTripPackingPermission(nextValue: boolean) {
    if (!selectedTripId) return;
    setUpdatingPackingPermission(true);
    try {
      const res = await apiFetch<TripSummary>(supabase, '/api/trips', {
        method: 'PATCH',
        body: JSON.stringify({
          tripId: selectedTripId,
          allowMemberPackingEdit: nextValue,
        }),
      });

      if (res.ok && res.data) {
        applyTripUpdate(res.data);
        showStatus(
          nextValue
            ? 'Invited members can now edit this trip packing list.'
            : 'Packing list editing is now limited to editors for this trip.',
          'success'
        );
      } else {
        showStatus(res.message ?? 'Failed to update packing permission');
      }
    } catch {
      showStatus('Failed to update packing permission');
    }
    setUpdatingPackingPermission(false);
  }

  async function createInvite() {
    if (!requireSignIn()) return;
    if (!requireTripSelected()) return;
    const res = await apiFetch<any>(supabase, '/api/invites', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        role: 'viewer',
      }),
    });
    if (res.ok && res.data) {
      setGeneratedInviteLink(res.data.inviteLink || `Code: ${res.data.code}`);
      showStatus('Invite created successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to create invite');
    }
  }

  async function acceptInvite() {
    if (!requireSignIn()) return;
    if (!inviteCode.trim()) {
      showStatus('Please enter an invite code first.');
      return;
    }
    const res = await apiFetch(supabase, '/api/invites', {
      method: 'PATCH',
      body: JSON.stringify({ code: inviteCode.trim() }),
    });
    if (res.ok) {
      showStatus('Invite accepted successfully.', 'success');
      setInviteCode('');
      await loadTrips();
    } else {
      showStatus(res.message ?? 'Failed to accept invite');
    }
  }

  async function loadPlaces() {
    const query = `/api/places?countryCode=${countryCode}&city=${encodeURIComponent(placesCity)}&theme=${placesTheme}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: any };
    if (json.ok && json.data) {
      setPlacesResponse(json.data);
    }
  }

  async function savePlace(place: any) {
    if (!requireSignIn()) return;
    if (!requireTripSelected()) return;
    const res = await apiFetch(supabase, '/api/places', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        placeId: place.id,
        city: place.city,
        countryCode: place.countryCode,
        name: place.name,
        theme: place.theme,
      }),
    });
    if (res.ok) {
      setSelectedPlaceNames((prev) => (prev.includes(place.name) ? prev : [...prev, place.name]));
      showStatus(`${place.name} added to your trip.`, 'success');
    } else {
      showStatus(res.message ?? 'Failed to add place');
    }
  }

  async function loadRestaurants() {
    const query = `/api/restaurants?countryCode=${countryCode}&city=${encodeURIComponent(restaurantsCity)}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: { restaurants: any[]; availableCities: string[] } };
    if (json.ok && json.data) {
      setRestaurants(json.data.restaurants);
      setAvailableCities(json.data.availableCities);
      if (json.data.availableCities.length && !json.data.availableCities.includes(restaurantsCity)) {
        setRestaurantsCity(json.data.availableCities[0]);
      }
    }
  }

  async function loadInformation() {
    const query = `/api/information?countryCode=${countryCode}&city=${encodeURIComponent(placesCity)}&topic=${informationTopic}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: any };
    if (json.ok && json.data) {
      setInformationData(json.data);
    }
  }

  async function loadTransportation() {
    const query = `/api/transportation?countryCode=${countryCode}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: { options: any[] } };
    if (json.ok && json.data) {
      setTransportOptions(json.data.options);
    }
  }

  async function loadTips() {
    const query = `/api/tips?countryCode=${countryCode}&city=${encodeURIComponent(placesCity)}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: { tips: any[] } };
    if (json.ok && json.data) {
      setTips(json.data.tips);
    }
  }

  async function loadEntertainment() {
    const query = `/api/entertainment?countryCode=${countryCode}&city=${encodeURIComponent(placesCity)}&type=${entertainmentType}&mood=${encodeURIComponent(
      travelMood
    )}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: { items: any[] } };
    if (json.ok && json.data) {
      setEntertainmentItems(json.data.items);
    }
  }

  async function loadEvents() {
    const query = `/api/events?countryCode=${countryCode}&city=${encodeURIComponent(placesCity)}`;
    const res = await fetch(query);
    const json = (await res.json()) as { ok: boolean; data?: { items: any[]; source: string } };
    if (json.ok && json.data) {
      setEvents(json.data.items);
      setEventsSource(json.data.source);
    }
  }

  async function submitTip() {
    if (!requireSignIn()) return;
    if (!tipMessage.trim()) {
      showStatus('Please write a tip first.');
      return;
    }
    const res = await apiFetch(supabase, '/api/tips', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId || undefined,
        countryCode,
        city: placesCity,
        message: tipMessage.trim(),
      }),
    });
    if (res.ok) {
      setTipMessage('');
      await loadTips();
      showStatus('Tip shared successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to add tip');
    }
  }

  async function loadRecords() {
    if (!selectedTripId) return;
    if (!backendConfigured) {
      setRecords(readLocalJson<RecordEntry[]>(`${demoRecordsStoragePrefix}${selectedTripId}`, []));
      return;
    }
    const res = await apiFetch<RecordEntry[]>(supabase, `/api/records?tripId=${selectedTripId}`, { method: 'GET' });
    if (res.ok && res.data) {
      setRecords(res.data);
    }
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (!recordTitle.trim()) {
      showStatus('Please enter a record title.');
      return;
    }
    if (!requireTripSelected()) return;

    const mediaUrls = await filesToDataUrls(recordFiles);

    if (!backendConfigured) {
      const localRecord: RecordEntry = {
        id: `local-record-${Date.now()}`,
        tripId: selectedTripId,
        title: recordTitle.trim(),
        note: recordNote,
        mediaUrls,
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => {
        const next = [localRecord, ...prev];
        writeLocalJson(`${demoRecordsStoragePrefix}${selectedTripId}`, next);
        return next;
      });
      setRecordTitle('');
      setRecordNote('');
      setRecordFiles(null);
      showStatus('Demo mode: record saved locally.');
      return;
    }

    if (!requireSignIn()) return;
    const res = await apiFetch<RecordEntry>(supabase, '/api/records', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        title: recordTitle.trim(),
        note: recordNote,
        mediaUrls,
      }),
    });
    if (res.ok) {
      setRecordTitle('');
      setRecordNote('');
      setRecordFiles(null);
      await loadRecords();
      showStatus('Record saved successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to save record');
    }
  }

  async function loadDiaries() {
    if (!selectedTripId) return;
    if (!backendConfigured) {
      setDiaries(readLocalJson<DiaryEntry[]>(`${demoDiariesStoragePrefix}${selectedTripId}`, []));
      return;
    }
    const res = await apiFetch<DiaryEntry[]>(supabase, `/api/diaries?tripId=${selectedTripId}`, { method: 'GET' });
    if (res.ok && res.data) {
      setDiaries(res.data);
    }
  }

  async function loadTripstargram() {
    if (!selectedTripId) {
      setTripstargramPosts([]);
      return;
    }
    const res = await apiFetch<TripstargramPost[]>(supabase, `/api/tripstargram?tripId=${selectedTripId}`, { method: 'GET' });
    if (res.ok && res.data) {
      setTripstargramPosts(res.data);
    }
  }

  async function createTripstargramPost(event: FormEvent) {
    event.preventDefault();
    if (!requireSignIn()) return;
    if (!requireTripSelected()) return;
    if (tripstargramMode === 'auto' && !tripstargramDiaryId) {
      showStatus('Select a diary to auto-create a Tripstargram post.');
      return;
    }
    if (tripstargramMode === 'manual' && !tripstargramCaption.trim()) {
      showStatus('Caption is required for manual Tripstargram posts.');
      return;
    }

    const mediaUrls = await filesToDataUrls(tripstargramFiles);
    const res = await apiFetch<TripstargramPost>(supabase, '/api/tripstargram', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        mode: tripstargramMode,
        diaryId: tripstargramMode === 'auto' ? tripstargramDiaryId : undefined,
        caption: tripstargramCaption.trim() || undefined,
        mediaUrl: mediaUrls[0] ?? null,
      }),
    });

    if (res.ok) {
      setTripstargramCaption('');
      setTripstargramFiles(null);
      if (tripstargramMode === 'manual') {
        setTripstargramDiaryId('');
      }
      await loadTripstargram();
      showStatus('Tripstargram post created successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to create Tripstargram post');
    }
  }

  async function saveDiary(event: FormEvent) {
    event.preventDefault();
    if (!diaryTitle.trim() || !diaryContent.trim()) {
      showStatus('Please fill in diary title and text.');
      return;
    }
    if (!requireTripSelected()) return;

    const mediaUrls = await filesToDataUrls(diaryFiles);
    if (audioDataUrl) {
      mediaUrls.push(audioDataUrl);
    }

    if (!backendConfigured) {
      const localDiary: DiaryEntry = {
        id: `local-diary-${Date.now()}`,
        tripId: selectedTripId,
        title: diaryTitle.trim(),
        content: diaryContent,
        date: diaryDate,
        place: diaryPlace,
        weatherEmoji: diaryWeatherEmoji as DiaryEntry['weatherEmoji'],
        weatherLabel: diaryWeatherLabel,
        mediaUrls,
        createdAt: new Date().toISOString(),
      };
      setDiaries((prev) => {
        const next = [localDiary, ...prev];
        writeLocalJson(`${demoDiariesStoragePrefix}${selectedTripId}`, next);
        return next;
      });
      setDiaryTitle('');
      setDiaryContent('');
      setAudioDataUrl(null);
      setDiaryFiles(null);
      setDiaryImagePreviews([]);
      showStatus('Demo mode: diary saved locally.');
      return;
    }

    if (!requireSignIn()) return;
    const res = await apiFetch<DiaryEntry>(supabase, '/api/diaries', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        title: diaryTitle.trim(),
        content: diaryContent,
        date: diaryDate,
        place: diaryPlace,
        weatherEmoji: diaryWeatherEmoji,
        weatherLabel: diaryWeatherLabel,
        mediaUrls,
      }),
    });

    if (res.ok) {
      setDiaryTitle('');
      setDiaryContent('');
      setAudioDataUrl(null);
      setDiaryFiles(null);
      setDiaryImagePreviews([]);
      await loadDiaries();
      showStatus('Diary saved successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to save diary');
    }
  }

  async function loadMusicJobs() {
    if (!selectedTripId) return;
    const res = await apiFetch<MusicJob[]>(supabase, `/api/music/jobs?tripId=${selectedTripId}`, { method: 'GET' });
    if (res.ok && res.data) {
      setMusicJobs(res.data);
    }
  }

  async function createMusicJob(diaryId: string) {
    if (!requireSignIn()) return;
    if (!requireTripSelected()) return;
    const res = await apiFetch<MusicJob>(supabase, '/api/music/jobs', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        diaryId,
        selectedStyle: musicStyle,
        includeLyrics,
      }),
    });

    if (res.ok) {
      await loadMusicJobs();
      showStatus('AI music generation started.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to generate music');
    }
  }

  async function generatePlan() {
    if (!requireTripSelected()) return;

    const payload = {
      tripId: selectedTripId,
      countryCode,
      city: placesCity,
      departureDate,
      returnDate,
      returnFlightTime,
      mode: planMode,
      purpose: travelPurpose,
      mood: travelMood,
      companion,
      peopleCount,
      stylePreference,
      budgetKrw,
      likesNightView,
      likesAlcohol,
      foodFocus,
      surveyAnswers: surveyAnswers.map((answer, idx) => ({
        question: surveyQuestions[idx],
        answer: answer || 'balanced',
      })),
      selectedPlaces: selectedPlaceNames,
    };

    if (!backendConfigured) {
      const localPlan = buildLocalPlan({
        countryCode,
        city: placesCity,
        departureDate,
        returnDate,
        returnFlightTime,
        mode: planMode,
        mood: travelMood,
        companion,
        peopleCount,
        stylePreference,
        budgetKrw,
        likesNightView,
        likesAlcohol,
        foodFocus,
        selectedPlaces: selectedPlaceNames,
      });
      setPlanResult(localPlan);
      setTransportOptions(localPlan.transportation || []);
      showStatus('Demo mode: itinerary generated locally.');
      return;
    }

    if (!requireSignIn()) return;
    const res = await apiFetch<any>(supabase, '/api/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok && res.data) {
      setPlanResult(res.data);
      setTransportOptions(res.data.transportation || []);
      showStatus('Itinerary generated successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to generate plan');
    }
  }

  async function autoWeather() {
    const coord = cityCoordinates[diaryPlace];
    if (!coord) {
      showStatus('Weather is unavailable for the selected city.');
      return;
    }
    const res = await fetch(`/api/weather?lat=${coord.lat}&lng=${coord.lng}`);
    const json = (await res.json()) as { ok: boolean; data?: { emoji: string; label: string; temperatureC: number | null } };
    if (json.ok && json.data) {
      setDiaryWeatherEmoji(json.data.emoji);
      const tempText = json.data.temperatureC === null ? '' : ` (${json.data.temperatureC.toFixed(1)}°C)`;
      setDiaryWeatherLabel(`${json.data.label}${tempText}`);
      showStatus('Weather updated automatically.', 'success');
    } else {
      showStatus('Failed to load weather automatically.');
    }
  }

  async function onDiaryFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    setDiaryFiles(files);
    if (!files || files.length === 0) {
      setDiaryImagePreviews([]);
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setDiaryImagePreviews([]);
      return;
    }

    try {
      const previews = await Promise.all(imageFiles.map((file) => readFileAsDataUrl(file)));
      setDiaryImagePreviews(previews);
    } catch {
      setDiaryImagePreviews([]);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showStatus('Voice recording is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setAudioDataUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        showStatus('Voice recording saved.', 'success');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      showStatus('Voice recording started.', 'success');
    } catch {
      showStatus('Unable to start voice recording.');
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) {
      showStatus('No active recording.');
      return;
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!requireSignIn()) return;
    if (!profile) return;
    const res = await apiFetch<UserProfile>(supabase, '/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: profile.displayName,
        phone: profile.phone,
        profileImageUrl: profile.profileImageUrl,
        locale: language,
      }),
    });
    if (res.ok && res.data) {
      setProfile(res.data);
      showStatus('Profile updated successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Profile update failed');
    }
  }

  async function generateProfileImage() {
    if (!requireSignIn()) return;
    const prompt = `${profile?.displayName || nickname || 'Traveler'} portrait for TripMaster profile`;
    const res = await apiFetch<{ generatedUrl: string }>(supabase, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'ai-image',
        prompt,
      }),
    });
    if (res.ok && res.data && profile) {
      setProfile({
        ...profile,
        profileImageUrl: res.data.generatedUrl,
      });
      showStatus('AI profile image generated.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to generate AI profile image');
    }
  }

  async function onProfileImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setProfile({
      ...profile,
      profileImageUrl: dataUrl,
    });
    showStatus('Profile image uploaded. Click "Update Profile" to save.', 'success');
  }

  async function loadSupportHistory() {
    if (!requireSignIn()) return;
    const res = await apiFetch<any[]>(supabase, '/api/support', { method: 'GET' });
    if (res.ok && res.data) {
      setSupportHistory(res.data);
    }
  }

  async function submitSupport(event: FormEvent) {
    event.preventDefault();
    if (!requireSignIn()) return;
    const res = await apiFetch(supabase, '/api/support', {
      method: 'POST',
      body: JSON.stringify({
        category: supportCategory,
        title: supportTitle,
        message: supportMessage,
      }),
    });
    if (res.ok) {
      setSupportTitle('');
      setSupportMessage('');
      await loadSupportHistory();
      showStatus('Request submitted successfully.', 'success');
    } else {
      showStatus(res.message ?? 'Failed to submit request');
    }
  }

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSupportHistory();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!transportOptions.length) return;
    const exists = transportOptions.some((option) => `${option.mode}-${option.bookingUrl}` === selectedTransportKey);
    if (!exists) {
      setSelectedTransportKey(`${transportOptions[0].mode}-${transportOptions[0].bookingUrl}`);
    }
  }, [transportOptions, selectedTransportKey]);

  function scrollToSection(sectionId: string) {
    if (typeof window === 'undefined') return;
    const tryScroll = (attempt = 0) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempt < 5) {
        window.setTimeout(() => tryScroll(attempt + 1), 40);
      }
    };
    window.requestAnimationFrame(() => tryScroll());
  }

  function openMainTab(tab: TabKey, sectionId = 'main-tabs-anchor') {
    setActiveTab(tab);
    setShowMobileMenu(false);
    scrollToSection(sectionId);
  }

  function openExtraTab(tab: ExtraTabKey, sectionId = 'main-tabs-anchor') {
    setActiveExtraTab(tab);
    if (tab === 'plan' || tab === 'transportation') {
      setActiveTab('places');
      setPlanHelperSubTab('transportation');
    } else if (tab === 'information' || tab === 'event' || tab === 'tips') {
      setActiveTab('restaurants');
      setInformationSubTab(tab === 'information' ? 'information' : tab === 'event' ? 'event' : 'tips');
    }
    setShowMobileMenu(false);
    scrollToSection(sectionId);
  }

  function openAccountTab(tab: 'profile' | 'settings') {
    if (tab === 'profile') {
      openMainTab('profile', 'tab-profile-section');
      return;
    }
    openMainTab('settings', 'tab-settings-section');
  }

  function openLoginPanelFromMenu() {
    setShowAuthPanel(true);
    scrollToSection('hero-auth-anchor');
  }

  function onMainNavSelect(tab: TabKey) {
    setActiveTab(tab);
    setShowMobileMenu(false);
    if (tab === 'places' && !planHelperSubTab) {
      setPlanHelperSubTab('places');
    }
    if (tab === 'restaurants' && !informationSubTab) {
      setInformationSubTab('information');
    }
  }

  function onMobileMainTabSelect(tab: TabKey) {
    onMainNavSelect(tab);
    setShowMobileMenu(false);
    scrollToSection('main-tabs-anchor');
  }

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;
  const selectedTripTitle = selectedTrip?.title ?? '';
  const canChangePackingPermission = selectedTrip?.role === 'editor';
  const activePackingKey = selectedTripId ? `${selectedTripId}:${countryCode}` : '';
  const canEditPacking = selectedTrip ? selectedTrip.role === 'editor' || selectedTrip.allowMemberPackingEdit : false;

  function updatePackingList(updater: (items: PackingItem[]) => PackingItem[]) {
    if (!activePackingKey) {
      showStatus('Trip을 먼저 선택하면 여행별 준비물 체크리스트를 사용할 수 있어요.');
      return;
    }
    if (!canEditPacking) {
      showStatus('Editor only: invited member edit mode가 OFF 상태입니다.');
      return;
    }
    setPackingByTrip((prev) => ({
      ...prev,
      [activePackingKey]: updater(prev[activePackingKey] ?? []),
    }));
  }

  function updateTemplate(updater: (items: string[]) => string[]) {
    setBasePackingTemplate((prev) =>
      Array.from(
        new Set(
          updater(prev)
            .map((text) => text.trim())
            .filter(Boolean)
        )
      )
    );
  }

  function togglePackingItem(itemId: string) {
    updatePackingList((items) => items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)));
  }

  function editPackingItem(itemId: string, text: string) {
    updatePackingList((items) => items.map((item) => (item.id === itemId ? { ...item, text } : item)));
  }

  function removePackingItem(itemId: string) {
    updatePackingList((items) => items.filter((item) => item.id !== itemId));
  }

  function addPackingItem() {
    const text = newPackingText.trim();
    if (!text) return;
    updatePackingList((items) => [
      ...items,
      { id: `${activePackingKey}:custom:${Date.now()}`, text, checked: false },
    ]);
    setNewPackingText('');
  }

  function editTemplateItem(index: number, text: string) {
    updateTemplate((items) => items.map((item, idx) => (idx === index ? text : item)));
  }

  function removeTemplateItem(index: number) {
    updateTemplate((items) => items.filter((_, idx) => idx !== index));
  }

  function addTemplateItem() {
    const text = newTemplatePackingText.trim();
    if (!text) return;
    updateTemplate((items) => [...items, text]);
    setNewTemplatePackingText('');
  }

  function syncTemplateToCurrentTrip() {
    if (!activePackingKey) {
      showStatus('Trip을 먼저 선택해 주세요.');
      return;
    }
    const guide = travelPrepGuides[countryCode] ?? travelPrepGuides.DEFAULT;
    const mergedDefaults = Array.from(new Set([...basePackingTemplate, ...guide.packing]));
    updatePackingList((items) => {
      const existing = new Set(items.map((item) => item.text.trim().toLowerCase()));
      const additions = mergedDefaults
        .filter((text) => !existing.has(text.trim().toLowerCase()))
        .map((text, idx) => ({
          id: `${activePackingKey}:template-sync:${Date.now()}:${idx}`,
          text,
          checked: false,
        }));
      return [...items, ...additions];
    });
    showStatus('Packing template synced to this trip.', 'success');
  }

  const planPrepGuide = travelPrepGuides[countryCode] ?? travelPrepGuides.DEFAULT;
  const planPrepItems = planPrepGuide[planPrepTopic];
  const packingChecklist = activePackingKey ? packingByTrip[activePackingKey] ?? [] : [];
  const primaryFlight = flightResults[0] ?? null;
  const primaryHotel = hotelResults[0] ?? null;
  const selectedTransport =
    transportOptions.find((option) => `${option.mode}-${option.bookingUrl}` === selectedTransportKey) ?? transportOptions[0] ?? null;
  const placesForDisplay =
    planHelperSubTab === 'activities'
      ? placesResponse.places.filter((place) => place.theme === 'activity')
      : placesResponse.places;

  return (
    <div className="tripmaster-shell">
      {statusToast ? (
        <div
          className={`status-toast is-${statusToast.tone}`}
          role={statusToast.tone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{statusToast.message}</span>
          <button type="button" className="status-toast-close" onClick={() => setStatusToast(null)} aria-label="Close notification">
            ✕
          </button>
        </div>
      ) : null}
      <header className="top-nav-shell">
        <div className="top-nav-row">
          <div className="brand-stack">
            <button type="button" className="brand-mark" onClick={() => scrollToSection('main-tabs-anchor')}>
              ✈️ TripMaster
            </button>
            <p className="brand-tagline">Plan with confidence, travel with excitement.</p>
          </div>
          <div className="top-nav-actions">
            <label className="utility-language">
              <span aria-hidden>🌐</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)} aria-label="Language">
                {languageOrder.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={activeTab === 'profile' ? 'utility-icon-btn active' : 'utility-icon-btn'}
              onClick={() => (nickname ? openAccountTab('profile') : openLoginPanelFromMenu())}
              aria-label="Profile"
            >
              <span aria-hidden>👤</span>
              <span className="utility-btn-text">Profile</span>
            </button>
            <button
              type="button"
              className={activeTab === 'settings' ? 'utility-icon-btn active' : 'utility-icon-btn'}
              onClick={() => (nickname ? openAccountTab('settings') : openLoginPanelFromMenu())}
              aria-label="Settings"
            >
              <span aria-hidden>⚙️</span>
              <span className="utility-btn-text">Settings</span>
            </button>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open tab menu"
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              ⋮
            </button>
          </div>
        </div>
        {showMobileMenu ? (
          <div className="mobile-menu-panel">
            <p className="mobile-menu-title">Menu</p>
            <div className="mobile-menu-grid">
              {mainTabs.map((tab) => (
                <button
                  key={`mobile-main-${tab.key}`}
                  type="button"
                  className={activeTab === tab.key ? 'mobile-menu-item active' : 'mobile-menu-item'}
                  onClick={() => onMobileMainTabSelect(tab.key)}
                >
                  <span aria-hidden>{tab.icon}</span> <span>{tab.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <nav id="main-tabs-anchor" className="main-tabs top-main-tabs">
          {mainTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab-btn active' : 'tab-btn'}
              onClick={() => onMainNavSelect(tab.key)}
            >
              <span className="tab-icon" aria-hidden>
                {tab.icon}
              </span>
              <span className="tab-label">{tab.fallbackLabel}</span>
            </button>
          ))}
        </nav>
      </header>

      <header className="hero-header">
        <div className="hero-copy-block">
          <p className="eyebrow">TripMaster</p>
          <h1>{copy.appTitle}</h1>
          <p>{copy.appSubtitle}</p>
          <div className="hero-highlights">
            <span>✈️ Airline-style planning workspace</span>
            <span>🚄 Route-aware itinerary assistance</span>
            <span>📍 Curated discovery with trusted structure</span>
          </div>
        </div>
        <div id="hero-auth-anchor" className="hero-auth-block">
          <label className="hero-translate-toggle">
            <input type="checkbox" checked={autoTranslate} onChange={(event) => setAutoTranslate(event.target.checked)} />
            Auto-translate shared content
          </label>

          {showAuthPanel || Boolean(nickname) ? (
            <AuthPanel supabase={supabase} language={language} currentNickname={nickname} onSignedIn={onSignedIn} onSignedOut={onSignedOut} />
          ) : (
            <button type="button" className="btn-secondary auth-open-btn" onClick={() => setShowAuthPanel(true)}>
              Open login / account panel
            </button>
          )}
        </div>
        {!backendConfigured ? (
          <p className="error-text hero-error">Backend is not configured yet. Set real Supabase environment variables to enable save/login.</p>
        ) : null}
      </header>

      <section className="card section-card glass-card trip-card">
        <div className="workspace-header">
          <h2>🧾 Trip Workspace</h2>
          <p>Manage your current trip, create or join trips, and collaboration permissions in one premium workspace.</p>
        </div>
        <div className="workspace-grid">
          <article className="workspace-panel summary-card glass-card">
            <h3>Current Trip</h3>
            <label>
              Select trip
              <select value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)}>
                <option value="">Select</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title} ({trip.role})
                  </option>
                ))}
              </select>
            </label>
            <p className="workspace-meta">
              {selectedTrip ? 'Trip context loaded. You can now manage invites and planning cards.' : 'Choose a trip to manage invites, packing permissions, and shared history.'}
            </p>
            {selectedTrip ? (
              <div className="chip-row">
                <span className="role-badge">Role: {selectedTrip.role.toUpperCase()}</span>
                <span className="status-chip">Country: {selectedTrip.destinationCountry ?? 'Not synced yet'}</span>
                <span className="travel-mode-chip">Mode: {flightTripType}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="btn-secondary danger"
              onClick={deleteSelectedTrip}
              disabled={!selectedTripId || deletingTrip || deletingAllTrips}
            >
              Delete Selected Trip
            </button>
          </article>

          <article className="workspace-panel action-card glass-card">
            <h3>Create / Join</h3>
            <label>
              New trip title
              <input value={newTripTitle} onChange={(event) => setNewTripTitle(event.target.value)} />
            </label>
            <button type="button" className="btn-primary" onClick={createTrip}>
              Create Trip
            </button>
            <label>
              Invite code
              <input placeholder="Paste invite code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
            </label>
            <button type="button" className="btn-secondary" onClick={acceptInvite}>
              Accept Invite
            </button>
          </article>

          <article className="workspace-panel detail-card glass-card">
            <h3>Collaboration</h3>
            <button type="button" className="btn-secondary" onClick={createInvite} disabled={!nickname || !selectedTripId}>
              Create Invite Link
            </button>
            <div className="packing-permission-row">
              <span className="packing-permission-label">Invited members can edit packing list</span>
              <label className="packing-permission-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTrip?.allowMemberPackingEdit)}
                  onChange={(event) => updateTripPackingPermission(event.target.checked)}
                  disabled={!selectedTripId || !canChangePackingPermission || updatingPackingPermission}
                />
                <span>{selectedTrip?.allowMemberPackingEdit ? 'ON' : 'OFF'}</span>
              </label>
              <p className="packing-permission-note">
                Default OFF: only editors can edit. Turn ON to allow invited members too.
              </p>
            </div>
            {generatedInviteLink ? <p className="info-text">Invite: {generatedInviteLink}</p> : null}
            <button
              type="button"
              className="btn-secondary danger"
              onClick={deleteAllTrips}
              disabled={!trips.length || deletingTrip || deletingAllTrips}
            >
              Delete All My Trips
            </button>
          </article>
        </div>
      </section>

      {activeTab === 'flight' || activeTab === 'hotel' || activeTab === 'places' || activeTab === 'restaurants' ? (
        <section className="card section-card glass-card journey-tools-card">
          <p className="hub-subtab-title">Journey Studio</p>
          <div className="journey-tools-row">
            <button type="button" className="journey-tool-btn" onClick={() => openMainTab('record', 'tab-record-section')}>
              <span aria-hidden>🧳</span>
              <span>Record</span>
            </button>
            <button type="button" className="journey-tool-btn" onClick={() => openMainTab('diary', 'tab-diary-section')}>
              <span aria-hidden>📔</span>
              <span>{copy.diary}</span>
            </button>
            <button type="button" className="journey-tool-btn" onClick={() => openMainTab('tripstargram', 'tab-tripstargram-section')}>
              <span aria-hidden>📸</span>
              <span>{copy.tripstargram ?? 'Tripstargram'}</span>
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'places' ? (
        <section className="card section-card glass-card hub-subtab-card">
          <p className="hub-subtab-title">PlanHelper</p>
          <div className="hub-subtab-list">
            <button
              type="button"
              className={planHelperSubTab === 'places' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setPlanHelperSubTab('places')}
            >
              <span aria-hidden>📍</span>
              <span>Places</span>
            </button>
            <button
              type="button"
              className={planHelperSubTab === 'activities' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => {
                setPlanHelperSubTab('activities');
                setPlacesTheme('activity');
              }}
            >
              <span aria-hidden>🧗</span>
              <span>Activities</span>
            </button>
            <button
              type="button"
              className={planHelperSubTab === 'restaurants' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setPlanHelperSubTab('restaurants')}
            >
              <span aria-hidden>🍽️</span>
              <span>Restaurants</span>
            </button>
            <button
              type="button"
              className={planHelperSubTab === 'transportation' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setPlanHelperSubTab('transportation')}
            >
              <span aria-hidden>🚄</span>
              <span>Transportation</span>
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'restaurants' ? (
        <section className="card section-card glass-card hub-subtab-card">
          <p className="hub-subtab-title">Information</p>
          <div className="hub-subtab-list">
            <button
              type="button"
              className={informationSubTab === 'information' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setInformationSubTab('information')}
            >
              <span aria-hidden>🌍</span>
              <span>Information</span>
            </button>
            <button
              type="button"
              className={informationSubTab === 'event' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setInformationSubTab('event')}
            >
              <span aria-hidden>🎫</span>
              <span>Events/Festival</span>
            </button>
            <button
              type="button"
              className={informationSubTab === 'tips' ? 'sub-tab active' : 'sub-tab'}
              onClick={() => setInformationSubTab('tips')}
            >
              <span aria-hidden>💬</span>
              <span>Tips</span>
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'flight' ? (
        <section className="card section-card glass-card">
          <div className="section-heading">
            <p className="section-kicker">✈️ Flight Center</p>
            <h2>Find the best fare and fly with confidence</h2>
          </div>
          <div className="flight-dashboard-grid">
            <article className="summary-card glass-card boarding-pass-card">
              <h3>Upcoming Flight</h3>
              {primaryFlight ? (
                <>
                  <p className="route-emphasis">
                    {flightOrigin} ➜ {flightDestination}
                  </p>
                  <div className="chip-row">
                    <span className="travel-mode-chip">✈️ {flightTripType}</span>
                    <span className="status-chip">{primaryFlight.airline}</span>
                    <span className="date-chip">📅 {formatDateChipText(departureDate)}</span>
                    <span className="date-chip">🏁 {formatDateChipText(returnDate)}</span>
                  </div>
                  <p className="workspace-meta">Booking Ref: {primaryFlight.id.toUpperCase().slice(0, 8)}</p>
                  <p className="workspace-meta">
                    {primaryFlight.durationHours}h • Stops {primaryFlight.stopCount} • {formatKRW(primaryFlight.price)}
                  </p>
                </>
              ) : (
                <p className="empty-state-text">Add your first flight to organize your trip.</p>
              )}
            </article>

            <article className="detail-card glass-card">
              <h3>Flight Timeline</h3>
              <div className="timeline-list">
                <p>
                  <span>Check-in</span>
                  <strong>T-180m</strong>
                </p>
                <p>
                  <span>Boarding</span>
                  <strong>T-45m</strong>
                </p>
                <p>
                  <span>Gate</span>
                  <strong>Auto-update</strong>
                </p>
                <p>
                  <span>Baggage</span>
                  <strong>{flightTripType === 'oneway' ? '1 carry-on' : '1 checked + 1 carry-on'}</strong>
                </p>
                <p>
                  <span>Duration</span>
                  <strong>{primaryFlight ? `${primaryFlight.durationHours}h` : 'TBD'}</strong>
                </p>
              </div>
            </article>

            <article className="action-card glass-card">
              <h3>Flight Notes</h3>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={flightNotes.packed}
                  onChange={(event) => setFlightNotes((prev) => ({ ...prev, packed: event.target.checked }))}
                />
                <span>Packing ready for this flight</span>
              </label>
              <label>
                Seat / terminal memo
                <input
                  value={flightNotes.seatMemo}
                  placeholder="Ex. Seat near wing, Terminal 2"
                  onChange={(event) => setFlightNotes((prev) => ({ ...prev, seatMemo: event.target.value }))}
                />
              </label>
              <label>
                Reminder
                <input
                  value={flightNotes.reminder}
                  placeholder="Ex. Check-in opens 24h before departure"
                  onChange={(event) => setFlightNotes((prev) => ({ ...prev, reminder: event.target.value }))}
                />
              </label>
            </article>
          </div>

          <article className="detail-card glass-card">
            <h3>Search Flights</h3>
            <div className="grid two">
              <label>
                Origin
                <select value={flightOrigin} onChange={(event) => setFlightOrigin(event.target.value)}>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.city} ({a.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination
                <select value={flightDestination} onChange={(event) => setFlightDestination(event.target.value)}>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.city} ({a.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid three">
              <label>
                Trip Type
                <select value={flightTripType} onChange={(event) => setFlightTripType(event.target.value as any)}>
                  <option value="round">Round trip</option>
                  <option value="oneway">One way</option>
                  <option value="multi">Multi-city</option>
                </select>
              </label>
              <label>
                Sort
                <select value={flightSort} onChange={(event) => setFlightSort(event.target.value as any)}>
                  <option value="recommended">{copy.recommended}</option>
                  <option value="price">{copy.lowPrice}</option>
                </select>
              </label>
              <button type="button" className="btn-secondary" onClick={updateTripDestination}>
                Sync Destination to Trip
              </button>
            </div>
          </article>

          <article className="detail-card glass-card">
            <h3>Available Flights</h3>
            <div className="result-list">
              {flightResults.length === 0 ? <p className="empty-state-text">Add your first flight to organize your trip.</p> : null}
              {flightResults.map((flight) => (
                <article key={flight.id} className="result-card">
                  <div className="result-head">
                    <div>
                      <strong>{flight.airline}</strong>
                      <p>{flight.route}</p>
                    </div>
                    <p className="price">{formatKRW(flight.price)}</p>
                  </div>
                  <p>
                    {flight.durationHours}h · Stops {flight.stopCount}
                  </p>
                  <a href={flight.officialUrl} target="_blank" rel="noreferrer">
                    Book via official airline
                  </a>
                </article>
              ))}
            </div>
          </article>

          <article className="detail-card glass-card">
            <h3>Recommended Destinations</h3>
            <div className="image-grid">
              {cityImages.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="destination-card"
                  onClick={() => {
                    const airport = cityToAirportMap[item.city];
                    if (airport) {
                      setFlightDestination(airport);
                    }
                    setCountryCode(item.countryCode);
                    setPlacesCity(item.city);
                    setRestaurantsCity(item.city);
                  }}
                >
                  <img src={item.imageUrl} alt={item.caption} />
                  <span>
                    {item.city} ({item.countryCode})
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'hotel' ? (
        <section className="card section-card glass-card">
          <div className="section-heading">
            <p className="section-kicker">🏨 Hotel Desk</p>
            <h2>Compare trusted stays in one clean view</h2>
          </div>

          <div className="hotel-dashboard-grid">
            <article className="summary-card glass-card">
              <h3>Reservation Summary</h3>
              {primaryHotel ? (
                <>
                  <p className="route-emphasis">{primaryHotel.name}</p>
                  <div className="chip-row">
                    <span className="date-chip">🗓️ {formatDateChipText(departureDate)}</span>
                    <span className="date-chip">🛏️ {formatDateChipText(returnDate)}</span>
                    <span className="status-chip">👥 {peopleCount} guest(s)</span>
                    <span className="status-chip">🔐 {primaryHotel.id.toUpperCase().slice(0, 8)}</span>
                  </div>
                  <p className="workspace-meta">
                    {primaryHotel.city} • ⭐ {primaryHotel.rating} ({primaryHotel.reviewCount}) • {formatKRW(primaryHotel.nightlyPrice)}/night
                  </p>
                </>
              ) : (
                <p className="empty-state-text">No hotel reservation yet. Start with a city and find trusted stays.</p>
              )}
            </article>

            <article className="detail-card glass-card">
              <h3>Stay Details</h3>
              <p className="workspace-meta">
                Address: {hotelCity} central district, traveler-friendly zone
              </p>
              <div className="chip-row">
                <span className="status-chip">Wi-Fi</span>
                <span className="status-chip">Breakfast</span>
                <span className="status-chip">24h desk</span>
                <span className="status-chip">No smoking</span>
              </div>
              <p className="workspace-meta">Policy summary: Flexible cancellation window depends on room plan.</p>
              <a
                className="btn-secondary inline-link-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotelCity} hotel`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open directions
              </a>
            </article>

            <article className="action-card glass-card">
              <h3>Hotel Notes</h3>
              <label>
                Special request
                <input
                  placeholder="Ex. Quiet room, high floor"
                  value={hotelNotes.requests}
                  onChange={(event) => setHotelNotes((prev) => ({ ...prev, requests: event.target.value }))}
                />
              </label>
              <label>
                Late check-in memo
                <input
                  placeholder="Ex. Arrive around 22:30"
                  value={hotelNotes.lateCheckIn}
                  onChange={(event) => setHotelNotes((prev) => ({ ...prev, lateCheckIn: event.target.value }))}
                />
              </label>
              <label>
                Nearby reference
                <input
                  placeholder="Ex. Convenience store behind hotel"
                  value={hotelNotes.nearbyNote}
                  onChange={(event) => setHotelNotes((prev) => ({ ...prev, nearbyNote: event.target.value }))}
                />
              </label>
            </article>
          </div>

          <article className="detail-card glass-card">
            <h3>Search Hotels</h3>
            <div className="grid two">
              <label>
                City
                <select value={hotelCity} onChange={(event) => setHotelCity(event.target.value)}>
                  {Array.from(new Set(airports.map((airport) => airport.city))).map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select value={hotelSort} onChange={(event) => setHotelSort(event.target.value as any)}>
                  <option value="recommended">{copy.recommended}</option>
                  <option value="price">{copy.lowPrice}</option>
                </select>
              </label>
            </div>
          </article>

          <article className="detail-card glass-card">
            <h3>Trusted Reservations</h3>
            <div className="result-list">
              {hotelResults.length === 0 ? <p className="empty-state-text">No hotel reservation yet. Start with a city and find trusted stays.</p> : null}
              {hotelResults.map((hotel) => (
                <article key={hotel.id} className="result-card">
                  <div className="result-head">
                    <div>
                      <strong>{hotel.name}</strong>
                      <p>
                        {hotel.city} · ⭐ {hotel.rating} ({hotel.reviewCount} reviews)
                      </p>
                    </div>
                    <p className="price">{formatKRW(hotel.nightlyPrice)}</p>
                  </div>
                  <a href={hotel.officialUrl} target="_blank" rel="noreferrer">
                    Book on official site
                  </a>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'places' && (planHelperSubTab === 'places' || planHelperSubTab === 'activities') ? (
        <section className="card section-card glass-card planhelper-section">
          <div className="section-heading">
            <p className="section-kicker">📍 Discovery Board</p>
            <h2>{planHelperSubTab === 'activities' ? 'Pick active adventures for your style' : 'Choose places that match your trip mood'}</h2>
          </div>
          <div className="grid three">
            <label>
              Country
              <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                {Object.keys(countryCities).map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <select value={placesCity} onChange={(event) => setPlacesCity(event.target.value)}>
                {(countryCities[countryCode] ?? []).map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label>
              Theme
              <select value={placesTheme} onChange={(event) => setPlacesTheme(event.target.value as any)}>
                <option value="all">all</option>
                <option value="activity">activity</option>
                <option value="healing">healing</option>
                <option value="city">city</option>
              </select>
            </label>
          </div>
          <div className="view-mode">
            <button type="button" className={placesViewMode === 'list' ? 'btn-secondary active' : 'btn-secondary'} onClick={() => setPlacesViewMode('list')}>
              {copy.listMode}
            </button>
            <button type="button" className={placesViewMode === 'images' ? 'btn-secondary active' : 'btn-secondary'} onClick={() => setPlacesViewMode('images')}>
              {copy.imageMode}
            </button>
          </div>

          {placesViewMode === 'images' ? (
            <div className="image-grid">
              {[...placesResponse.heroImages, ...placesResponse.cityImages.map((image) => image.imageUrl)].map((src, idx) => (
                <img key={`${src}-${idx}`} src={src} alt="destination inspiration" />
              ))}
            </div>
          ) : (
            <div className="result-list planhelper-card-grid">
              {placesForDisplay.map((place) => (
                <article
                  key={place.id}
                  className={
                    planHelperSubTab === 'activities'
                      ? 'result-card place-card planhelper-card activity-card'
                      : 'result-card place-card planhelper-card'
                  }
                >
                  <img src={place.imageUrl} alt={place.name} className="thumb" />
                  <div>
                    <strong>{place.name}</strong>
                    <p className="tag-row">
                      <span className="data-tag">📍 {place.city}</span>
                      <span className="data-tag">🧭 {place.theme}</span>
                      <span className="data-tag">⭐ {place.rating}</span>
                      {planHelperSubTab === 'activities' ? <span className="travel-mode-chip">⏱️ 2-4h</span> : null}
                    </p>
                    <p>{place.summary}</p>
                    <button type="button" className="btn-secondary" onClick={() => savePlace(place)}>
                      Add to trip
                    </button>
                  </div>
                </article>
              ))}
              {placesForDisplay.length === 0 ? <p className="empty-state-text">No saved places yet. Start building your journey.</p> : null}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'places' && planHelperSubTab === 'restaurants' ? (
        <section className="card section-card glass-card planhelper-section">
          <div className="section-heading">
            <p className="section-kicker">🍽️ Restaurant Picks</p>
            <h2>Curated city-by-city dining recommendations</h2>
          </div>
          <div className="grid two">
            <label>
              Country
              <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                {Object.keys(countryCities).map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <select value={restaurantsCity} onChange={(event) => setRestaurantsCity(event.target.value)}>
                {(availableCities.length ? availableCities : countryCities[countryCode] ?? []).map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="result-list planhelper-card-grid">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="result-card restaurant-card planhelper-card">
                <img src={restaurant.imageUrl} alt={restaurant.name} className="thumb" />
                <div>
                  <strong>{restaurant.name}</strong>
                  <p className="tag-row">
                    <span className="data-tag">📍 {restaurant.city}</span>
                    <span className="data-tag">🍽️ {restaurant.cuisine}</span>
                    <span className="data-tag">
                      ⭐ {restaurant.rating} ({restaurant.reviewCount})
                    </span>
                    <span className="status-chip">Recommended</span>
                  </p>
                  <p>{restaurant.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'record' ? (
        <section id="tab-record-section" className="card section-card glass-card">
          <div className="section-heading">
            <p className="section-kicker">🧳 Travel Record</p>
            <h2>Save your media memories in shareable cards</h2>
          </div>
          <form onSubmit={saveRecord}>
            <label>
              Title
              <input value={recordTitle} onChange={(event) => setRecordTitle(event.target.value)} required />
            </label>
            <label>
              Note
              <textarea rows={3} value={recordNote} onChange={(event) => setRecordNote(event.target.value)} />
            </label>
            <label>
              Photos / Videos
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>) => setRecordFiles(event.target.files)}
              />
            </label>
            <button type="submit" className="btn-primary">
              Save Record
            </button>
          </form>

          <div className="result-list">
            {records.length === 0 ? <p className="empty-state-text">No records yet. Save your first travel memory card.</p> : null}
            {records.map((record) => (
              <article key={record.id} className="result-card">
                <strong>{record.title}</strong>
                <p>{autoTranslate ? translatedRecordNote[record.id] ?? record.note : record.note}</p>
                <div className="media-grid">
                  {record.mediaUrls.map((url) =>
                    url.startsWith('data:video') ? (
                      <video key={url} controls src={url} />
                    ) : url.startsWith('data:audio') ? (
                      <audio key={url} controls src={url} />
                    ) : (
                      <img key={url} src={url} alt={record.title} />
                    )
                  )}
                </div>
                {selectedTripId ? (
                  <CommentsThread
                    supabase={supabase}
                    tripId={selectedTripId}
                    targetType="record"
                    targetId={record.id}
                    language={language}
                    autoTranslate={autoTranslate}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'diary' ? (
        <section id="tab-diary-section" className="card section-card glass-card diary-section">
          <div className="diary-intro">
            <h2>📔 Travel Journal</h2>
            <p>Capture today with a cozy memory card, not a boring form.</p>
          </div>
          <form onSubmit={saveDiary} className="diary-form-card">
            <label>
              Title
              <input
                className="diary-input"
                value={diaryTitle}
                onChange={(event) => setDiaryTitle(event.target.value)}
                placeholder="My warm travel moment"
                required
              />
            </label>
            <div className="grid three diary-meta-grid">
              <label>
                Date
                <input type="date" value={diaryDate} onChange={(event) => setDiaryDate(event.target.value)} />
              </label>
              <label>
                Place
                <select value={diaryPlace} onChange={(event) => setDiaryPlace(event.target.value)}>
                  {(countryCities[countryCode] ?? []).map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </label>
              <label>
                Weather Emoji
                <select value={diaryWeatherEmoji} onChange={(event) => setDiaryWeatherEmoji(event.target.value)}>
                  {weatherEmojiOptions.map((emoji) => (
                    <option key={emoji}>{emoji}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid two diary-weather-row">
              <button type="button" className="btn-secondary diary-weather-btn" onClick={autoWeather}>
                Auto weather (Open-Meteo)
              </button>
              <div className="diary-weather-display">
                <strong className="weather-badge">
                  {diaryWeatherEmoji} {weatherEmojiLabels[diaryWeatherEmoji] ?? 'Weather'}
                </strong>
                <p>{diaryWeatherLabel ?? 'Pick weather manually or auto-fill from Open-Meteo.'}</p>
              </div>
            </div>
            <label>
              Diary text
              <textarea
                className="diary-paper-textarea"
                rows={6}
                value={diaryContent}
                onChange={(event) => setDiaryContent(event.target.value)}
                placeholder="Write today's journey like a postcard to yourself..."
                required
              />
            </label>
            <label>
              Photo / Video attachments
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={onDiaryFilesChange}
              />
            </label>
            {diaryImagePreviews.length ? (
              <div className="diary-preview-grid">
                {diaryImagePreviews.map((src, idx) => (
                  <img key={`${src}-${idx}`} src={src} alt={`Diary preview ${idx + 1}`} />
                ))}
              </div>
            ) : null}
            <div className="grid two diary-voice-row">
              {!isRecording ? (
                <button type="button" className="btn-secondary diary-voice-btn" onClick={startRecording}>
                  🎙️ Start Voice Recording
                </button>
              ) : (
                <button type="button" className="btn-secondary danger diary-voice-btn is-recording" onClick={stopRecording}>
                  ⏹ Stop Recording
                </button>
              )}
              {audioDataUrl ? <audio controls src={audioDataUrl} /> : <p>No voice memo yet.</p>}
            </div>
            <button type="submit" className="btn-primary diary-save-btn">
              Save today ✨
            </button>
          </form>

          <h3 className="diary-list-title">Saved Diary Cards</h3>
          <div className="result-list">
            {diaries.length === 0 ? <p className="empty-state-text">No diary entries yet. Start with today's first story.</p> : null}
            {diaries.map((diary) => {
              const diaryJobs = musicJobs.filter((job) => job.diaryId === diary.id);
              return (
                <article key={diary.id} className="result-card">
                  <div className="result-head">
                    <div>
                      <strong>{diary.title}</strong>
                      <p className="tag-row">
                        <span className="date-chip">📅 {formatDateChipText(diary.date)}</span>
                        <span className="status-chip">📍 {diary.place}</span>
                        <span className="weather-badge">{diary.weatherEmoji}</span>
                      </p>
                    </div>
                    <p>{diary.weatherLabel ?? ''}</p>
                  </div>

                  <p>{autoTranslate ? translatedDiaryContent[diary.id] ?? diary.content : diary.content}</p>
                  <div className="media-grid">
                    {diary.mediaUrls.map((url) =>
                      url.startsWith('data:video') ? (
                        <video key={url} controls src={url} />
                      ) : url.startsWith('data:audio') ? (
                        <audio key={url} controls src={url} />
                      ) : (
                        <img key={url} src={url} alt={diary.title} />
                      )
                    )}
                  </div>

                  <div className="music-block">
                    <div className="grid three">
                      <label>
                        Music Style
                        <select value={musicStyle} onChange={(event) => setMusicStyle(event.target.value as any)}>
                          <option value="recommended">recommended</option>
                          <option value="cinematic-pop">cinematic-pop</option>
                          <option value="indie-folk">indie-folk</option>
                          <option value="lofi">lofi</option>
                          <option value="dance-pop">dance-pop</option>
                          <option value="orchestral">orchestral</option>
                          <option value="k-pop-ballad">k-pop-ballad</option>
                        </select>
                      </label>
                      <label>
                        Lyrics
                        <select value={includeLyrics ? 'on' : 'off'} onChange={(event) => setIncludeLyrics(event.target.value === 'on')}>
                          <option value="on">with lyrics</option>
                          <option value="off">instrumental</option>
                        </select>
                      </label>
                      <button type="button" className="btn-secondary" onClick={() => createMusicJob(diary.id)}>
                        Generate AI Music
                      </button>
                    </div>
                    <div className="music-list">
                      {diaryJobs.map((job) => (
                        <div key={job.id} className="music-item">
                          <p>
                            {job.title ?? 'Untitled'} · {job.status}
                          </p>
                          {job.resultUrl ? (
                            <>
                              <audio controls src={job.resultUrl} />
                              {selectedTripId ? (
                                <CommentsThread
                                  supabase={supabase}
                                  tripId={selectedTripId}
                                  targetType="music"
                                  targetId={job.id}
                                  language={language}
                                  autoTranslate={autoTranslate}
                                />
                              ) : null}
                            </>
                          ) : (
                            <p>{job.errorMessage ?? 'Processing...'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTripId ? (
                    <CommentsThread
                      supabase={supabase}
                      tripId={selectedTripId}
                      targetType="diary"
                      targetId={diary.id}
                      language={language}
                      autoTranslate={autoTranslate}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === 'tripstargram' ? (
        <section id="tab-tripstargram-section" className="card section-card glass-card">
          <h2>📸 Tripstargram</h2>
          <p>Build your own Instagram-style travel feed. Auto-create from diary or post manually.</p>
          <form className="tripstargram-form" onSubmit={createTripstargramPost}>
            <div className="grid three">
              <label>
                Post mode
                <select value={tripstargramMode} onChange={(event) => setTripstargramMode(event.target.value as 'auto' | 'manual')}>
                  <option value="auto">Auto from diary</option>
                  <option value="manual">Manual post</option>
                </select>
              </label>
              <label>
                Linked diary
                <select
                  value={tripstargramDiaryId}
                  onChange={(event) => setTripstargramDiaryId(event.target.value)}
                  disabled={tripstargramMode !== 'auto' || diaries.length === 0}
                >
                  <option value="">{diaries.length ? 'Select diary' : 'No diary yet'}</option>
                  {diaries.map((diary) => (
                    <option key={diary.id} value={diary.id}>
                      {diary.title} ({diary.date})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Media (optional)
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTripstargramFiles(event.target.files)}
                />
              </label>
            </div>
            <label>
              Caption {tripstargramMode === 'manual' ? '(required)' : '(optional override)'}
              <textarea
                rows={4}
                value={tripstargramCaption}
                onChange={(event) => setTripstargramCaption(event.target.value)}
                placeholder={
                  tripstargramMode === 'auto'
                    ? 'Leave empty to auto-generate from diary'
                    : 'Write your own travel post caption'
                }
                required={tripstargramMode === 'manual'}
              />
            </label>
            <button type="submit" className="btn-primary">
              Create Tripstargram Post
            </button>
          </form>

          <div className="result-list">
            {tripstargramPosts.map((post) => (
              <article key={post.id} className="result-card tripstargram-card">
                <div className="tripstargram-meta">
                  <strong>{post.authorNickname}</strong>
                  <span>{new Date(post.createdAt).toLocaleString(language === 'en' ? 'en-US' : language)}</span>
                </div>
                {post.mediaUrl ? (
                  post.mediaUrl.startsWith('data:video') ? (
                    <video controls src={post.mediaUrl} className="tripstargram-media" />
                  ) : (
                    <img src={post.mediaUrl} alt="tripstargram post" className="tripstargram-media" />
                  )
                ) : null}
                <p>{autoTranslate ? translatedTripstargramCaption[post.id] ?? post.caption : post.caption}</p>
                {post.hashtags.length ? <p className="tripstargram-tags">{post.hashtags.join(' ')}</p> : null}
                {post.diaryId ? <p className="tip-meta">Auto-created from diary</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'profile' ? (
        <section id="tab-profile-section" className="card section-card glass-card">
          {profile ? (
            <form onSubmit={saveProfile}>
              <div className="profile-grid">
                <div>
                  {profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="profile" className="profile-image" /> : <div className="profile-placeholder">No image</div>}
                  <label>
                    Upload profile image
                    <input type="file" accept="image/*" onChange={onProfileImageUpload} />
                  </label>
                  <button type="button" className="btn-secondary" onClick={generateProfileImage}>
                    Generate AI Profile Image
                  </button>
                </div>
                <div className="stack">
                  <label>
                    Nickname
                    <input value={profile.nickname} disabled />
                  </label>
                  <label>
                    Name
                    <input
                      value={profile.displayName ?? ''}
                      onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                    />
                  </label>
                  <label>
                    Phone
                    <input value={profile.phone ?? ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
                  </label>
                  <label>
                    Profile Image URL
                    <input
                      value={profile.profileImageUrl ?? ''}
                      onChange={(event) => setProfile({ ...profile, profileImageUrl: event.target.value })}
                    />
                  </label>
                  <button type="submit" className="btn-primary">
                    Update Profile
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <p>Sign in to manage profile.</p>
          )}
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section id="tab-settings-section" className="card section-card glass-card">
          <h2>⚙️ Settings</h2>
          <form onSubmit={submitSupport}>
            <div className="grid two">
              <label>
                Category
                <select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value as any)}>
                  <option value="contact">문의하기</option>
                  <option value="improvement">서비스 개선요청</option>
                </select>
              </label>
              <label>
                Title
                <input value={supportTitle} onChange={(event) => setSupportTitle(event.target.value)} required />
              </label>
            </div>
            <label>
              Message
              <textarea rows={4} value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} required />
            </label>
            <button type="submit" className="btn-primary">
              Submit
            </button>
          </form>
          <div className="result-list">
            {supportHistory.map((row) => (
              <article key={row.id} className="result-card">
                <strong>{row.title}</strong>
                <p>{row.category}</p>
                <p>{row.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'restaurants' && informationSubTab === 'information' ? (
        <section className="card section-card glass-card">
          <h2>🌍 Information</h2>
          <div className="grid three">
            <label>
              Country
              <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                {Object.keys(countryCities).map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <select value={placesCity} onChange={(event) => setPlacesCity(event.target.value)}>
                {(countryCities[countryCode] ?? []).map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <select value={informationTopic} onChange={(event) => setInformationTopic(event.target.value as any)}>
                <option value="overview">overview</option>
                <option value="history">history</option>
                <option value="society">society</option>
                <option value="economy">economy</option>
              </select>
            </label>
          </div>
          <div className="information-grid">
            <article className="summary-card glass-card">
              <h3>Destination Overview</h3>
              <p className="route-emphasis">
                {countryCode} · {placesCity}
              </p>
              <div className="chip-row">
                <span className="status-chip">Best for: {travelPurpose}</span>
                <span className="travel-mode-chip">Vibe: {travelMood}</span>
                <span className="status-chip">Style: {stylePreference}</span>
              </div>
              <p className="workspace-meta">
                Premium curated overview designed to keep planning reliable while preserving travel excitement.
              </p>
            </article>

            <article className="detail-card glass-card">
              <h3>Curated Guide Content</h3>
              {informationData ? (
                <>
                  <strong>
                    {informationData.country} · {informationData.city}
                  </strong>
                  <p>{informationData.text}</p>
                </>
              ) : (
                <p className="empty-state-text">No information yet. Select a destination and topic to load the guide.</p>
              )}
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === 'places' && planHelperSubTab === 'transportation' ? (
        <section id="extra-plan-section" className="card section-card glass-card planhelper-section">
          <h2>🚄 Transportation & Smart Plan</h2>
          <div className="result-list transport-route-list planhelper-card-grid">
            {transportOptions.length === 0 ? <p className="empty-state-text">No transportation route yet. Generate an itinerary first.</p> : null}
            {transportOptions.map((option) => {
              const optionKey = `${option.mode}-${option.bookingUrl}`;
              const isActive = optionKey === (selectedTransport ? `${selectedTransport.mode}-${selectedTransport.bookingUrl}` : '');
              return (
                <article
                  key={optionKey}
                  className={
                    isActive
                      ? 'result-card transport-card route-card planhelper-card active'
                      : 'result-card transport-card route-card planhelper-card'
                  }
                  onClick={() => setSelectedTransportKey(optionKey)}
                >
                  <strong>{option.mode}</strong>
                  <p>{option.reason}</p>
                  <p>{option.estimatedCost}</p>
                  <div className="chip-row">
                    <span className="travel-mode-chip">🚏 Route</span>
                    <span className="status-chip">Tap for detail</span>
                  </div>
                </article>
              );
            })}
          </div>
          {selectedTransport ? (
            <article className="detail-card glass-card transport-detail-panel">
              <h3>Route Detail Panel</h3>
              <p className="route-emphasis">{selectedTransport.mode}</p>
              <p>{selectedTransport.reason}</p>
              <p>{selectedTransport.estimatedCost}</p>
              <label>
                Route memo
                <input
                  value={transportMemo}
                  placeholder="Ex. Buy pass at airport station"
                  onChange={(event) => setTransportMemo(event.target.value)}
                />
              </label>
              <a href={selectedTransport.bookingUrl} target="_blank" rel="noreferrer">
                Open booking
              </a>
            </article>
          ) : null}
          <article className="plan-prep-card">
            <div className="plan-prep-header">
              <strong>
                Travel Check for {planPrepGuide.country} ({countryCode})
              </strong>
              <div className="plan-prep-tabs">
                <button
                  type="button"
                  className={planPrepTopic === 'caution' ? 'plan-prep-tab active' : 'plan-prep-tab'}
                  onClick={() => setPlanPrepTopic('caution')}
                >
                  주의사항
                </button>
                <button
                  type="button"
                  className={planPrepTopic === 'packing' ? 'plan-prep-tab active' : 'plan-prep-tab'}
                  onClick={() => setPlanPrepTopic('packing')}
                >
                  준비물
                </button>
                <button
                  type="button"
                  className={planPrepTopic === 'visa' ? 'plan-prep-tab active' : 'plan-prep-tab'}
                  onClick={() => setPlanPrepTopic('visa')}
                >
                  Visa
                </button>
              </div>
            </div>
            {planPrepTopic === 'packing' ? (
              <div className="packing-layout">
                <div className="packing-panel">
                  <p className="packing-section-title">기본 준비물 템플릿 (사용자화 가능)</p>
                  {basePackingTemplate.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="packing-template-row">
                      <input
                        className="packing-item-input"
                        value={item}
                        onChange={(event) => editTemplateItem(idx, event.target.value)}
                      />
                      <button type="button" className="packing-remove-btn" onClick={() => removeTemplateItem(idx)}>
                        삭제
                      </button>
                    </div>
                  ))}
                  <div className="packing-add-row">
                    <input
                      placeholder="기본 준비물 추가 (예: 세면도구, 샴푸/린스)"
                      value={newTemplatePackingText}
                      onChange={(event) => setNewTemplatePackingText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTemplateItem();
                        }
                      }}
                    />
                    <button type="button" className="btn-secondary" onClick={addTemplateItem}>
                      템플릿 추가
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={syncTemplateToCurrentTrip}
                    disabled={!selectedTripId || !canEditPacking}
                  >
                    현재 여행 리스트에 템플릿 반영
                  </button>
                </div>

                <div className="packing-panel">
                  <p className="packing-section-title">
                    여행별 준비물 리스트
                    {selectedTripId ? ` · ${selectedTripTitle || 'Selected Trip'} (${countryCode})` : ''}
                  </p>
                  {selectedTripId ? (
                    <>
                      <div className="packing-checklist">
                        {packingChecklist.map((item) => (
                          <div key={item.id} className="packing-item-row">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => togglePackingItem(item.id)}
                              aria-label="packed"
                              disabled={!canEditPacking}
                            />
                            <input
                              className="packing-item-input"
                              value={item.text}
                              onChange={(event) => editPackingItem(item.id, event.target.value)}
                              disabled={!canEditPacking}
                            />
                            <button
                              type="button"
                              className="packing-remove-btn"
                              onClick={() => removePackingItem(item.id)}
                              disabled={!canEditPacking}
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="packing-add-row">
                        <input
                          placeholder="이 여행에만 필요한 준비물 추가"
                          value={newPackingText}
                          onChange={(event) => setNewPackingText(event.target.value)}
                          disabled={!canEditPacking}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addPackingItem();
                            }
                          }}
                        />
                        <button type="button" className="btn-secondary" onClick={addPackingItem} disabled={!canEditPacking}>
                          추가
                        </button>
                      </div>
                      {!canEditPacking ? (
                        <p className="packing-helper">현재 이 여행은 준비물 편집이 OFF 상태라 editor만 수정할 수 있어요.</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="packing-helper">Trip을 선택하면 여행별 체크리스트가 개별로 생성됩니다.</p>
                  )}
                </div>
              </div>
            ) : (
              <ul className="plan-prep-list">
                {planPrepItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </article>
          <div className="grid three">
            <label>
              Mode
              <select value={planMode} onChange={(event) => setPlanMode(event.target.value as any)}>
                <option value="simple">simple</option>
                <option value="specific">specific</option>
              </select>
            </label>
            <label>
              Departure
              <input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} />
            </label>
            <label>
              Return date
              <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
            </label>
          </div>
          <div className="grid three">
            <label>
              Mood
              <select value={travelMood} onChange={(event) => setTravelMood(event.target.value)}>
                <option value="healing">healing</option>
                <option value="rest">rest</option>
                <option value="stress-release">stress release</option>
                <option value="adventure">adventure</option>
                <option value="culture">culture</option>
              </select>
            </label>
            <label>
              Purpose
              <select value={travelPurpose} onChange={(event) => setTravelPurpose(event.target.value)}>
                <option value="rest">rest</option>
                <option value="healing">healing</option>
                <option value="food">food exploration</option>
                <option value="photo">photo spots</option>
                <option value="culture">culture & museums</option>
              </select>
            </label>
            <label>
              Travel style
              <select value={stylePreference} onChange={(event) => setStylePreference(event.target.value)}>
                <option value="slow">slow</option>
                <option value="balanced">balanced</option>
                <option value="intensive">intensive</option>
              </select>
            </label>
          </div>
          <div className="grid three">
            <label>
              Who are you traveling with?
              <select value={companion} onChange={(event) => setCompanion(event.target.value)}>
                <option value="solo">solo</option>
                <option value="couple">couple</option>
                <option value="friends">friends</option>
                <option value="family">family</option>
              </select>
            </label>
            <label>
              People count
              <input
                type="number"
                min={1}
                max={30}
                value={peopleCount}
                onChange={(event) => setPeopleCount(Number(event.target.value) || 1)}
              />
            </label>
            <label>
              Budget (KRW)
              <input
                type="number"
                min={100000}
                step={100000}
                value={budgetKrw}
                onChange={(event) => setBudgetKrw(Number(event.target.value) || 100000)}
              />
            </label>
          </div>
          <div className="grid three">
            <label>
              Do you like night views?
              <select value={likesNightView ? 'yes' : 'no'} onChange={(event) => setLikesNightView(event.target.value === 'yes')}>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label>
              Do you enjoy alcohol / bars?
              <select value={likesAlcohol ? 'yes' : 'no'} onChange={(event) => setLikesAlcohol(event.target.value === 'yes')}>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label>
              Food-focused travel level
              <select value={foodFocus} onChange={(event) => setFoodFocus(event.target.value as 'low' | 'medium' | 'high')}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          <label>
            Return flight time
            <input type="time" value={returnFlightTime} onChange={(event) => setReturnFlightTime(event.target.value)} />
          </label>
          <div className="survey-list">
            {surveyQuestions.map((question, idx) => (
              <label key={question}>
                {question}
                <input
                  value={surveyAnswers[idx]}
                  onChange={(event) =>
                    setSurveyAnswers((prev) => {
                      const next = [...prev];
                      next[idx] = event.target.value;
                      return next;
                    })
                  }
                />
              </label>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={generatePlan}>
            Generate Itinerary
          </button>
          {planResult ? (
            <div className="result-list">
              <p>{planResult.recommendationSummary}</p>
              {planResult.budget ? (
                <article className="result-card">
                  <strong>Budget Meter</strong>
                  <p>
                    Estimated: {formatKRW(planResult.budget.estimatedCostKrw)} / Budget: {formatKRW(planResult.budget.budgetKrw)}
                  </p>
                  <div className="budget-battery">
                    <div
                      className="budget-battery-fill"
                      style={{ width: `${Math.min(planResult.budget.usagePercent, 100)}%` }}
                    />
                  </div>
                  <p>
                    Usage: {planResult.budget.usagePercent}% · Over budget: {formatKRW(planResult.budget.overBudgetKrw)}
                  </p>
                </article>
              ) : null}
              {planResult.itinerary?.map((day: any) => (
                <article key={day.day} className="result-card">
                  <strong>{day.title}</strong>
                  <ul>
                    {day.blocks.map((block: string) => (
                      <li key={block}>{block}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'restaurants' && informationSubTab === 'tips' ? (
        <section className="card section-card glass-card">
          <h2>💬 Tips</h2>
          <p>Community + global travel tips in friendly iMessage-like bubbles.</p>
          <div className="tips-bubbles">
            {tips.length === 0 ? <p className="empty-state-text">No tips yet. Share your first practical local advice.</p> : null}
            {tips.map((tip) => (
              <div key={tip.id} className="tip-bubble">
                <p className="tip-meta">
                  {tip.nickname} · {tip.city}
                </p>
                <p>{autoTranslate ? translatedTips[tip.id] ?? tip.message : tip.message}</p>
              </div>
            ))}
          </div>
          <div className="tip-compose">
            <textarea rows={3} value={tipMessage} onChange={(event) => setTipMessage(event.target.value)} placeholder="Share your own tip..." />
            <button type="button" className="btn-primary" onClick={submitTip}>
              Share Tip
            </button>
          </div>
        </section>
      ) : null}

      {activeExtraTab === 'entertainment' ? (
        <section className="card section-card glass-card">
          <h2>🎬 Entertainment</h2>
          <div className="grid two">
            <label>
              Mini title
              <select value={entertainmentType} onChange={(event) => setEntertainmentType(event.target.value as 'movie' | 'book')}>
                <option value="movie">영화 | Movie</option>
                <option value="book">책 | Book</option>
              </select>
            </label>
            <label>
              Trip mood
              <select value={travelMood} onChange={(event) => setTravelMood(event.target.value)}>
                <option value="healing">healing</option>
                <option value="rest">rest</option>
                <option value="stress-release">stress release</option>
                <option value="adventure">adventure</option>
                <option value="culture">culture</option>
              </select>
            </label>
          </div>
          <div className="result-list">
            {entertainmentItems.length === 0 ? <p className="empty-state-text">No recommendations yet. Try another mood or destination.</p> : null}
            {entertainmentItems.map((item) => (
              <article key={item.id} className="result-card">
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <a href={item.link} target="_blank" rel="noreferrer">
                  Details
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'restaurants' && informationSubTab === 'event' ? (
        <section id="extra-event-section" className="card section-card glass-card">
          <h2>🎫 Event</h2>
          <p>
            Latest planned exhibitions/performances for {placesCity} ({countryCode}) · source: {eventsSource}
          </p>
          <div className="result-list">
            {events.length === 0 ? <p className="empty-state-text">No current events found. Try another city.</p> : null}
            {events.map((event) => (
              <article key={event.id} className="result-card">
                <strong>{event.title}</strong>
                <p className="tag-row">
                  <span className="date-chip">📅 {event.date}</span>
                  <span className="status-chip">{event.category}</span>
                </p>
                <p>
                  {event.venue} · {event.priceText}
                </p>
                <a href={event.bookingUrl} target="_blank" rel="noreferrer">
                  Reserve / View event
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
