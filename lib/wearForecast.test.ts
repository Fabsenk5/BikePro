import { describe, expect, it } from 'vitest';
import { computeBikePaceKmPerDay, dueWeeks, formatForecast } from './wearForecast';

const day = 86_400_000;

describe('computeBikePaceKmPerDay', () => {
    it('computes km per day per bike from the first ride date', () => {
        const now = Date.now();
        const tenDaysAgo = new Date(now - 10 * day).toISOString().slice(0, 10);
        const today = new Date(now).toISOString().slice(0, 10);
        const pace = computeBikePaceKmPerDay([
            { bikeId: 'a', distanceKm: 100, date: tenDaysAgo },
            { bikeId: 'a', distanceKm: 50, date: today },
            { bikeId: 'b', distanceKm: 10, date: tenDaysAgo },
            { distanceKm: 999, date: tenDaysAgo }, // no bikeId → ignored
            { bikeId: 'c', distanceKm: -5, date: tenDaysAgo }, // invalid km → ignored
        ]);
        expect(pace.a).toBeGreaterThan(13);
        expect(pace.a).toBeLessThan(16);
        expect(pace.b).toBeGreaterThan(0.9);
        expect(pace.b).toBeLessThan(1.01);
        expect(pace.c).toBeUndefined();
    });

    it('handles empty input', () => {
        expect(computeBikePaceKmPerDay([])).toEqual({});
    });
});

describe('dueWeeks', () => {
    it('returns null when overdue or no pace data', () => {
        expect(dueWeeks(0, 1)).toBeNull();
        expect(dueWeeks(-5, 1)).toBeNull();
        expect(dueWeeks(100, 0)).toBeNull();
    });

    it('converts remaining km and daily pace to weeks', () => {
        expect(dueWeeks(70, 10)).toBeCloseTo(1);
        expect(dueWeeks(140, 10)).toBeCloseTo(2);
    });
});

describe('formatForecast', () => {
    const t = (key: string, opts?: Record<string, unknown>) =>
        `${key}${opts ? ':' + JSON.stringify(opts) : ''}`;

    it('uses the days key below one week', () => {
        expect(formatForecast(t, 'de', 0.5)).toContain('shred.forecast_days');
    });

    it('uses the weeks key from one week on', () => {
        expect(formatForecast(t, 'de', 2)).toContain('shred.forecast_weeks');
    });
});
