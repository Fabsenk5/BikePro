import { describe, expect, it } from 'vitest';
import { buildAnimationFrame, buildBikeSketch, buildFrontSketch, springPoints, wheelRadii } from './bikeSketch';
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
        // spacer tower projected along the steerer: 15 mm pull the bar
        // rearward (×cos 63.5°) and lift it (×sin 63.5°)
        expect(s.bar.x).toBeCloseTo(480 + 40 - 15 * Math.cos((63.5 * Math.PI) / 180), 6);
        expect(s.bar.y).toBeCloseTo(630 + 15 * Math.sin((63.5 * Math.PI) / 180) + 30, 6);
        expect(s.saddle.y).toBeCloseTo(741 * Math.sin((78 * Math.PI) / 180), 3);
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
        expect(s.legRangeDeg).toBeNull();
        expect(s.kopsOffsetMm).toBeNull();
        // default crank mode is horizontal
        expect(s.riderPedal.x).toBeCloseTo(170, 6);
    });

    it('reports the leg extension range over the full revolution', () => {
        const s = buildBikeSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, crankMode: 'vertical',
        })!;
        expect(s.legRangeDeg).not.toBeNull();
        // bottom dead centre: nearly straight (same value as the caption)
        expect(s.legRangeDeg!.bottom).toBeCloseTo(s.kneeBendDeg!, 6);
        expect(s.legRangeDeg!.bottom).toBeGreaterThan(15);
        expect(s.legRangeDeg!.bottom).toBeLessThan(45);
        // top dead centre: clearly bent — that's the rider's leg reserve
        expect(s.legRangeDeg!.top).toBeGreaterThan(s.legRangeDeg!.bottom + 20);
        expect(s.legRangeDeg!.top).toBeLessThan(150);
    });
});

