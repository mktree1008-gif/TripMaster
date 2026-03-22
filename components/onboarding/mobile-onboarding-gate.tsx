'use client';

import { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { AuthPanel } from '@/components/auth/auth-panel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { languageOrder } from '@/lib/i18n';
import { LanguageCode } from '@/lib/types';

const ONBOARDING_DONE_KEY = 'tripmaster-onboarding-complete-v1';
const LANGUAGE_STORAGE_KEY = 'tripmaster-language-v1';

const onboardingSlides: Array<{
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}> = [
  {
    id: 'air',
    title: 'Explore Destinations',
    description: 'Discover places that match your mood with a mobile-first travel planner.',
    imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'rail',
    title: 'Scenic Train Moments',
    description: 'Flip through exciting rail routes and build day plans with beautiful travel visuals.',
    imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'city',
    title: 'City Memories Together',
    description: 'Write diaries, co-create posts, and keep every trip memory in one collaborative app.',
    imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1400&q=80',
  },
];

function extractNicknameFromSessionUser(sessionUser: any): string | null {
  if (!sessionUser) return null;
  const candidate =
    sessionUser.user_metadata?.preferred_username ||
    sessionUser.user_metadata?.nickname ||
    sessionUser.user_metadata?.name ||
    sessionUser.email?.split('@')[0];
  if (!candidate) return null;
  return String(candidate).trim().replace(/\s+/g, '').slice(0, 32) || null;
}

export function MobileOnboardingGate() {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [slideIndex, setSlideIndex] = useState(0);
  const [showAuthStep, setShowAuthStep] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [supabaseError, setSupabaseError] = useState('');
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && languageOrder.some((item) => item.code === storedLanguage)) {
      setLanguage(storedLanguage as LanguageCode);
    }
    if (window.localStorage.getItem(ONBOARDING_DONE_KEY) === '1') {
      router.replace('/app');
      return;
    }

    try {
      const client = getSupabaseBrowserClient();
      setSupabase(client);
      client.auth
        .getSession()
        .then(({ data }) => {
          const nickname = extractNicknameFromSessionUser(data.session?.user);
          if (nickname) {
            setCurrentNickname(nickname);
          }
        })
        .catch(() => {
          // Session fetch failure should not block onboarding.
        });
    } catch (error) {
      setSupabaseError(error instanceof Error ? error.message : 'Failed to initialize auth client.');
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const currentSlide = onboardingSlides[slideIndex];
  const isLastSlide = slideIndex === onboardingSlides.length - 1;

  function finishOnboarding() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_DONE_KEY, '1');
    }
    router.push('/app');
  }

  function goNextSlide() {
    if (isLastSlide) {
      setShowAuthStep(true);
      return;
    }
    setSlideIndex((prev) => Math.min(prev + 1, onboardingSlides.length - 1));
  }

  function goBack() {
    if (showAuthStep) {
      setShowAuthStep(false);
      return;
    }
    setSlideIndex((prev) => Math.max(prev - 1, 0));
  }

  async function handleSignedIn(nickname: string) {
    setCurrentNickname(nickname);
    finishOnboarding();
  }

  async function handleSignedOut() {
    setCurrentNickname(null);
  }

  return (
    <main className="onboarding-root">
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <span className="onboarding-brand">✈ TripMaster</span>
          <label className="onboarding-language">
            <span aria-hidden>🌐</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)} aria-label="Language">
              {languageOrder.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {!showAuthStep ? (
          <section className="onboarding-phone-wrap">
            <article className="onboarding-phone">
              <div className="onboarding-screen" style={{ backgroundImage: `url(${currentSlide.imageUrl})` }}>
                <div className="onboarding-screen-overlay" />
                <div className="onboarding-content">
                  <div className="onboarding-dot-row">
                    {onboardingSlides.map((slide, idx) => (
                      <span
                        key={slide.id}
                        className={idx === slideIndex ? 'onboarding-dot active' : 'onboarding-dot'}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <h1>{currentSlide.title}</h1>
                  <p>{currentSlide.description}</p>
                  <div className="onboarding-actions">
                    <button type="button" className="onboarding-ghost-btn" onClick={goBack} disabled={slideIndex === 0}>
                      Back
                    </button>
                    <button type="button" className="onboarding-primary-btn" onClick={goNextSlide}>
                      {isLastSlide ? 'Get Started' : 'Next'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </section>
        ) : (
          <section className="onboarding-auth-wrap">
            <article className="onboarding-auth-card">
              <p className="onboarding-auth-kicker">Get Started</p>
              <h2>Sign in and start your trip story</h2>
              <p>Create an account or log in to continue with shared planning and travel memory tools.</p>

              {currentNickname ? (
                <div className="onboarding-ready-box">
                  <p>
                    Welcome back, <strong>{currentNickname}</strong>.
                  </p>
                  <button type="button" className="onboarding-primary-btn w-full" onClick={finishOnboarding}>
                    Continue to TripMaster
                  </button>
                </div>
              ) : null}

              {supabaseError ? <p className="onboarding-auth-error">{supabaseError}</p> : null}

              {supabase ? (
                <AuthPanel
                  supabase={supabase}
                  language={language}
                  currentNickname={currentNickname}
                  onSignedIn={handleSignedIn}
                  onSignedOut={handleSignedOut}
                />
              ) : (
                <p className="onboarding-auth-loading">Loading secure sign-in...</p>
              )}

              <div className="onboarding-auth-actions">
                <button type="button" className="onboarding-ghost-btn" onClick={goBack}>
                  Back to intro
                </button>
                <button type="button" className="onboarding-secondary-btn" onClick={finishOnboarding}>
                  Continue in demo mode
                </button>
              </div>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
