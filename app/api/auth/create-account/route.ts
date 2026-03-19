import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { nicknameToEmail } from '@/lib/auth/nickname-email';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  nickname: z.string().min(2).max(32),
  password: z.string().min(6).max(72),
  displayName: z.string().max(80).optional().nullable(),
  locale: z.enum(['en', 'ko', 'zh', 'ja', 'fr', 'de']).optional(),
});

function normalizeNickname(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const nickname = normalizeNickname(body.nickname);
    if (nickname.length < 2) {
      return fail('Nickname must be at least 2 valid characters.', 400);
    }

    const admin = getSupabaseAdminClient();

    const { data: existingNickname } = await admin
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle();

    if (existingNickname) {
      return fail('Nickname is already in use.', 409);
    }

    const email = nicknameToEmail(nickname);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        preferred_username: nickname,
        name: body.displayName ?? nickname,
      },
    });

    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes('already been registered')) {
        return fail('This account already exists. Please sign in.', 409);
      }
      return fail(createError?.message ?? 'Failed to create account', 500);
    }

    const { error: profileError } = await admin.from('users').upsert(
      {
        auth_user_id: created.user.id,
        nickname,
        display_name: body.displayName ?? nickname,
        locale: body.locale ?? 'en',
      },
      { onConflict: 'auth_user_id' }
    );

    if (profileError) {
      return fail(profileError.message, 500);
    }

    return ok({
      nickname,
      message: 'Account created. Please sign in.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create account', 500);
  }
}
