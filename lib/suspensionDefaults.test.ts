import { describe, expect, it } from 'vitest';
import { sagRangeMm, SAG_TARGETS, travelStrokeDefaults } from './suspensionDefaults';

describe('SAG_TARGETS', () => {
    it('uses the canonical BikePro table (hart/mitte/weich)', () => {
        expect(SAG_TARGETS.firm).toEqual({ fork: { min: 15, max: 15 }, shock: { min: 25, max: 25 } });
        expect(SAG_TARGETS.balanced).toEqual({ fork: { min: 17.5, max: 17.5 }, shock: { min: 27.5, max: 27.5 } });
        expect(SAG_TARGETS.comfortable).toEqual({ fork: { min: 20, max: 20 }, shock: { min: 30, max: 30 } });
    });
});

describe('sagRangeMm', () => {
    it('converts sag percentages to millimetres', () => {
        expect(sagRangeMm(SAG_TARGETS.comfortable.fork, 170)).toEqual({ min: 34, max: 34 });
        expect(sagRangeMm(SAG_TARGETS.balanced.fork, 170)).toEqual({ min: 29.75, max: 29.75 });
        expect(sagRangeMm(SAG_TARGETS.firm.fork, 170)).toEqual({ min: 25.5, max: 25.5 });
        expect(sagRangeMm(SAG_TARGETS.firm.shock, 60)).toEqual({ min: 15, max: 15 });
        expect(sagRangeMm(SAG_TARGETS.comfortable.shock, 57.5)).toEqual({ min: 17.25, max: 17.25 });
    });
});

describe('travelStrokeDefaults', () => {
    it('falls back per bike type', () => {
        expect(travelStrokeDefaults('enduro')).toEqual({ travel: 170, stroke: 65 });
        expect(travelStrokeDefaults('unbekannt')).toEqual({ travel: 160, stroke: 60 });
    });
});
