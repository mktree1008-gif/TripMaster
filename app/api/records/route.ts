import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(1).max(120),
  note: z.string().max(4000).optional().default(''),
  mediaUrls: z.array(z.string().url()).default([]),
});

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get('tripId');
  if (!tripId) {
    return fail('tripId is required', 400);
  }

  const membership = await getMembershipRole(req, tripId);
  if (!membership) {
    return fail('Unauthorized', 401);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('records')
    .select('id, trip_id, title, note, media_urls, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((entry) => ({
      id: entry.id,
      tripId: entry.trip_id,
      title: entry.title,
      note: entry.note,
      mediaUrls: entry.media_urls ?? [],
      createdAt: entry.created_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = createSchema.parse(await req.json());
    const membership = await getMembershipRole(req, body.tripId);
    if (!membership) {
      return fail('Unauthorized', 401);
    }
    if (membership.role !== 'editor') {
      return fail('Editor role required', 403);
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('records')
      .insert({
        trip_id: body.tripId,
        title: body.title,
        note: body.note,
        media_urls: body.mediaUrls,
        created_by: membership.user.profileId,
      })
      .select('id, trip_id, title, note, media_urls, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok({
      id: data.id,
      tripId: data.trip_id,
      title: data.title,
      note: data.note,
      mediaUrls: data.media_urls ?? [],
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create record', 500);
  }
}
