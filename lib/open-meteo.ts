export interface OpenMeteoResult {
  emoji: string;
  label: string;
  temperatureC: number | null;
}

const weatherCodeMap: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'Clear sky' },
  1: { emoji: '⛅', label: 'Mostly clear' },
  2: { emoji: '⛅', label: 'Partly cloudy' },
  3: { emoji: '🌫️', label: 'Overcast' },
  45: { emoji: '🌫️', label: 'Fog' },
  48: { emoji: '🌫️', label: 'Depositing rime fog' },
  51: { emoji: '🌧️', label: 'Light drizzle' },
  61: { emoji: '🌧️', label: 'Rain' },
  71: { emoji: '❄️', label: 'Snow fall' },
  80: { emoji: '🌧️', label: 'Rain showers' },
  95: { emoji: '🌩️', label: 'Thunderstorm' },
};

export async function getWeatherByLatLng(lat: number, lng: number): Promise<OpenMeteoResult> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('current', 'temperature_2m,weather_code');

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    return { emoji: '⛅', label: 'Unknown', temperatureC: null };
  }

  const json = (await res.json()) as { current?: { weather_code?: number; temperature_2m?: number } };
  const code = json.current?.weather_code;
  const mapped = typeof code === 'number' ? weatherCodeMap[code] : undefined;

  return {
    emoji: mapped?.emoji ?? '⛅',
    label: mapped?.label ?? 'Unknown',
    temperatureC: typeof json.current?.temperature_2m === 'number' ? json.current.temperature_2m : null,
  };
}
