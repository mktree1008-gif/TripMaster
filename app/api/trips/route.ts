import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { getRequestUser } from '@/lib/auth/request-user';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const createSchema = z.object({
  title: z.string().min(2).max(120),
  destinationCountry: z.string().max(3).optional().nullable(),
  allowMemberPackingEdit: z.boolean().optional(),
});

const patchSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(2).max(120).optional(),
  destinationCountry: z.string().max(3).optional().nullable(),
  allowMemberPackingEdit: z.boolean().optional(),
});

const deleteSchema = z
  .object({
    tripId: z.string().uuid().optional(),
    deleteAll: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.tripId) || value.deleteAll === true, {
    message: 'tripId or deleteAll=true is required',
  });

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return fail('Unauthorized', 401);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('trip_members')
    .select(
      `
      role,
      trips:trip_id (
        id,
        title,
        destination_country,
        allow_member_packing_edit,
        owner_id,
        created_at
      )
    `
    )
    .eq('user_id', user.profileId);

  if (error) {
    return fail(error.message, 500);
  }

  const mapped = (data ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      if (!trip) return null;
      return {
        id: trip.id,
        title: trip.title,
        destinationCountry: trip.destination_country,
        ownerId: trip.owner_id,
        role: row.role,
        allowMemberPackingEdit: Boolean(trip.allow_member_packing_edit),
        createdAt: trip.created_at,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));

  return ok(mapped);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = createSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .insert({
        title: body.title,
        destination_country: body.destinationCountry ?? null,
        allow_member_packing_edit: body.allowMemberPackingEdit ?? false,
        owner_id: user.profileId,
      })
      .select('id, title, destination_country, allow_member_packing_edit, owner_id, created_at')
      .single();

    if (tripError || !trip) {
      return fail(tripError?.message ?? 'Failed to create trip', 500);
    }

    const { error: memberError } = await admin.from('trip_members').insert({
      trip_id: trip.id,
      user_id: user.profileId,
      role: 'editor',
    });

    if (memberError) {
      return fail(memberError.message, 500);
    }

    return ok({
      id: trip.id,
      title: trip.title,
      destinationCountry: trip.destination_country,
      ownerId: trip.owner_id,
      role: 'editor',
      allowMemberPackingEdit: Boolean(trip.allow_member_packing_edit),
      createdAt: trip.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to create trip', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = patchSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: member } = await admin
      .from('trip_members')
      .select('role')
      .eq('trip_id', body.tripId)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (!member || member.role !== 'editor') {
      return fail('Editor role required', 403);
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.title === 'string') updates.title = body.title;
    if (Object.hasOwn(body, 'destinationCountry')) {
      updates.destination_country = body.destinationCountry ?? null;
    }
    if (Object.hasOwn(body, 'allowMemberPackingEdit')) {
      updates.allow_member_packing_edit = Boolean(body.allowMemberPackingEdit);
    }

    const { data, error } = await admin
      .from('trips')
      .update(updates)
      .eq('id', body.tripId)
      .select('id, title, destination_country, allow_member_packing_edit, owner_id, created_at')
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      id: data.id,
      title: data.title,
      destinationCountry: data.destination_country,
      ownerId: data.owner_id,
      role: member.role,
      allowMemberPackingEdit: Boolean(data.allow_member_packing_edit),
      createdAt: data.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to update trip', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return fail('Unauthorized', 401);
    }

    const body = deleteSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    if (body.deleteAll) {
      const { data, error } = await admin
        .from('trips')
        .delete()
        .eq('owner_id', user.profileId)
        .select('id');

      if (error) {
        return fail(error.message, 500);
      }

      return ok({
        deletedCount: data?.length ?? 0,
      });
    }

    const tripId = body.tripId;
    if (!tripId) {
      return fail('tripId is required', 400);
    }

    const { data, error } = await admin
      .from('trips')
      .delete()
      .eq('id', tripId)
      .eq('owner_id', user.profileId)
      .select('id')
      .maybeSingle();

    if (error) {
      return fail(error.message, 500);
    }

    if (!data) {
      return fail('Only the trip owner can delete this trip', 403);
    }

    return ok({ deleted: true, tripId: data.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to delete trip', 500);
  }
}
