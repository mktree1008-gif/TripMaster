import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/http';
import { transportationByCountry } from '@/lib/info-plan-data';

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode');
  if (!countryCode) {
    return fail('countryCode is required', 400);
  }

  const options = transportationByCountry[countryCode] ?? [
    {
      mode: 'Public transit + walk',
      reason: 'A safe default for most cities.',
      estimatedCost: 'USD 6-20/day',
      bookingUrl: 'https://www.google.com/travel/',
    },
  ];

  return ok({
    countryCode,
    options,
  });
}
