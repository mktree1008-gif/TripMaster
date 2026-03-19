import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole, getRequestUser } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { globalTipsSeed } from '@/lib/info-plan-data';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid().optional(),
  countryCode: z.string().max(3),
  city: z.string().min(1),
  message: z.string().min(2).max(1200),
});

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode');
  const city = req.nextUrl.searchParams.get('city');
  if (!countryCode || !city) {
    return fail('countryCode and city are required', 400);
  }

  const seeded = globalTipsSeed.filter((tip) => tip.countryCode === countryCode && tip.city.toLowerCase() === city.toLowerCase());
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('tips')
    .select('id, country_code, city, nickname, message, created_at')
    .eq('country_code', countryCode)
    .ilike('city', city)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return fail(error.message, 500);
  }

  const community = (data ?? []).map((item) => ({
    id: item.id,
    countryCode: item.country_code,
    city: item.city,
    nickname: item.nickname,
    message: item.message,
    sourceType: 'community',
    createdAt: item.created_at,
  }));

  return ok({
    tips: [...seeded, ...community],
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = createSchema.parse(await req.json());

    if (body.tripId) {
      const membership = await getMembershipRole(req, body.tripId);
      if (!membership) {
        return fail('Unauthorized for this trip', 401);
      }
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('tips')
      .insert({
        trip_id: body.tripId ?? null,
        user_id: user.profileId,
        nickname: user.nickname,
        country_code: body.countryCode,
        city: body.city,
        message: body.message,
      })
      .select('id, country_code, city, nickname, message, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      id: data.id,
      countryCode: data.country_code,
      city: data.city,
      nickname: data.nickname,
      message: data.message,
      sourceType: 'community',
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create tip', 500);
  }
}
