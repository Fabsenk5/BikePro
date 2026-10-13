import { describe, expect, it } from 'vitest';
import { buildBikeSketch, springPoints, wheelRadii } from './bikeSketch';
import { computeContactGeometry } from './geometry';

const geo = {
    frame: {
        stack: 630, reach: 480, chainstay: 445, wheelbase: 1284, bbDrop: 23,
        headAngle: 63.5, seatAngle: 78, seatTube: 450, wheelSize: 'mullet',
    },
    cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
    fit: { saddleHeight: 741, saddleSetback: 60 },
};
const derived = computeContactGeometry(geo);

describe('wheelRadii', () => {
    it('handles mullet and uniform sizes', () => {
        expect(wheelRadii('mullet')).toEqual({ front: 374, rear: 355 });
        expect(wheelRadii('29')).toEqual({ front: 374, rear: 374 });
        expect(wheelRadii(undefined)).toEqual({ front: 374, rear: 374 });
    });
});

describe('buildBikeSketch', () => {
    it('places axles, head tube, bar and saddle correctly', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        // mullet: BB height = front radius − drop = 351; both wheels touch the ground
        expect(s.groundY).toBeCloseTo(-351, 6);
        expect(s.rearAxle).toEqual({ x: -445, y: 4 });
        expect(s.frontAxle.x).toBeCloseTo(1284 - 445, 6);
        expect(s.frontAxle.y).toBeCloseTo(23, 6);
        expect(s.headTop).toEqual({ x: 480, y: 630 });
        expect(s.bar.x).toBeCloseTo(520, 6);
        expect(s.bar.y).toBeCloseTo(675, 6);
        expect(s.saddle.y).toBeCloseTo(741, 6);
        expect(s.riderHead.y).toBeGreaterThan(s.riderShoulder.y);
    });

    it('uses a measured BB height for the stance', () => {
        const geo2 = { ...geo, measured: { bbHeight: 352 } };
        const s = buildBikeSketch(geo2, computeContactGeometry(geo2), { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.groundY).toBeCloseTo(-352, 6);
        expect(s.frontAxle.y).toBeCloseTo(374 - 352, 6);
        expect(s.rearAxle.y).toBeCloseTo(355 - 352, 6);
    });

    it('sag lowers frame and rider but keeps wheels on the ground', () => {
        const noSag = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        const sagged = buildBikeSketch(geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 60 })!;
        expect(sagged.frontAxle).toEqual(noSag.frontAxle);
        expect(sagged.rearAxle).toEqual(noSag.rearAxle);
        expect(sagged.sagFork).toBeCloseTo(34, 6);
        expect(sagged.sagShock).toBeCloseTo(12, 6);
        // head tube sits toward the front → drops close to the fork sag
        expect(noSag.headTop.y - sagged.headTop.y).toBeGreaterThan(25);
        // saddle sits further back → drops between shock and fork sag
        const saddleDrop = noSag.saddle.y - sagged.saddle.y;
        expect(saddleDrop).toBeGreaterThan(12);
        expect(saddleDrop).toBeLessThan(34);
        expect(sagged.riderHead.y).toBeLessThan(noSag.riderHead.y);
    });

    it('returns null when frame data is incomplete', () => {
        const incomplete = { frame: { stack: 630 } };
        expect(buildBikeSketch(incomplete, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })).toBeNull();
    });
});

describe('rider pose', () => {
    const pose = { inseam: 840, crankLength: 170 };

    it('bends the elbow backward from the shoulder–hand line', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose })!;
        const midX = (s.riderShoulder.x + s.hand.x) / 2;
        expect(s.riderElbow.x).toBeLessThan(midX);
        expect(s.riderElbow.y).toBeLessThan(s.riderShoulder.y);
    });

    it('bends the knee toward the bottom pedal and reports the bend', () => {
        const s = buildBikeSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, crankMode: 'vertical',
        })!;
        expect(s.riderPedal.x).toBeCloseTo(0, 6);
        expect(s.riderPedal.y).toBeCloseTo(-170, 6);
        expect(s.riderKnee).not.toBeNull();
        expect(s.kneeBendDeg).not.toBeNull();
        // at the bottom the leg is nearly straight — but not locked out
        expect(s.kneeBendDeg!).toBeGreaterThan(15);
        expect(s.kneeBendDeg!).toBeLessThan(45);
        expect(s.kopsOffsetMm).toBeNull();
    });

    it('places the horizontal pedal forward with a bent knee', () => {
        const s = buildBikeSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, crankMode: 'horizontal',
        })!;
        expect(s.riderPedal.x).toBeCloseTo(170, 6);
        expect(s.riderPedal.y).toBeCloseTo(0, 6);
        expect(s.kneeBendDeg!).toBeGreaterThan(40);
        expect(s.kopsOffsetMm).not.toBeNull();
        expect(Math.abs(s.kopsOffsetMm!)).toBeLessThan(300);
    });

    it('falls back to a straight leg without an inseam', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.riderKnee).toBeNull();
        expect(s.kneeBendDeg).toBeNull();
        expect(s.kopsOffsetMm).toBeNull();
        // default crank mode is horizontal
        expect(s.riderPedal.x).toBeCloseTo(170, 6);
    });
});

