import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { countryCities, getRestaurants } from '@/lib/curated-data';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const saveSchema = z.object({
  tripId: z.string().uuid(),
  restaurantId: z.string(),
  countryCode: z.string().max(3),
  city: z.string(),
  name: z.string(),
  cuisine: z.string(),
});

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode') ?? undefined;
  const city = req.nextUrl.searchParams.get('city') ?? undefined;

  const list = getRestaurants({ countryCode, city });
  const cities = countryCode ? countryCities[countryCode] ?? [] : [];

  return ok({
    restaurants: list,
    availableCities: cities,
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
      .from('restaurants')
      .insert({
        trip_id: body.tripId,
        restaurant_ref_id: body.restaurantId,
        country_code: body.countryCode,
        city: body.city,
        name: body.name,
        cuisine: body.cuisine,
        created_by: membership.user.profileId,
      })
      .select('id, trip_id, restaurant_ref_id, country_code, city, name, cuisine, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to save restaurant', 500);
  }
}
