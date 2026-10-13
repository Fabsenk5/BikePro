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

    it('moves the crown down with the frame head tube length', () => {
        const long = { ...geo, frame: { ...geo.frame, headTube: 150 } };
        const s = buildBikeSketch(long, computeContactGeometry(long), { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        const base = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        // 150 vs 110 mm: the crown drops 40 × sin(63.5°)
        expect(base.headBottom.y - s.headBottom.y).toBeCloseTo(40 * Math.sin((63.5 * Math.PI) / 180), 0);
        expect(s.headBottom.x).toBeGreaterThan(base.headBottom.x);
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
        // seated: saddle at the fit height, hip above the rail clamp
        expect(seated.saddle.y).toBeCloseTo(741, 6);
        expect(seated.riderHip.y).toBeCloseTo(741 + 60, 6);
        expect(seated.riderHip.x).toBeCloseTo(-60 - 60, 6);
        // standing: saddle slid down the seat axis by the dropper travel
        const seatRad = (78 * Math.PI) / 180;
        expect(standing.saddle.y).toBeCloseTo(741 - 170 * Math.sin(seatRad), 0);
        expect(standing.saddle.x).toBeCloseTo(-60 + 170 * Math.cos(seatRad), 0);
        // standing hip sits above the compressed saddle
        expect(standing.riderHip.y).toBeGreaterThan(standing.saddle.y + 100);
        expect(standing.riderHip.y).toBeCloseTo(seated.riderHip.y + 60, 6);
        // the back angle is derived (not fixed) and differs per pose
        for (const s of [seated, standing]) {
            expect(s.torsoAngleDeg).toBeGreaterThan(35);
            expect(s.torsoAngleDeg).toBeLessThan(70);
        }
        expect(standing.torsoAngleDeg).not.toBe(seated.torsoAngleDeg);
        // the standing rider still reaches the pedal
        expect(standing.riderKnee).not.toBeNull();
        expect(standing.kneeBendDeg!).toBeGreaterThan(20);
    });

    it('assumes the saddle setback when only the saddle height is known', () => {
        const noSetback = { ...geo, fit: { saddleHeight: 741 } };
        const s = buildBikeSketch(noSetback, computeContactGeometry(noSetback), { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        // seat angle 78° → 741 × cos 78° − 110 ≈ 44 mm setback
        expect(s.saddle.x).toBeCloseTo(-44, 0);
        expect(s.saddle.y).toBeCloseTo(741, 6);
    });

    it('keeps the dropper post and the saddle on the seat-tube axis', () => {
        const seatRad = (78 * Math.PI) / 180;
        const axisRatio = -Math.cos(seatRad) / Math.sin(seatRad);
        for (const riderMode of ['seated', 'standing'] as const) {
            const s = buildBikeSketch(geo, derived, {
                sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode, dropperTravel: 170,
            })!;
            // rail clamp sits on the axis through the BB
            expect(s.saddleClamp.x, riderMode).toBeCloseTo(-s.saddleClamp.y / Math.tan(seatRad), 0);
            // post from the seat cluster to the clamp follows the seat angle
            const post = { x: s.saddleClamp.x - s.seatCluster.x, y: s.saddleClamp.y - s.seatCluster.y };
            expect(post.x / post.y, riderMode).toBeCloseTo(axisRatio, 2);
        }
        // compressing the dropper slides the saddle down along the axis
        const seated = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'seated' })!;
        const standing = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'standing', dropperTravel: 170 })!;
        const slide = { x: standing.saddle.x - seated.saddle.x, y: standing.saddle.y - seated.saddle.y };
        expect(slide.x / -slide.y).toBeCloseTo(Math.cos(seatRad) / Math.sin(seatRad), 3);
        expect(Math.hypot(slide.x, slide.y)).toBeCloseTo(170, 0);
    });

    it('attack position crouches: hips back and down, arms strongly bent', () => {
        const standing = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'standing', dropperTravel: 170 })!;
        const attack = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'attack', dropperTravel: 170 })!;
        // dropper compressed like standing
        expect(attack.saddle.y).toBeCloseTo(standing.saddle.y, 6);
        // hips lower and further back than standing
        expect(attack.riderHip.y).toBeLessThan(standing.riderHip.y);
        expect(attack.riderHip.x).toBeLessThan(standing.riderHip.x);
        // back flatter (crouched) than standing
        expect(attack.torsoAngleDeg).toBeLessThan(standing.torsoAngleDeg);
        // elbows bend harder: elbow further off the shoulder–hand line
        const lineDist = (
            p: { x: number; y: number },
            a: { x: number; y: number },
            b: { x: number; y: number },
        ) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
        };
        expect(lineDist(attack.riderElbow, attack.riderShoulder, attack.hand))
            .toBeGreaterThan(lineDist(standing.riderElbow, standing.riderShoulder, standing.hand));
    });

    it('draws both legs on opposite crank positions', () => {        const horizontal = buildBikeSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, crankMode: 'horizontal',
        })!;
        expect(horizontal.riderLegs).toHaveLength(2);
        const near = horizontal.riderLegs.find(l => l.near)!;
        const far = horizontal.riderLegs.find(l => !l.near)!;
        expect(near.pedal.x).toBeCloseTo(170, 6);
        expect(far.pedal.x).toBeCloseTo(-170, 6);
        // the back leg is more compressed than the forward leg
        expect(far.knee!.x).toBeLessThan(near.knee!.x);
        const vertical = buildBikeSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, crankMode: 'vertical',
        })!;
        expect(vertical.riderLegs.find(l => l.near)!.pedal.y).toBeCloseTo(-170, 6);
        expect(vertical.riderLegs.find(l => !l.near)!.pedal.y).toBeCloseTo(170, 6);
    });

    it('clamps the compressed saddle above the seat cluster', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, riderMode: 'standing', dropperTravel: 400 })!;
        const seatClusterY = 450 * Math.sin((78 * Math.PI) / 180);
        expect(s.saddle.y).toBeGreaterThanOrEqual(seatClusterY + 60);
    });

    it('springs shorten with sag and carry the component travel', () => {
        const noSag = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose })!;
        const sagged = buildBikeSketch(geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 60, ...pose })!;
        // no sag → no used travel
        expect(noSag.forkSpring.used).toBeCloseTo(0, 6);
        expect(noSag.shockSpring.used).toBeCloseTo(0, 6);
        // sag → fork uses part of its travel, shock exactly its sag
        expect(sagged.forkSpring.used).toBeGreaterThan(20);
        expect(sagged.forkSpring.used).toBeLessThan(34);
        expect(sagged.shockSpring.used).toBeCloseTo(12, 6);
        // travel carried for the coil length; fork body = half the travel
        expect(sagged.forkSpring.travel).toBe(170);
        expect(sagged.forkSpring.lead).toBe(85);
        expect(sagged.shockSpring.travel).toBe(60);
        // shock is drawn as a real damper body: ~3× stroke overall
        expect(sagged.shockSpring.lead).toBe(60);
        const len = (p: { top: { x: number; y: number }; bottom: { x: number; y: number } }) =>
            Math.hypot(p.bottom.x - p.top.x, p.bottom.y - p.top.y);
        expect(len(noSag.shockSpring)).toBeCloseTo(3 * 60, 0);
        // coil + solid reconstruct the un-sagged spring line
        expect(len(sagged.forkSpring) + sagged.forkSpring.used).toBeCloseTo(len(noSag.forkSpring), 6);
        expect(len(sagged.shockSpring) + sagged.shockSpring.used).toBeCloseTo(len(noSag.shockSpring), 6);
    });
});

