import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { getAuthUserIdFromRequest } from '@/lib/auth/request-user';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  nickname: z.string().min(2).max(32),
  displayName: z.string().max(80).optional().nullable(),
  locale: z
    .enum([
      'en',
      'ko',
      'zh',
      'ja',
      'fr',
      'de',
      'es',
      'pt',
      'it',
      'ru',
      'ar',
      'hi',
      'id',
      'tr',
      'nl',
      'pl',
      'vi',
      'th',
      'ms',
      'sv',
      'no',
      'da',
      'fi',
      'cs',
      'hu',
      'ro',
      'uk',
      'el',
      'he',
      'bn',
      'ur',
      'fa',
      'ta',
    ])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authUserId = await getAuthUserIdFromRequest(req);
    if (!authUserId) {
      return fail('Unauthorized', 401);
    }

    const body = bodySchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('users')
      .upsert(
        {
          auth_user_id: authUserId,
          nickname: body.nickname.toLowerCase(),
          display_name: body.displayName ?? body.nickname,
          locale: body.locale ?? 'en',
        },
        { onConflict: 'auth_user_id' }
      )
      .select('id, nickname, display_name, profile_image_url, phone, locale')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to sync profile', 500);
  }
}
