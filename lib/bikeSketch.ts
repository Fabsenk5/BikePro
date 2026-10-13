/**
 * Bike side-view sketch — pure coordinate math for the technical drawing.
 *
 * Points are in millimetres, BB-relative with y pointing up; the SVG component
 * maps them to screen space. Sag lowers frame and rider along a linear pitch
 * between the rear and front axle — the wheels stay on the ground, so the
 * fork/shock visually compress.
 */
import { assumedSaddleSetback, BikeGeometry, ContactGeometry, GRIP_INSET_MM } from './geometry';

export interface SketchPoint {
    x: number;
    y: number;
}

export interface BikeSketch {
    bb: SketchPoint;
    rearAxle: SketchPoint;
    frontAxle: SketchPoint;
    /** ground line height (BB-relative, negative) — wheel bottoms rest here */
    groundY: number;
    headTop: SketchPoint;
    headBottom: SketchPoint;
    seatCluster: SketchPoint;
    saddle: SketchPoint;
    bar: SketchPoint;
    hand: SketchPoint;
    riderHip: SketchPoint;
    riderShoulder: SketchPoint;
    riderHead: SketchPoint;
    riderHeadRadius: number;
    /** elbow of the bent arm (shoulder → elbow → hand) */
    riderElbow: SketchPoint;
    /** knee of the near leg (null when no inseam is known) */
    riderKnee: SketchPoint | null;
    /** pedal of the near leg (forward / bottom) */
    riderPedal: SketchPoint;
    /** both legs: near (forward/bottom pedal) and far (opposite crank) */
    riderLegs: { pedal: SketchPoint; knee: SketchPoint | null; near: boolean }[];
    /** rail clamp on the seat-tube axis (dropper post top) */
    saddleClamp: SketchPoint;
    /** knee bend in degrees (0 = straight) at the current pedal position */
    kneeBendDeg: number | null;
    /** knee-over-pedal horizontal offset (positive = knee ahead) — horizontal mode */
    kopsOffsetMm: number | null;
    wheelRadiusRear: number;
    wheelRadiusFront: number;
    sagFork: number;
    sagShock: number;
    /** fork spring (crown → front axle) for the sag visualization */
    forkSpring: SpringLine;
    /** rear shock spring, drawn along the seat tube */
    shockSpring: SpringLine;
}

/** Fallback head tube length when the frame data has none (mm). */
const HEAD_TUBE_LENGTH = 110;
const DEFAULT_TORSO = 550;
/** Hip joint sits above the saddle surface (mm). */
const HIP_ABOVE_SADDLE = 60;
/** Functional leg segments relative to inseam (shin includes the foot to the pedal). */
const THIGH_RATIO = 0.53;
const SHIN_RATIO = 0.67;
/** Standing hips sit higher and slightly behind the BB compared to the seated pose. */
const STANDING_HIP_RISE = 60;
const STANDING_HIP_BACK = 30;
/** Torso lean from horizontal — standing is more upright (leaning back). */
const TORSO_ANGLE_SEATED = 55;
const TORSO_ANGLE_STANDING = 60;
/** Hip joint sits this far behind the saddle nose (above the rail clamp). */
const HIP_BEHIND_NOSE = 60;
/** Dropper travel assumed when the component does not state a hub. */
export const DEFAULT_DROPPER_TRAVEL = 170;
/** Saddle stays at least this high above the seat cluster when the dropper is compressed. */
const SADDLE_MIN_ABOVE_CLUSTER = 60;
/** Rear shock is drawn along the seat tube (fraction of its length + forward offset). */
const SHOCK_LINE_TO = 0.85;
const SHOCK_LINE_OFFSET = 34;
/** Front-view legs: half hip joint distance and half pedal stance (mm). */
const FRONT_HIP_HALF = 55;
const FRONT_PEDAL_HALF = 80;

