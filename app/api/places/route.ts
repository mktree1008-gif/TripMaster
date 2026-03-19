import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { getCityImages, getPlaces, themeHeroImages } from '@/lib/curated-data';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const saveSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string(),
  city: z.string(),
  countryCode: z.string().max(3),
  name: z.string(),
  theme: z.enum(['activity', 'healing', 'city']),
});

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode') ?? undefined;
  const city = req.nextUrl.searchParams.get('city') ?? undefined;
  const theme = (req.nextUrl.searchParams.get('theme') as 'activity' | 'healing' | 'city' | 'all' | null) ?? 'all';

  const list = getPlaces({ countryCode, city, theme });
  const images = getCityImages(countryCode, city);
  const heroImages = theme !== 'all' ? themeHeroImages[theme] : [];

  return ok({
    places: list,
    heroImages,
    cityImages: images,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = saveSchema.parse(await req.json());
    const membership = await getMembershipRole(req, body.tripId);
    if (!membership) {
      return fail('Unauthorized', 401);
    }
    if (membership.role !== 'editor') {
      return fail('Editor role required', 403);
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('places')
      .insert({
        trip_id: body.tripId,
        place_ref_id: body.placeId,
        country_code: body.countryCode,
        city: body.city,
        name: body.name,
        theme: body.theme,
        created_by: membership.user.profileId,
      })
      .select('id, trip_id, place_ref_id, country_code, city, name, theme, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to save place', 500);
  }
}
