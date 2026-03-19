import { NextRequest } from 'next/server';
import { entertainmentItems } from '@/lib/info-plan-data';
import { fail, ok } from '@/lib/http';

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode');
  const city = req.nextUrl.searchParams.get('city');
  const type = req.nextUrl.searchParams.get('type') as 'movie' | 'book' | null;
  const mood = req.nextUrl.searchParams.get('mood')?.toLowerCase() ?? '';

  if (!countryCode || !city || !type) {
    return fail('countryCode, city, type are required', 400);
  }

  let base = entertainmentItems
    .filter((item) => item.countryCode === countryCode)
    .filter((item) => item.city.toLowerCase() === city.toLowerCase() || item.city === 'Any')
    .filter((item) => item.type === type);

  if (!base.length) {
    base = entertainmentItems
      .filter((item) => item.countryCode === countryCode)
      .filter((item) => item.type === type);
  }
  if (!base.length) {
    base = entertainmentItems.filter((item) => item.type === type);
  }

  const sorted = [...base].sort((a, b) => {
    const scoreA = mood && a.reason.toLowerCase().includes(mood) ? 1 : 0;
    const scoreB = mood && b.reason.toLowerCase().includes(mood) ? 1 : 0;
    return scoreB - scoreA;
  });

  return ok({
    items: sorted,
  });
}