describe('rider mode and springs', () => {
    const pose = { inseam: 840, crankLength: 170 };

    it('seated keeps the dropper extended, standing compresses it', () => {
        const seated = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'seated' })!;
        const standing = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'standing', dropperTravel: 170 })!;
        // seated: saddle at the fit height, hip on the saddle
        expect(seated.saddle.y).toBeCloseTo(741, 6);
        expect(seated.riderHip.y).toBeCloseTo(741 + 60, 6);
        // standing: saddle slid down the seat axis by the dropper travel
        const seatRad = (78 * Math.PI) / 180;
        expect(standing.saddle.y).toBeCloseTo(741 - 170 * Math.sin(seatRad), 0);
        expect(standing.saddle.x).toBeCloseTo(-60 + 170 * Math.cos(seatRad), 0);
        // standing hip sits above the compressed saddle
        expect(standing.riderHip.y).toBeGreaterThan(standing.saddle.y + 100);
        expect(standing.riderHip.y).toBeCloseTo(seated.riderHip.y + 40, 6);
        // the standing rider still reaches the pedal
        expect(standing.riderKnee).not.toBeNull();
        expect(standing.kneeBendDeg!).toBeGreaterThan(20);
    });

    it('clamps the compressed saddle above the seat cluster', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, riderMode: 'standing', dropperTravel: 400 })!;
        const seatClusterY = 450 * Math.sin((78 * Math.PI) / 180);
        expect(s.saddle.y).toBeGreaterThanOrEqual(seatClusterY + 60);
    });

    it('springs shorten with sag and mark the used travel', () => {
        const noSag = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose })!;
        const sagged = buildBikeSketch(geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 60, ...pose })!;
        // no sag → no used travel, full coil length
        expect(noSag.forkSpring.used).toBeCloseTo(0, 6);
        expect(noSag.shockSpring.used).toBeCloseTo(0, 6);
        // sag → fork uses part of its travel, shock exactly its sag
        expect(sagged.forkSpring.used).toBeGreaterThan(20);
        expect(sagged.forkSpring.used).toBeLessThan(34);
        expect(sagged.shockSpring.used).toBeCloseTo(12, 6);
        // coil + used bar reconstruct the un-sagged spring line
        const len = (p: { top: { x: number; y: number }; bottom: { x: number; y: number } }) =>
            Math.hypot(p.bottom.x - p.top.x, p.bottom.y - p.top.y);
        expect(len(sagged.forkSpring) + sagged.forkSpring.used).toBeCloseTo(len(noSag.forkSpring), 6);
        expect(len(sagged.shockSpring) + sagged.shockSpring.used).toBeCloseTo(len(noSag.shockSpring), 6);
    });
});

describe('springPoints', () => {
    it('zigzags between the ends and extends the used bar beyond the top', () => {
        const a = { x: 0, y: 100 };
        const b = { x: 0, y: 0 };
        const { coil, bar } = springPoints(a, b, 20);
        expect(coil[0]).toEqual(a);
        expect(coil[coil.length - 1]).toEqual(b);
        expect(coil.length).toBeGreaterThanOrEqual(9);
        // interior points alternate around the axis
        const xs = coil.slice(1, -1).map(p => p.x);
        expect(Math.max(...xs)).toBeGreaterThan(0);
        expect(Math.min(...xs)).toBeLessThan(0);
        // the used bar extends upward from the frame-side end
        expect(bar[0]).toEqual(a);
        expect(bar[1]).toEqual({ x: 0, y: 120 });
    });
});
