import { describe, expect, it } from 'vitest';
import {
    BikeGeometry,
    computeContactGeometry,
    evaluateFit,
    DISCIPLINE_REFERENCES,
    recommendForSymptoms,
    saddleHeightTarget,
    sanitizeGeometry,
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
        expect(d.saddleToBarDrop).toBeCloseTo(66, 6);
        expect(d.seatedReach).toBeCloseTo(525.25, 1);
        expect(d.saddleToHand).toBeCloseTo(526.4, 1);
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