export type CrankMode = 'horizontal' | 'vertical';
export type RiderMode = 'seated' | 'standing';

/** Spring line for the sag visualization: coil length = remaining travel. */
export interface SpringLine {
    /** frame-side end (moves down with sag) */
    top: SketchPoint;
    /** wheel-side end (shock: end of the drawn body) */
    bottom: SketchPoint;
    /** travel used by sag along the spring axis (mm) */
    used: number;
    /** full travel of the component (mm) — the coil is only this long */
    travel: number;
    /** solid body above the coil (crown / shock body, mm) */
    lead: number;
}

const distance = (a: SketchPoint, b: SketchPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** Point offset perpendicular to the a→b line, bowing backward (elbow bend). */
function bendPoint(a: SketchPoint, b: SketchPoint, offset: number): SketchPoint {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const len = Math.hypot(ux, uy) || 1;
    let nx = -uy / len;
    let ny = ux / len;
    // Rider faces +x: the elbow bows backward (−x), never forward
    if (nx > 0) { nx = -nx; ny = -ny; }
    return { x: (a.x + b.x) / 2 + nx * offset, y: (a.y + b.y) / 2 + ny * offset };
}

/** Two-bone IK for the knee, choosing the forward (+x) solution. */
function twoBoneIK(hip: SketchPoint, target: SketchPoint, l1: number, l2: number): SketchPoint {
    const d = Math.min(distance(hip, target), l1 + l2 - 1);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = (target.x - hip.x) / d;
    const uy = (target.y - hip.y) / d;
    const k1 = { x: hip.x + a * ux - h * uy, y: hip.y + a * uy + h * ux };
    const k2 = { x: hip.x + a * ux + h * uy, y: hip.y + a * uy - h * ux };
    return k1.x >= k2.x ? k1 : k2;
}

/** Knee bend in degrees (0 = straight leg). */
function kneeBend(l1: number, l2: number, d: number): number {
    const dd = Math.min(d, l1 + l2 - 0.001);
    const cos = (l1 * l1 + l2 * l2 - dd * dd) / (2 * l1 * l2);
    const interior = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    return Math.round((180 - interior) * 10) / 10;
}

/**
 * Zigzag spring along a→b. Only the component travel is drawn as a coil
 * (shortened by the travel used); `lead` stays a solid body above it and the
 * rest below is a solid line too.
 */
export function springPoints(
    a: SketchPoint,
    b: SketchPoint,
    used: number,
    travel: number,
    lead = 0,
): { coil: SketchPoint[]; solids: [SketchPoint, SketchPoint][] } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const leadLen = Math.max(0, Math.min(lead, len));
    const coilLen = Math.max(0, Math.min(travel - used, len - leadLen));
    const amp = Math.min(14, Math.max(4, coilLen / 8));
    const coils = Math.max(3, Math.min(8, Math.round(coilLen / 22)));
    const steps = coils * 2;
    const coilStart = { x: a.x + ux * leadLen, y: a.y + uy * leadLen };
    const coil: SketchPoint[] = [];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const off = i === 0 || i === steps ? 0 : i % 2 === 1 ? amp : -amp;
        coil.push({
            x: coilStart.x + ux * coilLen * t + nx * off,
            y: coilStart.y + uy * coilLen * t + ny * off,
        });
    }
    const coilEnd = { x: coilStart.x + ux * coilLen, y: coilStart.y + uy * coilLen };
    return {
        coil,
        solids: [
            [a, coilStart],
            [coilEnd, b],
        ],
    };
}

/** Approximate outer tire radii (mm) for common wheel sizes with a 2.4–2.5" tire. */
const TIRE_RADIUS: Record<string, number> = { '29': 374, '27.5': 355, '26': 340 };

export function wheelRadii(wheelSize?: string): { front: number; rear: number } {
    if (wheelSize === 'mullet') return { front: TIRE_RADIUS['29'], rear: TIRE_RADIUS['27.5'] };
    const radius = TIRE_RADIUS[wheelSize ?? ''] ?? TIRE_RADIUS['29'];
    return { front: radius, rear: radius };
}

