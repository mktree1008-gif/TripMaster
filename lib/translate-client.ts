import { LanguageCode } from '@/lib/types';

const cache = new Map<string, string>();

function detectSourceLanguage(text: string): LanguageCode {
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[ぁ-ゖァ-ヺ]/.test(text)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0370-\u03FF]/.test(text)) return 'el';
  if (/[іїєґІЇЄҐ]/.test(text)) return 'uk';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[ٹڈڑے]+/.test(text)) return 'ur';
  if (/[پچژگ]+/.test(text)) return 'fa';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[äöüß]/i.test(text)) return 'de';
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return 'fr';
  if (/[ñ¡¿]/i.test(text)) return 'es';
  if (/[ăâđêôơư]/i.test(text)) return 'vi';
  if (/[ăîșț]/i.test(text)) return 'ro';
  if (/[áčďéěíňóřšťúůýž]/i.test(text)) return 'cs';
  if (/[áéíóöőúüű]/i.test(text)) return 'hu';
  if (/[ãõç]/i.test(text)) return 'pt';
  if (/[ìòàù]/i.test(text)) return 'it';
  if (/[ğışİçöü]/i.test(text)) return 'tr';
  if (/[ąćęłńóśźż]/i.test(text)) return 'pl';
  return 'en';
}

export async function translateText(text: string, target: LanguageCode, source?: LanguageCode) {
  const resolvedSource = source ?? detectSourceLanguage(text);
  const key = `${resolvedSource}:${target}:${text}`;
  if (cache.has(key)) {
    return cache.get(key) as string;
  }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        target,
        source: resolvedSource,
      }),
    });

    const json = (await res.json()) as { ok: boolean; data?: { translatedText?: string } };
    const translated = json.data?.translatedText ?? text;
    cache.set(key, translated);
    return translated;
  } catch {
    return text;
  }
}
