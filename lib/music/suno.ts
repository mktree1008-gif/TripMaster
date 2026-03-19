import { MusicCreateInput, MusicCreateOutput, MusicProvider } from '@/lib/music/provider';

interface SunoConfig {
  apiUrl?: string;
  apiKey?: string;
}

export function createSunoProvider(config: SunoConfig): MusicProvider {
  return {
    name: 'suno-compatible',
    async createSong(input: MusicCreateInput): Promise<MusicCreateOutput> {
      if (!config.apiUrl || !config.apiKey) {
        return {
          title: `${input.style} Travel Sketch`,
          resultUrl: 'https://example.com/music-preview',
        };
      }

      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          prompt: input.prompt,
          style: input.style,
          withLyrics: input.includeLyrics,
        }),
      });

      if (!res.ok) {
        throw new Error(`Music provider request failed: ${res.status}`);
      }

      const json = (await res.json()) as {
        id?: string;
        title?: string;
        audio_url?: string;
        url?: string;
      };

      return {
        title: json.title ?? `${input.style} Travel Track`,
        resultUrl: json.audio_url ?? json.url ?? 'https://example.com/music-fallback',
        providerJobId: json.id,
      };
    },
  };
}
