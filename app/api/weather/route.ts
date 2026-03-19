import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { getWeatherByLatLng } from '@/lib/open-meteo';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.parse({
      lat: req.nextUrl.searchParams.get('lat'),
      lng: req.nextUrl.searchParams.get('lng'),
    });

    const weather = await getWeatherByLatLng(parsed.lat, parsed.lng);
    return ok(weather);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid coordinates', 400, { issues: error.flatten() });
    }
    return fail('Failed to fetch weather', 500);
  }
}