describe('rider mode and springs', () => {
    const pose = { inseam: 840, crankLength: 170 };

    it('seated keeps the dropper extended, standing compresses it', () => {
        const seated = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'seated' })!;
        const standing = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, riderMode: 'standing', dropperTravel: 170 })!;
        // seated: saddle at the fit height (along the seat tube → vertical), hip above the rail clamp
        expect(seated.saddle.y).toBeCloseTo(741 * Math.sin((78 * Math.PI) / 180), 3);
        expect(seated.riderHip.y).toBeCloseTo(seated.saddle.y + 60, 6);
        expect(seated.riderHip.x).toBeCloseTo(-60 - 60, 6);
        // standing: saddle slid down the seat axis by the dropper travel
        const seatRad = (78 * Math.PI) / 180;
        expect(standing.saddle.y).toBeCloseTo((741 - 170) * Math.sin(seatRad), 0);
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
        expect(s.saddle.y).toBeCloseTo(741 * Math.sin((78 * Math.PI) / 180), 3);
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

    it('attack positions hinge the hips: flat moderate, steep deeper', () => {
        const opts = { sagPercent: 0, forkTravel: 170, shockStroke: 60, ...pose, dropperTravel: 170 };
        const standing = buildBikeSketch(geo, derived, { ...opts, riderMode: 'standing' })!;
        const flat = buildBikeSketch(geo, derived, { ...opts, riderMode: 'attack-flat' })!;
        const steep = buildBikeSketch(geo, derived, { ...opts, riderMode: 'attack-steep' })!;
        // dropper compressed like standing in both attack variants
        expect(flat.saddle.y).toBeCloseTo(standing.saddle.y, 6);
        expect(steep.saddle.y).toBeCloseTo(standing.saddle.y, 6);
        // hips go back and up (butt behind and above the saddle), steep furthest
        expect(flat.riderHip.x).toBeLessThan(flat.saddle.x);
        expect(flat.riderHip.y).toBeGreaterThan(flat.saddle.y + 100);
        expect(steep.riderHip.x).toBeLessThan(flat.riderHip.x);
        expect(steep.riderHip.y).toBeGreaterThan(flat.riderHip.y);
        // the saddle ends up clearly below the steep hips (hip hinge)
        expect(steep.riderHip.y - steep.saddle.y).toBeGreaterThan(150);
        // backs are flatter than standing, steep flattest
        expect(flat.torsoAngleDeg).toBeLessThan(standing.torsoAngleDeg);
        expect(steep.torsoAngleDeg).toBeLessThan(flat.torsoAngleDeg);
        // legs stay reachable: the pedals are still solved by the IK
        expect(flat.riderKnee).not.toBeNull();
        expect(steep.riderKnee).not.toBeNull();
        expect(steep.kneeBendDeg!).toBeGreaterThan(10);
        // elbows bend harder than standing: elbow further off the shoulder–hand line
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
        const standingElbow = lineDist(standing.riderElbow, standing.riderShoulder, standing.hand);
        const flatElbow = lineDist(flat.riderElbow, flat.riderShoulder, flat.hand);
        const steepElbow = lineDist(steep.riderElbow, steep.riderShoulder, steep.hand);
        expect(flatElbow).toBeGreaterThan(standingElbow);
        expect(steepElbow).toBeGreaterThan(flatElbow);
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

describe('body segment proportions', () => {
    it('arm segments add up to the arm length (shoulder → ball of hand)', () => {
        const armLength = 640;
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, inseam: 840, armLength })!;
        const upper = Math.hypot(s.riderElbow.x - s.riderShoulder.x, s.riderElbow.y - s.riderShoulder.y);
        const forearm = Math.hypot(s.hand.x - s.riderElbow.x, s.hand.y - s.riderElbow.y);
        expect(upper + forearm).toBeCloseTo(armLength, 0);
        // upper arm ≈ 0.48 of the arm (forearm incl. hand to the ball ≈ 0.52)
        expect(upper / armLength).toBeCloseTo(0.48, 2);
    });

    it('leg segments add up to the functional leg (1.18 × inseam)', () => {
        const inseam = 840;
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60, inseam })!;
        const thigh = Math.hypot(s.riderKnee!.x - s.riderHip.x, s.riderKnee!.y - s.riderHip.y);
        const shin = Math.hypot(s.riderPedal.x - s.riderKnee!.x, s.riderPedal.y - s.riderKnee!.y);
        expect(thigh).toBeCloseTo(inseam * 0.53, 1);
        expect(shin).toBeCloseTo(inseam * 0.65, 1);
        // thigh ≈ 0.44 of the functional leg
        expect(thigh / (thigh + shin)).toBeCloseTo(0.45, 2);
    });

    it('reproduces the knee-bend guideline at the LeMond saddle height', () => {
        for (const inseam of [780, 840, 900]) {
            const saddleHeight = Math.round(0.883 * inseam);
            const setback = Math.max(20, Math.min(120, Math.round(saddleHeight * Math.cos((78 * Math.PI) / 180) - 110)));
            const g = { ...geo, fit: { saddleHeight, saddleSetback: setback } };
            const s = buildBikeSketch(g, computeContactGeometry(g), {
                sagPercent: 0, forkTravel: 170, shockStroke: 60, inseam, crankMode: 'vertical',
            })!;
            expect(s.kneeBendDeg!, `inseam ${inseam}`).toBeGreaterThan(15);
            expect(s.kneeBendDeg!, `inseam ${inseam}`).toBeLessThan(40);
        }
    });
});

