import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { getRequestUser } from '@/lib/auth/request-user';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  tripId: z.string().uuid(),
  role: z.enum(['viewer', 'editor']),
});

const acceptSchema = z.object({
  code: z.string().min(10),
});

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return fail('Unauthorized', 401);
  }

  const tripId = req.nextUrl.searchParams.get('tripId');
  if (!tripId) {
    return fail('tripId is required', 400);
  }

  const admin = getSupabaseAdminClient();
  const { data: membership } = await admin
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.profileId)
    .maybeSingle();

  if (!membership || membership.role !== 'editor') {
    return fail('Editor role required', 403);
  }

  const { data, error } = await admin
    .from('invites')
    .select('id, trip_id, code, role, status, expires_at, invited_by, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    return fail(error.message, 500);
  }

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = createSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: membership } = await admin
      .from('trip_members')
      .select('role')
      .eq('trip_id', body.tripId)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (!membership || membership.role !== 'editor') {
      return fail('Editor role required', 403);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const code = randomBytes(10).toString('hex');

    const { data, error } = await admin
      .from('invites')
      .insert({
        trip_id: body.tripId,
        role: body.role,
        code,
        invited_by: user.profileId,
        expires_at: expiresAt,
        status: 'pending',
      })
      .select('id, trip_id, code, role, status, expires_at, invited_by, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      ...data,
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/?invite=${code}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create invite', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = acceptSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: invite, error: inviteError } = await admin
      .from('invites')
      .select('id, trip_id, role, status, expires_at')
      .eq('code', body.code)
      .maybeSingle();

    if (inviteError || !invite) {
      return fail('Invite not found', 404);
    }

    if (invite.status !== 'pending') {
      return fail('Invite is not active', 400);
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from('invites').update({ status: 'expired' }).eq('id', invite.id);
      return fail('Invite expired', 410);
    }

    const { error: memberError } = await admin.from('trip_members').upsert(
      {
        trip_id: invite.trip_id,
        user_id: user.profileId,
        role: invite.role,
      },
      { onConflict: 'trip_id,user_id' }
    );

    if (memberError) {
      return fail(memberError.message, 500);
    }

    await admin.from('invites').update({ status: 'accepted' }).eq('id', invite.id);
    return ok({ accepted: true, tripId: invite.trip_id, role: invite.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to accept invite', 500);
  }
}
