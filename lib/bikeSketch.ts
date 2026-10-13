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
    /** derived back angle (hip → shoulder) in degrees from horizontal */
    torsoAngleDeg: number;
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
/**
 * Body segment proportions (fractions of the profile measurements):
 * - thigh (femur) ≈ 0.53 × inseam (anthropometry: femur ≈ 0.245 × height,
 *   inseam ≈ 0.47 × height → ≈ 0.52)
 * - shin incl. foot to the pedal ≈ 0.67 × inseam (tibia ≈ 0.52 × inseam plus
 *   the ankle→pedal distance; sum = 1.20 × inseam is the functional leg
 *   hip joint → pedal and reproduces the 25–35° knee-bend guideline at the
 *   LeMond saddle height)
 */
const THIGH_RATIO = 0.53;
const SHIN_RATIO = 0.67;
/** Standing hips sit higher and slightly behind the BB compared to the seated pose. */
const STANDING_HIP_RISE = 60;
const STANDING_HIP_BACK = 30;
/** Attack flat (flowing terrain): moderately crouched, hips back and a bit down. */
const ATTACK_FLAT_HIP_RISE = 30;
const ATTACK_FLAT_HIP_BACK = 70;
/** Attack steep (steep terrain): deeper crouch, hips further back. */
const ATTACK_STEEP_HIP_RISE = 20;
const ATTACK_STEEP_HIP_BACK = 90;
/** Attack arms: strongly bent (effective reach share per variant). */
const ATTACK_FLAT_ARM_BEND = 0.8;
const ATTACK_STEEP_ARM_BEND = 0.7;
/** Torso lean fallbacks (from horizontal) when no bar position is known. */
const TORSO_ANGLE_SEATED = 55;
const TORSO_ANGLE_STANDING = 60;
const TORSO_ANGLE_ATTACK_FLAT = 40;
const TORSO_ANGLE_ATTACK_STEEP = 35;
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
export type RiderMode = 'seated' | 'standing' | 'attack-flat' | 'attack-steep';

/** Hip offset behind the BB and above the seated hip for a rider mode. */
function riderHipOffset(mode: RiderMode): { back: number; rise: number } {
    switch (mode) {
        case 'standing': return { back: STANDING_HIP_BACK, rise: STANDING_HIP_RISE };
        case 'attack-flat': return { back: ATTACK_FLAT_HIP_BACK, rise: ATTACK_FLAT_HIP_RISE };
        case 'attack-steep': return { back: ATTACK_STEEP_HIP_BACK, rise: ATTACK_STEEP_HIP_RISE };
        default: return { back: 0, rise: 0 };
    }
}

/** Effective arm reach per mode — attack positions ride with bent arms. */
function riderArmFactor(mode: RiderMode): number {
    if (mode === 'attack-flat') return ATTACK_FLAT_ARM_BEND;
    if (mode === 'attack-steep') return ATTACK_STEEP_ARM_BEND;
    return ARM_BEND_FACTOR;
}

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

/** Two-bone IK for a joint, choosing the preferred solution side. */
function twoBoneIK(
    a: SketchPoint,
    target: SketchPoint,
    l1: number,
    l2: number,
    prefer: 'forward' | 'back' | 'up' = 'forward',
): SketchPoint {
    const d = Math.min(distance(a, target), l1 + l2 - 1);
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const ux = (target.x - a.x) / d;
    const uy = (target.y - a.y) / d;
    const k1 = { x: a.x + along * ux - h * uy, y: a.y + along * uy + h * ux };
    const k2 = { x: a.x + along * ux + h * uy, y: a.y + along * uy - h * ux };
    if (prefer === 'up') return k1.y >= k2.y ? k1 : k2;
    if (prefer === 'back') return k1.x <= k2.x ? k1 : k2;
    return k1.x >= k2.x ? k1 : k2;
}

/** Elbow bend factor: the arm reaches the bar with slightly bent elbows. */
const ARM_BEND_FACTOR = 0.97;
/**
 * Arm share: upper arm (shoulder → elbow) ≈ 0.48 of the arm length, the rest
 * is forearm + hand to the ball (≈ 0.52) — anthropometry: upper arm 0.186 ×
 * height vs. forearm 0.146 + hand-to-ball ≈ 0.05.
 */
const UPPER_ARM_RATIO = 0.48;
/** Fallback arm length (shoulder → wrist) when the profile has none. */
export const DEFAULT_ARM = 640;

/**
 * Shoulder from the torso + arm reach to the bar: two-bone IK between the hip
 * and the hand. The back angle follows saddle height, stack/reach and the
 * rider's proportions instead of a fixed value. `armFactor` < 1 models more
 * strongly bent arms (attack position).
 */