describe('animation wheel lifts', () => {
    it('compresses fork and shock over rocks and lets the rider absorb', () => {
        const opts = { sagPercent: 20, forkTravel: 180, shockStroke: 65, rearTravel: 170, inseam: 840, crankLength: 170 };
        const base = buildBikeSketch(geo, derived, opts)!;
        // front wheel over a rock: axle lifts, fork compresses towards travel
        const frontHit = buildBikeSketch(geo, derived, { ...opts, wheelLift: { front: 180 } })!;
        expect(frontHit.frontAxle.y).toBeCloseTo(base.frontAxle.y + 180, 6);
        expect(frontHit.forkSpring.used).toBeGreaterThan(150);
        expect(frontHit.forkSpring.used).toBeLessThanOrEqual(180);
        // rear wheel travel compresses the shock via the leverage: 170 mm wheel
        // travel uses the full 65 mm stroke
        const rearHit = buildBikeSketch(geo, derived, { ...opts, wheelLift: { rear: 170 } })!;
        expect(rearHit.rearAxle.y).toBeCloseTo(base.rearAxle.y + 170, 6);
        expect(rearHit.shockSpring.used).toBeCloseTo(65, 1);
        // beyond the suspension the frame lifts and the rider absorbs it:
        // body drops in the frame-fixed sketch, back angle stays stable
        const absorbed = buildBikeSketch(geo, derived, { ...opts, wheelLift: { front: 180 }, riderAbsorb: 60 })!;
        expect(absorbed.riderHip.y).toBeCloseTo(frontHit.riderHip.y - 60, 6);
        expect(frontHit.riderHead.y - absorbed.riderHead.y).toBeGreaterThan(50);
        expect(frontHit.riderHead.y - absorbed.riderHead.y).toBeLessThan(75);
        expect(Math.abs(absorbed.torsoAngleDeg - frontHit.torsoAngleDeg)).toBeLessThanOrEqual(2);
    });
});

describe('animation frame (rocks)', () => {
    const params = {
        frontAxleX: 839, rearAxleX: -445, frontRadius: 374, rearRadius: 355,
        forkTravel: 180, shockStroke: 65, rearTravel: 170, sagPercent: 20,
    };

    it('never sinks a wheel below the ground and never floats above its rock', () => {
        for (let i = 0; i <= 100; i += 1) {
            const f = buildAnimationFrame({ ...params, progress: i / 100 });
            // world bottom of each wheel above the ground (mm)
            expect(f.frontLift + f.absorb, `front @${i}`).toBeGreaterThanOrEqual(-0.001);
            expect(f.rearLift + f.absorb, `rear @${i}`).toBeGreaterThanOrEqual(-0.001);
            // and never above the rock height currently under it
            expect(f.frontLift + f.absorb, `front max @${i}`).toBeLessThanOrEqual(f.rockHeight + 0.001);
            expect(f.rearLift + f.absorb, `rear max @${i}`).toBeLessThanOrEqual(f.rockHeight + 0.001);
        }
    });

    it('puts the wheel exactly on the rock at the peaks', () => {
        const rockStart = params.frontAxleX + 420;
        const rockEnd = params.rearAxleX - 420;
        const span = rockStart - rockEnd;
        for (const phase of [0, 1]) {
            for (const [axleX, wheel] of [[params.frontAxleX, 'front'], [params.rearAxleX, 'rear']] as const) {
                const local = (rockStart - axleX) / span;
                const progress = phase * 0.5 + local * 0.5;
                const f = buildAnimationFrame({ ...params, progress });
                const bottom = wheel === 'front' ? f.frontLift + f.absorb : f.rearLift + f.absorb;
                expect(bottom, `${wheel} phase ${phase}`).toBeCloseTo(f.rockHeight, 0);
            }
        }
    });
});

