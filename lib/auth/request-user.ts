import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export interface RequestUser {
  authUserId: string;
  profileId: string;
  nickname: string;
}

export async function getAuthUserIdFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();
  if (!accessToken) {
    return null;
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser | null> {
  const authUserId = await getAuthUserIdFromRequest(req);
  if (!authUserId) {
    return null;
  }

  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('id, nickname')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    authUserId,
    profileId: profile.id,
    nickname: profile.nickname,
  };
}

export async function getMembershipRole(req: NextRequest, tripId: string) {
  const user = await getRequestUser(req);
  if (!user) {
    return null;
  }

  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.profileId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    user,
    role: data.role as 'viewer' | 'editor',
  };
}
