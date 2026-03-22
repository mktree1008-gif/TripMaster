'use client';

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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

function buildTagCandidates(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .slice(0, 10);
  return Array.from(new Set(words)).map((word) => `#${word}`);
}

function parseTagInput(text: string) {
  const tokens = text
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const normalized = tokens.map((token) => (token.startsWith('#') ? token : `#${token}`));
  return Array.from(new Set(normalized));
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
const tripstargramDraftStoragePrefix = 'tripmaster-tripstargram-drafts-v1:';
const tripstargramMetaStoragePrefix = 'tripmaster-tripstargram-meta-v1:';
const tripstargramReactionStoragePrefix = 'tripmaster-tripstargram-reactions-v1:';

const tripstargramReactionOptions = ['❤️', '✈️', '😍', '📍', '🍜', '🌅', '😂'] as const;
const tripstargramVibePresets = ['Soft memory', 'Bright city', 'Sunset journal', 'Cozy food moment', 'Adventure day', 'Quiet reflection'];
const tripstargramEffectPresets = ['Warm film', 'Soft fade', 'Vivid daylight', 'Night glow', 'Clean natural'];

type TripstargramReactionEmoji = (typeof tripstargramReactionOptions)[number];

interface TripstargramDraft {
  id: string;
  mode: 'auto' | 'manual';
  diaryId: string;
  caption: string;
  tags: string[];
  emojis: string[];
  vibe: string;
  effect: string;
  collaborators: string[];
  visibility: 'tripmates' | 'private' | 'public';
  createdAt: string;
}

interface TripstargramPostMeta {
  collaborators: string[];
  vibe: string;
  effect: string;
  emojis: string[];
  visibility: 'tripmates' | 'private' | 'public';
  coEditEnabled: boolean;
}

interface TripstargramReactionState {
  counts: Partial<Record<TripstargramReactionEmoji, number>>;
  selectedEmoji: TripstargramReactionEmoji | null;
}

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface AppShellProps {
  topHeroHeader: ReactNode;
  tripWorkspaceSection: ReactNode;
  primaryTabBar: ReactNode;
  mobileExperienceStrip?: ReactNode;
  activePage: ReactNode;
  statusToast?: ReactNode;
}

function AppShell({ topHeroHeader, tripWorkspaceSection, primaryTabBar, mobileExperienceStrip, activePage, statusToast }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ecf4ff_0%,#f7fbff_38%,#ffffff_100%)] text-slate-900">
      <BackgroundLayer />
      {statusToast}
      <div className="relative z-10">
        {topHeroHeader}
        <main className="tripmaster-main-shell mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-8">
          <div className="tripmaster-content-stack">
            {tripWorkspaceSection}
            {primaryTabBar}
            {mobileExperienceStrip}
            {activePage}
          </div>
        </main>
      </div>
    </div>
  );
}

function BackgroundLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_9%,rgba(120,219,239,0.34),transparent_26%),radial-gradient(circle_at_82%_11%,rgba(122,188,255,0.28),transparent_30%),radial-gradient(circle_at_55%_88%,rgba(155,228,236,0.21),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(78,180,236,0.21),rgba(78,180,236,0.02)_80%,transparent)]" />
      <div className="absolute -left-20 top-14 h-72 w-72 rounded-[44%] bg-cyan-200/26 blur-2xl" />
      <div className="absolute right-[-60px] top-44 h-80 w-80 rounded-[46%] bg-blue-200/30 blur-2xl" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(rgba(45,117,170,0.22)_0.6px,transparent_0.6px)] [background-size:22px_22px]" />
      <div className="absolute inset-x-[8%] top-[24%] h-px bg-[linear-gradient(90deg,transparent,rgba(77,158,207,0.35),transparent)]" />
      <div className="absolute inset-x-[12%] top-[58%] h-px bg-[linear-gradient(90deg,transparent,rgba(104,179,215,0.24),transparent)]" />
    </div>
  );
}

function HeaderIconButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-base backdrop-blur-md transition-all duration-200',
        active
          ? 'border-sky-300/70 bg-sky-50 text-[#0d3d72] shadow-[0_10px_20px_rgba(44,110,169,0.24)]'
          : 'border-sky-200/80 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-sky-300 hover:text-[#0d3f74]'
      )}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

function PrimaryButton({ children, type = 'button', onClick }: { children: ReactNode; type?: 'button' | 'submit'; onClick?: () => void }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f4ed8,#0ea5a7)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,78,216,0.26)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,67,145,0.28)]"
    >
      {children}
    </button>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'glass-card-base rounded-[30px] border border-white/70 bg-white/78 p-6 shadow-[0_14px_40px_rgba(11,33,66,0.11)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </section>
  );
}

