import { describe, expect, it } from 'vitest';
import {
    assumedSaddleSetback,
    BikeGeometry,
    cockpitDefaults,
    computeContactGeometry,
    evaluateFit,
    DISCIPLINE_REFERENCES,
    recommendForSymptoms,
    saddleHeightTarget,
    sanitizeGeometry,
    seatpostSaddleHeight,
    stripComputedMeasured,
} from './geometry';

const sample: BikeGeometry = {
    frame: { stack: 630, reach: 480 },
    cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
    fit: { saddleHeight: 741, saddleSetback: 60 },
};

describe('sanitizeGeometry', () => {
    it('parses numbers, trims strings and drops empty parts', () => {
        const geo = sanitizeGeometry({
            frame: { stack: '630', reach: 480, size: ' L ', headAngle: '' },
            cockpit: { stemLength: '40,5', barWidth: '' },
            fit: {},
            measured: { barY: '690' },
            meta: { source: 'Hersteller' },
        });
        expect(geo).toEqual({
            frame: { stack: 630, reach: 480, size: 'L' },
            cockpit: { stemLength: 40.5 },
            measured: { barY: 690 },
            meta: { source: 'Hersteller' },
        });
    });

    it('returns undefined for empty/invalid input', () => {
        expect(sanitizeGeometry(null)).toBeUndefined();
        expect(sanitizeGeometry({})).toBeUndefined();
        expect(sanitizeGeometry({ frame: { stack: 'abc' } })).toBeUndefined();
    });
});

describe('computeContactGeometry', () => {
    it('computes bar, hand and saddle positions from frame + cockpit + fit', () => {
        const d = computeContactGeometry(sample);
        expect(d.barX).toBeCloseTo(520, 6);
        expect(d.barY).toBeCloseTo(675, 6);
        expect(d.handX).toBeCloseTo(465.25, 1);
        expect(d.handY).toBeCloseTo(705.5, 1);
        expect(d.rad).toBeCloseTo(845.1, 1);
        // saddle height is measured along the seat tube (741 × sin 75° ≈ 715.7) → drop ≈ 40.8
        expect(d.saddleToBarDrop).toBeCloseTo(40.8, 1);
        expect(d.seatedReach).toBeCloseTo(525.25, 1);
        expect(d.saddleToHand).toBeCloseTo(525.3, 1);
    });

    it('lets measured values override computed ones', () => {
        const geo: BikeGeometry = {
            ...sample,
            measured: { barX: 540, barY: 700, seatedReach: 560, saddleToBarDrop: 41 },
        };
        const d = computeContactGeometry(geo);
        expect(d.barX).toBe(540);
        expect(d.barY).toBe(700);
        expect(d.seatedReach).toBe(560);
        expect(d.saddleToBarDrop).toBe(41);
    });

    it('returns nulls when data is missing', () => {
        const d = computeContactGeometry({});
        expect(d.barX).toBeNull();
        expect(d.rad).toBeNull();
        expect(d.seatedReach).toBeNull();
    });
});

