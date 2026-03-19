import { NextRequest } from 'next/server';
import { fallbackEvents } from '@/lib/info-plan-data';
import { fail, ok } from '@/lib/http';

function formatDate(value?: string) {
  if (!value) return 'TBD';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('countryCode');
  const city = req.nextUrl.searchParams.get('city');
  if (!countryCode || !city) {
    return fail('countryCode and city are required', 400);
  }

  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (apiKey) {
    try {
      const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('city', city);
      url.searchParams.set('countryCode', countryCode);
      url.searchParams.set('sort', 'date,asc');
      url.searchParams.set('size', '15');
      url.searchParams.set('startDateTime', new Date().toISOString());

      const res = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
      });

      if (res.ok) {
        const json = (await res.json()) as {
          _embedded?: {
            events?: Array<{
              id: string;
              name: string;
              type?: string;
              classifications?: Array<{ segment?: { name?: string } }>;
              dates?: { start?: { localDate?: string; dateTime?: string } };
              _embedded?: { venues?: Array<{ name?: string; city?: { name?: string } }> };
              priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
              url?: string;
            }>;
          };
        };

        const events = (json._embedded?.events ?? []).map((event) => {
          const firstPrice = event.priceRanges?.[0];
          const priceText = firstPrice
            ? `${firstPrice.min ?? '?'}-${firstPrice.max ?? '?'} ${firstPrice.currency ?? ''}`.trim()
            : 'Price info on booking page';

          return {
            id: event.id,
            title: event.name,
            category: event.classifications?.[0]?.segment?.name ?? event.type ?? 'Event',
            date: formatDate(event.dates?.start?.localDate ?? event.dates?.start?.dateTime),
            venue: event._embedded?.venues?.[0]?.name ?? city,
            priceText,
            bookingUrl: event.url ?? 'https://www.ticketmaster.com/',
            source: 'Ticketmaster',
          };
        });

        return ok({
          updatedAt: new Date().toISOString(),
          items: events,
          source: 'live',
        });
      }
    } catch {
      // Falls back below.
    }
  }

  let fallback = fallbackEvents.filter(
    (event) => event.countryCode === countryCode && event.city.toLowerCase() === city.toLowerCase()
  );
  if (!fallback.length) {
    fallback = fallbackEvents.filter((event) => event.countryCode === countryCode);
  }
  if (!fallback.length) {
    fallback = fallbackEvents;
  }

  return ok({
    updatedAt: new Date().toISOString(),
    items: fallback,
    source: 'fallback',
  });
}
