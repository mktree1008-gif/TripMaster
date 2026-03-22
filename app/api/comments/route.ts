import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  targetType: z.enum(['diary', 'record', 'music', 'tripstargram']),
  targetId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  emoji: z.string().max(8).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get('tripId');
  const targetType = req.nextUrl.searchParams.get('targetType');
  const targetId = req.nextUrl.searchParams.get('targetId');

  if (!tripId || !targetType || !targetId) {
    return fail('tripId, targetType, targetId are required', 400);
  }

  const membership = await getMembershipRole(req, tripId);
  if (!membership) {
    return fail('Unauthorized', 401);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('comments')
    .select('id, trip_id, target_type, target_id, content, emoji, author_nickname, created_at')
    .eq('trip_id', tripId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });

  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      targetType: row.target_type,
      targetId: row.target_id,
      content: row.content,
      emoji: row.emoji,
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

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('comments')
      .insert({
        trip_id: body.tripId,
        target_type: body.targetType,
        target_id: body.targetId,
        content: body.content,
        emoji: body.emoji ?? null,
        author_id: membership.user.profileId,
        author_nickname: membership.user.nickname,
      })
      .select('id, trip_id, target_type, target_id, content, emoji, author_nickname, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok({
      id: data.id,
      tripId: data.trip_id,
      targetType: data.target_type,
      targetId: data.target_id,
      content: data.content,
      emoji: data.emoji,
      authorNickname: data.author_nickname,
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create comment', 500);
  }
}