function TripWorkspaceSection({ children }: { children: ReactNode }) {
  return (
    <section className="trip-workspace-block">
      <div className="trip-workspace-head mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Trip Workspace</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">Command center before departure</h2>
        <p className="mt-1 text-sm text-slate-500">
          Keep current trip context, create and join flows, and collaboration controls in one structured premium workspace.
        </p>
      </div>
      {children}
    </section>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/70">{children}</p>;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold text-sky-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {children}
    </span>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-sky-100 bg-white/90 px-4 py-3 shadow-[0_8px_18px_rgba(18,78,129,0.08)]">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function PrimaryTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ key: TabKey; label: string; icon: string }>;
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <div className="primary-tab-shell relative overflow-hidden rounded-[30px] border border-[#a9c9e7]/60 bg-[linear-gradient(140deg,rgba(9,48,104,0.94),rgba(19,96,158,0.9))] p-2 shadow-[0_18px_38px_rgba(4,32,78,0.3)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(126,200,255,0.18),transparent_30%),radial-gradient(circle_at_8%_86%,rgba(118,219,210,0.14),transparent_34%)]" />
      <div className="primary-tab-grid relative grid grid-cols-2 gap-2 md:grid-cols-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              className={cn(
                'primary-tab-btn group flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold tracking-[0.01em] transition-all duration-200',
                isActive
                  ? 'bg-white text-[#0f4478] shadow-[0_12px_26px_rgba(9,32,71,0.36)]'
                  : 'bg-white/10 text-sky-50 hover:-translate-y-0.5 hover:bg-white/18'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'primary-tab-icon inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[1.02rem] transition',
                  isActive ? 'border-sky-200/80 bg-sky-50/80' : 'border-white/35 bg-white/20 group-hover:bg-white/28'
                )}
              >
                {tab.icon}
              </span>
              <span className="primary-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="page-header-block mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/60">Workspace</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SubTabBar({
  items,
  active,
}: {
  items: Array<{ key: string; label: string; icon?: string; onClick: () => void }>;
  active: string;
}) {
  return (
    <div className="subtab-shell mt-4 flex flex-wrap items-center gap-2 rounded-2xl p-2">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              'subtab-item inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'active border border-transparent text-white shadow-[0_8px_20px_rgba(19,88,168,0.25)]'
                : 'text-slate-600'
            )}
          >
            {item.icon ? <span aria-hidden>{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const mobileInspirationCards: Array<{ key: TabKey; title: string; subtitle: string; imageUrl: string; badge: string }> = [
  {
    key: 'flight',
    title: 'Flight Mobile',
    subtitle: 'Boarding pass and departure timeline',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46915034/file/98baa819e35f6a3f911d0e7b1c48b741.png?crop=195x0-2813x1964&format=webp&resize=1200x900&vertical=center',
    badge: '✈️',
  },
  {
    key: 'hotel',
    title: 'Hotel Mobile',
    subtitle: 'Reservation card and stay details',
    imageUrl:
      'https://cdn.dribbble.com/userupload/42973342/file/original-dbc11cdaa4615b18c15e2be25007e3ae.png?format=webp&resize=1200x900&vertical=center',
    badge: '🏨',
  },
  {
    key: 'places',
    title: 'Plan Mobile',
    subtitle: 'Map-style cards for places and routes',
    imageUrl:
      'https://cdn.dribbble.com/userupload/46906420/file/b54c5f45d656929e83aa8a65ebb4ac51.jpg?format=webp&resize=1200x900&vertical=center',
    badge: '🧭',
  },
  {
    key: 'diary',
    title: 'Diary Mobile',
    subtitle: 'Warm journal card with media and voice',
    imageUrl:
      'https://images.squarespace-cdn.com/content/v1/603fd2e6b89a792feb000f9c/ab985b3c-d3da-474c-b3ca-332671b5e975/weekly%2Bmemory%2Bkeeper%2Bdigital%2Bjournal.jpg',
    badge: '📔',
  },
];

function MobileExperienceStrip({
  activeTab,
  onSelect,
}: {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <section className="mobile-experience-strip mobile-reference-themed rounded-[30px] border border-white/70 bg-white/78 p-4 shadow-[0_16px_38px_rgba(14,35,68,0.1)] backdrop-blur-xl">
      <div className="mobile-experience-head">
        <div>
          <p className="mobile-experience-kicker">Mobile-Led Design Direction</p>
          <h3>Mobile flow inspired by Flight, Hotel, Plan, and Diary apps</h3>
        </div>
        <p className="mobile-experience-note">Tap a card to jump directly into that tab experience.</p>
      </div>
      <div className="mobile-experience-grid">
        {mobileInspirationCards.map((card) => {
          const isActive = activeTab === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelect(card.key)}
              className={cn('mobile-experience-card', isActive && 'active')}
            >
              <div className="mobile-experience-frame">
                <img src={card.imageUrl} alt={card.title} />
                <div className="mobile-experience-overlay">
                  <span>{card.badge}</span>
                  <strong>{card.title}</strong>
                  <p>{card.subtitle}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SectionMobileHero({
  title,
  subtitle,
  imageUrl,
  chips,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  chips: string[];
}) {
  return (
    <article className="section-mobile-hero">
      <img src={imageUrl} alt={title} />
      <div className="section-mobile-hero-overlay">
        <p className="section-mobile-hero-kicker">Mobile UX Pattern</p>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <div className="section-mobile-chip-row">
          {chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function TopHeroHeader({
  language,
  onLanguageChange,
  onProfileClick,
  onSettingsClick,
  profileActive,
  settingsActive,
  nickname,
  selectedTripTitle,
  autoTranslate,
  onAutoTranslateChange,
  onAuthToggle,
  isAuthOpen,
  backendConfigured,
  onBrandClick,
}: {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  profileActive: boolean;
  settingsActive: boolean;
  nickname: string | null;
  selectedTripTitle: string;
  autoTranslate: boolean;
  onAutoTranslateChange: (next: boolean) => void;
  onAuthToggle: () => void;
  isAuthOpen: boolean;
  backendConfigured: boolean;
  onBrandClick: () => void;
}) {
  return (
    <header className="hero-airlink-shell">
      <div className="hero-airlink-overlay" />
      <div className="hero-airlink-wave" />
      <div className="hero-airlink-wave second" />
      <div className="hero-airlink-inner">
        <div className="hero-airlink-card">
          <div className="hero-airlink-topbar">
            <button type="button" onClick={onBrandClick} className="hero-airlink-brand">
              ✈ TripMaster
            </button>
            <nav className="hero-airlink-links" aria-label="Hero quick links">
              <span>Home</span>
              <span>Flight</span>
              <span>Hotel</span>
              <span>Plan</span>
              <span>Information</span>
            </nav>
            <div className="hero-airlink-utils">
              <label className="hero-airlink-language">
                <span aria-hidden>🌐</span>
                <select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguageCode)} aria-label="Language">
                  {languageOrder.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <HeaderIconButton icon="👤" label="Profile" active={profileActive} onClick={onProfileClick} />
              <HeaderIconButton icon="⚙️" label="Settings" active={settingsActive} onClick={onSettingsClick} />
              <button type="button" className="hero-airlink-auth" onClick={onAuthToggle}>
                {isAuthOpen ? 'Close' : 'Account'}
              </button>
            </div>
          </div>

          <div className="hero-airlink-main">
            <div className="hero-airlink-visual">
              <img
                src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80"
                alt="Airplane in sky"
              />
              <div className="hero-airlink-chip-row">
                <span>{selectedTripTitle || 'No trip selected'}</span>
                <span>{nickname ? `@${nickname}` : 'Guest mode'}</span>
              </div>
            </div>
            <div className="hero-airlink-copy">
              <p className="hero-airlink-kicker">Aero Dashboard</p>
              <h1>Your Ticket to Explore the World</h1>
              <p>
                Premium planning with flight, hotel, planning, and local insight workflows in one destination-focused interface.
              </p>
              <div className="hero-airlink-status">
                <article>
                  <small>Trip</small>
                  <strong>{selectedTripTitle || 'Select workspace'}</strong>
                </article>
                <article>
                  <small>Translate</small>
                  <strong>{autoTranslate ? 'Enabled' : 'Disabled'}</strong>
                </article>
                <article>
                  <small>Profile</small>
                  <strong>{nickname ?? 'Not signed in'}</strong>
                </article>
              </div>
            </div>
          </div>

          <div className="hero-airlink-searchdock">
            <div className="hero-airlink-field">
              <span>From</span>
              <strong>Choose departure</strong>
            </div>
            <div className="hero-airlink-field">
              <span>To</span>
              <strong>Destination city</strong>
            </div>
            <div className="hero-airlink-field">
              <span>Departure</span>
              <strong>Pick a date</strong>
            </div>
            <div className="hero-airlink-field">
              <span>Return</span>
              <strong>Pick a date</strong>
            </div>
            <button type="button" className="hero-airlink-searchbtn" onClick={onBrandClick}>
              Explore
            </button>
            <label className="hero-airlink-toggle">
              <input type="checkbox" checked={autoTranslate} onChange={(event) => onAutoTranslateChange(event.target.checked)} />
              Auto-translate
            </label>
          </div>

          {!backendConfigured ? (
            <p className="hero-airlink-warning">
              Backend is not configured yet. Set real Supabase environment variables to enable save/login.
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
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
  const [tripstargramVibe, setTripstargramVibe] = useState(tripstargramVibePresets[0]);
  const [tripstargramEffect, setTripstargramEffect] = useState(tripstargramEffectPresets[0]);
  const [tripstargramSelectedEmojis, setTripstargramSelectedEmojis] = useState<string[]>(['🌅', '✈️']);
  const [tripstargramSuggestedTags, setTripstargramSuggestedTags] = useState<string[]>([]);
  const [tripstargramCustomTags, setTripstargramCustomTags] = useState('');
  const [tripstargramCoEditorInput, setTripstargramCoEditorInput] = useState('');
  const [tripstargramCoEditors, setTripstargramCoEditors] = useState<string[]>([]);
  const [tripstargramAllowCoEdit, setTripstargramAllowCoEdit] = useState(true);
  const [tripstargramVisibility, setTripstargramVisibility] = useState<'tripmates' | 'private' | 'public'>('tripmates');
  const [tripstargramDraftGenerated, setTripstargramDraftGenerated] = useState(false);
  const [tripstargramDrafts, setTripstargramDrafts] = useState<TripstargramDraft[]>([]);
  const [tripstargramPostMeta, setTripstargramPostMeta] = useState<Record<string, TripstargramPostMeta>>({});
  const [tripstargramReactionMap, setTripstargramReactionMap] = useState<Record<string, TripstargramReactionState>>({});
  const [tripstargramReactionTrayPostId, setTripstargramReactionTrayPostId] = useState<string | null>(null);
  const [tripstargramPreviewUrl, setTripstargramPreviewUrl] = useState<string | null>(null);
  const [tripstargramPreviewIsVideo, setTripstargramPreviewIsVideo] = useState(false);
  const [tripstargramFeedFilter, setTripstargramFeedFilter] = useState<'latest' | 'from-diary' | 'shared'>('latest');
  const tripstargramLongPressTimerRef = useRef<number | null>(null);
  const tripstargramLongPressTriggeredRef = useRef(false);

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
    if (!selectedTripId) {
      setTripstargramDrafts([]);
      setTripstargramPostMeta({});
      setTripstargramReactionMap({});
      setTripstargramReactionTrayPostId(null);
      return;
    }
    setTripstargramDrafts(readLocalJson<TripstargramDraft[]>(`${tripstargramDraftStoragePrefix}${selectedTripId}`, []));
    setTripstargramPostMeta(readLocalJson<Record<string, TripstargramPostMeta>>(`${tripstargramMetaStoragePrefix}${selectedTripId}`, {}));
    setTripstargramReactionMap(
      readLocalJson<Record<string, TripstargramReactionState>>(`${tripstargramReactionStoragePrefix}${selectedTripId}`, {})
    );
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTripId) return;
    writeLocalJson(`${tripstargramDraftStoragePrefix}${selectedTripId}`, tripstargramDrafts);
  }, [selectedTripId, tripstargramDrafts]);

  useEffect(() => {
    if (!selectedTripId) return;
    writeLocalJson(`${tripstargramMetaStoragePrefix}${selectedTripId}`, tripstargramPostMeta);
  }, [selectedTripId, tripstargramPostMeta]);

  useEffect(() => {
    if (!selectedTripId) return;
    writeLocalJson(`${tripstargramReactionStoragePrefix}${selectedTripId}`, tripstargramReactionMap);
  }, [selectedTripId, tripstargramReactionMap]);

  useEffect(() => {
    if (!tripstargramFiles?.length) {
      setTripstargramPreviewUrl(null);
      setTripstargramPreviewIsVideo(false);
      return;
    }
    const firstFile = tripstargramFiles.item(0);
    if (!firstFile) {
      setTripstargramPreviewUrl(null);
      setTripstargramPreviewIsVideo(false);
      return;
    }
    const objectUrl = URL.createObjectURL(firstFile);
    setTripstargramPreviewUrl(objectUrl);
    setTripstargramPreviewIsVideo(firstFile.type.startsWith('video/'));
    return () => URL.revokeObjectURL(objectUrl);
  }, [tripstargramFiles]);

  useEffect(
    () => () => {
      if (tripstargramLongPressTimerRef.current) {
        window.clearTimeout(tripstargramLongPressTimerRef.current);
      }
    },
    []
  );

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

  function getSelectedTripstargramDiary() {
    if (!diaries.length) return null;
    return diaries.find((entry) => entry.id === tripstargramDiaryId) ?? diaries[0];
  }

  function toggleTripstargramEmoji(emoji: string) {
    setTripstargramSelectedEmojis((prev) => {
      if (prev.includes(emoji)) {
        const next = prev.filter((item) => item !== emoji);
        return next.length ? next : [emoji];
      }
      return [...prev, emoji];
    });
  }

  function toggleTripstargramSuggestedTag(tag: string) {
    setTripstargramSuggestedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

  function addTripstargramCoEditor() {
    const normalized = tripstargramCoEditorInput.trim().replace(/^@/, '');
    if (!normalized) return;
    setTripstargramCoEditors((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setTripstargramCoEditorInput('');
  }

  function removeTripstargramCoEditor(name: string) {
    setTripstargramCoEditors((prev) => prev.filter((item) => item !== name));
  }

  function buildTripstargramDiaryDraft(diary: DiaryEntry) {
    const cleanContent = diary.content.replace(/\s+/g, ' ').trim();
    const excerpt = cleanContent.length > 220 ? `${cleanContent.slice(0, 217)}...` : cleanContent;
    const emojiPrefix = tripstargramSelectedEmojis.join(' ');
    const caption = [
      `${emojiPrefix} ${diary.title} • ${diary.place}`.trim(),
      excerpt,
      `Mood preset: ${tripstargramVibe}`,
    ]
      .filter(Boolean)
      .join('\n');

    const tags = buildTagCandidates(`${diary.title} ${diary.place} ${diary.content} ${tripstargramVibe}`).slice(0, 7);
    return { caption, tags };
  }

  function generateTripstargramDraftFromDiary() {
    const diary = getSelectedTripstargramDiary();
    if (!diary) {
      showStatus('Create a diary first to use AI draft mode.');
      return;
    }
    const draft = buildTripstargramDiaryDraft(diary);
    setTripstargramMode('auto');
    setTripstargramDiaryId(diary.id);
    setTripstargramCaption(draft.caption);
    setTripstargramSuggestedTags(draft.tags);
    setTripstargramCustomTags('');
    setTripstargramDraftGenerated(true);
    showStatus('AI-style draft generated from your diary. Review and edit before publishing.', 'success');
  }

  function switchTripstargramToManual() {
    setTripstargramMode('manual');
    setTripstargramDraftGenerated(false);
    setTripstargramDiaryId('');
    if (!tripstargramCaption.trim()) {
      setTripstargramSuggestedTags([]);
    }
  }

  function saveTripstargramDraftLocally() {
    if (!tripstargramCaption.trim()) {
      showStatus('Add a caption first, then save a draft.');
      return;
    }
    const draft: TripstargramDraft = {
      id: `tripstargram-draft-${Date.now()}`,
      mode: tripstargramMode,
      diaryId: tripstargramDiaryId,
      caption: tripstargramCaption.trim(),
      tags: Array.from(new Set([...tripstargramSuggestedTags, ...parseTagInput(tripstargramCustomTags)])).slice(0, 10),
      emojis: tripstargramSelectedEmojis,
      vibe: tripstargramVibe,
      effect: tripstargramEffect,
      collaborators: tripstargramCoEditors,
      visibility: tripstargramVisibility,
      createdAt: new Date().toISOString(),
    };
    setTripstargramDrafts((prev) => [draft, ...prev].slice(0, 8));
    showStatus('Tripstargram draft saved locally.', 'success');
  }

  function applySavedTripstargramDraft(draft: TripstargramDraft) {
    setTripstargramMode(draft.mode);
    setTripstargramDiaryId(draft.diaryId);
    setTripstargramCaption(draft.caption);
    setTripstargramSuggestedTags(draft.tags);
    setTripstargramCustomTags('');
    setTripstargramSelectedEmojis(draft.emojis.length ? draft.emojis : ['🌅', '✈️']);
    setTripstargramVibe(draft.vibe);
    setTripstargramEffect(draft.effect);
    setTripstargramCoEditors(draft.collaborators);
    setTripstargramVisibility(draft.visibility);
    setTripstargramDraftGenerated(draft.mode === 'auto');
    showStatus('Saved draft loaded into the editor.');
  }

  function removeSavedTripstargramDraft(draftId: string) {
    setTripstargramDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  }

  function applyTripstargramReaction(postId: string, emoji: TripstargramReactionEmoji) {
    setTripstargramReactionMap((prev) => {
      const current = prev[postId] ?? { counts: {}, selectedEmoji: null };
      if (current.selectedEmoji === emoji) {
        return prev;
      }
      const counts: Partial<Record<TripstargramReactionEmoji, number>> = { ...current.counts };
      if (current.selectedEmoji) {
        const nextValue = Math.max((counts[current.selectedEmoji] ?? 1) - 1, 0);
        if (nextValue === 0) {
          delete counts[current.selectedEmoji];
        } else {
          counts[current.selectedEmoji] = nextValue;
        }
      }
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      return {
        ...prev,
        [postId]: {
          counts,
          selectedEmoji: emoji,
        },
      };
    });
    setTripstargramReactionTrayPostId(null);
  }

  function cancelTripstargramLongPress() {
    if (tripstargramLongPressTimerRef.current) {
      window.clearTimeout(tripstargramLongPressTimerRef.current);
      tripstargramLongPressTimerRef.current = null;
    }
  }

  function onTripstargramReactionPointerDown(postId: string) {
    cancelTripstargramLongPress();
    tripstargramLongPressTriggeredRef.current = false;
    tripstargramLongPressTimerRef.current = window.setTimeout(() => {
      tripstargramLongPressTriggeredRef.current = true;
      setTripstargramReactionTrayPostId(postId);
    }, 450);
  }

  function onTripstargramReactionPointerUp(postId: string) {
    cancelTripstargramLongPress();
    if (!tripstargramLongPressTriggeredRef.current) {
      applyTripstargramReaction(postId, '❤️');
    }
    tripstargramLongPressTriggeredRef.current = false;
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

    const emojiLine = tripstargramSelectedEmojis.join(' ').trim();
    const activeTags = Array.from(new Set([...tripstargramSuggestedTags, ...parseTagInput(tripstargramCustomTags)])).slice(0, 10);
    const tagLine = activeTags.join(' ').trim();
    const userCaption = tripstargramCaption.trim();
    const shouldDecorateCaption = tripstargramMode === 'manual' || tripstargramDraftGenerated || Boolean(userCaption) || Boolean(tagLine);
    const composedCaption = shouldDecorateCaption ? [emojiLine, userCaption, tagLine].filter(Boolean).join('\n') : userCaption;
    const mediaUrls = await filesToDataUrls(tripstargramFiles);
    const res = await apiFetch<TripstargramPost>(supabase, '/api/tripstargram', {
      method: 'POST',
      body: JSON.stringify({
        tripId: selectedTripId,
        mode: tripstargramMode,
        diaryId: tripstargramMode === 'auto' ? tripstargramDiaryId : undefined,
        caption: composedCaption || undefined,
        mediaUrl: mediaUrls[0] ?? null,
      }),
    });

    if (res.ok && res.data) {
      const createdPost = res.data;
      setTripstargramPostMeta((prev) => ({
        ...prev,
        [createdPost.id]: {
          collaborators: tripstargramCoEditors,
          vibe: tripstargramVibe,
          effect: tripstargramEffect,
          emojis: tripstargramSelectedEmojis,
          visibility: tripstargramVisibility,
          coEditEnabled: tripstargramAllowCoEdit,
        },
      }));
      setTripstargramCaption('');
      setTripstargramFiles(null);
      setTripstargramPreviewUrl(null);
      setTripstargramPreviewIsVideo(false);
      setTripstargramCustomTags('');
      setTripstargramSuggestedTags([]);
      setTripstargramCoEditors([]);
      setTripstargramDraftGenerated(false);
      setTripstargramReactionTrayPostId(null);
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
    setShowAuthPanel((prev) => !prev || !nickname);
    scrollToSection('account-panel-anchor');
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
      showStatus('Select a trip first to manage the per-trip packing checklist.');
      return;
    }
    if (!canEditPacking) {
      showStatus('Editor only: invited member edit mode is currently OFF.');
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
      showStatus('Please select a trip first.');
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
  const selectedPlaceDetail =
    placesForDisplay.find((place) => selectedPlaceNames.includes(place.name)) ?? placesForDisplay[0] ?? null;
  const selectedRestaurantDetail = restaurants[0] ?? null;
  const primaryNavTabs = [
    { key: 'flight' as TabKey, label: 'Flight', icon: '✈️' },
    { key: 'hotel' as TabKey, label: 'Hotel', icon: '🏨' },
    { key: 'places' as TabKey, label: 'PlanHelper', icon: '🧭' },
    { key: 'restaurants' as TabKey, label: 'Information', icon: 'ℹ️' },
  ];
  const activePrimaryTab: TabKey = ['flight', 'hotel', 'places', 'restaurants'].includes(activeTab) ? activeTab : 'flight';
  const planHelperSubTabItems = [
    { key: 'places', label: 'Places', icon: '📍', onClick: () => setPlanHelperSubTab('places') },
    {
      key: 'activities',
      label: 'Activities',
      icon: '🧗',
      onClick: () => {
        setPlanHelperSubTab('activities');
        setPlacesTheme('activity');
      },
    },
    { key: 'restaurants', label: 'Restaurants', icon: '🍽️', onClick: () => setPlanHelperSubTab('restaurants') },
    { key: 'transportation', label: 'Transportation', icon: '🚄', onClick: () => setPlanHelperSubTab('transportation') },
  ];
  const informationSubTabItems = [
    { key: 'information', label: 'Information', icon: '🌍', onClick: () => setInformationSubTab('information') },
    { key: 'event', label: 'Events / Festival', icon: '🎫', onClick: () => setInformationSubTab('event') },
    { key: 'tips', label: 'Tips', icon: '💬', onClick: () => setInformationSubTab('tips') },
  ];
  const selectedTripstargramDiary = getSelectedTripstargramDiary();
  const tripstargramEditorTags = Array.from(new Set([...tripstargramSuggestedTags, ...parseTagInput(tripstargramCustomTags)])).slice(0, 10);
  const tripstargramPreviewCaption = [tripstargramSelectedEmojis.join(' '), tripstargramCaption.trim(), tripstargramEditorTags.join(' ')]
    .filter(Boolean)
    .join('\n');
  const filteredTripstargramPosts = tripstargramPosts.filter((post) => {
    if (tripstargramFeedFilter === 'from-diary') {
      return Boolean(post.diaryId);
    }
    if (tripstargramFeedFilter === 'shared') {
      return Boolean(tripstargramPostMeta[post.id]?.collaborators.length);
    }
    return true;
  });

  return (
    <AppShell
      statusToast={
        statusToast ? (
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
        ) : null
      }
      topHeroHeader={
        <TopHeroHeader
          language={language}
          onLanguageChange={setLanguage}
          onProfileClick={() => (nickname ? openAccountTab('profile') : openLoginPanelFromMenu())}
          onSettingsClick={() => (nickname ? openAccountTab('settings') : openLoginPanelFromMenu())}
          profileActive={activeTab === 'profile'}
          settingsActive={activeTab === 'settings'}
          nickname={nickname}
          selectedTripTitle={selectedTripTitle}
          autoTranslate={autoTranslate}
          onAutoTranslateChange={setAutoTranslate}
          onAuthToggle={openLoginPanelFromMenu}
          isAuthOpen={showAuthPanel}
          onBrandClick={() => scrollToSection('main-tabs-anchor')}
          backendConfigured={backendConfigured}
        />
      }
      tripWorkspaceSection={
        <TripWorkspaceSection>
          <div className="grid gap-4 lg:grid-cols-12">
            <GlassCard className="lg:col-span-4 workspace-current-card">
              <SectionEyebrow>Current Trip</SectionEyebrow>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{selectedTripTitle || 'Choose your trip workspace'}</h2>
              <p className="mt-1 text-sm text-slate-500">Lock your trip context first, then keep all tools aligned to that single source.</p>
              <label className="mt-4 block text-sm text-slate-600">
                Select trip
                <select className="mt-2 w-full" value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)}>
                  <option value="">Select</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title} ({trip.role})
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 space-y-2">
                <MiniInfo label="Role" value={selectedTrip ? selectedTrip.role.toUpperCase() : 'None'} />
                <MiniInfo label="Destination" value={selectedTrip?.destinationCountry ?? 'Unset'} />
                <MiniInfo label="Flight mode" value={flightTripType} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip>{selectedTrip ? selectedTrip.role.toUpperCase() : 'Role not selected'}</Chip>
                <Chip>{selectedTrip ? selectedTrip.destinationCountry ?? 'Country not set' : 'Country not set'}</Chip>
                <Chip>{flightTripType}</Chip>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {selectedTrip
                  ? 'Trip context loaded. You can now manage invites and planning cards.'
                  : 'Choose a trip to manage invites, packing permissions, and shared history.'}
              </p>
              <button
                type="button"
                className="btn-secondary danger mt-4 w-full"
                onClick={deleteSelectedTrip}
                disabled={!selectedTripId || deletingTrip || deletingAllTrips}
              >
                Delete Selected Trip
              </button>
            </GlassCard>

            <GlassCard className="lg:col-span-5 workspace-create-card">
              <SectionEyebrow>Create / Join</SectionEyebrow>
              <p className="mt-1 text-sm text-slate-500">Create a new trip or join instantly with an invite code.</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-[0_8px_18px_rgba(15,70,126,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700/75">Create</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input value={newTripTitle} onChange={(event) => setNewTripTitle(event.target.value)} placeholder="New trip title" />
                    <PrimaryButton onClick={createTrip}>Create Trip</PrimaryButton>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-[0_8px_18px_rgba(15,70,126,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700/75">Join</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input placeholder="Paste invite code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
                    <button type="button" className="btn-secondary" onClick={acceptInvite}>
                      Accept Invite
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="lg:col-span-3 workspace-collab-card">
              <SectionEyebrow>Collaboration</SectionEyebrow>
              <p className="mt-1 text-sm text-slate-500">Share planning with tripmates and control editing permissions.</p>
              <button type="button" className="btn-primary mt-4 w-full" onClick={createInvite} disabled={!nickname || !selectedTripId}>
                Create Invite Link
              </button>
              <div className="mt-4 rounded-2xl border border-sky-100 bg-white/86 p-3 shadow-[0_8px_18px_rgba(15,70,126,0.07)]">
                <p className="text-sm font-semibold text-slate-800">Invited member packing permissions</p>
                <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedTrip?.allowMemberPackingEdit)}
                    onChange={(event) => updateTripPackingPermission(event.target.checked)}
                    disabled={!selectedTripId || !canChangePackingPermission || updatingPackingPermission}
                  />
                  <span>{selectedTrip?.allowMemberPackingEdit ? 'ON' : 'OFF'}</span>
                </label>
                <p className="mt-1 text-xs text-slate-500">Default is OFF. Turn it ON to let invited members edit.</p>
              </div>
              {generatedInviteLink ? (
                <p className="info-text mt-3">
                  Invite link
                  <br />
                  {generatedInviteLink}
                </p>
              ) : null}
              <button
                type="button"
                className="btn-secondary danger mt-3 w-full"
                onClick={deleteAllTrips}
                disabled={!trips.length || deletingTrip || deletingAllTrips}
              >
                Delete All My Trips
              </button>
            </GlassCard>
          </div>
        </TripWorkspaceSection>
      }
      primaryTabBar={
        <div id="main-tabs-anchor" className="space-y-3">
          <PrimaryTabBar tabs={primaryNavTabs} active={activePrimaryTab} onSelect={onMainNavSelect} />
          {showMobileMenu ? (
            <div className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Menu</p>
              <div className="grid grid-cols-2 gap-2">
                {mainTabs.map((tab) => (
                  <button
                    key={`mobile-main-${tab.key}`}
                    type="button"
                    className={cn(
                      'rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600',
                      activeTab === tab.key && 'bg-slate-900 text-white'
                    )}
                    onClick={() => onMobileMainTabSelect(tab.key)}
                  >
                    {tab.icon} {tab.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end md:hidden">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
              aria-label="Open tab menu"
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              Menu {showMobileMenu ? '▲' : '▼'}
            </button>
          </div>
        </div>
      }
      mobileExperienceStrip={<MobileExperienceStrip activeTab={activeTab} onSelect={(tab) => openMainTab(tab)} />}
      activePage={
        <div className="space-y-5">
          {showAuthPanel ? (
            <GlassCard className="max-w-3xl">
              <div id="account-panel-anchor" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <SectionEyebrow>Account</SectionEyebrow>
                    <p className="mt-1 text-sm text-slate-500">Sign in, create account, or manage your current session.</p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setShowAuthPanel(false)}>
                    Close
                  </button>
                </div>
                <AuthPanel
                  supabase={supabase}
                  language={language}
                  currentNickname={nickname}
                  onSignedIn={onSignedIn}
                  onSignedOut={onSignedOut}
                />
              </div>
            </GlassCard>
          ) : null}

          {activeTab === 'flight' || activeTab === 'hotel' || activeTab === 'places' || activeTab === 'restaurants' ? (
            <GlassCard className="journey-tools-card journey-studio-themed">
              <SectionEyebrow>Journey Studio</SectionEyebrow>
              <p className="mt-1 text-sm text-slate-500">Jump quickly between record, diary, and feed experiences.</p>
              <div className="journey-tools-row mt-3">
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
            </GlassCard>
          ) : null}

      {activeTab === 'flight' ? (
        <section className="card section-card glass-card flight-themed-section">
          <SectionMobileHero
            title="Flight App Flow"
            subtitle="Boarding-pass summary, departure timeline, and fare comparison cards"
            imageUrl="https://cdn.dribbble.com/userupload/46915034/file/98baa819e35f6a3f911d0e7b1c48b741.png?crop=195x0-2813x1964&format=webp&resize=1200x900&vertical=center"
            chips={['Boarding pass', 'Timeline', 'Price compare']}
          />
          <PageHeader title="Flight" description="Search and compare flights, then lock the best option for this trip." />
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
                <p className="empty-state-text">Add your first flight to complete your trip flow.</p>
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
              {flightResults.length === 0 ? <p className="empty-state-text">No flight results yet. Try a different route or date.</p> : null}
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
        <section className="card section-card glass-card hotel-themed-section">
          <SectionMobileHero
            title="Hotel App Flow"
            subtitle="Reservation cards, stay details, and check-in notes in a mobile-like flow"
            imageUrl="https://cdn.dribbble.com/userupload/42973342/file/original-dbc11cdaa4615b18c15e2be25007e3ae.png?format=webp&resize=1200x900&vertical=center"
            chips={['Reservation', 'Stay detail', 'Check-in memo']}
          />
          <PageHeader
            title="Hotel"
            description="Keep reservations, check-in details, and location context organized in one place."
          />

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
        <section className="card section-card glass-card planhelper-section plan-dark-section">
          <SectionMobileHero
            title="PlanHelper Mobile Flow"
            subtitle="Separate discovery cards and detail panel for fast planning decisions"
            imageUrl="https://cdn.dribbble.com/userupload/46906420/file/b54c5f45d656929e83aa8a65ebb4ac51.jpg?format=webp&resize=1200x900&vertical=center"
            chips={['Place cards', 'Activity cards', 'Detail panel']}
          />
          <PageHeader
            title="PlanHelper"
            description={
              planHelperSubTab === 'activities'
                ? 'Curate activity-heavy experiences and match them to your travel pace.'
                : 'Pick destinations that fit your route and travel mood.'
            }
          >
            <SubTabBar items={planHelperSubTabItems} active={planHelperSubTab} />
          </PageHeader>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
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
                <button
                  type="button"
                  className={placesViewMode === 'list' ? 'btn-secondary active' : 'btn-secondary'}
                  onClick={() => setPlacesViewMode('list')}
                >
                  List mode
                </button>
                <button
                  type="button"
                  className={placesViewMode === 'images' ? 'btn-secondary active' : 'btn-secondary'}
                  onClick={() => setPlacesViewMode('images')}
                >
                  Image mode
                </button>
              </div>

              {placesViewMode === 'images' ? (
                <div className="image-grid">
                  {[...placesResponse.heroImages, ...placesResponse.cityImages.map((image) => image.imageUrl)].map((src, idx) => (
                    <img key={`${src}-${idx}`} src={src} alt="Destination inspiration" />
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
            </div>

            <aside className="xl:col-span-4">
              <article className="detail-card glass-card">
                <h3>{planHelperSubTab === 'activities' ? 'Selected Activity' : 'Selected Place'}</h3>
                {selectedPlaceDetail ? (
                  <>
                    <p className="route-emphasis">{selectedPlaceDetail.name}</p>
                    <p>{selectedPlaceDetail.summary}</p>
                    <div className="chip-row">
                      <span className="status-chip">📍 {selectedPlaceDetail.city}</span>
                      <span className="travel-mode-chip">Theme: {selectedPlaceDetail.theme}</span>
                      <span className="status-chip">⭐ {selectedPlaceDetail.rating}</span>
                    </div>
                    <p className="workspace-meta">Saved places: {selectedPlaceNames.length}</p>
                  </>
                ) : (
                  <p className="empty-state-text">Select a place card to build your personalized plan panel.</p>
                )}
              </article>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === 'places' && planHelperSubTab === 'restaurants' ? (
        <section className="card section-card glass-card planhelper-section plan-dark-section">
          <PageHeader
            title="PlanHelper"
            description="City-by-city restaurant recommendations with cuisine and vibe tags."
          >
            <SubTabBar items={planHelperSubTabItems} active={planHelperSubTab} />
          </PageHeader>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
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
                {restaurants.length === 0 ? <p className="empty-state-text">No restaurant picks yet. Choose another city.</p> : null}
              </div>
            </div>

            <aside className="xl:col-span-4">
              <article className="detail-card glass-card">
                <h3>Selected Recommendation</h3>
                {selectedRestaurantDetail ? (
                  <>
                    <p className="route-emphasis">{selectedRestaurantDetail.name}</p>
                    <p>{selectedRestaurantDetail.summary}</p>
                    <div className="chip-row">
                      <span className="status-chip">Cuisine: {selectedRestaurantDetail.cuisine}</span>
                      <span className="travel-mode-chip">⭐ {selectedRestaurantDetail.rating}</span>
                      <span className="status-chip">City: {selectedRestaurantDetail.city}</span>
                    </div>
                    <p className="workspace-meta">Recommendation cards: {restaurants.length}</p>
                  </>
                ) : (
                  <p className="empty-state-text">Select a city to load curated restaurant cards.</p>
                )}
              </article>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === 'record' ? (
        <section id="tab-record-section" className="card section-card glass-card record-themed-section">
          <SectionMobileHero
            title="Record App Flow"
            subtitle="Media-first cards to save and share travel moments quickly"
            imageUrl="https://images.openai.com/static-rsc-1/8Nqkz7ZZ3-Gm_TXJQY_A_04rmzm0cn1mhiq1LiUAcJRNu9Fms8Z8_qIs6OUiO6MEFfbUc8jHC9Bro3YgXce1BkL6TNXWB1OKitFKAdNHNBhH8ena-Hrn3E8m3n-3sfSrqGpjw8mr7T-Db_BmCJKbhA"
            chips={['Media first', 'Memory card', 'Share-ready']}
          />
          <div className="section-heading">
            <p className="section-kicker">🧳 Travel Record</p>
            <h2>Save media memories as shareable travel cards</h2>
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
        <section id="tab-diary-section" className="card section-card glass-card diary-section diary-themed-section">
          <SectionMobileHero
            title="Diary App Flow"
            subtitle="Paper-style writing, weather badge, media, and voice memo in one flow"
            imageUrl="https://images.squarespace-cdn.com/content/v1/603fd2e6b89a792feb000f9c/ab985b3c-d3da-474c-b3ca-332671b5e975/weekly%2Bmemory%2Bkeeper%2Bdigital%2Bjournal.jpg"
            chips={['Paper mood', 'Weather badge', 'Voice memo']}
          />
          <div className="diary-intro">
            <h2>📔 Travel Journal</h2>
            <p>Capture today with a warm journal card, not a rigid form.</p>
          </div>
          <form onSubmit={saveDiary} className="diary-form-card">
            <label>
              Title
              <input
                className="diary-input"
                value={diaryTitle}
                onChange={(event) => setDiaryTitle(event.target.value)}
                placeholder="A one-line memory from today ✨"
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
                Weather emoji
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
                placeholder="Write today's journey like a postcard to your future self..."
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
        <section id="tab-tripstargram-section" className="card section-card glass-card tripstargram-themed-section">
          <SectionMobileHero
            title="Tripstargram Feed"
            subtitle="Create collaborative travel postcards from diary memories with AI-assisted draft editing"
            imageUrl="https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=1400&q=80"
            chips={['Shared memory', 'Diary to post', 'Long-press reactions']}
          />
          <div className="tripstargram-header">
            <div>
              <h2>📸 Tripstargram</h2>
              <p>Turn diary moments into warm social memory cards, then co-create and publish with your tripmates.</p>
            </div>
            <div className="tripstargram-header-actions">
              <button type="button" className="btn-secondary" onClick={saveTripstargramDraftLocally}>
                Save Draft
              </button>
              <button type="button" className="btn-primary" onClick={generateTripstargramDraftFromDiary}>
                New AI Draft
              </button>
            </div>
          </div>

          <div className="tripstargram-mode-grid">
            <button
              type="button"
              className={cn('tripstargram-mode-card', tripstargramMode === 'auto' && 'active')}
              onClick={() => {
                setTripstargramMode('auto');
                setTripstargramDraftGenerated(false);
                if (!tripstargramDiaryId && diaries[0]) {
                  setTripstargramDiaryId(diaries[0].id);
                }
              }}
            >
              <p>AI from diary</p>
              <strong>Generate editable caption, mood, emoji, and tag suggestions.</strong>
            </button>
            <button
              type="button"
              className={cn('tripstargram-mode-card', tripstargramMode === 'manual' && 'active')}
              onClick={switchTripstargramToManual}
            >
              <p>Create manually</p>
              <strong>Start from scratch and design your own travel post card.</strong>
            </button>
          </div>

          <article className="tripstargram-diary-prompt">
            <p className="tripstargram-panel-kicker">Diary to Post</p>
            {selectedTripstargramDiary ? (
              <>
                <h3>Turn today&apos;s diary into a post?</h3>
                <p>
                  <strong>{selectedTripstargramDiary.title}</strong> · {selectedTripstargramDiary.place} · {selectedTripstargramDiary.date}
                </p>
                <p className="tripstargram-diary-snippet">{selectedTripstargramDiary.content.slice(0, 180)}</p>
                <div className="tripstargram-inline-actions">
                  <button type="button" className="btn-primary" onClick={generateTripstargramDraftFromDiary}>
                    Generate draft from diary
                  </button>
                  <button type="button" className="btn-secondary" onClick={switchTripstargramToManual}>
                    Create manually
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>No diary yet</h3>
                <p>Write a diary entry first, then you can generate an AI draft post from it.</p>
              </>
            )}
          </article>

          <form className="tripstargram-form tripstargram-editor-shell" onSubmit={createTripstargramPost}>
            <div className="tripstargram-editor-grid">
              <div className="tripstargram-editor-col">
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
                {tripstargramPreviewUrl ? (
                  <div className="tripstargram-media-preview">
                    {tripstargramPreviewIsVideo ? (
                      <video controls src={tripstargramPreviewUrl} />
                    ) : (
                      <img src={tripstargramPreviewUrl} alt="tripstargram upload preview" />
                    )}
                  </div>
                ) : null}
                <label>
                  Vibe preset
                  <select value={tripstargramVibe} onChange={(event) => setTripstargramVibe(event.target.value)}>
                    {tripstargramVibePresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Effect preset
                  <select value={tripstargramEffect} onChange={(event) => setTripstargramEffect(event.target.value)}>
                    {tripstargramEffectPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tripstargram-editor-col">
                <label>
                  Caption {tripstargramMode === 'manual' ? '(required)' : '(editable AI draft)'}
                  <textarea
                    rows={7}
                    value={tripstargramCaption}
                    onChange={(event) => setTripstargramCaption(event.target.value)}
                    placeholder={
                      tripstargramMode === 'auto'
                        ? 'Generate a draft from diary, then refine before publishing'
                        : 'Write your own travel memory caption'
                    }
                    required={tripstargramMode === 'manual'}
                  />
                </label>

                <div className="tripstargram-emoji-picker">
                  {tripstargramReactionOptions.map((emoji) => (
                    <button
                      key={`editor-emoji-${emoji}`}
                      type="button"
                      className={cn('reaction-pill', tripstargramSelectedEmojis.includes(emoji) && 'active')}
                      onClick={() => toggleTripstargramEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="tripstargram-tag-editor">
                  <div className="tripstargram-tag-row">
                    {buildTagCandidates(
                      `${tripstargramCaption} ${selectedTripstargramDiary?.title ?? ''} ${selectedTripstargramDiary?.place ?? ''} ${tripstargramVibe}`
                    )
                      .slice(0, 8)
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={cn('data-tag', tripstargramSuggestedTags.includes(tag) && 'active')}
                          onClick={() => toggleTripstargramSuggestedTag(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                  <label>
                    Additional tags
                    <input
                      value={tripstargramCustomTags}
                      onChange={(event) => setTripstargramCustomTags(event.target.value)}
                      placeholder="#city #food #memory"
                    />
                  </label>
                </div>

                <label>
                  Visibility
                  <select
                    value={tripstargramVisibility}
                    onChange={(event) => setTripstargramVisibility(event.target.value as 'tripmates' | 'private' | 'public')}
                  >
                    <option value="tripmates">Tripmates only</option>
                    <option value="private">Private draft</option>
                    <option value="public">Public feed</option>
                  </select>
                </label>
              </div>
            </div>

            <article className="tripstargram-collab-card">
              <p className="tripstargram-panel-kicker">Collaborators</p>
              <p className="tripstargram-collab-description">Co-create this post with invited editors or add tripmates manually.</p>
              <div className="tripstargram-collab-input-row">
                <input
                  value={tripstargramCoEditorInput}
                  onChange={(event) => setTripstargramCoEditorInput(event.target.value)}
                  placeholder="@tripmate nickname"
                />
                <button type="button" className="btn-secondary" onClick={addTripstargramCoEditor}>
                  Add
                </button>
              </div>
              <div className="tripstargram-collab-chip-row">
                <span className="status-chip">Author: {nickname ?? 'traveler'}</span>
                {tripstargramCoEditors.map((name) => (
                  <button key={name} type="button" className="status-chip removable" onClick={() => removeTripstargramCoEditor(name)}>
                    @{name} ✕
                  </button>
                ))}
              </div>
              <label className="tripstargram-coedit-toggle">
                <input type="checkbox" checked={tripstargramAllowCoEdit} onChange={(event) => setTripstargramAllowCoEdit(event.target.checked)} />
                Allow co-edit before publishing
              </label>
            </article>

            <article className="tripstargram-preview-card">
              <p className="tripstargram-panel-kicker">Live Preview</p>
              <strong>Preview before publishing</strong>
              <p className="tripstargram-preview-text">
                {tripstargramPreviewCaption || 'Your preview will appear here after caption, emoji, and tags are added.'}
              </p>
              <div className="tripstargram-collab-row">
                <span className="travel-mode-chip">Vibe: {tripstargramVibe}</span>
                <span className="travel-mode-chip">Effect: {tripstargramEffect}</span>
                <span className="travel-mode-chip">Visibility: {tripstargramVisibility}</span>
                {tripstargramDraftGenerated ? <span className="status-chip">Created from diary</span> : null}
                {tripstargramCoEditors.length ? <span className="status-chip">Shared memory</span> : null}
              </div>
            </article>

            {tripstargramDrafts.length ? (
              <article className="tripstargram-saved-drafts">
                <p className="tripstargram-panel-kicker">Saved Drafts</p>
                <div className="tripstargram-draft-list">
                  {tripstargramDrafts.map((draft) => (
                    <div key={draft.id} className="tripstargram-draft-item">
                      <p>{draft.caption.slice(0, 120)}</p>
                      <div className="tripstargram-inline-actions">
                        <button type="button" className="btn-secondary" onClick={() => applySavedTripstargramDraft(draft)}>
                          Load
                        </button>
                        <button type="button" className="btn-secondary danger" onClick={() => removeSavedTripstargramDraft(draft.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            <div className="tripstargram-action-row">
              <button type="button" className="btn-secondary" onClick={saveTripstargramDraftLocally}>
                Save Draft
              </button>
              <button type="submit" className="btn-primary">
                Publish Tripstargram Post
              </button>
            </div>
          </form>

          <div className="tripstargram-feed-head">
            <h3>Feed</h3>
            <div className="tripstargram-feed-filters">
              <button
                type="button"
                className={cn('btn-secondary', tripstargramFeedFilter === 'latest' && 'active')}
                onClick={() => setTripstargramFeedFilter('latest')}
              >
                Latest
              </button>
              <button
                type="button"
                className={cn('btn-secondary', tripstargramFeedFilter === 'from-diary' && 'active')}
                onClick={() => setTripstargramFeedFilter('from-diary')}
              >
                From diary
              </button>
              <button
                type="button"
                className={cn('btn-secondary', tripstargramFeedFilter === 'shared' && 'active')}
                onClick={() => setTripstargramFeedFilter('shared')}
              >
                Shared
              </button>
            </div>
          </div>

          <div className="result-list">
            {filteredTripstargramPosts.map((post) => {
              const postMeta = tripstargramPostMeta[post.id];
              const postReaction = tripstargramReactionMap[post.id];
              const reactionSummary = Object.entries(postReaction?.counts ?? {})
                .filter((entry) => Number(entry[1]) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1])) as Array<[TripstargramReactionEmoji, number]>;

              return (
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
                  <div className="tripstargram-collab-row">
                    {post.diaryId ? <span className="status-chip">Created from diary</span> : null}
                    {postMeta?.collaborators.length ? (
                      <span className="status-chip">Co-created with {postMeta.collaborators.map((name) => `@${name}`).join(', ')}</span>
                    ) : null}
                    {postMeta?.visibility ? <span className="travel-mode-chip">{postMeta.visibility}</span> : null}
                  </div>

                  <div className="tripstargram-reaction-zone">
                    <button
                      type="button"
                      className="tripstargram-react-trigger"
                      onPointerDown={() => onTripstargramReactionPointerDown(post.id)}
                      onPointerUp={() => onTripstargramReactionPointerUp(post.id)}
                      onPointerLeave={cancelTripstargramLongPress}
                      onPointerCancel={cancelTripstargramLongPress}
                      onContextMenu={(event) => event.preventDefault()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          applyTripstargramReaction(post.id, '❤️');
                        }
                      }}
                    >
                      {postReaction?.selectedEmoji ?? '❤️'} Tap to like, long press for more reactions
                    </button>
                    {tripstargramReactionTrayPostId === post.id ? (
                      <div className="tripstargram-reaction-tray">
                        {tripstargramReactionOptions.map((emoji) => (
                          <button
                            key={`tray-${post.id}-${emoji}`}
                            type="button"
                            className="reaction-pill"
                            onClick={() => applyTripstargramReaction(post.id, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button type="button" className="btn-secondary" onClick={() => setTripstargramReactionTrayPostId(null)}>
                          Close
                        </button>
                      </div>
                    ) : null}

                    <div className="tripstargram-reaction-row">
                      {tripstargramReactionOptions.map((emoji) => (
                        <button
                          key={`quick-${post.id}-${emoji}`}
                          type="button"
                          className={cn('reaction-pill', postReaction?.selectedEmoji === emoji && 'active')}
                          onClick={() => applyTripstargramReaction(post.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {reactionSummary.length ? (
                      <div className="tripstargram-reaction-summary">
                        {reactionSummary.map(([emoji, count]) => (
                          <span key={`${post.id}-${emoji}`}>
                            {emoji} {count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="tip-meta">No reactions yet.</p>
                    )}
                  </div>

                  {selectedTripId ? (
                    <CommentsThread
                      supabase={supabase}
                      tripId={selectedTripId}
                      targetType="tripstargram"
                      targetId={post.id}
                      language={language}
                      autoTranslate={autoTranslate}
                    />
                  ) : null}
                </article>
              );
            })}
            {!filteredTripstargramPosts.length ? (
              <article className="result-card">
                <strong>No posts in this feed yet</strong>
                <p>Create the first shared memory post and reactions/comments will appear here.</p>
              </article>
            ) : null}
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
                  <option value="contact">Contact</option>
                  <option value="improvement">Improvement request</option>
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
        <section className="card section-card glass-card info-dark-section">
          <PageHeader
            title="Information"
            description="Destination context, curated highlights, and reliable local overview."
          >
            <SubTabBar items={informationSubTabItems} active={informationSubTab} />
          </PageHeader>
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
        <section id="extra-plan-section" className="card section-card glass-card planhelper-section plan-dark-section">
          <PageHeader
            title="PlanHelper"
            description="Review route options, travel prep, and day-by-day itinerary with budget control."
          >
            <SubTabBar items={planHelperSubTabItems} active={planHelperSubTab} />
          </PageHeader>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
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
            </div>
            <aside className="space-y-4 xl:col-span-4">
              <article className="detail-card glass-card transport-detail-panel">
                <h3>Route Detail Panel</h3>
                {selectedTransport ? (
                  <>
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
                  </>
                ) : (
                  <p className="empty-state-text">Select a route card to preview transportation detail.</p>
                )}
              </article>
              {planResult?.budget ? (
                <article className="summary-card glass-card">
                  <h3>Budget Snapshot</h3>
                  <p className="workspace-meta">
                    Estimated {formatKRW(planResult.budget.estimatedCostKrw)} / Budget {formatKRW(planResult.budget.budgetKrw)}
                  </p>
                  <div className="chip-row">
                    <span className="status-chip">Usage {planResult.budget.usagePercent}%</span>
                    <span className="travel-mode-chip">Over {formatKRW(planResult.budget.overBudgetKrw)}</span>
                  </div>
                </article>
              ) : null}
            </aside>
          </div>
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
                  Caution
                </button>
                <button
                  type="button"
                  className={planPrepTopic === 'packing' ? 'plan-prep-tab active' : 'plan-prep-tab'}
                  onClick={() => setPlanPrepTopic('packing')}
                >
                  Packing
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
                  <p className="packing-section-title">Base packing template (customizable)</p>
                  {basePackingTemplate.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="packing-template-row">
                      <input
                        className="packing-item-input"
                        value={item}
                        onChange={(event) => editTemplateItem(idx, event.target.value)}
                      />
                      <button type="button" className="packing-remove-btn" onClick={() => removeTemplateItem(idx)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="packing-add-row">
                    <input
                      placeholder="Add base packing item (ex. toiletries, shampoo/conditioner)"
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
                      Add template item
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={syncTemplateToCurrentTrip}
                    disabled={!selectedTripId || !canEditPacking}
                  >
                    Sync template to current trip
                  </button>
                </div>

                <div className="packing-panel">
                  <p className="packing-section-title">
                    Per-trip packing list
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
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="packing-add-row">
                        <input
                          placeholder="Add item needed only for this trip"
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
                          Add
                        </button>
                      </div>
                      {!canEditPacking ? (
                        <p className="packing-helper">Packing edit is OFF for this trip, so only editors can modify it.</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="packing-helper">Select a trip to generate a dedicated per-trip checklist.</p>
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
        <section className="card section-card glass-card info-dark-section">
          <PageHeader
            title="Information"
            description="Practical local advice from shared community memories."
          >
            <SubTabBar items={informationSubTabItems} active={informationSubTab} />
          </PageHeader>
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
                  <option value="movie">Movie</option>
                  <option value="book">Book</option>
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
        <section id="extra-event-section" className="card section-card glass-card info-dark-section">
          <PageHeader
            title="Information"
            description="Upcoming events and festivals with booking links and pricing context."
          >
            <SubTabBar items={informationSubTabItems} active={informationSubTab} />
          </PageHeader>
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
      }
    />
  );
}