// ─── Front view (grip span vs shoulder width) ───

export interface FrontSketch {
    wheelRadius: number;
    barWidth: number;
    /** half distance between grip centres (bar width minus the hand inset) */
    gripHalfSpan: number;
    shoulderHalfWidth: number | null;
    /** bar centre height above the ground (front sag applied) */
    barGroundY: number;
    shoulderY: number;
    hipY: number;
    headCenter: SketchPoint;
    headRadius: number;
    /** tire width for the head-on view (mm) */
    tireWidthMm: number;
    /** saddle top above the ground — dropper extended (seated) or compressed (standing) */
    saddleGroundY: number;
    /** fork travel used by sag (mm) */
    forkUsed: number;
    /** full fork travel (mm) — the coil is only this long */
    forkTravel: number;
    /** BB height above the ground (front leg origin) */
    bbGroundY: number;
    /** head tube length — crown sits this far below the bar */
    headTubeLength: number;
    /** both legs hip → knee → pedal (front view, feet per crank position) */
    legs: { hip: SketchPoint; knee: SketchPoint; foot: SketchPoint }[];
}

export function buildFrontSketch(
    geo: BikeGeometry,
    derived: ContactGeometry,
    opts: {
        shoulderWidth?: number | null;
        sagPercent: number;
        forkTravel: number;
        shockStroke?: number | null;
        tireWidthMm?: number | null;
        riderMode?: RiderMode;
        dropperTravel?: number | null;
        torsoLength?: number | null;
        crankMode?: CrankMode;
        crankLength?: number | null;
    },
): FrontSketch | null {
    const frame = geo.frame ?? {};
    const cockpit = geo.cockpit ?? {};
    if (cockpit.barWidth == null || derived.barY == null) return null;

    const bbDrop = frame.bbDrop ?? 30;
    const seatAngle = frame.seatAngle ?? 75;
    const seatRad = (seatAngle * Math.PI) / 180;
    const radii = wheelRadii(frame.wheelSize);
    const bbHeight = geo.measured?.bbHeight ?? (radii.front - bbDrop);
    const sagFork = Math.max(0, (opts.forkTravel * opts.sagPercent) / 100);
    const sagShock = Math.max(0, ((opts.shockStroke ?? 0) * opts.sagPercent) / 100);
    const barGroundY = bbHeight + derived.barY - sagFork;
    const gripHalfSpan = Math.max(0, cockpit.barWidth / 2 - GRIP_INSET_MM);
    const shoulderHalfWidth = opts.shoulderWidth != null && opts.shoulderWidth > 0
        ? opts.shoulderWidth / 2
        : null;

    // Rider mode mirrors the side view: same hip heights, dropper state and lean
    const riderMode = opts.riderMode ?? 'seated';
    const dropperTravel = opts.dropperTravel ?? DEFAULT_DROPPER_TRAVEL;
    const saddleAboveBb = derived.saddleY ?? (frame.seatTube ?? 440) * Math.sin(seatRad);
    const saddleGroundYSeated = bbHeight + saddleAboveBb - sagShock;
    const saddleGroundY = riderMode === 'standing'
        ? saddleGroundYSeated - dropperTravel * Math.sin(seatRad)
        : saddleGroundYSeated;
    const torso = opts.torsoLength ?? DEFAULT_TORSO;
    const hipY = riderMode === 'standing'
        ? saddleGroundYSeated + HIP_ABOVE_SADDLE + STANDING_HIP_RISE
        : saddleGroundY + HIP_ABOVE_SADDLE;
    const torsoAngle = riderMode === 'standing' ? TORSO_ANGLE_STANDING : TORSO_ANGLE_SEATED;
    const shoulderY = hipY + torso * Math.sin((torsoAngle * Math.PI) / 180);

    // Legs seen from the front: hip → knee → pedal, feet per crank position
    const crank = opts.crankLength ?? geo.cockpit?.crankLength ?? 170;
    const crankMode = opts.crankMode ?? 'horizontal';
    const footY = (side: number) => crankMode === 'vertical'
        ? bbHeight + side * crank
        : bbHeight;
    const legs = ([1, -1] as const).map(side => {
        const hip = { x: side * FRONT_HIP_HALF, y: hipY };
        const foot = { x: side * FRONT_PEDAL_HALF, y: footY(side) };
        return {
            hip,
            foot,
            knee: {
                x: side * (FRONT_HIP_HALF + FRONT_PEDAL_HALF) / 2 + side * 10,
                y: (hipY + foot.y) / 2 + 25,
            },
        };
    });

    return {
        wheelRadius: radii.front,
        barWidth: cockpit.barWidth,
        gripHalfSpan,
        shoulderHalfWidth,
        barGroundY,
        shoulderY,
        hipY,
        headCenter: { x: 0, y: shoulderY + 90 },
        headRadius: 60,
        tireWidthMm: opts.tireWidthMm != null && opts.tireWidthMm > 0 ? opts.tireWidthMm : 60,
        saddleGroundY,
        forkUsed: sagFork,
        forkTravel: opts.forkTravel,
        bbGroundY: bbHeight,
        headTubeLength: frame.headTube ?? HEAD_TUBE_LENGTH,
        legs,
    };
}

