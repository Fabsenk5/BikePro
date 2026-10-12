import { describe, expect, it } from 'vitest';
import { buildBikeSketch, buildFrontSketch, wheelRadii } from './bikeSketch';
import { computeContactGeometry } from './geometry';
import { GEOMETRY_SCENARIOS } from './testScenarios';

/**
 * Bike sketch scenario matrix — validates the drawing math with the same
 * realistic bikes as the fit-check matrix (lib/testScenarios.ts).
 */
describe('bike sketch scenario matrix (plausibility guard)', () => {
    for (const s of GEOMETRY_SCENARIOS) {
        it(`${s.name} — side sketch is geometrically sane`, () => {
            const derived = computeContactGeometry(s.geo);
            const sketch = buildBikeSketch(s.geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 });
            expect(sketch, `${s.name}: sketch`).not.toBeNull();
            const frame = s.geo.frame!;

            // axles and frame anchors come straight from the specs
            expect(sketch!.rearAxle.x).toBe(-frame.chainstay!);
            expect(sketch!.frontAxle.x).toBeCloseTo(frame.wheelbase! - frame.chainstay!, 6);
            expect(sketch!.rearAxle.y).toBe(frame.bbDrop);
            expect(sketch!.frontAxle.y).toBe(frame.bbDrop);
            expect(sketch!.headTop.x).toBe(frame.reach);
            expect(sketch!.headTop.y).toBe(frame.stack);

            // wheel radii follow the wheel size (mullet differs front/rear)
            const radii = wheelRadii(frame.wheelSize);
            expect(sketch!.wheelRadiusFront).toBe(radii.front);
            expect(sketch!.wheelRadiusRear).toBe(radii.rear);

            // head tube points down/back along the head angle; seat cluster up/back
            expect(sketch!.headBottom.y).toBeLessThan(sketch!.headTop.y);
            expect(sketch!.headBottom.x).toBeLessThan(sketch!.headTop.x);
            expect(sketch!.seatCluster.y).toBeGreaterThan(300);
            expect(sketch!.seatCluster.x).toBeLessThan(0);

            // rider sits upright above the frame
            expect(sketch!.riderHead.y).toBeGreaterThan(sketch!.riderShoulder.y);
            expect(sketch!.riderShoulder.y).toBeGreaterThan(sketch!.riderHip.y);

            // everything stays in sane bounds (mm, BB-relative)
            for (const p of [sketch!.bar, sketch!.saddle, sketch!.riderHead]) {
                expect(Math.abs(p.x), s.name).toBeLessThan(frame.wheelbase! + 500);
                expect(p.y, s.name).toBeGreaterThan(-100);
                expect(p.y, s.name).toBeLessThan(2200);
            }
        });
    }

    it('sag lowers frame and rider, wheels stay grounded', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const noSag = buildBikeSketch(s.geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
            const sagged = buildBikeSketch(s.geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 60 })!;
            expect(sagged.frontAxle).toEqual(noSag.frontAxle);
            expect(sagged.rearAxle).toEqual(noSag.rearAxle);
            expect(sagged.sagFork).toBeCloseTo(34, 6);
            expect(sagged.sagShock).toBeCloseTo(12, 6);
            expect(sagged.headTop.y).toBeLessThan(noSag.headTop.y);
            expect(sagged.bar.y).toBeLessThan(noSag.bar.y);
            expect(sagged.saddle.y).toBeLessThan(noSag.saddle.y);
            expect(sagged.riderHead.y).toBeLessThan(noSag.riderHead.y);
            // the pitch is bounded by shock and fork sag
            const headDrop = noSag.headTop.y - sagged.headTop.y;
            expect(headDrop, s.name).toBeGreaterThan(12);
            expect(headDrop, s.name).toBeLessThan(34);
        }
    });

    it('front sketch: grip span vs shoulder width', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const front = buildFrontSketch(s.geo, derived, {
                shoulderWidth: s.rider.shoulderWidth,
                sagPercent: 0,
                forkTravel: 170,
            });
            expect(front, s.name).not.toBeNull();
            expect(front!.gripHalfSpan).toBeCloseTo(s.geo.cockpit!.barWidth! / 2 - 40, 6);
            expect(front!.shoulderHalfWidth).toBeCloseTo(s.rider.shoulderWidth! / 2, 6);
            expect(front!.barGroundY).toBeGreaterThan(front!.wheelRadius - 100);
            expect(front!.shoulderY).toBeGreaterThan(front!.barGroundY);
            expect(front!.headCenter.y).toBeGreaterThan(front!.shoulderY);
            // modern MTB bars: grip span wider than the shoulders
            expect(front!.gripHalfSpan * 2, s.name).toBeGreaterThan(s.rider.shoulderWidth!);
        }
    });

    it('front sketch tolerates a missing shoulder width', () => {
        const s = GEOMETRY_SCENARIOS[2];
        const derived = computeContactGeometry(s.geo);
        const front = buildFrontSketch(s.geo, derived, { shoulderWidth: null, sagPercent: 20, forkTravel: 170 })!;
        expect(front.shoulderHalfWidth).toBeNull();
    });
});