describe('cockpit detail', () => {
    it('splits spacers, stem, rise and swept bar exactly like the contact model', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.steererTop).not.toBeNull();
        expect(s.stemEnd).not.toBeNull();
        // spacer tower along the steerer: 15 mm pull the clamp rearward/up
        expect(s.steererTop!.x).toBeCloseTo(480 - 15 * Math.cos((63.5 * Math.PI) / 180), 6);
        expect(s.steererTop!.y).toBeCloseTo(630 + 15 * Math.sin((63.5 * Math.PI) / 180), 6);
        // stem 40 mm at 0°: straight forward
        expect(s.stemEnd!.x).toBeCloseTo(s.steererTop!.x + 40, 6);
        expect(s.stemEnd!.y).toBeCloseTo(s.steererTop!.y, 6);
        // rise + swept bar land exactly on the derived points
        expect(s.bar.x).toBeCloseTo(s.stemEnd!.x, 6);
        expect(s.bar.y).toBeCloseTo(s.stemEnd!.y + 30, 6);
        expect(s.hand.x).toBeCloseTo(derived.handX!, 6);
        expect(s.hand.y).toBeCloseTo(derived.handY!, 6);
    });

    it('falls back to the simple stem line without stem data or with a measured bar', () => {
        const { stemLength: _stem, ...cockpitNoStem } = geo.cockpit;
        const noStem = { ...geo, cockpit: cockpitNoStem };
        const s1 = buildBikeSketch(noStem, computeContactGeometry(noStem), { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s1.steererTop).toBeNull();
        expect(s1.stemEnd).toBeNull();
        const measured = { ...geo, measured: { barX: 999, barY: 999 } };
        const s2 = buildBikeSketch(measured, computeContactGeometry(measured), { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s2.steererTop).toBeNull();
        expect(s2.stemEnd).toBeNull();
    });

    it('offsets the far arm for depth', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.riderElbowFar.x).toBeCloseTo(s.riderElbow.x - 18, 6);
        expect(s.riderElbowFar.y).toBeCloseTo(s.riderElbow.y - 28, 6);
        expect(s.riderHandFar.x).toBeCloseTo(s.hand.x - 18, 6);
        expect(s.riderHandFar.y).toBeCloseTo(s.hand.y - 28, 6);
    });

    it('exposes front cockpit heights (clamp, steerer top, grip rise)', () => {
        const f = buildFrontSketch(geo, derived, { sagPercent: 0, forkTravel: 170 })!;
        // grip rise from the upsweep: (780/2 − 40) · sin 5°
        expect(f.gripRise).toBeCloseTo(350 * Math.sin((5 * Math.PI) / 180), 6);
        // clamp = bar centre minus rise
        expect(f.clampGroundY).toBeCloseTo(f.barGroundY - 30, 6);
        // steerer top = stack height above ground at rest
        expect(f.headTopGroundY).toBeCloseTo(f.bbGroundY + 630, 6);
        expect(f.spacersMm).toBe(15);
    });

    it('front cockpit falls back without stack or rise', () => {
        // without a stack the steerer top is unknown — reachable with a
        // measured bar override (otherwise barY itself is already null)
        const { stack: _stack, ...frameNoStack } = geo.frame;
        const noStack = { ...geo, frame: frameNoStack, measured: { barX: 520, barY: 675 } };
        const f1 = buildFrontSketch(noStack, computeContactGeometry(noStack), { sagPercent: 0, forkTravel: 170 })!;
        expect(f1.headTopGroundY).toBeNull();
        const { barRise: _rise, ...cockpitNoRise } = geo.cockpit;
        const noRise = { ...geo, cockpit: cockpitNoRise };
        const f2 = buildFrontSketch(noRise, computeContactGeometry(noRise), { sagPercent: 0, forkTravel: 170 })!;
        expect(f2.clampGroundY).toBeNull();
        const { upsweep: _sweep, ...cockpitNoSweep } = geo.cockpit;
        const noSweep = { ...geo, cockpit: cockpitNoSweep };
        const f3 = buildFrontSketch(noSweep, computeContactGeometry(noSweep), { sagPercent: 0, forkTravel: 170 })!;
        // grips still sit at the bar line without upsweep data
        expect(f3.gripRise).toBe(0);
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

describe('torso angle source', () => {
    it("reports 'ik' when the bar position is known", () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.torsoAngleSource).toBe('ik');
    });

    it("reports 'fallback' without a hand position", () => {
        const noHands = { ...derived, handX: null, handY: null };
        const s = buildBikeSketch(geo, noHands, { sagPercent: 0, forkTravel: 170, shockStroke: 60 })!;
        expect(s.torsoAngleSource).toBe('fallback');
        expect(s.torsoAngleDeg).toBe(55); // seated lean fallback
    });
});

