import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { buildMusicPrompt, getMusicProvider, recommendMusicStyle } from '@/lib/music/provider';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  diaryId: z.string().uuid(),
  selectedStyle: z.enum([
    'recommended',
    'cinematic-pop',
    'indie-folk',
    'lofi',
    'dance-pop',
    'orchestral',
    'k-pop-ballad',
  ]),
  includeLyrics: z.boolean(),
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

  const diaryId = req.nextUrl.searchParams.get('diaryId');
  const admin = getSupabaseAdminClient();
  let query = admin
    .from('music_jobs')
    .select('id, trip_id, diary_id, style, include_lyrics, prompt, status, result_url, title, error_message, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (diaryId) {
    query = query.eq('diary_id', diaryId);
  }

  const { data, error } = await query;
  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((job) => ({
      id: job.id,
      tripId: job.trip_id,
      diaryId: job.diary_id,
      style: job.style,
      includeLyrics: job.include_lyrics,
      prompt: job.prompt,
      status: job.status,
      resultUrl: job.result_url,
      title: job.title,
      errorMessage: job.error_message,
      createdAt: job.created_at,
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
    const { data: diary, error: diaryError } = await admin
      .from('diaries')
      .select('id, content, place, weather_label')
      .eq('trip_id', body.tripId)
      .eq('id', body.diaryId)
      .single();

    if (diaryError || !diary) {
      return fail('Diary not found', 404);
    }

    const recommendedStyle = recommendMusicStyle(diary.content);
    const prompt = buildMusicPrompt({
      diaryText: diary.content,
      place: diary.place,
      weatherLabel: diary.weather_label,
      recommendedStyle,
      selectedStyle: body.selectedStyle,
      includeLyrics: body.includeLyrics,
    });
    const finalStyle = body.selectedStyle === 'recommended' ? recommendedStyle : body.selectedStyle;

    const { data: createdJob, error: insertError } = await admin
      .from('music_jobs')
      .insert({
        trip_id: body.tripId,
        diary_id: body.diaryId,
        created_by: membership.user.profileId,
        style: finalStyle,
        include_lyrics: body.includeLyrics,
        prompt,
        status: 'queued',
      })
      .select('id')
      .single();

    if (insertError || !createdJob) {
      return fail(insertError?.message ?? 'Failed to create music job', 500);
    }

    const provider = getMusicProvider();

    try {
      await admin.from('music_jobs').update({ status: 'running' }).eq('id', createdJob.id);

      const result = await provider.createSong({
        prompt,
        style: finalStyle,
        includeLyrics: body.includeLyrics,
      });

      await admin
        .from('music_jobs')
        .update({
          status: 'succeeded',
          result_url: result.resultUrl,
          title: result.title,
          error_message: null,
        })
        .eq('id', createdJob.id);

      await admin.from('music_tracks').insert({
        trip_id: body.tripId,
        diary_id: body.diaryId,
        music_job_id: createdJob.id,
        provider_name: provider.name,
        provider_track_id: result.providerJobId ?? null,
        title: result.title,
        track_url: result.resultUrl,
      });
    } catch (providerError) {
      const message = providerError instanceof Error ? providerError.message : 'Unknown provider error';
      await admin
        .from('music_jobs')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', createdJob.id);
    }

    const { data: finalJob, error: finalError } = await admin
      .from('music_jobs')
      .select('id, trip_id, diary_id, style, include_lyrics, prompt, status, result_url, title, error_message, created_at')
      .eq('id', createdJob.id)
      .single();

    if (finalError) {
      return fail(finalError.message, 500);
    }

    return ok({
      id: finalJob.id,
      tripId: finalJob.trip_id,
      diaryId: finalJob.diary_id,
      style: finalJob.style,
      includeLyrics: finalJob.include_lyrics,
      prompt: finalJob.prompt,
      status: finalJob.status,
      resultUrl: finalJob.result_url,
      title: finalJob.title,
      errorMessage: finalJob.error_message,
      createdAt: finalJob.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create music job', 500);
  }
}