export function buildBikeSketch(
    geo: BikeGeometry,
    derived: ContactGeometry,
    opts: {
        sagPercent: number;
        forkTravel: number;
        shockStroke: number;
        torsoLength?: number | null;
        inseam?: number | null;
        crankLength?: number | null;
        crankMode?: CrankMode;
        riderMode?: RiderMode;
        dropperTravel?: number | null;
    },
): BikeSketch | null {
    const frame = geo.frame ?? {};
    const { chainstay, wheelbase, stack, reach } = frame;
    if (chainstay == null || wheelbase == null || stack == null || reach == null) return null;

    const bbDrop = frame.bbDrop ?? 30;
    const headAngle = frame.headAngle ?? 65;
    const seatAngle = frame.seatAngle ?? 75;
    const seatTube = frame.seatTube ?? 440;
    const headTube = frame.headTube ?? HEAD_TUBE_LENGTH;

    const radii = wheelRadii(frame.wheelSize);
    // BB height above ground: measured value wins, else derived from the front
    // wheel — matches manufacturer charts (front radius − BB drop).
    const bbHeight = geo.measured?.bbHeight ?? (radii.front - bbDrop);

    const bb: SketchPoint = { x: 0, y: 0 };
    // Both wheels stand on the ground: axle height = wheel radius − BB height
    const rearAxle: SketchPoint = { x: -chainstay, y: radii.rear - bbHeight };
    const frontAxle: SketchPoint = { x: wheelbase - chainstay, y: radii.front - bbHeight };

    const headTop: SketchPoint = { x: reach, y: stack };
    const headRad = (headAngle * Math.PI) / 180;
    // The head tube leans back: its bottom sits FORWARD of the top
    const headBottom: SketchPoint = {
        x: headTop.x + headTube * Math.cos(headRad),
        y: headTop.y - headTube * Math.sin(headRad),
    };

    const seatRad = (seatAngle * Math.PI) / 180;
    const seatCluster: SketchPoint = {
        x: -seatTube * Math.cos(seatRad),
        y: seatTube * Math.sin(seatRad),
    };

    // Saddle position: height from fit (assumed when empty), setback likewise —
    // without either we can only fall back to the seat cluster.
    const saddleSeated: SketchPoint = derived.saddleY != null
        ? {
            x: derived.saddleX ?? -assumedSaddleSetback(derived.saddleY, seatAngle),
            y: derived.saddleY,
        }
        : seatCluster;

    // Rider mode: seated keeps the dropper extended, standing compresses it
    const riderMode = opts.riderMode ?? 'seated';
    const dropperTravel = opts.dropperTravel ?? DEFAULT_DROPPER_TRAVEL;
    const seatDir: SketchPoint = { x: -Math.cos(seatRad), y: Math.sin(seatRad) };
    let saddle = saddleSeated;
    if (riderMode === 'standing') {
        const dropped = {
            x: saddleSeated.x - seatDir.x * dropperTravel,
            y: saddleSeated.y - seatDir.y * dropperTravel,
        };
        const minY = seatCluster.y + SADDLE_MIN_ABOVE_CLUSTER;
        saddle = dropped.y < minY
            ? { x: seatCluster.x + ((minY - seatCluster.y) / seatDir.y) * seatDir.x, y: minY }
            : dropped;
    }

    const bar: SketchPoint = derived.barX != null && derived.barY != null
        ? { x: derived.barX, y: derived.barY }
        : { x: headTop.x + 40, y: headTop.y };
    const hand: SketchPoint = derived.handX != null && derived.handY != null
        ? { x: derived.handX, y: derived.handY }
        : bar;

    // Rail clamp sits on the seat-tube axis (never behind the drawn rails):
    // this is what keeps the dropper post parallel to the seat angle.
    const clampY = saddle.y - 10;
    const clampX = Math.max(-clampY / Math.tan(seatRad), saddle.x - 115);
    const saddleClamp: SketchPoint = { x: clampX, y: clampY };

    // Rider: seated hip on the saddle (above the rail clamp, not the nose),
    // standing hip lifted off it; torso leans up-forward
    const torso = opts.torsoLength ?? DEFAULT_TORSO;
    const seatedHip: SketchPoint = {
        x: saddleSeated.x - (derived.saddleY != null ? HIP_BEHIND_NOSE : 0),
        y: saddleSeated.y + HIP_ABOVE_SADDLE,
    };
    const hip: SketchPoint = riderMode === 'standing'
        ? { x: bb.x - STANDING_HIP_BACK, y: seatedHip.y + STANDING_HIP_RISE }
        : { x: saddle.x - HIP_BEHIND_NOSE, y: saddle.y + HIP_ABOVE_SADDLE };
    const torsoAngle = ((riderMode === 'standing' ? TORSO_ANGLE_STANDING : TORSO_ANGLE_SEATED) * Math.PI) / 180;
    const shoulder: SketchPoint = {
        x: hip.x + torso * Math.cos(torsoAngle),
        y: hip.y + torso * Math.sin(torsoAngle),
    };
    const head: SketchPoint = {
        x: shoulder.x + 90 * Math.cos(torsoAngle),
        y: shoulder.y + 90 * Math.sin(torsoAngle),
    };

    // Elbow: bend the arm upward from the shoulder–hand line (attack position)
    const elbow = bendPoint(shoulder, hand, 70);

    // Legs: two-bone IK from hip to pedal, knee forward of the hip–pedal line.
    // Both cranks are drawn — near leg on the forward/bottom pedal, far leg opposite.
    const crank = opts.crankLength ?? geo.cockpit?.crankLength ?? 170;
    const crankMode = opts.crankMode ?? 'horizontal';
    const pedalAt = (dir: number): SketchPoint => crankMode === 'vertical'
        ? { x: bb.x, y: bb.y + dir * crank }
        : { x: bb.x + dir * crank, y: bb.y };
    const inseam = opts.inseam != null && opts.inseam > 0 ? opts.inseam : null;
    const legAt = (dir: number, near: boolean) => {
        const pedal = pedalAt(dir);
        if (!inseam) return { pedal, knee: null, near };
        const thigh = inseam * THIGH_RATIO;
        const shin = inseam * SHIN_RATIO;
        return { pedal, knee: twoBoneIK(hip, pedal, thigh, shin), near };
    };
    const riderLegs = crankMode === 'vertical'
        ? [legAt(-1, true), legAt(1, false)]
        : [legAt(1, true), legAt(-1, false)];
    const knee = riderLegs[0].knee;
    const pedal = riderLegs[0].pedal;
    const kneeBendDeg = inseam ? kneeBend(inseam * THIGH_RATIO, inseam * SHIN_RATIO, distance(hip, pedal)) : null;
    const kopsOffsetMm = crankMode === 'horizontal' && knee ? knee.x - pedal.x : null;

    // Sag: linear pitch between the axles (wheels stay on the ground)
    const sagFork = Math.max(0, (opts.forkTravel * opts.sagPercent) / 100);
    const sagShock = Math.max(0, (opts.shockStroke * opts.sagPercent) / 100);
    const drop = (p: SketchPoint): SketchPoint => {
        const t = Math.max(0, Math.min(1, (p.x - rearAxle.x) / (frontAxle.x - rearAxle.x)));
        const d = sagShock + (sagFork - sagShock) * t;
        return { x: p.x, y: p.y - d };
    };

    // Springs for the sag visualization: the frame side drops with the pitch,
    // the coil covers the travel and shortens by the travel used.
    // Fork: crown body above the coil, lowers below (to the axle).
    const forkTop = drop(headBottom);
    const forkSpring: SpringLine = {
        top: forkTop,
        bottom: frontAxle,
        used: Math.max(0, distance(headBottom, frontAxle) - distance(forkTop, frontAxle)),
        travel: opts.forkTravel,
        lead: opts.forkTravel / 2,
    };
    // Shock: drawn as a real damper body — 1× stroke above the coil (air can),
    // the coil itself and 1× stroke below (shaft) → ~3× stroke overall.
    const shockNormal: SketchPoint = { x: seatDir.y, y: -seatDir.x };
    const shockTop0: SketchPoint = {
        x: seatDir.x * seatTube * SHOCK_LINE_TO + shockNormal.x * SHOCK_LINE_OFFSET,
        y: seatDir.y * seatTube * SHOCK_LINE_TO + shockNormal.y * SHOCK_LINE_OFFSET,
    };
    const shockDir: SketchPoint = { x: -seatDir.x, y: -seatDir.y };
    const shockTop = drop(shockTop0);
    const shockLen = Math.max(opts.shockStroke, 3 * opts.shockStroke - sagShock);
    const shockSpring: SpringLine = {
        top: shockTop,
        bottom: {
            x: shockTop.x + shockDir.x * shockLen,
            y: shockTop.y + shockDir.y * shockLen,
        },
        used: sagShock,
        travel: opts.shockStroke,
        lead: opts.shockStroke,
    };

    return {
        bb: drop(bb),
        rearAxle,
        frontAxle,
        groundY: -bbHeight,
        headTop: drop(headTop),
        headBottom: drop(headBottom),
        seatCluster: drop(seatCluster),
        saddle: drop(saddle),
        bar: drop(bar),
        hand: drop(hand),
        riderHip: drop(hip),
        riderShoulder: drop(shoulder),
        riderHead: drop(head),
        riderHeadRadius: 60,
        riderElbow: drop(elbow),
        riderKnee: knee ? drop(knee) : null,
        riderPedal: drop(pedal),
        riderLegs: riderLegs.map(leg => ({
            pedal: drop(leg.pedal),
            knee: leg.knee ? drop(leg.knee) : null,
            near: leg.near,
        })),
        saddleClamp: drop(saddleClamp),
        kneeBendDeg,
        kopsOffsetMm,
        wheelRadiusRear: radii.rear,
        wheelRadiusFront: radii.front,
        sagFork,
        sagShock,
        forkSpring,
        shockSpring,
    };
}
