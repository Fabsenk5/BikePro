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
            // both wheels rest on the ground; the front drop matches the chart value
            const radiiCheck = wheelRadii(frame.wheelSize);
            expect(sketch!.frontAxle.y).toBe(frame.bbDrop!);
            expect(sketch!.rearAxle.y).toBeCloseTo(frame.bbDrop! + (radiiCheck.rear - radiiCheck.front), 6);
            expect(sketch!.rearAxle.y - radiiCheck.rear).toBeCloseTo(sketch!.groundY, 6);
            expect(sketch!.frontAxle.y - radiiCheck.front).toBeCloseTo(sketch!.groundY, 6);
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

    it('rider pose: bent arms and knees for all scenarios', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const opts = { sagPercent: 0, forkTravel: 170, shockStroke: 60, inseam: s.rider.inseam, crankLength: 170 };
            const vertical = buildBikeSketch(s.geo, derived, { ...opts, crankMode: 'vertical' })!;
            const horizontal = buildBikeSketch(s.geo, derived, { ...opts, crankMode: 'horizontal' })!;
            // elbow sits behind the shoulder–hand line (bent arm, attack position)
            for (const k of [vertical, horizontal]) {
                expect(k.riderElbow.x, s.name).toBeLessThan((k.riderShoulder.x + k.hand.x) / 2);
            }
            // bottom pedal: leg nearly straight but not locked out
            expect(vertical.riderPedal.x).toBeCloseTo(0, 6);
            expect(vertical.riderPedal.y).toBeCloseTo(-170, 6);
            expect(vertical.kneeBendDeg!, s.name).toBeGreaterThan(10);
            expect(vertical.kneeBendDeg!, s.name).toBeLessThan(50);
            // horizontal pedal: clearly bent knee, knee in front of the hip
            expect(horizontal.riderPedal.x).toBeCloseTo(170, 6);
            expect(horizontal.kneeBendDeg!, s.name).toBeGreaterThan(40);
            expect(horizontal.riderKnee!.x, s.name).toBeGreaterThan(horizontal.riderHip.x);
        }
    });

    it('front sketch: grip span vs shoulder width', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const front = buildFrontSketch(s.geo, derived, {
                shoulderWidth: s.rider.shoulderWidth,
                sagPercent: 0,
                forkTravel: 170,
                tireWidthMm: 63,
            });
            expect(front, s.name).not.toBeNull();
            expect(front!.gripHalfSpan).toBeCloseTo(s.geo.cockpit!.barWidth! / 2 - 40, 6);
            expect(front!.shoulderHalfWidth).toBeCloseTo(s.rider.shoulderWidth! / 2, 6);
            expect(front!.barGroundY).toBeGreaterThan(front!.wheelRadius - 100);
            expect(front!.shoulderY).toBeGreaterThan(front!.barGroundY);
            expect(front!.headCenter.y).toBeGreaterThan(front!.shoulderY);
            expect(front!.tireWidthMm).toBe(63);
            // modern MTB bars: grip span wider than the shoulders
            expect(front!.gripHalfSpan * 2, s.name).toBeGreaterThan(s.rider.shoulderWidth!);
        }
    });

    it('rider modes: dropper state and springs for all scenarios', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const opts = {
                sagPercent: 20, forkTravel: 170, shockStroke: 60,
                riderMode: 'standing' as const, dropperTravel: 170, inseam: s.rider.inseam,
            };
            const standing = buildBikeSketch(s.geo, derived, opts)!;
            const seated = buildBikeSketch(s.geo, derived, { ...opts, riderMode: 'seated' })!;
            // the compressed saddle sits clearly below the seated position
            expect(standing.saddle.y, s.name).toBeLessThan(seated.saddle.y - 100);
            // standing hips stay above the compressed saddle and reach the pedals
            expect(standing.riderHip.y, s.name).toBeGreaterThan(standing.saddle.y + 80);
            expect(standing.riderKnee, s.name).not.toBeNull();
            expect(standing.kneeBendDeg!, s.name).toBeGreaterThan(10);
            expect(standing.kneeBendDeg!, s.name).toBeLessThan(120);
            // springs: used travel stays within the component travel
            expect(standing.forkSpring.used, s.name).toBeGreaterThanOrEqual(0);
            expect(standing.forkSpring.used, s.name).toBeLessThanOrEqual(170);
            expect(standing.shockSpring.used, s.name).toBeCloseTo(12, 6);
        }
    });

    it('front sketch: rider modes place hips and saddle consistently', () => {
        for (const s of GEOMETRY_SCENARIOS) {
            const derived = computeContactGeometry(s.geo);
            const base = {
                shoulderWidth: s.rider.shoulderWidth, sagPercent: 0, forkTravel: 170,
                shockStroke: 60, dropperTravel: 170,
            };
            const seated = buildFrontSketch(s.geo, derived, { ...base, riderMode: 'seated' })!;
            const standing = buildFrontSketch(s.geo, derived, { ...base, riderMode: 'standing' })!;
            // seated: hip sits on the saddle, above the bar (positive drop)
            expect(seated.hipY, s.name).toBeCloseTo(seated.saddleGroundY + 60, 6);
            expect(seated.hipY, s.name).toBeGreaterThan(seated.barGroundY);
            // standing: saddle compressed, hip lifted off it
            expect(standing.saddleGroundY, s.name).toBeLessThan(seated.saddleGroundY - 100);
            expect(standing.hipY, s.name).toBeGreaterThan(standing.saddleGroundY + 100);
            expect(standing.hipY, s.name).toBeCloseTo(seated.hipY + 40, 6);
            // no sag → no used travel
            expect(seated.forkUsed).toBeCloseTo(0, 6);
        }
        // sag 20 → fork shows 20 % of the travel as used
        const s = GEOMETRY_SCENARIOS[0];
        const front = buildFrontSketch(s.geo, computeContactGeometry(s.geo), { sagPercent: 20, forkTravel: 170, shockStroke: 60 })!;
        expect(front.forkUsed).toBeCloseTo(34, 6);
    });

    it('front sketch tolerates a missing shoulder width', () => {
        const s = GEOMETRY_SCENARIOS[2];
        const derived = computeContactGeometry(s.geo);
        const front = buildFrontSketch(s.geo, derived, { shoulderWidth: null, sagPercent: 20, forkTravel: 170 })!;
        expect(front.shoulderHalfWidth).toBeNull();
        expect(front.tireWidthMm).toBe(60); // default width
    });
});
