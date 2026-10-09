import { describe, expect, it } from 'vitest';
import {
    formatRange,
    formatSpecSummary,
    midpoint,
    parseNumericRange,
    resolveSpecRow,
    sanitizeSpecTable,
} from './specTable';

describe('parseNumericRange', () => {
    it('parses single values and ranges', () => {
        expect(parseNumericRange('8')).toEqual({ min: 8, max: 8 });
        expect(parseNumericRange('5-6')).toEqual({ min: 5, max: 6 });
        expect(parseNumericRange('5 – 6')).toEqual({ min: 5, max: 6 });
        expect(parseNumericRange(80)).toEqual({ min: 80, max: 80 });
        expect(parseNumericRange('6-5')).toEqual({ min: 5, max: 6 });
    });

    it('rejects empty and invalid values', () => {
        expect(parseNumericRange('')).toBeNull();
        expect(parseNumericRange('abc')).toBeNull();
        expect(parseNumericRange(undefined)).toBeNull();
    });
});

describe('formatRange and midpoint', () => {
    it('formats ranges and derives midpoints', () => {
        expect(formatRange('5-6')).toBe('5–6');
        expect(formatRange('80')).toBe('80');
        expect(midpoint('5-6')).toBe(6);
        expect(midpoint('80')).toBe(80);
        expect(midpoint('abc')).toBeNull();
    });
});

describe('sanitizeSpecTable', () => {
    it('keeps ranges as raw strings, parses weights, drops empty rows', () => {
        const rows = sanitizeSpecTable([
            { weightMin: '82', weightMax: '87', psi: '80', lsr: '5-6', hsr: '', lsc: 8 },
            { psi: '' },
        ]);
        expect(rows).toHaveLength(1);
        expect(rows![0]).toMatchObject({ weightMin: 82, weightMax: 87, psi: '80', lsr: '5-6', lsc: '8' });
        expect(rows![0].id).toBeTruthy();
        expect(rows![0].hsr).toBeUndefined();
    });

    it('returns undefined for empty input', () => {
        expect(sanitizeSpecTable([])).toBeUndefined();
        expect(sanitizeSpecTable(null)).toBeUndefined();
        expect(sanitizeSpecTable([{ weightMin: '' }])).toBeUndefined();
    });
});

describe('resolveSpecRow', () => {
    const rows = [
        { id: 'a', weightMin: 60, weightMax: 69, psi: '70' },
        { id: 'b', weightMin: 70, weightMax: 79, psi: '75' },
    ];

    it('matches the range containing the weight, else nearest with fallback flag', () => {
        expect(resolveSpecRow(rows, 72)).toMatchObject({ fallback: false });
        expect(resolveSpecRow(rows, 72)?.row.id).toBe('b');
        expect(resolveSpecRow(rows, 85)).toMatchObject({ fallback: true });
        expect(resolveSpecRow(rows, 85)?.row.id).toBe('b');
    });

    it('supports open-ended and universal rows', () => {
        expect(resolveSpecRow([{ id: 'x', weightMin: 80, psi: '80' }], 95)?.row.id).toBe('x');
        expect(resolveSpecRow([{ id: 'u', psi: '60' }], 70)?.row.id).toBe('u');
    });

    it('returns null without usable data', () => {
        expect(resolveSpecRow([], 80)).toBeNull();
        expect(resolveSpecRow(undefined, 80)).toBeNull();
        expect(resolveSpecRow(rows, null)).toBeNull();
    });
});

describe('formatSpecSummary', () => {
    it('joins the values that are present', () => {
        expect(formatSpecSummary({ id: '1', psi: '78-82', lsr: '10', hsr: '5-6', hsc: '4' }))
            .toBe('78–82 psi · LSR 10 · HSR 5–6 · HSC 4');
    });
});
