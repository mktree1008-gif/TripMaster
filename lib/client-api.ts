import { SupabaseClient } from '@supabase/supabase-js';

export async function apiFetch<T>(
  supabase: SupabaseClient,
  input: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; message?: string }> {
  let sessionToken = '';
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    sessionToken = session?.access_token ?? '';
  } catch {
    return {
      ok: false,
      message: 'Authentication session is unavailable. Please sign in again.',
    };
  }

  const headers = new Headers(init?.headers || {});
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers,
    });
  } catch {
    return {
      ok: false,
      message: 'Network request failed. Please check backend environment and internet connection.',
    };
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      message: `Server returned non-JSON response (${res.status}).`,
    };
  }

  try {
    const json = (await res.json()) as { ok: boolean; data?: T; message?: string };
    if (!res.ok && !json.message) {
      return { ok: false, message: `Request failed (${res.status})` };
    }
    return json;
  } catch {
    return {
      ok: false,
      message: `Failed to parse server response (${res.status}).`,
    };
  }
}