describe('springPoints', () => {
    it('draws the coil over the travel between solid body and rest', () => {
        const a = { x: 0, y: 200 };
        const b = { x: 0, y: 0 };
        const { coil, solids } = springPoints(a, { x: 0, y: 20 }, 20, 60, 60);
        // solid body above the coil (lead = 60)
        expect(solids[0][0]).toEqual(a);
        expect(solids[0][1]).toEqual({ x: 0, y: 140 });
        // coil covers travel − used = 40 mm
        expect(coil[0]).toEqual({ x: 0, y: 140 });
        expect(coil[coil.length - 1]).toEqual({ x: 0, y: 100 });
        expect(coil.length).toBeGreaterThanOrEqual(7);
        // interior points alternate around the axis
        const xs = coil.slice(1, -1).map(p => p.x);
        expect(Math.max(...xs)).toBeGreaterThan(0);
        expect(Math.min(...xs)).toBeLessThan(0);
        // rest of the line below the coil
        expect(solids[1][0]).toEqual({ x: 0, y: 100 });
        expect(solids[1][1]).toEqual({ x: 0, y: 20 });
        // without sag the coil is longer and the rest shorter, total stays
        const noSag = springPoints(a, b, 0, 60, 60);
        expect(noSag.coil[noSag.coil.length - 1]).toEqual({ x: 0, y: 80 });
        expect(noSag.solids[1][1]).toEqual(b);
    });
});
