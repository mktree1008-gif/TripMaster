import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  mode: z.enum(['auto', 'manual']).default('manual'),
  diaryId: z.string().uuid().optional(),
  caption: z.string().max(2200).optional(),
  mediaUrl: z.string().optional().nullable(),
});

function hashtagsFromText(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 5);
  return Array.from(new Set(words)).map((word) => `#${word}`);
}

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
    .from('tripstargram_posts')
    .select('id, trip_id, diary_id, image_url, media_url, caption, hashtags, author_nickname, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      diaryId: row.diary_id,
      imageUrl: row.image_url,
      mediaUrl: row.media_url,
      caption: row.caption,
      hashtags: row.hashtags ?? [],
      authorNickname: row.author_nickname,
      createdAt: row.created_at,
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
    let caption = body.caption?.trim() ?? '';
    let mediaUrl = body.mediaUrl ?? null;
    let diaryId: string | null = body.diaryId ?? null;

    if (body.mode === 'auto') {
      if (!body.diaryId) {
        return fail('diaryId is required for auto mode', 400);
      }
      const { data: diary, error: diaryError } = await admin
        .from('diaries')
        .select('id, title, content, place, date, media_urls')
        .eq('trip_id', body.tripId)
        .eq('id', body.diaryId)
        .single();

      if (diaryError || !diary) {
        return fail('Diary not found', 404);
      }

      const autoMedia = Array.isArray(diary.media_urls) && diary.media_urls.length ? diary.media_urls[0] : null;
      mediaUrl = mediaUrl ?? autoMedia;
      caption = caption || `${diary.title} — ${diary.place} (${diary.date})\n${String(diary.content).slice(0, 280)}`;
      diaryId = diary.id;
    }

    if (!caption) {
      return fail('caption is required', 400);
    }

    const hashtags = hashtagsFromText(caption);
    const { data, error } = await admin
      .from('tripstargram_posts')
      .insert({
        trip_id: body.tripId,
        diary_id: diaryId,
        media_url: mediaUrl,
        image_url: mediaUrl,
        caption,
        hashtags,
        author_id: membership.user.profileId,
        author_nickname: membership.user.nickname,
      })
      .select('id, trip_id, diary_id, image_url, media_url, caption, hashtags, author_nickname, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      id: data.id,
      tripId: data.trip_id,
      diaryId: data.diary_id,
      imageUrl: data.image_url,
      mediaUrl: data.media_url,
      caption: data.caption,
      hashtags: data.hashtags ?? [],
      authorNickname: data.author_nickname,
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create tripstargram post', 500);
  }
}
