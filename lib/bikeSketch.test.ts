import { describe, expect, it } from 'vitest';
import { buildBikeSketch, wheelRadii } from './bikeSketch';
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
