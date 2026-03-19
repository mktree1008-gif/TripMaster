import { MusicStyle } from '@/lib/types';
import { createSunoProvider } from '@/lib/music/suno';

export interface MusicCreateInput {
  prompt: string;
  style: MusicStyle;
  includeLyrics: boolean;
}

export interface MusicCreateOutput {
  title: string;
  resultUrl: string;
  providerJobId?: string;
}

export interface MusicProvider {
  name: string;
  createSong(input: MusicCreateInput): Promise<MusicCreateOutput>;
}

export function getMusicProvider(): MusicProvider {
  return createSunoProvider({
    apiUrl: process.env.SUNO_API_URL,
    apiKey: process.env.SUNO_API_KEY,
  });
}

export function buildMusicPrompt(params: {
  diaryText: string;
  place: string;
  weatherLabel: string | null;
  recommendedStyle: MusicStyle;
  selectedStyle: MusicStyle;
  includeLyrics: boolean;
}) {
  const style = params.selectedStyle === 'recommended' ? params.recommendedStyle : params.selectedStyle;
  const lyricLine = params.includeLyrics ? 'Include expressive lyrics.' : 'Instrumental only, no lyrics.';

  return [
    `Create a ${style} travel song inspired by this diary entry.`,
    `Place: ${params.place || 'Unknown place'}`,
    `Weather mood: ${params.weatherLabel ?? 'Unspecified weather mood'}`,
    lyricLine,
    'Diary context:',
    params.diaryText,
  ].join('\n');
}

export function recommendMusicStyle(diaryText: string): MusicStyle {
  const text = diaryText.toLowerCase();
  if (text.includes('night') || text.includes('city') || text.includes('neon')) {
    return 'cinematic-pop';
  }
  if (text.includes('mountain') || text.includes('nature') || text.includes('healing')) {
    return 'indie-folk';
  }
  if (text.includes('dance') || text.includes('party') || text.includes('beach')) {
    return 'dance-pop';
  }
  if (text.includes('rain') || text.includes('quiet') || text.includes('alone')) {
    return 'lofi';
  }
  return 'k-pop-ballad';
}