export function torsoReach(
    hip: SketchPoint,
    hand: SketchPoint,
    torsoLength: number,
    armLength: number,
    armFactor = ARM_BEND_FACTOR,
): { shoulder: SketchPoint; angleDeg: number } {
    const shoulder = twoBoneIK(hip, hand, torsoLength, armLength * armFactor, 'up');
    const angleDeg = Math.round((Math.atan2(shoulder.y - hip.y, shoulder.x - hip.x) * 180) / Math.PI);
    return { shoulder, angleDeg };
}

/** Fallback torso lean (radians) when no bar position is available. */
function fallbackTorsoAngle(mode: RiderMode): number {
    const deg = mode === 'attack-steep' ? TORSO_ANGLE_ATTACK_STEEP
        : mode === 'attack-flat' ? TORSO_ANGLE_ATTACK_FLAT
            : mode === 'standing' ? TORSO_ANGLE_STANDING
                : TORSO_ANGLE_SEATED;
    return (deg * Math.PI) / 180;
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
        armLength?: number | null;
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
    const saddleGroundY = riderMode !== 'seated'
        ? saddleGroundYSeated - dropperTravel * Math.sin(seatRad)
        : saddleGroundYSeated;
    const torso = opts.torsoLength ?? DEFAULT_TORSO;
    const arm = opts.armLength ?? DEFAULT_ARM;
    const hipOffset = riderHipOffset(riderMode);
    const hipY = riderMode === 'seated'
        ? saddleGroundY + HIP_ABOVE_SADDLE
        : saddleGroundYSeated + HIP_ABOVE_SADDLE + hipOffset.rise;
    // Shoulder from the same torso + arm reach as the side view
    const hipX = riderMode === 'seated'
        ? (derived.saddleX ?? -assumedSaddleSetback(saddleAboveBb, seatAngle)) - HIP_BEHIND_NOSE
        : -hipOffset.back;
    const handGroundY = derived.handY != null ? bbHeight + derived.handY - sagFork : null;
    const armFactor = riderArmFactor(riderMode);
    const reach = derived.handX != null && handGroundY != null
        ? torsoReach({ x: hipX, y: hipY }, { x: derived.handX, y: handGroundY }, torso, arm, armFactor)
        : null;
    const fallbackAngle = fallbackTorsoAngle(riderMode);
    const shoulderY = reach?.shoulder.y ?? hipY + torso * Math.sin(fallbackAngle);

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
        armLength?: number | null;
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

    // Rider mode: seated keeps the dropper extended; standing and attack
    // (downhill ready) ride with it compressed
    const riderMode = opts.riderMode ?? 'seated';
    const dropperTravel = opts.dropperTravel ?? DEFAULT_DROPPER_TRAVEL;
    const seatDir: SketchPoint = { x: -Math.cos(seatRad), y: Math.sin(seatRad) };
    let saddle = saddleSeated;
    if (riderMode !== 'seated') {
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
    // standing hip lifted off it. The shoulder comes from the torso + arm
    // reach to the bar — the back angle follows the bike and the rider.
    const torso = opts.torsoLength ?? DEFAULT_TORSO;
    const arm = opts.armLength ?? DEFAULT_ARM;
    const seatedHip: SketchPoint = {
        x: saddleSeated.x - (derived.saddleY != null ? HIP_BEHIND_NOSE : 0),
        y: saddleSeated.y + HIP_ABOVE_SADDLE,
    };
    const hipOffset = riderHipOffset(riderMode);
    const hip: SketchPoint = riderMode === 'seated'
        ? { x: saddle.x - HIP_BEHIND_NOSE, y: saddle.y + HIP_ABOVE_SADDLE }
        : { x: bb.x - hipOffset.back, y: seatedHip.y + hipOffset.rise };

    const fallbackAngle = fallbackTorsoAngle(riderMode);
    const armFactor = riderArmFactor(riderMode);
    const barReach = derived.handX != null && derived.handY != null
        ? torsoReach(hip, hand, torso, arm, armFactor)
        : null;
    const shoulder: SketchPoint = barReach?.shoulder ?? {
        x: hip.x + torso * Math.cos(fallbackAngle),
        y: hip.y + torso * Math.sin(fallbackAngle),
    };
    const torsoAngleDeg = barReach?.angleDeg ?? Math.round((fallbackAngle * 180) / Math.PI);
    const torsoDir: SketchPoint = {
        x: (shoulder.x - hip.x) / torso,
        y: (shoulder.y - hip.y) / torso,
    };
    const head: SketchPoint = {
        x: shoulder.x + 90 * torsoDir.x,
        y: shoulder.y + 90 * torsoDir.y,
    };

    // Elbow: two-bone arm IK from the shoulder to the hand, bowing backward
    const upperArm = arm * UPPER_ARM_RATIO;
    const elbow = twoBoneIK(shoulder, hand, upperArm, arm - upperArm, 'back');

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
        torsoAngleDeg,
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
