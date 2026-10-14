import { describe, expect, it } from 'vitest';
import {
    AssumedKey,
    assumedSaddleSetback,
    BikeGeometry,
    cockpitDefaults,
    computeContactGeometry,
    DISCIPLINE_REFERENCES,
    evaluateFit,
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

    it('drops absurd values to undefined instead of storing them', () => {
        // lengths live in 0–3000
        expect(sanitizeGeometry({ frame: { stack: 9999, reach: 480 } })).toEqual({
            frame: { reach: 480 },
        });
        expect(sanitizeGeometry({ cockpit: { spacers: -5, stemLength: 40 } })).toEqual({
            cockpit: { stemLength: 40 },
        });
        // angles live in 0–180
        expect(sanitizeGeometry({ frame: { headAngle: 200, reach: 480 } })).toEqual({
            frame: { reach: 480 },
        });
        expect(sanitizeGeometry({ cockpit: { backsweep: 200, stemLength: 40 } })).toEqual({
            cockpit: { stemLength: 40 },
        });
        // saddle height (along-tube) lives in 400–1100
        expect(sanitizeGeometry({ fit: { saddleHeight: 2000, saddleSetback: 60 } })).toEqual({
            fit: { saddleSetback: 60 },
        });
        expect(sanitizeGeometry({ fit: { saddleHeight: 300 } })).toBeUndefined();
        // crank length lives in 100–220
        expect(sanitizeGeometry({ cockpit: { crankLength: 50, stemLength: 40 } })).toEqual({
            cockpit: { stemLength: 40 },
        });
    });

    it('keeps plausible boundary values', () => {
        expect(sanitizeGeometry({ fit: { saddleHeight: 400 } })).toEqual({ fit: { saddleHeight: 400 } });
        expect(sanitizeGeometry({ fit: { saddleHeight: 1100 } })).toEqual({ fit: { saddleHeight: 1100 } });
        expect(sanitizeGeometry({ cockpit: { crankLength: 100 } })).toEqual({ cockpit: { crankLength: 100 } });
        expect(sanitizeGeometry({ cockpit: { crankLength: 220 } })).toEqual({ cockpit: { crankLength: 220 } });
        expect(sanitizeGeometry({ frame: { headAngle: 180 } })).toEqual({ frame: { headAngle: 180 } });
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

    it('projects the spacer tower along the steerer tube', () => {
        const geo: BikeGeometry = {
            frame: { stack: 630, reach: 480, headAngle: 64.5 },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
        };
        const d = computeContactGeometry(geo);
        const headRad = (64.5 * Math.PI) / 180;
        // bar moves up by spacers·sin(headAngle) and rearward by spacers·cos(headAngle)
        expect(d.barX).toBeCloseTo(480 + 40 - 15 * Math.cos(headRad), 9);
        expect(d.barY).toBeCloseTo(630 + 15 * Math.sin(headRad) + 30, 9);
        expect(d.barX!).toBeLessThan(480 + 40);
        expect(d.barY!).toBeLessThan(630 + 15 + 30);
    });

    it('stacks spacers vertically when the head angle is unknown', () => {
        const geo: BikeGeometry = {
            frame: { stack: 630, reach: 480 },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
        };
        const d = computeContactGeometry(geo);
        expect(d.barX).toBeCloseTo(520, 9);
        expect(d.barY).toBeCloseTo(675, 9);
    });

    it('leaves hand and RAD unknown without a bar width (no centre fallback)', () => {
        const { barWidth: _dropped, ...cockpit } = sample.cockpit!;
        const d = computeContactGeometry({ ...sample, cockpit });
        expect(d.barX).toBeCloseTo(520, 6);
        expect(d.barY).toBeCloseTo(675, 6);
        expect(d.handX).toBeNull();
        expect(d.handY).toBeNull();
        expect(d.rad).toBeNull();
        expect(d.seatedReach).toBeNull();
        expect(d.saddleToHand).toBeNull();
        // saddle and drop do not need the grips
        expect(d.saddleToBarDrop).toBeCloseTo(40.8, 1);
    });

    it('projects the along-tube saddle height with ×sin(seatAngle)', () => {
        const steep = computeContactGeometry({ ...sample, frame: { ...sample.frame, seatAngle: 78 } });
        expect(steep.saddleY).toBeCloseTo(741 * Math.sin((78 * Math.PI) / 180), 9);
        expect(steep.saddleY).toBeCloseTo(724.8, 1);
        // default 75° when the frame has no seat angle
        const def = computeContactGeometry(sample);
        expect(def.saddleY).toBeCloseTo(741 * Math.sin((75 * Math.PI) / 180), 9);
    });

    it('lets a ±15 mm tape override win over the model bar height', () => {
        const base = computeContactGeometry(sample);
        const up: BikeGeometry = { ...sample, measured: { barY: base.barY! + 15 } };
        const down: BikeGeometry = { ...sample, measured: { barY: base.barY! - 15 } };
        const dUp = computeContactGeometry(up);
        const dDown = computeContactGeometry(down);
        expect(dUp.barY).toBe(base.barY! + 15);
        expect(dDown.barY).toBe(base.barY! - 15);
        // drop = saddle − bar, so it shifts by the mirrored amount
        expect(dUp.saddleToBarDrop).toBeCloseTo(base.saddleToBarDrop! - 15, 6);
        expect(dDown.saddleToBarDrop).toBeCloseTo(base.saddleToBarDrop! + 15, 6);
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

    it('scores the enduro drop band from 0 (level bar/saddle is ok)', () => {
        expect(DISCIPLINE_REFERENCES.enduro.saddleToBarDrop.min).toBe(0);
    });

    it('caps DH bar width at real-world 805 and adds a compact bikepark reference', () => {
        expect(DISCIPLINE_REFERENCES.dh.barWidth).toEqual({ min: 760, max: 805 });
        expect(DISCIPLINE_REFERENCES.bikepark.radRatio).toEqual({ min: 0.95, max: 1.05 });
        const d = computeContactGeometry(sample);
        // 780 bar is fine in both gravity references
        for (const r of [DISCIPLINE_REFERENCES.dh, DISCIPLINE_REFERENCES.bikepark]) {
            const checks = evaluateFit(sample, d, r, { inseam: 840 });
            expect(checks.find(c => c.id === 'barWidth')).toMatchObject({ status: 'ok' });
        }
        // 815 de facto doesn't exist → high in DH
        const wide = { ...sample, cockpit: { ...sample.cockpit, barWidth: 815 } };
        const dw = computeContactGeometry(wide);
        expect(evaluateFit(wide, dw, DISCIPLINE_REFERENCES.dh, { inseam: 840 }).find(c => c.id === 'barWidth')).toMatchObject({ status: 'high' });
    });

    it('stays backward compatible without the assumed set', () => {
        const d = computeContactGeometry(sample);
        const ref = DISCIPLINE_REFERENCES.enduro;
        const rider = { inseam: 840 };
        expect(evaluateFit(sample, d, ref, rider)).toEqual(evaluateFit(sample, d, ref, rider, new Set()));
        expect(evaluateFit(sample, d, ref, rider).filter(c => c.status !== 'ok')).toHaveLength(0);
    });

    it('marks checks with assumed inputs as unknown', () => {
        const ref = DISCIPLINE_REFERENCES.enduro;
        const rider = { inseam: 840 };
        const statusOf = (assumed: AssumedKey[], id: string) => {
            const d = computeContactGeometry(sample);
            return evaluateFit(sample, d, ref, rider, new Set<string>(assumed)).find(c => c.id === id)!.status;
        };
        // values stay reported, only the status flips
        const d = computeContactGeometry(sample);
        const stemCheck = evaluateFit(sample, d, ref, rider, new Set<string>(['cockpit.stemLength'])).find(c => c.id === 'stemLength')!;
        expect(stemCheck).toMatchObject({ status: 'unknown', value: 40 });

        expect(statusOf(['cockpit.barRise'], 'barRise')).toBe('unknown');
        expect(statusOf(['cockpit.barRise'], 'stemLength')).toBe('ok');
        // bar width feeds the grips, so it also clouds RAD — but not the drop
        expect(statusOf(['cockpit.barWidth'], 'barWidth')).toBe('unknown');
        expect(statusOf(['cockpit.barWidth'], 'radRatio')).toBe('unknown');
        expect(statusOf(['cockpit.barWidth'], 'saddleToBarDrop')).toBe('ok');
        // saddle height feeds the saddle check and the drop
        expect(statusOf(['fit.saddleHeight'], 'saddleHeight')).toBe('unknown');
        expect(statusOf(['fit.saddleHeight'], 'saddleToBarDrop')).toBe('unknown');
        expect(statusOf(['fit.saddleHeight'], 'stemLength')).toBe('ok');
        // inseam feeds the ratio denominator and the saddle target
        expect(statusOf(['rider.inseam'], 'radRatio')).toBe('unknown');
        expect(statusOf(['rider.inseam'], 'saddleHeight')).toBe('unknown');
        expect(statusOf(['rider.inseam'], 'stemLength')).toBe('ok');
        // bar-height path inputs cloud the drop
        expect(statusOf(['cockpit.spacers'], 'saddleToBarDrop')).toBe('unknown');
        expect(statusOf(['cockpit.stemAngle'], 'saddleToBarDrop')).toBe('unknown');
        // setback is tracked but judges no band check today
        expect(statusOf(['fit.saddleSetback'], 'saddleHeight')).toBe('ok');
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
        expect(advice.too_long[0].key).toBe('geometry.advice_shorter_stem');
    });

    it('includes the saddle height target for knee pain', () => {
        const d = computeContactGeometry(sample);
        const advice = recommendForSymptoms(['knee_front'], sample, d, { inseam: 840 });
        expect(advice.knee_front[0]).toMatchObject({ key: 'geometry.advice_raise_saddle', params: { target: 742 } });
    });

    it('mentions the current RAD for pop issues', () => {
        const d = computeContactGeometry(sample);
        const advice = recommendForSymptoms(['no_pop'], sample, d, { inseam: 840 });
        expect(advice.no_pop.some(a => a.key === 'geometry.advice_check_rad')).toBe(true);
    });

    it('withholds shorter-stem advice when the stem is already stubby', () => {
        const d = computeContactGeometry(sample);
        // sample stem is 40 mm → guarded advice
        expect(recommendForSymptoms(['too_long'], sample, d, { inseam: 840 }).too_long).toHaveLength(3);
        const stubby: BikeGeometry = { ...sample, cockpit: { ...sample.cockpit, stemLength: 30 } };
        expect(recommendForSymptoms(['too_long'], stubby, computeContactGeometry(stubby), { inseam: 840 }).too_long).toEqual([]);
        const boundary: BikeGeometry = { ...sample, cockpit: { ...sample.cockpit, stemLength: 35 } };
        expect(recommendForSymptoms(['too_long'], boundary, computeContactGeometry(boundary), { inseam: 840 }).too_long).toEqual([]);
        // unknown stem → assume the worst, keep advising
        const unknown: BikeGeometry = { ...sample, cockpit: { ...sample.cockpit, stemLength: undefined } };
        expect(recommendForSymptoms(['too_long'], unknown, computeContactGeometry(unknown), { inseam: 840 }).too_long).toHaveLength(3);
    });

    it('withholds lower-bar advice when nothing can come off', () => {
        const rider = { inseam: 840 };
        // spacers on board → actionable
        expect(recommendForSymptoms(['bar_too_high'], sample, computeContactGeometry(sample), rider).bar_too_high).toHaveLength(2);
        // slammed with a normal rise → nothing to lower
        const slammed: BikeGeometry = { ...sample, cockpit: { ...sample.cockpit, spacers: 0, barRise: 30 } };
        expect(recommendForSymptoms(['bar_too_high'], slammed, computeContactGeometry(slammed), rider).bar_too_high).toEqual([]);
        // slammed but rise over every discipline band → lower-rise bar helps
        const tower: BikeGeometry = { ...sample, cockpit: { ...sample.cockpit, spacers: 0, barRise: 60 } };
        expect(recommendForSymptoms(['bar_too_high'], tower, computeContactGeometry(tower), rider).bar_too_high).toHaveLength(2);
    });

    it('keeps the unsafe advice and notes the short-vs-safe conflict', () => {
        const d = computeContactGeometry(sample);
        const rider = { inseam: 840 };
        const soloShort = recommendForSymptoms(['too_short'], sample, d, rider);
        expect(soloShort.too_short).toHaveLength(2);
        const both = recommendForSymptoms(['too_short', 'unsafe_descending'], sample, d, rider);
        // unsafe advice is kept as-is (safety wins) …
        expect(both.unsafe_descending).toEqual(
            recommendForSymptoms(['unsafe_descending'], sample, d, rider).unsafe_descending,
        );
        expect(both.unsafe_descending.map(a => a.key)).toContain('geometry.advice_higher_bar');
        // … and the conflict is noted on the longer-stem side
        expect(both.too_short.map(a => a.key)).toContain('geometry.advice_conflict_short_unsafe');
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