describe('front sketch crown', () => {
    it('places the crown from the head-tube geometry like the side view', () => {
        const front = buildFrontSketch(geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 60 })!;
        // BB height = front radius − drop (no measured height), sag 20 % of 170
        const expected = (374 - 23) + (630 - 110 * Math.sin((63.5 * Math.PI) / 180)) - 34;
        expect(front.crownGroundY).toBeCloseTo(expected, 6);
        expect(front.crownGroundY).toBeLessThan(front.barGroundY);
        expect(front.crownGroundY).toBeGreaterThan(front.wheelRadius);
    });

    it('hangs the head tube below the bar without stack/reach', () => {
        const minimal = {
            frame: { bbDrop: 23, wheelSize: 'mullet', headTube: 120 },
            cockpit: { barWidth: 780 },
        };
        const front = buildFrontSketch(minimal, derived, { sagPercent: 0, forkTravel: 170 })!;
        expect(front.crownGroundY).toBeCloseTo(front.barGroundY - 120, 6);
    });
});

describe('front sketch legs', () => {
    it('draws straight legs without an inseam (knee null)', () => {
        const front = buildFrontSketch(geo, derived, { sagPercent: 0, forkTravel: 170 })!;
        expect(front.legs).toHaveLength(2);
        for (const leg of front.legs) {
            expect(leg.knee).toBeNull();
            expect(leg.hip.y).toBeCloseTo(front.hipY, 6);
        }
    });

    it('bends the knees when the inseam is known', () => {
        const front = buildFrontSketch(geo, derived, {
            sagPercent: 0, forkTravel: 170, inseam: 840, crankMode: 'vertical', crankLength: 170,
        })!;
        for (const leg of front.legs) {
            expect(leg.knee).not.toBeNull();
        }
        // vertical: one foot above, one below the BB height (upper leg is dimmed)
        expect(front.legs[0].foot.y).toBeGreaterThan(front.bbGroundY);
        expect(front.legs[1].foot.y).toBeLessThan(front.bbGroundY);
    });
});

describe('hardtail (no shock stroke)', () => {
    it('side sketch stays finite and degenerates the shock to a solid line', () => {
        const s = buildBikeSketch(geo, derived, { sagPercent: 20, forkTravel: 170, shockStroke: 0 })!;
        expect(s.sagShock).toBe(0);
        expect(s.shockSpring.used).toBe(0);
        expect(s.forkSpring.used).toBeGreaterThan(0);
        // degenerate damper: top meets bottom — the component draws only a line
        expect(s.shockSpring.bottom).toEqual(s.shockSpring.top);
        const nums = [
            s.groundY, s.sagFork, s.sagShock,
            s.headTop.x, s.headTop.y, s.headBottom.x, s.headBottom.y,
            s.bar.x, s.bar.y, s.saddle.x, s.saddle.y,
            s.riderHip.x, s.riderHip.y, s.riderShoulder.x, s.riderShoulder.y,
            s.forkSpring.used, s.shockSpring.used,
            s.shockSpring.top.x, s.shockSpring.top.y,
        ];
        for (const n of nums) expect(Number.isFinite(n)).toBe(true);
    });

    it('animation frame stays finite without a shock (no division by zero)', () => {
        const params = {
            frontAxleX: 839, rearAxleX: -445, frontRadius: 374, rearRadius: 355,
            forkTravel: 180, shockStroke: 0, rearTravel: 0, sagPercent: 20,
        };
        for (let i = 0; i <= 20; i += 1) {
            const f = buildAnimationFrame({ ...params, progress: i / 20 });
            for (const n of [f.rockHeight, f.rockX, f.frontLift, f.rearLift, f.absorb]) {
                expect(Number.isFinite(n), `progress ${i}`).toBe(true);
            }
            expect(f.frontLift + f.absorb, `front @${i}`).toBeGreaterThanOrEqual(-0.001);
            expect(f.rearLift + f.absorb, `rear @${i}`).toBeGreaterThanOrEqual(-0.001);
        }
    });
});
