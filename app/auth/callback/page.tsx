'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/client-api';

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Signing you in...');
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setMessage('No active session found. Redirecting...');
        setTimeout(() => router.replace('/'), 500);
        return;
      }

      const fallbackNickname =
        session.user.user_metadata?.preferred_username ||
        session.user.user_metadata?.name ||
        session.user.email?.split('@')[0] ||
        'traveler';

      await apiFetch(supabase, '/api/auth/sync-profile', {
        method: 'POST',
        body: JSON.stringify({
          nickname: String(fallbackNickname).replace(/\s+/g, '').toLowerCase().slice(0, 32),
          displayName: session.user.user_metadata?.name ?? fallbackNickname,
          locale: 'en',
        }),
      });

      router.replace('/app');
    };
    run();
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <p>{message}</p>
    </main>
  );
}
