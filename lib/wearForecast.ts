/**
 * Wear forecast helpers — predicts when a wear item reaches its service
 * interval based on the rider's average daily distance (from Ride-Log).
 */

export interface RideLike {
    bikeId?: string;
    distanceKm?: number;
    date?: string;
}

/**
 * Average km per day per bike, derived from rides with a bikeId + distance.
 * Falls back to the single-ride day span to avoid dividing by zero.
 */
export function computeBikePaceKmPerDay(rides: RideLike[]): Record<string, number> {
    const stats: Record<string, { km: number; firstTs: number }> = {};
    for (const r of rides ?? []) {
    const bikeId = r.bikeId;
    const km = Number(r.distanceKm);
    if (!bikeId || !km || km <= 0 || !r.date) continue;
    const ts = new Date(r.date).getTime();
        if (isNaN(ts)) continue;
        const s = stats[bikeId] ?? { km: 0, firstTs: Infinity };
        s.km += km;
        if (ts < s.firstTs) s.firstTs = ts;
        stats[bikeId] = s;
    }
    const now = Date.now();
    const pace: Record<string, number> = {};
    for (const [bikeId, s] of Object.entries(stats)) {
        const days = Math.max(1, Math.round((now - s.firstTs) / 86_400_000));
        pace[bikeId] = s.km / days;
    }
    return pace;
}

/**
 * Weeks until the item hits its service interval, or null when there is
 * nothing to predict (already overdue, no remaining km, no pace data).
 */
export function dueWeeks(remainingKm: number, kmPerDay: number): number | null {
    if (!remainingKm || remainingKm <= 0) return null;
    if (!kmPerDay || kmPerDay <= 0) return null;
    return remainingKm / kmPerDay / 7;
}

type TranslateFn = (key: string, options?: Record<string, any>) => string;

/**
 * Localized forecast text without prefix: "heute", "~in 3 Tagen",
 * "~in 3 Wo (12.08.)". Uses the shred.* translation keys.
 */
export function formatForecast(t: TranslateFn, language: string, weeks: number): string {
    if (weeks < 1) {
        const days = Math.max(1, Math.round(weeks * 7));
        if (days <= 1) return t('shred.forecast_today');
        return t('shred.forecast_days', { days });
    }
    const date = new Date(Date.now() + weeks * 7 * 86_400_000).toLocaleDateString(language, {
        day: '2-digit',
        month: '2-digit',
    });
    const weeksRounded = Math.max(1, Math.round(weeks));
    return t('shred.forecast_weeks', { weeks: weeksRounded, date });
}
