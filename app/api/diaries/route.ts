import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(1).max(120),
  content: z.string().min(1),
  date: z.string(),
  place: z.string().min(1),
  weatherEmoji: z.string().min(1).max(4),
  weatherLabel: z.string().nullable().optional(),
  mediaUrls: z.array(z.string().url()).default([]),
});

const updateSchema = createSchema.extend({
  diaryId: z.string().uuid(),
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
    .from('diaries')
    .select('id, trip_id, title, content, date, place, weather_emoji, weather_label, media_urls, created_at')
    .eq('trip_id', tripId)
    .order('date', { ascending: false });

  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((entry) => ({
      id: entry.id,
      tripId: entry.trip_id,
      title: entry.title,
      content: entry.content,
      date: entry.date,
      place: entry.place,
      weatherEmoji: entry.weather_emoji,
      weatherLabel: entry.weather_label,
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
      .from('diaries')
      .insert({
        trip_id: body.tripId,
        title: body.title,
        content: body.content,
        date: body.date,
        place: body.place,
        weather_emoji: body.weatherEmoji,
        weather_label: body.weatherLabel ?? null,
        media_urls: body.mediaUrls,
        created_by: membership.user.profileId,
      })
      .select('id, trip_id, title, content, date, place, weather_emoji, weather_label, media_urls, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok({
      id: data.id,
      tripId: data.trip_id,
      title: data.title,
      content: data.content,
      date: data.date,
      place: data.place,
      weatherEmoji: data.weather_emoji,
      weatherLabel: data.weather_label,
      mediaUrls: data.media_urls ?? [],
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create diary', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = updateSchema.parse(await req.json());
    const membership = await getMembershipRole(req, body.tripId);
    if (!membership) {
      return fail('Unauthorized', 401);
    }
    if (membership.role !== 'editor') {
      return fail('Editor role required', 403);
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('diaries')
      .update({
        title: body.title,
        content: body.content,
        date: body.date,
        place: body.place,
        weather_emoji: body.weatherEmoji,
        weather_label: body.weatherLabel ?? null,
        media_urls: body.mediaUrls,
      })
      .eq('id', body.diaryId)
      .eq('trip_id', body.tripId)
      .select('id, trip_id, title, content, date, place, weather_emoji, weather_label, media_urls, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok({
      id: data.id,
      tripId: data.trip_id,
      title: data.title,
      content: data.content,
      date: data.date,
      place: data.place,
      weatherEmoji: data.weather_emoji,
      weatherLabel: data.weather_label,
      mediaUrls: data.media_urls ?? [],
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to update diary', 500);
  }
}
