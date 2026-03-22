import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const updateSchema = z.object({
  displayName: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  profileImageUrl: z.string().url().optional().nullable(),
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

const aiImageSchema = z.object({
  mode: z.literal('ai-image'),
  prompt: z.string().min(3).max(300),
});

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return fail('Unauthorized', 401);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, nickname, display_name, phone, profile_image_url, locale')
    .eq('id', user.profileId)
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  return ok({
    id: data.id,
    nickname: data.nickname,
    displayName: data.display_name,
    phone: data.phone,
    profileImageUrl: data.profile_image_url,
    locale: data.locale,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = updateSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();
    const updates: Record<string, unknown> = {};

    if (Object.hasOwn(body, 'displayName')) updates.display_name = body.displayName ?? null;
    if (Object.hasOwn(body, 'phone')) updates.phone = body.phone ?? null;
    if (Object.hasOwn(body, 'profileImageUrl')) updates.profile_image_url = body.profileImageUrl ?? null;
    if (Object.hasOwn(body, 'locale')) updates.locale = body.locale;

    const { data, error } = await admin
      .from('users')
      .update(updates)
      .eq('id', user.profileId)
      .select('id, nickname, display_name, phone, profile_image_url, locale')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      id: data.id,
      nickname: data.nickname,
      displayName: data.display_name,
      phone: data.phone,
      profileImageUrl: data.profile_image_url,
      locale: data.locale,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to update profile', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = aiImageSchema.parse(await req.json());
    const generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      `${body.prompt}, portrait profile photo, clean background`
    )}`;

    return ok({
      generatedUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to generate profile image', 500);
  }
}
