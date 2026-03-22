import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok } from '@/lib/http';

const schema = z.object({
  text: z.string().min(1).max(8000),
  target: z.enum([
    'en',
    'ko',
    'zh',
    'ja',
    'fr',
    'de',
    'es',
    'pt',
    'it',
    'ru',
    'ar',
    'hi',
    'id',
    'tr',
    'nl',
    'pl',
    'vi',
    'th',
    'ms',
    'sv',
    'no',
    'da',
    'fi',
    'cs',
    'hu',
    'ro',
    'uk',
    'el',
    'he',
    'bn',
    'ur',
    'fa',
    'ta',
  ]),
  source: z
    .enum([
      'en',
      'ko',
      'zh',
      'ja',
      'fr',
      'de',
      'es',
      'pt',
      'it',
      'ru',
      'ar',
      'hi',
      'id',
      'tr',
      'nl',
      'pl',
      'vi',
      'th',
      'ms',
      'sv',
      'no',
      'da',
      'fi',
      'cs',
      'hu',
      'ro',
      'uk',
      'el',
      'he',
      'bn',
      'ur',
      'fa',
      'ta',
    ])
    .optional()
    .default('en'),
});

const langToMemory: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  zh: 'zh-CN',
  ja: 'ja',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt',
  it: 'it',
  ru: 'ru',
  ar: 'ar',
  hi: 'hi',
  id: 'id',
  tr: 'tr',
  nl: 'nl',
  pl: 'pl',
  vi: 'vi',
  th: 'th',
  ms: 'ms',
  sv: 'sv',
  no: 'no',
  da: 'da',
  fi: 'fi',
  cs: 'cs',
  hu: 'hu',
  ro: 'ro',
  uk: 'uk',
  el: 'el',
  he: 'he',
  bn: 'bn',
  ur: 'ur',
  fa: 'fa',
  ta: 'ta',
};

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    if (body.source === body.target) {
      return ok({ translatedText: body.text, source: body.source, target: body.target });
    }

    const langpair = `${langToMemory[body.source]}|${langToMemory[body.target]}`;
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', body.text);
    url.searchParams.set('langpair', langpair);

    const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      return ok({
        translatedText: body.text,
        source: body.source,
        target: body.target,
        fallback: true,
      });
    }

    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
    };

    return ok({
      translatedText: json.responseData?.translatedText ?? body.text,
      source: body.source,
      target: body.target,
      fallback: !json.responseData?.translatedText,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('Invalid payload', 400, { issues: error.flatten() });
    }
    return fail('Translation failed', 500);
  }
}
