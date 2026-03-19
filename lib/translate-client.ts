import { LanguageCode } from '@/lib/types';

const cache = new Map<string, string>();

function detectSourceLanguage(text: string): LanguageCode {
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[ぁ-ゖァ-ヺ]/.test(text)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[äöüß]/i.test(text)) return 'de';
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return 'fr';
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
