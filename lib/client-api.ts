import { SupabaseClient } from '@supabase/supabase-js';

export async function apiFetch<T>(
  supabase: SupabaseClient,
  input: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; message?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const res = await fetch(input, {
    ...init,
    headers,
  });

  const json = (await res.json()) as { ok: boolean; data?: T; message?: string };
  return json;
}
