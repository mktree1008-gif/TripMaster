import { NextRequest } from 'next/server';
import { destinationInformation, InfoTopic } from '@/lib/info-plan-data';
import { fail, ok } from '@/lib/http';

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode');
  const city = req.nextUrl.searchParams.get('city');
  const topic = (req.nextUrl.searchParams.get('topic') as InfoTopic | null) ?? 'overview';

  if (!countryCode) {
    return fail('countryCode is required', 400);
  }

  const candidates = destinationInformation.filter((item) => item.countryCode === countryCode);
  const info = city
    ? candidates.find((item) => item.city.toLowerCase() === city.toLowerCase()) ?? candidates[0]
    : candidates[0];

  if (!info) {
    return fail('No information found for the destination', 404);
  }

  return ok({
    countryCode: info.countryCode,
    country: info.country,
    city: info.city,
    topic,
    text: info[topic],
    all: {
      overview: info.overview,
      history: info.history,
      society: info.society,
      economy: info.economy,
    },
  });
}
