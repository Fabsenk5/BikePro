import { describe, expect, it } from 'vitest';
import {
    channelsForModes,
    getModelDefaultClicks,
    parseClicks,
    resolveMaxClicks,
    sanitizeClickLimits,
} from './clickLimits';

describe('channelsForModes', () => {
    it('maps simple clicks modes to one channel each', () => {
        expect(channelsForModes('clicks', 'clicks')).toEqual(['rebound', 'compression']);
    });

    it('maps HS/LS modes to the four high/low channels', () => {
        expect(channelsForModes('hsls', 'hsls')).toEqual([
            'reboundHsr', 'reboundLsr', 'compressionHsc', 'compressionLsc',
        ]);
    });

    it('treats lever/none as clickless', () => {
        expect(channelsForModes('none', 'lever')).toEqual([]);
        expect(channelsForModes('none', 'none')).toEqual([]);
    });

    it('treats unset modes like the default (simple clicks)', () => {
        expect(channelsForModes('', '')).toEqual(['rebound', 'compression']);
        expect(channelsForModes(undefined, undefined)).toEqual(['rebound', 'compression']);
    });
});

describe('parseClicks', () => {
    it('parses positive integers', () => {
        expect(parseClicks('14')).toBe(14);
        expect(parseClicks(18)).toBe(18);
        expect(parseClicks(' 8 ')).toBe(8);
    });

    it('rejects empty, zero and invalid values', () => {
        expect(parseClicks('')).toBeNull();
        expect(parseClicks('0')).toBeNull();
        expect(parseClicks(undefined)).toBeNull();
        expect(parseClicks('abc')).toBeNull();
    });
});

describe('sanitizeClickLimits', () => {
    it('keeps valid channels and drops invalid ones', () => {
        expect(sanitizeClickLimits({ rebound: '14', reboundHsr: '0', compressionHsc: 6, foo: 3 }))
            .toEqual({ rebound: 14, compressionHsc: 6 });
    });

    it('returns undefined for empty/invalid input', () => {
        expect(sanitizeClickLimits({})).toBeUndefined();
        expect(sanitizeClickLimits(null)).toBeUndefined();
        expect(sanitizeClickLimits('x')).toBeUndefined();
    });
});

describe('getModelDefaultClicks', () => {
    it('detects common models', () => {
        expect(getModelDefaultClicks('FOX 38 Factory')).toBe(14);
        expect(getModelDefaultClicks('RockShox Zeb Ultimate')).toBe(18);
        expect(getModelDefaultClicks('Öhlins TTX22')).toBe(15);
        expect(getModelDefaultClicks('Irgendwas')).toBeNull();
    });
});

describe('resolveMaxClicks', () => {
    const comp = {
        maxClicks: '20',
        model: 'FOX 36',
        clickLimits: { reboundHsr: 10, compressionLsc: 15 },
    };

    it('prefers the channel-specific value', () => {
        expect(resolveMaxClicks(comp, 'reboundHsr')).toBe(10);
        expect(resolveMaxClicks(comp, 'compressionLsc')).toBe(15);
    });

    it('falls back to the legacy single value', () => {
        expect(resolveMaxClicks(comp, 'rebound')).toBe(20);
        expect(resolveMaxClicks(comp, 'compression')).toBe(20);
    });

    it('falls back to the model default, then to the generic fallback', () => {
        expect(resolveMaxClicks({ model: 'FOX 36' }, 'rebound')).toBe(14);
        expect(resolveMaxClicks({ brand: 'FOX', model: '36' }, 'rebound')).toBe(14);
        expect(resolveMaxClicks({ brand: 'RockShox', model: 'Zeb Ultimate' }, 'rebound')).toBe(18);
        expect(resolveMaxClicks({}, 'rebound')).toBe(25);
        expect(resolveMaxClicks({}, 'rebound', 30)).toBe(30);
        expect(resolveMaxClicks(undefined, 'compression')).toBe(25);
    });

    it('ignores invalid legacy values', () => {
        expect(resolveMaxClicks({ maxClicks: 'abc' }, 'rebound')).toBe(25);
    });
});