describe('evaluateFit', () => {
    it('passes a well-fitted enduro bike against its reference', () => {
        const d = computeContactGeometry(sample);
        const checks = evaluateFit(sample, d, DISCIPLINE_REFERENCES.enduro, { inseam: 840 });
        expect(checks.find(c => c.id === 'radRatio')).toMatchObject({ status: 'ok' });
        expect(checks.find(c => c.id === 'saddleToBarDrop')).toMatchObject({ status: 'ok' });
        expect(checks.find(c => c.id === 'saddleHeight')).toMatchObject({ status: 'ok' });
        expect(checks.filter(c => c.status !== 'ok')).toHaveLength(0);
    });

    it('flags a race setup as too low for touring', () => {
        const d = computeContactGeometry(sample);
        const checks = evaluateFit(sample, d, DISCIPLINE_REFERENCES.tour, { inseam: 840 });
        expect(checks.find(c => c.id === 'saddleToBarDrop')).toMatchObject({ status: 'high' });
    });

    it('checks the saddle height target within a ±10 mm tolerance', () => {
        const target = saddleHeightTarget(840);
        expect(target).toBe(742);
        const geo = { ...sample, fit: { ...sample.fit, saddleHeight: target + 25 } };
        const checks = evaluateFit(geo, computeContactGeometry(geo), DISCIPLINE_REFERENCES.enduro, { inseam: 840 });
        expect(checks.find(c => c.id === 'saddleHeight')).toMatchObject({ status: 'high' });
    });

    it('assumes a saddle setback from the seat-tube geometry', () => {
        // 777 × cos 78° − 110 ≈ 52 mm; steep seat angles need less setback
        expect(assumedSaddleSetback(777, 78)).toBe(52);
        // 740 × cos 74° − 110 ≈ 94 mm for a classic trail seat angle
        expect(assumedSaddleSetback(740, 74)).toBe(94);
        // clamped to a realistic band
        expect(assumedSaddleSetback(600, 80)).toBe(20);
        expect(assumedSaddleSetback(900, 60)).toBe(120);
    });

    it('derives the saddle height from the seatpost hardware', () => {
        // 450 seat tube + 80 exposed + 210 hub + 40 stack = 780 along the tube
        // (same convention as the saddle-height field)
        expect(seatpostSaddleHeight(450, 80, 210, 78)).toBe(780);
        // incomplete hardware → no estimate
        expect(seatpostSaddleHeight(450, null, 210, 78)).toBeNull();
        expect(seatpostSaddleHeight(null, 80, 210, 78)).toBeNull();
    });

    it('provides cockpit standards per discipline', () => {
        // freeride/DH: 0° stem, short cranks, wide bar
        expect(cockpitDefaults('downhill')).toMatchObject({ stemAngle: 0, crankLength: 165, barWidth: 800, stemLength: 35 });
        expect(cockpitDefaults('dirt').crankLength).toBe(165);
        // e-MTBs run shorter cranks too
        expect(cockpitDefaults('emtb').crankLength).toBe(165);
        // enduro/trail standard
        expect(cockpitDefaults('enduro')).toMatchObject({ crankLength: 170, backsweep: 9, upsweep: 5, stemAngle: 0 });
        expect(cockpitDefaults('trail').crankLength).toBe(170);
        // XC: longer cranks, narrow bar, long stem
        expect(cockpitDefaults('xc')).toMatchObject({ crankLength: 175, barWidth: 740, stemLength: 70 });
        // unknown type falls back to the enduro standard
        expect(cockpitDefaults(undefined)).toEqual(cockpitDefaults('enduro'));
    });

    it('cockpit standards complete a bare geometry into a full model', () => {
        const standards = cockpitDefaults('enduro');
        const geo: BikeGeometry = { frame: { stack: 630, reach: 480 }, cockpit: { ...standards } };
        const derived = computeContactGeometry(geo);
        // bar = reach + stem (0°) and stack + rise (no spacers entered)
        expect(derived.barX).toBeCloseTo(480 + standards.stemLength, 6);
        expect(derived.barY).toBeCloseTo(630 + standards.barRise, 6);
        // hand position uses backsweep/upsweep
        const span = standards.barWidth / 2 - 40;
        expect(derived.handX).toBeCloseTo(derived.barX! - span * Math.sin((standards.backsweep * Math.PI) / 180), 6);
        expect(derived.handY).toBeCloseTo(derived.barY! + span * Math.sin((standards.upsweep * Math.PI) / 180), 6);
        expect(derived.rad).toBeGreaterThan(600);
    });
});

describe('recommendForSymptoms', () => {
    it('suggests a shorter stem for "too long"', () => {
        const d = computeContactGeometry(sample);
        const advice = recommendForSymptoms(['too_long'], sample, d, { inseam: 840 });
        expect(advice.too_long[0].key).toBe('geometry.advice.shorter_stem');
    });

    it('includes the saddle height target for knee pain', () => {
        const d = computeContactGeometry(sample);
        const advice = recommendForSymptoms(['knee_front'], sample, d, { inseam: 840 });
        expect(advice.knee_front[0]).toMatchObject({ key: 'geometry.advice.raise_saddle', params: { target: 742 } });
    });

    it('mentions the current RAD for pop issues', () => {
        const d = computeContactGeometry(sample);
        const advice = recommendForSymptoms(['no_pop'], sample, d, { inseam: 840 });
        expect(advice.no_pop.some(a => a.key === 'geometry.advice.check_rad')).toBe(true);
    });
});

describe('stripComputedMeasured', () => {
    it('drops measured values that match the computed model', () => {
        const measured = { barY: 675, barX: 520, seatedReach: 560, bbHeight: 351 };
        const auto = { barY: 675, barX: 520.4, seatedReach: 525, bbHeight: 351 };
        expect(stripComputedMeasured(measured, auto)).toEqual({ seatedReach: 560 });
    });

    it('keeps real deviations and returns undefined when everything matches', () => {
        expect(stripComputedMeasured({ barY: 680 }, { barY: 675 })).toEqual({ barY: 680 });
        expect(stripComputedMeasured({ barY: 675 }, { barY: 675 })).toBeUndefined();
        expect(stripComputedMeasured(undefined, { barY: 675 })).toBeUndefined();
    });
});
