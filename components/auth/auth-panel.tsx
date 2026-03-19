'use client';

import { FormEvent, useMemo, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { nicknameToEmail } from '@/lib/auth/nickname-email';
import { apiFetch } from '@/lib/client-api';
import { LanguageCode } from '@/lib/types';

interface AuthPanelProps {
  supabase: SupabaseClient;
  language: LanguageCode;
  currentNickname: string | null;
  onSignedIn: (nickname: string) => Promise<void> | void;
  onSignedOut: () => Promise<void> | void;
}

export function AuthPanel({ supabase, language, currentNickname, onSignedIn, onSignedOut }: AuthPanelProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const labels = useMemo(() => {
    if (language === 'ko') {
      return {
        signIn: '로그인',
        nickname: '닉네임',
        password: '비밀번호',
        signOut: '로그아웃',
        google: 'Google 로그인',
        apple: 'Apple 로그인',
        welcome: '환영합니다',
      };
    }
    return {
      signIn: 'Sign in',
      nickname: 'Nickname',
      password: 'Password',
      signOut: 'Sign out',
      google: 'Continue with Google',
      apple: 'Continue with Apple',
      welcome: 'Welcome',
    };
  }, [language]);

  async function syncProfile(nextNickname: string) {
    await apiFetch(supabase, '/api/auth/sync-profile', {
      method: 'POST',
      body: JSON.stringify({
        nickname: nextNickname,
        displayName: nextNickname,
        locale: language,
      }),
    });
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const email = nicknameToEmail(nickname);

      let signIn = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signIn.error) {
        const signUp = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUp.error) {
          throw signIn.error;
        }

        signIn = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (signIn.error) {
        throw signIn.error;
      }

      await syncProfile(nickname);
      await onSignedIn(nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('');
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    await onSignedOut();
  }

  if (currentNickname) {
    return (
      <div className="auth-box">
        <p>
          {labels.welcome}, <strong>{currentNickname}</strong>
        </p>
        <button className="btn-secondary" type="button" onClick={handleSignOut}>
          {labels.signOut}
        </button>
      </div>
    );
  }

  return (
    <form className="auth-box" onSubmit={handleSignIn}>
      <label>
        {labels.nickname}
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} required minLength={2} maxLength={32} />
      </label>
      <label>
        {labels.password}
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn-primary" type="submit" disabled={loading}>
        {labels.signIn}
      </button>
      <div className="oauth-row">
        <button type="button" className="btn-secondary" onClick={() => handleOAuth('google')} disabled={loading}>
          {labels.google}
        </button>
        <button type="button" className="btn-secondary" onClick={() => handleOAuth('apple')} disabled={loading}>
          {labels.apple}
        </button>
      </div>
    </form>
  );
}
