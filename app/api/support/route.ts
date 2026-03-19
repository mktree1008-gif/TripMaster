import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  category: z.enum(['contact', 'improvement']),
  title: z.string().min(2).max(140),
  message: z.string().min(3).max(5000),
});

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return fail('Unauthorized', 401);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('support_requests')
    .select('id, category, title, message, created_at')
    .eq('user_id', user.profileId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return fail(error.message, 500);
  }

  return ok(
    (data ?? []).map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = createSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('support_requests')
      .insert({
        user_id: user.profileId,
        category: body.category,
        title: body.title,
        message: body.message,
      })
      .select('id, category, title, message, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }
    return ok({
      id: data.id,
      category: data.category,
      title: data.title,
      message: data.message,
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to submit support request', 500);
  }
}
