/**
 * OpenWeatherMap integration for the Park-Picker.
 *
 * Requires EXPO_PUBLIC_OPENWEATHER_KEY (see .env.example). Results are cached
 * in AsyncStorage with a TTL so the free tier (1000 calls/day) is never
 * exhausted by a single user session (57 parks × 30 min).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const CACHE_KEY = '@bikepro_weather_cache';
const CACHE_TTL_MS = 30 * 60 * 1000;

export const hasWeatherKey = !!process.env.EXPO_PUBLIC_OPENWEATHER_KEY;

export interface ParkWeather {
    temp: number;          // °C
    code: number;          // OpenWeather weather id
    wind: number;          // km/h
    rain: number;          // mm/h (last hour, may be 0)
    fetchedAt: number;     // epoch ms
}

interface CacheEntry {
    [parkId: string]: ParkWeather;
}

function mapWeatherCode(code: number): { icon: string; key: string; score: number } {
    // Weather id groups: 2xx thunder, 3xx drizzle, 5xx rain, 6xx snow,
    // 7xx atmosphere, 800 clear, 80x clouds
    if (code >= 200 && code < 300) return { icon: '⛈️', key: 'thunder', score: -3 };
    if (code >= 300 && code < 500) return { icon: '🌦️', key: 'drizzle', score: 1 };
    if (code >= 500 && code < 600) return { icon: '🌧️', key: 'rain', score: -2 };
    if (code >= 600 && code < 700) return { icon: '❄️', key: 'snow', score: -1 };
    if (code >= 700 && code < 800) return { icon: '🌫️', key: 'fog', score: 0 };
    if (code === 800) return { icon: '☀️', key: 'clear', score: 3 };
    return { icon: '⛅', key: 'clouds', score: 2 };
}

export function weatherInfo(code: number) {
    return mapWeatherCode(code);
}

async function readCache(): Promise<CacheEntry> {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/**
 * Current weather for a park. Returns cached data when fresh, fetches
 * otherwise. Returns null when no API key is configured or the request fails.
 */
export async function fetchParkWeather(parkId: string, lat: number, lon: number, force = false): Promise<ParkWeather | null> {
    if (!hasWeatherKey) return null;

    const cache = await readCache();
    const cached = cache[parkId];
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached;
    }

    try {
        const url = `${API_URL}?lat=${lat}&lon=${lon}&appid=${process.env.EXPO_PUBLIC_OPENWEATHER_KEY}&units=metric`;
        const res = await fetch(url);
        if (!res.ok) return cached ?? null;
        const data = await res.json();
        const weather: ParkWeather = {
            temp: Math.round(data.main?.temp ?? 0),
            code: data.weather?.[0]?.id ?? 800,
            wind: data.wind?.speed ? Math.round(data.wind.speed * 3.6) : 0,
            rain: Math.round((data.rain?.['1h'] ?? 0) * 10) / 10,
            fetchedAt: Date.now(),
        };
        cache[parkId] = weather;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return weather;
    } catch (e) {
        console.warn(`[weather] Fetch failed for ${parkId}:`, e);
        return cached ?? null;
    }
}

/** Loads weather for all parks with minimal concurrency, returns a map. */
export async function fetchWeatherForParks(
    parks: { id: string; lat: number; lon: number }[],
    force = false,
): Promise<Record<string, ParkWeather>> {
    const result: Record<string, ParkWeather> = {};
    const cache = await readCache();
    const todo: { id: string; lat: number; lon: number }[] = [];

    for (const p of parks) {
        const cached = cache[p.id];
        if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            result[p.id] = cached;
        } else {
            todo.push(p);
        }
    }

    const BATCH = 5;
    for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        await Promise.all(batch.map(async p => {
            const w = await fetchParkWeather(p.id, p.lat, p.lon, force);
            if (w) result[p.id] = w;
        }));
    }
    return result;
}
