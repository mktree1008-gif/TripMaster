import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMembershipRole } from '@/lib/auth/request-user';
import { fail, ok } from '@/lib/http';
import { transportationByCountry } from '@/lib/info-plan-data';

const surveySchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const createPlanSchema = z.object({
  tripId: z.string().uuid(),
  countryCode: z.string().max(3),
  city: z.string().min(1),
  departureDate: z.string(),
  returnDate: z.string(),
  returnFlightTime: z.string().default('18:00'),
  mode: z.enum(['specific', 'simple']),
  purpose: z.string().default('general'),
  mood: z.string().default('balanced'),
  companion: z.string().default('solo'),
  peopleCount: z.number().int().min(1).max(30).default(1),
  stylePreference: z.string().default('balanced'),
  budgetKrw: z.number().int().min(100000).max(50000000).default(2000000),
  likesNightView: z.boolean().default(true),
  likesAlcohol: z.boolean().default(false),
  foodFocus: z.enum(['low', 'medium', 'high']).default('medium'),
  surveyAnswers: z.array(surveySchema).length(5),
  selectedPlaces: z.array(z.string()).default([]),
});

function toDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenInclusive(start: Date, end: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const raw = Math.floor((end.getTime() - start.getTime()) / oneDay) + 1;
  return Math.max(1, raw);
}

export async function POST(req: NextRequest) {
  try {
    const body = createPlanSchema.parse(await req.json());
    const membership = await getMembershipRole(req, body.tripId);
    if (!membership) {
      return fail('Unauthorized', 401);
    }

    const start = toDate(body.departureDate);
    const end = toDate(body.returnDate);
    if (!start || !end || end < start) {
      return fail('Invalid departure/return date range', 400);
    }

    const dayCount = Math.min(daysBetweenInclusive(start, end), 14);
    const relaxScore = body.surveyAnswers.reduce((acc, cur) => {
      const lower = cur.answer.toLowerCase();
      if (lower.includes('relax') || lower.includes('slow') || lower.includes('rest')) return acc + 2;
      if (lower.includes('balanced')) return acc + 1;
      return acc;
    }, 0);

    const moodBonus = body.mood.includes('healing') || body.mood.includes('rest') || body.mood.includes('stress') ? 2 : 0;
    const isRelaxed = relaxScore + moodBonus >= 5;
    const mode = body.mode;

    const itinerary = Array.from({ length: dayCount }, (_, idx) => {
      const day = idx + 1;
      const isLastDay = day === dayCount;
      const pace = mode === 'specific' ? (isRelaxed ? 'balanced' : 'active') : 'light';
      const placeHint = body.selectedPlaces[idx % Math.max(body.selectedPlaces.length, 1)] ?? `${body.city} highlight`;

      if (isLastDay) {
        return {
          day,
          title: `Departure day (${body.returnFlightTime} flight)`,
          blocks: [
            `08:30 - Easy breakfast near ${body.city} center`,
            `10:00 - Last walk around ${placeHint}`,
            `13:00 - Airport transfer`,
            `${body.returnFlightTime} - Return flight`,
          ],
          pace,
        };
      }

      const eveningBlock = body.likesAlcohol
        ? body.likesNightView
          ? '20:00 - Rooftop bar + skyline view'
          : '20:00 - Local pub / bar street experience'
        : body.likesNightView
          ? '20:00 - Scenic night walk / observatory'
          : '20:00 - Relaxing tea & rest';

      const foodBlock =
        body.foodFocus === 'high'
          ? '12:30 - Signature local food route (market + famous restaurant)'
          : body.foodFocus === 'medium'
            ? '12:30 - Local lunch spot recommendation'
            : '12:30 - Light meal near next attraction';

      if (mode === 'simple') {
        return {
          day,
          title: `Day ${day} relaxed route (${body.companion}, ${body.peopleCount}pax)`,
          blocks: [
            '10:00 - Slow start brunch',
            `12:00 - Main destination: ${placeHint}`,
            foodBlock,
            '16:00 - Cafe / photo break',
            eveningBlock,
          ],
          pace,
        };
      }

      return {
        day,
        title: `Day ${day} detailed route (${body.stylePreference})`,
        blocks: [
          '08:30 - Morning local breakfast',
          `10:00 - Core activity at ${placeHint}`,
          foodBlock,
          '13:30 - Transit to next zone',
          '15:00 - Secondary attraction / shopping',
          '18:30 - Dinner reservation',
          eveningBlock,
        ],
        pace,
      };
    });

    const transportation = transportationByCountry[body.countryCode] ?? [
      {
        mode: 'Public transit + walk',
        reason: 'Most convenient default option for city travel.',
        estimatedCost: 'USD 6-20/day',
        bookingUrl: 'https://www.google.com/travel/',
      },
    ];

    const perDayBase = isRelaxed ? 180000 : 250000;
    const styleMultiplier = body.mode === 'specific' ? 1.18 : 0.94;
    const peopleMultiplier = 0.7 + body.peopleCount * 0.65;
    const foodMultiplier = body.foodFocus === 'high' ? 1.2 : body.foodFocus === 'medium' ? 1.08 : 0.95;
    const nightlifeMultiplier = body.likesNightView ? 1.05 : 1;
    const alcoholMultiplier = body.likesAlcohol ? 1.08 : 1;
    const estimatedCostKrw = Math.round(
      dayCount * perDayBase * styleMultiplier * peopleMultiplier * foodMultiplier * nightlifeMultiplier * alcoholMultiplier
    );
    const budgetUsageRatio = Math.min(estimatedCostKrw / body.budgetKrw, 2);
    const overBudgetKrw = Math.max(estimatedCostKrw - body.budgetKrw, 0);

    return ok({
      itinerary,
      transportation,
      budget: {
        budgetKrw: body.budgetKrw,
        estimatedCostKrw,
        overBudgetKrw,
        usagePercent: Math.round(budgetUsageRatio * 100),
      },
      travelerProfile: {
        purpose: body.purpose,
        mood: body.mood,
        companion: body.companion,
        peopleCount: body.peopleCount,
        stylePreference: body.stylePreference,
        budgetKrw: body.budgetKrw,
        likesNightView: body.likesNightView,
        likesAlcohol: body.likesAlcohol,
        foodFocus: body.foodFocus,
      },
      recommendationSummary: isRelaxed
        ? `Relaxed schedule tuned for ${body.foodFocus} food focus${body.likesNightView ? ', night-view friendly' : ''}.`
        : `Efficient sightseeing schedule tuned for ${body.foodFocus} food focus${body.likesAlcohol ? ' and nightlife' : ''}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Failed to generate plan', 500);
  }
}
