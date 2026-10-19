/**
 * Bar finder scoring — transparent heuristics, test-guarded.
 *
 * Width target is height- and style-based (standard practice); the shoulder
 * comparison (grip span vs shoulder width, see geometry front view) is shown
 * as info, not as the target. Rise target starts from the current bar and
 * shifts with symptoms. All weights are documented below.
 */
import { HandlebarEntry } from '../constants/handlebars';

export type BarStyle = 'playful' | 'balanced' | 'stable';

export interface BarTargetInput {
    heightMm: number | null;
    shoulderMm: number | null;
    currentWidthMm: number | null;
    currentRiseMm: number | null;
    style: BarStyle;
    handPressure: boolean;
    barTooHigh: boolean;
}

export interface BarTarget {
    widthMm: number;
    widthBase: 'height' | 'current' | 'fallback';
    riseMm: number;
    riseReasons: ('current' | 'hands' | 'lower')[];
    /** preferred minimum backsweep, null = no preference */
    minBacksweepDeg: number | null;
    /** grip span vs shoulder info (app convention: barWidth − 80 − shoulder) */
    gripDeltaMm: number | null;
}

/** Width target: height-based base, style-shifted, clamped to real bars. */
export function barTargetWidthMm(input: {
    heightMm: number | null;
    style: BarStyle;
    currentWidthMm: number | null;
}): { value: number; base: 'height' | 'current' | 'fallback' } {
    const shift = input.style === 'playful' ? -20 : input.style === 'stable' ? 10 : 0;
    if (input.heightMm != null) {
        const base = input.heightMm < 1750 ? 760 : input.heightMm <= 1880 ? 780 : 800;
        return { value: Math.min(810, Math.max(740, base + shift)), base: 'height' };
    }
    if (input.currentWidthMm != null) return { value: input.currentWidthMm, base: 'current' };
    return { value: 780, base: 'fallback' };
}

/** Rise target: current bar + symptom shifts, clamped to 0..60. */
export function barTargetRiseMm(input: {
    currentRiseMm: number | null;
    handPressure: boolean;
    barTooHigh: boolean;
}): { value: number; reasons: ('current' | 'hands' | 'lower')[] } {
    let value = input.currentRiseMm ?? 30;
    const reasons: ('current' | 'hands' | 'lower')[] = input.currentRiseMm != null ? ['current'] : [];
    if (input.handPressure) {
        value += 20;
        reasons.push('hands');
    }
    if (input.barTooHigh) {
        value -= 10;
        reasons.push('lower');
    }
    return { value: Math.min(60, Math.max(0, value)), reasons };
}

export function barTarget(input: BarTargetInput): BarTarget {
    const width = barTargetWidthMm(input);
    const rise = barTargetRiseMm(input);
    return {
        widthMm: width.value,
        widthBase: width.base,
        riseMm: rise.value,
        riseReasons: rise.reasons,
        minBacksweepDeg: input.handPressure ? 9 : null,
        gripDeltaMm:
            input.shoulderMm != null && input.currentWidthMm != null
                ? input.currentWidthMm - 80 - input.shoulderMm
                : null,
    };
}

export interface BarScore {
    entry: HandlebarEntry;
    /** 0..100, higher is closer to the target */
    score: number;
    matchedWidthMm: number | null;
    matchedRiseMm: number | null;
    meetsSweep: boolean;
}

const nearest = (options: number[], target: number): number | null => {
    if (options.length === 0) return null;
    return options.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
};

/**
 * Weighted distance score: width ×1.5/mm, rise ×1.5/mm, missed sweep −20.
 * Deterministic tie-break by id so the ranking is stable.
 */
export function scoreBars(
    bars: HandlebarEntry[],
    target: { widthMm: number; riseMm: number; minBacksweepDeg: number | null },
): BarScore[] {
    return bars
        .map(entry => {
            const matchedWidthMm = nearest(entry.widthsMm, target.widthMm);
            const matchedRiseMm = nearest(entry.risesMm, target.riseMm);
            const meetsSweep = target.minBacksweepDeg == null || entry.backsweepDeg >= target.minBacksweepDeg;
            const score = Math.round(
                100
                - 1.5 * Math.abs((matchedWidthMm ?? target.widthMm) - target.widthMm)
                - 1.5 * Math.abs((matchedRiseMm ?? target.riseMm) - target.riseMm)
                - (meetsSweep ? 0 : 20),
            );
            return { entry, score, matchedWidthMm, matchedRiseMm, meetsSweep };
        })
        .sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : 1));
}

export interface BarFilter {
    material: 'all' | 'carbon' | 'alloy';
    clamp: 'all' | '31.8' | '35';
    wishlistOnly: boolean;
    query: string;
}

export const EMPTY_FILTER: BarFilter = { material: 'all', clamp: 'all', wishlistOnly: false, query: '' };

export function matchesFilter(entry: HandlebarEntry, filter: BarFilter, wishlisted: boolean): boolean {
    if (filter.wishlistOnly && !wishlisted) return false;
    if (filter.material !== 'all' && entry.material !== filter.material) return false;
    if (filter.clamp !== 'all' && !entry.clampsMm.some(c => String(c) === filter.clamp)) return false;
    const q = filter.query.trim().toLowerCase();
    if (q && !`${entry.brand} ${entry.model}`.toLowerCase().includes(q)) return false;
    return true;
}
