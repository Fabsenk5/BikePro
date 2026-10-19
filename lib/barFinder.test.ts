import { describe, expect, it } from 'vitest';
import { HANDLEBARS } from '../constants/handlebars';
import {
    barTarget,
    barTargetRiseMm,
    barTargetWidthMm,
    EMPTY_FILTER,
    matchesFilter,
    scoreBars,
} from './barFinder';

describe('barTargetWidthMm', () => {
    it('targets height- and style-based widths, clamped to real bars', () => {
        expect(barTargetWidthMm({ heightMm: 1700, style: 'balanced', currentWidthMm: null })).toEqual({
            value: 760,
            base: 'height',
        });
        expect(barTargetWidthMm({ heightMm: 1880, style: 'balanced', currentWidthMm: null }).value).toBe(780);
        expect(barTargetWidthMm({ heightMm: 1950, style: 'stable', currentWidthMm: null }).value).toBe(810);
        expect(barTargetWidthMm({ heightMm: 1700, style: 'playful', currentWidthMm: null }).value).toBe(740);
        expect(barTargetWidthMm({ heightMm: null, style: 'balanced', currentWidthMm: 785 })).toEqual({
            value: 785,
            base: 'current',
        });
        expect(barTargetWidthMm({ heightMm: null, style: 'balanced', currentWidthMm: null })).toEqual({
            value: 780,
            base: 'fallback',
        });
    });
});

describe('barTargetRiseMm', () => {
    it('shifts from the current bar by symptoms, clamped 0..60', () => {
        expect(barTargetRiseMm({ currentRiseMm: 20, handPressure: false, barTooHigh: false })).toEqual({
            value: 20,
            reasons: ['current'],
        });
        expect(barTargetRiseMm({ currentRiseMm: 20, handPressure: true, barTooHigh: false }).value).toBe(40);
        expect(barTargetRiseMm({ currentRiseMm: 20, handPressure: false, barTooHigh: true }).value).toBe(10);
        expect(barTargetRiseMm({ currentRiseMm: null, handPressure: false, barTooHigh: false }).value).toBe(30);
        expect(barTargetRiseMm({ currentRiseMm: 55, handPressure: true, barTooHigh: false }).value).toBe(60);
    });
});

describe('barTarget', () => {
    it('combines width, rise, sweep preference and shoulder info', () => {
        const t = barTarget({
            heightMm: 1880,
            shoulderMm: 460,
            currentWidthMm: 780,
            currentRiseMm: 20,
            style: 'balanced',
            handPressure: true,
            barTooHigh: false,
        });
        expect(t.widthMm).toBe(780);
        expect(t.riseMm).toBe(40);
        expect(t.minBacksweepDeg).toBe(9);
        expect(t.gripDeltaMm).toBe(780 - 80 - 460);
        expect(
            barTarget({
                heightMm: null,
                shoulderMm: null,
                currentWidthMm: null,
                currentRiseMm: null,
                style: 'balanced',
                handPressure: false,
                barTooHigh: false,
            }).gripDeltaMm,
        ).toBeNull();
    });
});

describe('scoreBars', () => {
    it('ranks the exact match first, deterministically', () => {
        const ranked = scoreBars(HANDLEBARS, { widthMm: 800, riseMm: 30, minBacksweepDeg: null });
        expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
        // an 800×30 bar exists in the DB and must top the ranking
        expect(ranked[0].matchedWidthMm).toBe(800);
        expect(ranked[0].matchedRiseMm).toBe(30);
        expect(ranked[0].score).toBe(100);
    });

    it('penalizes missed sweep preference', () => {
        const withPref = scoreBars(HANDLEBARS, { widthMm: 780, riseMm: 25, minBacksweepDeg: 9 });
        const withoutPref = scoreBars(HANDLEBARS, { widthMm: 780, riseMm: 25, minBacksweepDeg: null });
        const sqlabWith = withPref.find(s => s.entry.id === 'sqlab-30x-12')!;
        const rugWith = withPref.find(s => s.entry.id === 'renthal-fatbar-carbon-35')!;
        // SQLab (12°) keeps full points, Renthal (7°) loses 20
        expect(sqlabWith.score - rugWith.score).toBeGreaterThan(0);
        expect(withoutPref.find(s => s.entry.id === 'renthal-fatbar-carbon-35')!.score).toBe(
            rugWith.score + 20,
        );
    });
});

describe('matchesFilter', () => {
    it('filters by material, clamp, wishlist and query', () => {
        const carbon = HANDLEBARS.find(b => b.id === 'oneup-v2-carbon')!;
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, material: 'alloy' }, false)).toBe(false);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, clamp: '31.8' }, false)).toBe(false);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, clamp: '35' }, false)).toBe(true);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, wishlistOnly: true }, false)).toBe(false);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, wishlistOnly: true }, true)).toBe(true);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, query: 'oneup' }, false)).toBe(true);
        expect(matchesFilter(carbon, { ...EMPTY_FILTER, query: 'renthal' }, false)).toBe(false);
    });
});

describe('handlebar database integrity', () => {
    it('every entry has complete, sane specs', () => {
        expect(HANDLEBARS.length).toBeGreaterThanOrEqual(10);
        for (const b of HANDLEBARS) {
            expect(b.widthsMm.length, `${b.id} widths`).toBeGreaterThan(0);
            expect(b.risesMm.length, `${b.id} rises`).toBeGreaterThan(0);
            expect(b.backsweepDeg, `${b.id} backsweep`).toBeGreaterThanOrEqual(0);
            expect(b.backsweepDeg, `${b.id} backsweep`).toBeLessThanOrEqual(20);
            expect(b.upsweepDeg, `${b.id} upsweep`).toBeGreaterThanOrEqual(0);
            expect(b.upsweepDeg, `${b.id} upsweep`).toBeLessThanOrEqual(10);
            expect(b.clampsMm.length, `${b.id} clamps`).toBeGreaterThan(0);
            for (const c of b.clampsMm) expect([31.8, 35], `${b.id} clamp`).toContain(c);
            expect(b.usp.de.length, `${b.id} usp de`).toBeGreaterThan(0);
            expect(b.usp.en.length, `${b.id} usp en`).toBeGreaterThan(0);
            expect(b.verified, `${b.id} verified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        const ids = HANDLEBARS.map(b => b.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers high-rise bars (50 mm and up)', () => {
        const highRisers = HANDLEBARS.filter(b => b.risesMm.some(r => r >= 50));
        expect(highRisers.length).toBeGreaterThanOrEqual(4);
        // high-rise lines carry the tall options explicitly
        const renthalHR = HANDLEBARS.find(b => b.id === 'renthal-fatbar-35-highrise')!;
        expect(renthalHR.risesMm).toEqual([50, 60, 70]);
        expect(renthalHR.widthsMm).toEqual([820]);
        expect(renthalHR.priceEur).toBe(95.5);
        const highside = HANDLEBARS.find(b => b.id === 'deity-highside-760')!;
        expect(highside.risesMm).toContain(80);
    });
});
