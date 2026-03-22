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
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const labels = useMemo(() => {
    if (language === 'ko') {
      return {
        signIn: '로그인',
        create: '계정 만들기',
        createAccount: 'Create account',
        nickname: '닉네임',
        password: '비밀번호',
        confirmPassword: '비밀번호 확인',
        signOut: '로그아웃',
        google: 'Google 로그인',
        apple: 'Apple 로그인',
        welcome: '환영합니다',
      };
    }
    return {
      signIn: 'Sign in',
      create: 'Create account',
      createAccount: 'Create account',
      nickname: 'Nickname',
      password: 'Password',
      confirmPassword: 'Confirm password',
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
    setNotice('');
    setLoading(true);
    try {
      const email = nicknameToEmail(nickname);

      const signIn = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signIn.error) {
        throw new Error(signIn.error.message || 'Sign in failed');
      }

      await syncProfile(nickname);
      await onSignedIn(nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmPassword) {
      setError(language === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ message?: string }>(supabase, '/api/auth/create-account', {
        method: 'POST',
        body: JSON.stringify({
          nickname,
          password,
          displayName: nickname,
          locale: language,
        }),
      });

      if (!res.ok) {
        throw new Error(res.message ?? 'Failed to create account');
      }

      setNotice(res.data?.message ?? (language === 'ko' ? '계정이 생성되었습니다. 로그인해 주세요.' : 'Account created. Please sign in.'));
      setMode('signin');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('');
    setNotice('');
    setLoading(true);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!supabaseUrl || supabaseUrl.includes('example.supabase.co')) {
      setError('Supabase is not configured. Set real NEXT_PUBLIC_SUPABASE_URL/KEY in Vercel first.');
      setLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (oauthError) {
      setError(`${oauthError.message} (Check Supabase OAuth provider + redirect URL settings)`);
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
    <form className="auth-box" onSubmit={mode === 'signin' ? handleSignIn : handleCreateAccount}>
      <div className="auth-mode-row">
        <button type="button" className={mode === 'signin' ? 'btn-secondary active' : 'btn-secondary'} onClick={() => setMode('signin')}>
          {labels.signIn}
        </button>
        <button type="button" className={mode === 'create' ? 'btn-secondary active' : 'btn-secondary'} onClick={() => setMode('create')}>
          {labels.create}
        </button>
      </div>
      <label>
        {labels.nickname}
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} required minLength={2} maxLength={32} />
      </label>
      <label>
        {labels.password}
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
      </label>
      {mode === 'create' ? (
        <label>
          {labels.confirmPassword}
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
        </label>
      ) : null}
      {notice ? <p className="status">{notice}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn-primary" type="submit" disabled={loading}>
        {mode === 'signin' ? labels.signIn : labels.createAccount}
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
