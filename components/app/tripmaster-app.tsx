'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AuthPanel } from '@/components/auth/auth-panel';
import { CommentsThread } from '@/components/comments/comments-thread';
import { airportCountryMap, cityImages, countryCities } from '@/lib/curated-data';
import { generateFlights, generateHotels, airports } from '@/lib/flight-hotel';
import { PrepGuideTopic, travelPrepGuides } from '@/lib/info-plan-data';
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

const mainTabs: Array<{ key: TabKey; fallbackLabel: string }> = [
  { key: 'flight', fallbackLabel: 'Flight' },
  { key: 'hotel', fallbackLabel: 'Hotel' },
  { key: 'places', fallbackLabel: 'Places' },
  { key: 'restaurants', fallbackLabel: 'Restaurants' },
  { key: 'record', fallbackLabel: 'Record' },
  { key: 'diary', fallbackLabel: 'Diary' },
  { key: 'profile', fallbackLabel: 'Profile' },
  { key: 'settings', fallbackLabel: 'Settings' },
  { key: 'tripstargram', fallbackLabel: 'Tripstargram' },
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

async function filesToDataUrls(files: FileList | null) {
  if (!files || files.length === 0) return [];
  const tasks = Array.from(files).map(
    (file) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })
  );
  return Promise.all(tasks);
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
  const [updatingPackingPermission, setUpdatingPackingPermission] = useState(false);

  const [flightOrigin, setFlightOrigin] = useState('ICN');
  const [flightDestination, setFlightDestination] = useState('NRT');
  const [flightTripType, setFlightTripType] = useState<'round' | 'oneway' | 'multi'>('round');
  const [flightSort, setFlightSort] = useState<'recommended' | 'price'>('recommended');
  const [flightResults, setFlightResults] = useState<FlightOption[]>([]);
  const [countryCode, setCountryCode] = useState('JP');

  const [hotelCity, setHotelCity] = useState('Tokyo');
  const [hotelSort, setHotelSort] = useState<'recommended' | 'price'>('recommended');
  const [hotelResults, setHotelResults] = useState<HotelOption[]>([]);

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
      setStatusMessage(res.message);
    }
    return false;
  }

  async function loadTrips() {
    const res = await apiFetch<TripSummary[]>(supabase, '/api/trips', { method: 'GET' });
    if (res.ok && res.data) {
      setTrips(res.data);
      if (!selectedTripId && res.data.length > 0) {
        setSelectedTripId(res.data[0].id);
      }
      return true;
    }
    if (res.message) {
      setStatusMessage(res.message);
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

  function requireSignIn() {
    if (nickname) return true;
    setStatusMessage('Please sign in first.');
    return false;
  }

  function applyTripUpdate(updatedTrip: TripSummary) {
    setTrips((prev) => prev.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip)));
  }

  useEffect(() => {
    const init = async () => {
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
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTripId) return;
    loadRecords();
    loadDiaries();
    loadMusicJobs();
    loadTripstargram();
  }, [selectedTripId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    await loadProfile();
    await loadTrips();
  }

  async function onSignedOut() {
    setNickname(null);
    setProfile(null);
    setTrips([]);
    setSelectedTripId('');
    setTripstargramPosts([]);
  }

  async function createTrip() {
    if (!requireSignIn()) return;
    const res = await apiFetch<TripSummary>(supabase, '/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        title: newTripTitle,
        destinationCountry: countryCode,
      }),
    });
    if (res.ok && res.data) {
      await loadTrips();
      setSelectedTripId(res.data.id);
      setStatusMessage('Trip created.');
    } else {
      setStatusMessage(res.message ?? 'Failed to create trip');
    }
  }

  async function updateTripDestination() {
    if (!selectedTripId) return;
    const res = await apiFetch<TripSummary>(supabase, '/api/trips', {
      method: 'PATCH',
      body: JSON.stringify({
        tripId: selectedTripId,
        destinationCountry: countryCode,
      }),
    });
    if (res.ok && res.data) {
      applyTripUpdate(res.data);
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
        setStatusMessage(
          nextValue
            ? 'Invited members can now edit this trip packing list.'
            : 'Packing list editing is now limited to editors for this trip.'
        );
      } else {
        setStatusMessage(res.message ?? 'Failed to update packing permission');
      }
    } catch {
      setStatusMessage('Failed to update packing permission');
    }
    setUpdatingPackingPermission(false);
  }

  async function createInvite() {
    if (!requireSignIn()) return;
    if (!selectedTripId) return;
    const res = await apiFetch<any>(supabase, '/api/invites', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        role: 'viewer',
      }),
    });
    if (res.ok && res.data) {
      setGeneratedInviteLink(res.data.inviteLink || `Code: ${res.data.code}`);
      setStatusMessage('Invite created.');
    } else {
      setStatusMessage(res.message ?? 'Failed to create invite');
    }
  }

  async function acceptInvite() {
    if (!requireSignIn()) return;
    if (!inviteCode.trim()) return;
    const res = await apiFetch(supabase, '/api/invites', {
      method: 'PATCH',
      body: JSON.stringify({ code: inviteCode.trim() }),
    });
    if (res.ok) {
      setStatusMessage('Invite accepted.');
      setInviteCode('');
      await loadTrips();
    } else {
      setStatusMessage(res.message ?? 'Failed to accept invite');
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
    if (!selectedTripId) return;
    await apiFetch(supabase, '/api/places', {
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
    setSelectedPlaceNames((prev) => (prev.includes(place.name) ? prev : [...prev, place.name]));
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
    if (!tipMessage.trim()) return;
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
    } else {
      setStatusMessage(res.message ?? 'Failed to add tip');
    }
  }

  async function loadRecords() {
    if (!selectedTripId) return;
    const res = await apiFetch<RecordEntry[]>(supabase, `/api/records?tripId=${selectedTripId}`, { method: 'GET' });
    if (res.ok && res.data) {
      setRecords(res.data);
    }
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (!requireSignIn()) return;
    if (!selectedTripId || !recordTitle.trim()) return;
    const mediaUrls = await filesToDataUrls(recordFiles);
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
    } else {
      setStatusMessage(res.message ?? 'Failed to save record');
    }
  }

  async function loadDiaries() {
    if (!selectedTripId) return;
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
    if (!selectedTripId) return;
    if (tripstargramMode === 'auto' && !tripstargramDiaryId) {
      setStatusMessage('Select a diary to auto-create a Tripstargram post.');
      return;
    }
    if (tripstargramMode === 'manual' && !tripstargramCaption.trim()) {
      setStatusMessage('Caption is required for manual Tripstargram posts.');
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
    } else {
      setStatusMessage(res.message ?? 'Failed to create Tripstargram post');
    }
  }

  async function saveDiary(event: FormEvent) {
    event.preventDefault();
    if (!requireSignIn()) return;
    if (!selectedTripId || !diaryTitle.trim() || !diaryContent.trim()) return;
    const mediaUrls = await filesToDataUrls(diaryFiles);
    if (audioDataUrl) {
      mediaUrls.push(audioDataUrl);
    }

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
      await loadDiaries();
    } else {
      setStatusMessage(res.message ?? 'Failed to save diary');
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
    if (!selectedTripId) return;
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
    } else {
      setStatusMessage(res.message ?? 'Failed to generate music');
    }
  }

  async function generatePlan() {
    if (!requireSignIn()) return;
    if (!selectedTripId) return;
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

    const res = await apiFetch<any>(supabase, '/api/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok && res.data) {
      setPlanResult(res.data);
      setTransportOptions(res.data.transportation || []);
    } else {
      setStatusMessage(res.message ?? 'Failed to generate plan');
    }
  }

  async function autoWeather() {
    const coord = cityCoordinates[diaryPlace];
    if (!coord) return;
    const res = await fetch(`/api/weather?lat=${coord.lat}&lng=${coord.lng}`);
    const json = (await res.json()) as { ok: boolean; data?: { emoji: string; label: string; temperatureC: number | null } };
    if (json.ok && json.data) {
      setDiaryWeatherEmoji(json.data.emoji);
      const tempText = json.data.temperatureC === null ? '' : ` (${json.data.temperatureC.toFixed(1)}°C)`;
      setDiaryWeatherLabel(`${json.data.label}${tempText}`);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) return;
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
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
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
      setStatusMessage('Profile updated.');
    } else {
      setStatusMessage(res.message ?? 'Profile update failed');
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
      setStatusMessage('Request submitted.');
    } else {
      setStatusMessage(res.message ?? 'Failed to submit request');
    }
  }

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSupportHistory();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
    scrollToSection(sectionId);
  }

  function openExtraTab(tab: ExtraTabKey, sectionId = 'extra-tabs-anchor') {
    setActiveExtraTab(tab);
    scrollToSection(sectionId);
  }

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;
  const selectedTripTitle = selectedTrip?.title ?? '';
  const canChangePackingPermission = selectedTrip?.role === 'editor';
  const activePackingKey = selectedTripId ? `${selectedTripId}:${countryCode}` : '';
  const canEditPacking = selectedTrip ? selectedTrip.role === 'editor' || selectedTrip.allowMemberPackingEdit : false;

  function updatePackingList(updater: (items: PackingItem[]) => PackingItem[]) {
    if (!activePackingKey) {
      setStatusMessage('Trip을 먼저 선택하면 여행별 준비물 체크리스트를 사용할 수 있어요.');
      return;
    }
    if (!canEditPacking) {
      setStatusMessage('Editor only: invited member edit mode가 OFF 상태입니다.');
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
      setStatusMessage('Trip을 먼저 선택해 주세요.');
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
  }

  const planPrepGuide = travelPrepGuides[countryCode] ?? travelPrepGuides.DEFAULT;
  const planPrepItems = planPrepGuide[planPrepTopic];
  const packingChecklist = activePackingKey ? packingByTrip[activePackingKey] ?? [] : [];

  return (
    <div className="tripmaster-shell">
      <header className="hero-header">
        <p className="eyebrow">TripMaster</p>
        <h1>{copy.appTitle}</h1>
        <p>{copy.appSubtitle}</p>

        <div className="toolbar">
          <label>
            Language
            <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)}>
              {languageOrder.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="translate-toggle">
            <input type="checkbox" checked={autoTranslate} onChange={(event) => setAutoTranslate(event.target.checked)} />
            Auto-translate shared content
          </label>
        </div>

        <AuthPanel supabase={supabase} language={language} currentNickname={nickname} onSignedIn={onSignedIn} onSignedOut={onSignedOut} />
        {!backendConfigured ? (
          <p className="error-text">Backend is not configured yet. Set real Supabase environment variables to enable save/login.</p>
        ) : null}
      </header>

      <section className="card trip-card">
        <h2>Trip Workspace</h2>
        <div className="trip-row">
          <label>
            Trip
            <select value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)}>
              <option value="">Select</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({trip.role})
                </option>
              ))}
            </select>
          </label>
          <label>
            New Trip Title
            <input value={newTripTitle} onChange={(event) => setNewTripTitle(event.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={createTrip} disabled={!nickname}>
            Create Trip
          </button>
        </div>
        <div className="trip-row">
          <button type="button" className="btn-secondary" onClick={createInvite} disabled={!nickname || !selectedTripId}>
            Create Invite Link
          </button>
          <input placeholder="Paste invite code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          <button type="button" className="btn-secondary" onClick={acceptInvite} disabled={!nickname}>
            Accept Invite
          </button>
        </div>
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
            Default OFF: only editor can edit. Turn ON to allow invited members too.
          </p>
        </div>
        {generatedInviteLink ? <p className="info-text">Invite: {generatedInviteLink}</p> : null}
      </section>

      {statusMessage ? <p className="status">{statusMessage}</p> : null}

      <nav className="quick-shortcuts">
        <button type="button" className="shortcut-btn" onClick={() => openExtraTab('plan', 'extra-plan-section')}>
          <span className="shortcut-emoji" aria-hidden>
            🗺️
          </span>
          <span>Plan</span>
        </button>
        <button type="button" className="shortcut-btn" onClick={() => openExtraTab('event', 'extra-event-section')}>
          <span className="shortcut-emoji" aria-hidden>
            🎉
          </span>
          <span>Event</span>
        </button>
        <button type="button" className="shortcut-btn" onClick={() => openMainTab('diary', 'tab-diary-section')}>
          <span className="shortcut-emoji" aria-hidden>
            📔
          </span>
          <span>{copy.diary}</span>
        </button>
        <button type="button" className="shortcut-btn" onClick={() => openMainTab('tripstargram', 'tab-tripstargram-section')}>
          <span className="shortcut-emoji" aria-hidden>
            📸
          </span>
          <span>{copy.tripstargram ?? 'Tripstargram'}</span>
        </button>
      </nav>

      <nav id="main-tabs-anchor" className="main-tabs">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setActiveTab(tab.key)}
          >
            {copy[tab.key] ?? tab.fallbackLabel}
          </button>
        ))}
      </nav>

      <nav id="extra-tabs-anchor" className="extra-tabs">
        {extraTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeExtraTab === tab ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setActiveExtraTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'flight' ? (
        <section className="card">
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

          <div className="result-list">
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
        </section>
      ) : null}

      {activeTab === 'hotel' ? (
        <section className="card">
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
          <div className="result-list">
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
        </section>
      ) : null}

      {activeTab === 'places' ? (
        <section className="card">
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
            <div className="result-list">
              {placesResponse.places.map((place) => (
                <article key={place.id} className="result-card">
                  <img src={place.imageUrl} alt={place.name} className="thumb" />
                  <div>
                    <strong>{place.name}</strong>
                    <p>
                      {place.city} · {place.theme} · ⭐ {place.rating}
                    </p>
                    <p>{place.summary}</p>
                    <button type="button" className="btn-secondary" onClick={() => savePlace(place)}>
                      Add to trip
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'restaurants' ? (
        <section className="card">
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
          <div className="result-list">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="result-card">
                <img src={restaurant.imageUrl} alt={restaurant.name} className="thumb" />
                <div>
                  <strong>{restaurant.name}</strong>
                  <p>
                    {restaurant.city} · {restaurant.cuisine}
                  </p>
                  <p>
                    ⭐ {restaurant.rating} ({restaurant.reviewCount})
                  </p>
                  <p>{restaurant.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'record' ? (
        <section className="card">
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
            <button type="submit" className="btn-primary" disabled={!selectedTripId}>
              Save Record
            </button>
          </form>

          <div className="result-list">
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
        <section id="tab-diary-section" className="card">
          <form onSubmit={saveDiary}>
            <label>
              Title
              <input value={diaryTitle} onChange={(event) => setDiaryTitle(event.target.value)} required />
            </label>
            <div className="grid three">
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
            <div className="grid two">
              <button type="button" className="btn-secondary" onClick={autoWeather}>
                Auto weather (Open-Meteo)
              </button>
              <p>{diaryWeatherLabel ?? 'Weather label will appear here.'}</p>
            </div>
            <label>
              Diary text
              <textarea rows={5} value={diaryContent} onChange={(event) => setDiaryContent(event.target.value)} required />
            </label>
            <label>
              Photo / Video attachments
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setDiaryFiles(event.target.files)}
              />
            </label>
            <div className="grid two">
              {!isRecording ? (
                <button type="button" className="btn-secondary" onClick={startRecording}>
                  Start Voice Recording
                </button>
              ) : (
                <button type="button" className="btn-secondary danger" onClick={stopRecording}>
                  Stop Recording
                </button>
              )}
              {audioDataUrl ? <audio controls src={audioDataUrl} /> : <p>No voice memo yet.</p>}
            </div>
            <button type="submit" className="btn-primary" disabled={!selectedTripId}>
              Save Diary
            </button>
          </form>

          <div className="result-list">
            {diaries.map((diary) => {
              const diaryJobs = musicJobs.filter((job) => job.diaryId === diary.id);
              return (
                <article key={diary.id} className="result-card">
                  <div className="result-head">
                    <div>
                      <strong>{diary.title}</strong>
                      <p>
                        {diary.date} · {diary.place} · {diary.weatherEmoji}
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
        <section id="tab-tripstargram-section" className="card">
          <h2>Tripstargram</h2>
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
            <button type="submit" className="btn-primary" disabled={!selectedTripId}>
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
        <section className="card">
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
        <section className="card">
          <h2>Settings</h2>
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

      {activeExtraTab === 'information' ? (
        <section className="card">
          <h2>Information</h2>
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
          {informationData ? (
            <article className="result-card">
              <strong>
                {informationData.country} · {informationData.city}
              </strong>
              <p>{informationData.text}</p>
            </article>
          ) : (
            <p>No information yet.</p>
          )}
        </section>
      ) : null}

      {activeExtraTab === 'plan' ? (
        <section id="extra-plan-section" className="card">
          <h2>Plan</h2>
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
          <button type="button" className="btn-primary" onClick={generatePlan} disabled={!selectedTripId}>
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

      {activeExtraTab === 'transportation' ? (
        <section className="card">
          <h2>Transportation</h2>
          <div className="result-list">
            {transportOptions.map((option) => (
              <article key={`${option.mode}-${option.bookingUrl}`} className="result-card">
                <strong>{option.mode}</strong>
                <p>{option.reason}</p>
                <p>{option.estimatedCost}</p>
                <a href={option.bookingUrl} target="_blank" rel="noreferrer">
                  Open booking
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeExtraTab === 'tips' ? (
        <section className="card">
          <h2>Tips</h2>
          <p>Community + global travel tips in friendly iMessage-like bubbles.</p>
          <div className="tips-bubbles">
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
        <section className="card">
          <h2>Entertainment</h2>
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

      {activeExtraTab === 'event' ? (
        <section id="extra-event-section" className="card">
          <h2>Event</h2>
          <p>
            Latest planned exhibitions/performances for {placesCity} ({countryCode}) · source: {eventsSource}
          </p>
          <div className="result-list">
            {events.map((event) => (
              <article key={event.id} className="result-card">
                <strong>{event.title}</strong>
                <p>
                  {event.category} · {event.date}
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
