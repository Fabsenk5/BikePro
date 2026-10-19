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
    /** steerer top (head tube + spacers along the steerer), null without complete cockpit data */
    steererTop: SketchPoint | null;
    /** stem end (null = draw the simple stem line instead) */
    stemEnd: SketchPoint | null;
    riderHip: SketchPoint;
    riderShoulder: SketchPoint;
    riderHead: SketchPoint;
    riderHeadRadius: number;
    /** derived back angle (hip → shoulder) in degrees from horizontal */
    torsoAngleDeg: number;
    /** whether the back angle came from the torso+arm IK ('ik') or the lean fallback */
    torsoAngleSource: TorsoAngleSource;
    /** elbow of the bent arm (shoulder → elbow → hand) */
    riderElbow: SketchPoint;
    /** far-side elbow/hand (depth cue, drawn dimmed and slightly offset) */
    riderElbowFar: SketchPoint;
    riderHandFar: SketchPoint;
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
    /** knee bend at bottom/top dead centre over the full crank revolution */
    legRangeDeg: { bottom: number; top: number } | null;
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
 * - shin incl. foot to the pedal ≈ 0.65 × inseam (tibia ≈ 0.52 × inseam plus
 *   the ankle→pedal distance; sum = 1.18 × inseam is the functional leg
 *   hip joint → pedal and reproduces the 25–35° knee-bend guideline at the
 *   LeMond saddle height — with the saddle height measured along the seat tube)
 */
const THIGH_RATIO = 0.53;
const SHIN_RATIO = 0.65;
/** Standing hips sit higher and slightly behind the BB compared to the seated pose. */
const STANDING_HIP_RISE = 60;
const STANDING_HIP_BACK = 30;
/**
 * Attack positions are hip hinges: the butt goes back and up (the saddle ends
 * up well below the hips), the chest drops — the back gets flat, the legs
 * straighten while the pedals stay reachable.
 */
const ATTACK_FLAT_HIP_RISE = 50;
const ATTACK_FLAT_HIP_BACK = 110;
const ATTACK_STEEP_HIP_RISE = 110;
const ATTACK_STEEP_HIP_BACK = 190;
/** Attack arms: strongly bent (effective reach share per variant). */
const ATTACK_FLAT_ARM_BEND = 0.8;
const ATTACK_STEEP_ARM_BEND = 0.7;
/** Torso lean fallbacks (from horizontal) when no bar position is known. */
const TORSO_ANGLE_SEATED = 55;
const TORSO_ANGLE_STANDING = 60;
const TORSO_ANGLE_ATTACK_FLAT = 36;
const TORSO_ANGLE_ATTACK_STEEP = 22;
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
/** Where the side-view back angle comes from: the torso+arm IK or the lean fallback. */
export type TorsoAngleSource = 'ik' | 'fallback';

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
 * Far-arm depth cue in side projection: the off-side arm reads slightly
 * behind and below the near arm.
 */
const FAR_ARM_OFFSET = { x: -18, y: -28 };

/**
 * Shoulder from the torso + arm reach to the bar: two-bone IK between the hip
 * and the hand. The back angle follows saddle height, stack/reach and the
 * rider's proportions instead of a fixed value. `armFactor` < 1 models more
 * strongly bent arms (attack position).
 */
export interface RiderPoseInput {
    torsoLength?: number | null;
    armLength?: number | null;
    riderMode?: RiderMode;
    dropperTravel?: number | null;
}

export interface RiderPoseBase {
    hip: SketchPoint;
    hand: SketchPoint;
    torso: number;
    arm: number;
    armFactor: number;
}

/**
 * Shared rider-pose root (hip + hand + segment lengths) for the sketch and
 * the cockpit proposal solver — one definition, no drift. Mirrors the
 * buildBikeSketch pose math exactly (verified by test); returns null when no
 * hand position is known (bar data incomplete).
 */
export function riderPoseBase(
    geo: BikeGeometry,
    derived: ContactGeometry,
    input: RiderPoseInput,
): RiderPoseBase | null {
    if (derived.handX == null || derived.handY == null) return null;
    const frame = geo.frame ?? {};
    const seatAngle = frame.seatAngle ?? 75;
    const seatRad = (seatAngle * Math.PI) / 180;
    const seatTube = frame.seatTube ?? 440;
    const seatCluster: SketchPoint = {
        x: -seatTube * Math.cos(seatRad),
        y: seatTube * Math.sin(seatRad),
    };
    const saddleAlongTube = derived.saddleY != null ? derived.saddleY / Math.sin(seatRad) : null;
    const saddleSeated: SketchPoint = derived.saddleY != null
        ? {
            x: derived.saddleX ?? -assumedSaddleSetback(saddleAlongTube ?? 0, seatAngle),
            y: derived.saddleY,
        }
        : seatCluster;
    const riderMode = input.riderMode ?? 'seated';
    const dropperTravel = input.dropperTravel ?? DEFAULT_DROPPER_TRAVEL;
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
    const torso = input.torsoLength ?? DEFAULT_TORSO;
    const arm = input.armLength ?? DEFAULT_ARM;
    const seatedHip: SketchPoint = {
        x: saddleSeated.x - (derived.saddleY != null ? HIP_BEHIND_NOSE : 0),
        y: saddleSeated.y + HIP_ABOVE_SADDLE,
    };
    const hipOffset = riderHipOffset(riderMode);
    const hip: SketchPoint = riderMode === 'seated'
        ? { x: saddle.x - HIP_BEHIND_NOSE, y: saddle.y + HIP_ABOVE_SADDLE }
        : { x: -hipOffset.back, y: seatedHip.y + hipOffset.rise };
    return {
        hip,
        hand: { x: derived.handX, y: derived.handY },
        torso,
        arm,
        armFactor: riderArmFactor(riderMode),
    };
}

export type ProposalAxis = 'height' | 'reach';

/**
 * Current back angle for a pose — same inputs as the sketch, no sag involved.
 * Used for the proposal target default and display.
 */
export function poseTorsoDeg(
    geo: BikeGeometry,
    derived: ContactGeometry,
    input: RiderPoseInput,
): number | null {
    const pose = riderPoseBase(geo, derived, input);
    if (!pose) return null;
    return torsoReach(pose.hip, pose.hand, pose.torso, pose.arm, pose.armFactor).angleDeg;
}

/** Standard MTB stem lengths (mm) the reach proposal snaps to. */
export const STEM_LENGTHS = [35, 40, 45, 50, 60, 70, 80];
/** One headset spacer step (mm) — matches the spacer-pieces convention. */
export const SPACER_MM = 10;
/** Sane upper bound for a spacer tower (mm). */
export const MAX_SPACER_MM = 60;

export interface CockpitProposal {
    targetDeg: number;
    axis: ProposalAxis;
    currentDeg: number;
    /** signed bar displacement that hits the target (mm) */
    dBarX: number;
    dBarY: number;
    /** height mode: recommended TOTAL spacers (pieces) and rise (mm) */
    spacerPieces: number;
    riseMm: number;
    /** reach mode: recommended stem length (mm), null in height mode */
    stemMm: number | null;
    /** back angle with the rounded hardware */
    achievedDeg: number;
    /** false when even ±150 mm can't get within 2° of the target */
    reachable: boolean;
}

/**
 * Inverse fit solver: given a target back angle, find the grip displacement
 * along one axis (grid search ±150 mm, no monotonicity assumed), then map it
 * to purchasable hardware — spacers in 10 mm pieces first, remainder to rise
 * (height), or nearest standard stem length (reach). The achieved angle is
 * recomputed with the rounded hardware so the UI never promises more than
 * the parts deliver. Saddle stays fixed (fit convention: saddle first).
 */
export function proposeCockpit(
    geo: BikeGeometry,
    derived: ContactGeometry,
    input: RiderPoseInput & { spacersMm?: number | null; riseMm?: number | null; stemMm?: number | null },
    targetDeg: number,
    axis: ProposalAxis,
): CockpitProposal | null {
    const pose = riderPoseBase(geo, derived, input);
    if (!pose) return null;
    const { hip, hand, torso, arm, armFactor } = pose;
    const currentDeg = torsoReach(hip, hand, torso, arm, armFactor).angleDeg;
    let bestD = 0;
    let bestErr = Math.abs(currentDeg - targetDeg);
    for (let d = -150; d <= 150; d += 2) {
        const h = axis === 'height' ? { x: hand.x, y: hand.y + d } : { x: hand.x + d, y: hand.y };
        const a = torsoReach(hip, h, torso, arm, armFactor).angleDeg;
        const err = Math.abs(a - targetDeg);
        if (err < bestErr - 1e-9 || (err === bestErr && Math.abs(d) < Math.abs(bestD))) {
            bestErr = err;
            bestD = d;
        }
    }
    const dBarX = axis === 'reach' ? bestD : 0;
    const dBarY = axis === 'height' ? bestD : 0;
    const spacers = input.spacersMm ?? 0;
    const rise = input.riseMm ?? 30;
    const stem = input.stemMm ?? 40;
    let spacerPieces = Math.round(spacers / SPACER_MM);
    let riseMm = rise;
    let stemMm: number | null = null;
    if (axis === 'height') {
        const total = spacers + rise + dBarY;
        spacerPieces = Math.min(MAX_SPACER_MM / SPACER_MM, Math.max(0, Math.round(total / SPACER_MM)));
        riseMm = Math.round(total - spacerPieces * SPACER_MM);
        if (riseMm < 0) {
            spacerPieces = Math.max(0, spacerPieces - 1);
            riseMm = Math.round(total - spacerPieces * SPACER_MM);
        }
        if (riseMm < 0) {
            spacerPieces = 0;
            riseMm = Math.max(0, Math.round(total));
        }
    } else {
        spacerPieces = Math.round(spacers / SPACER_MM);
        stemMm = STEM_LENGTHS.reduce((a, b) => (Math.abs(b - (stem + dBarX)) < Math.abs(a - (stem + dBarX)) ? b : a));
    }
    const achievedHand = axis === 'height'
        ? { x: hand.x, y: hand.y + (spacerPieces * SPACER_MM + riseMm - spacers - rise) }
        : { x: hand.x + ((stemMm ?? stem) - stem), y: hand.y };
    const achievedDeg = torsoReach(hip, achievedHand, torso, arm, armFactor).angleDeg;
    return {
        targetDeg, axis, currentDeg, dBarX, dBarY,
        spacerPieces, riseMm, stemMm, achievedDeg,
        reachable: Math.abs(achievedDeg - targetDeg) <= 2,
    };
}

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
 * Animation frame: rock position/lift curve, wheel lifts and rider absorption.
 * The world bottom of a wheel is `lift + absorb` above the ground — this must
 * never go negative and must match the rock height at the peak (tested).
 */
export interface AnimationFrame {
    rockHeight: number;
    rockX: number;
    /** wheel lift relative to the frame (mm) */
    frontLift: number;
    rearLift: number;
    /** frame lift absorbed by the rider (mm) */
    absorb: number;
}

export function buildAnimationFrame(params: {
    progress: number;
    frontAxleX: number;
    rearAxleX: number;
    frontRadius: number;
    rearRadius: number;
    forkTravel: number;
    shockStroke: number;
    rearTravel: number;
    sagPercent: number;
}): AnimationFrame {
    const {
        progress, frontAxleX, rearAxleX, frontRadius, rearRadius,
        forkTravel, shockStroke, rearTravel, sagPercent,
    } = params;
    // Rocks: first one just reaches the suspension travel, then a bigger one
    // that exceeds the fork travel so the rider has to absorb the rest.
    const rockSmall = Math.max(20, Math.min(forkTravel, shockStroke));
    const rockBig = Math.round(forkTravel * 1.25);
    const phase = progress < 0.5 ? 0 : 1;
    const local = (progress - phase * 0.5) / 0.5;
    const rockHeight = phase === 0 ? rockSmall : rockBig;
    const rockStart = frontAxleX + 420;
    const rockEnd = rearAxleX - 420;
    const rockX = rockStart + (rockEnd - rockStart) * local;

    // Wheel hit: smooth climb while the rock passes under the axle
    const hitFor = (axleX: number, radius: number) => {
        const t = Math.max(0, 1 - Math.abs(rockX - axleX) / radius);
        return rockHeight * t * t * (3 - 2 * t);
    };
    const frontHit = hitFor(frontAxleX, frontRadius);
    const rearHit = hitFor(rearAxleX, rearRadius);

    // Beyond the suspension the frame lifts and the rider absorbs the rest
    const absorb = Math.max(
        Math.max(0, frontHit - forkTravel),
        Math.max(0, rearHit - rearTravel),
    );
    const sagFork = (forkTravel * sagPercent) / 100;
    const sagShock = (shockStroke * sagPercent) / 100;
    // No shock (hardtail, stroke 0) → no leverage ratio, the wheel sag is 0.
    const rearSagWheel = rearTravel > 0 && shockStroke > 0 ? (sagShock * rearTravel) / shockStroke : sagShock;
    return {
        rockHeight,
        rockX,
        absorb,
        frontLift: Math.max(-sagFork, frontHit - absorb),
        rearLift: Math.max(-rearSagWheel, rearHit - absorb),
    };
}

/** Zigzag spring along a→b. Only the component travel is drawn as a coil
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
    /** grip height above the bar centre (upsweep), so grips sit off the bar line */
    gripRise: number;
    /** stem clamp height above the ground (bar centre minus rise), null if rise unknown */
    clampGroundY: number | null;
    /** steerer/head-tube top height above the ground, null without stack */
    headTopGroundY: number | null;
    /** visible spacer stack above the head tube (mm, 0 when unknown like the model) */
    spacersMm: number;
    /** head tube length — crown sits this far below the bar */
    headTubeLength: number;
    /**
     * crown (fork top) height above the ground — same head-tube geometry as
     * the side view (reach/stack/head angle/head tube), falling back to the
     * bar height minus the head tube when the frame data is incomplete
     */
    crownGroundY: number;
    /** both legs hip → knee → pedal (front view, feet per crank position) */
    legs: { hip: SketchPoint; knee: SketchPoint | null; foot: SketchPoint }[];
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
        inseam?: number | null;
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
    const barRiseMm = cockpit.barRise ?? 0;
    const gripRise = gripHalfSpan * Math.sin(((cockpit.upsweep ?? 0) * Math.PI) / 180);
    const clampGroundY = cockpit.barRise != null ? barGroundY - barRiseMm : null;
    const headTopGroundY = frame.stack != null ? bbHeight + frame.stack - sagFork : null;
    const spacersMm = cockpit.spacers ?? 0;
    const shoulderHalfWidth = opts.shoulderWidth != null && opts.shoulderWidth > 0
        ? opts.shoulderWidth / 2
        : null;

    // Rider mode mirrors the side view: same hip heights, dropper state and lean
    const riderMode = opts.riderMode ?? 'seated';
    const dropperTravel = opts.dropperTravel ?? DEFAULT_DROPPER_TRAVEL;
    const saddleAboveBb = derived.saddleY ?? (frame.seatTube ?? 440) * Math.sin(seatRad);
    const saddleAlongTube = saddleAboveBb / Math.sin(seatRad);
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
        ? (derived.saddleX ?? -assumedSaddleSetback(saddleAlongTube, seatAngle)) - HIP_BEHIND_NOSE
        : -hipOffset.back;
    const handGroundY = derived.handY != null ? bbHeight + derived.handY - sagFork : null;
    const armFactor = riderArmFactor(riderMode);
    const reach = derived.handX != null && handGroundY != null
        ? torsoReach({ x: hipX, y: hipY }, { x: derived.handX, y: handGroundY }, torso, arm, armFactor)
        : null;
    const fallbackAngle = fallbackTorsoAngle(riderMode);
    const shoulderY = reach?.shoulder.y ?? hipY + torso * Math.sin(fallbackAngle);

    // Legs seen from the front: hip → knee → pedal, feet per crank position.
    // Without an inseam the legs are drawn straight hip → foot (knee null).
    const crank = opts.crankLength ?? geo.cockpit?.crankLength ?? 170;
    const crankMode = opts.crankMode ?? 'horizontal';
    const inseam = opts.inseam != null && opts.inseam > 0 ? opts.inseam : null;
    const footY = (side: number) => crankMode === 'vertical'
        ? bbHeight + side * crank
        : bbHeight;
    const legs = ([1, -1] as const).map(side => {
        const hip = { x: side * FRONT_HIP_HALF, y: hipY };
        const foot = { x: side * FRONT_PEDAL_HALF, y: footY(side) };
        return {
            hip,
            foot,
            knee: inseam ? {
                x: side * (FRONT_HIP_HALF + FRONT_PEDAL_HALF) / 2 + side * 10,
                y: (hipY + foot.y) / 2 + 25,
            } : null,
        };
    });

    // Crown: same head-tube bottom as the side view (head tube leaning back
    // from the stack/reach point), converted to a height above the ground;
    // without stack/reach the head tube hangs below the bar instead.
    const headTubeLength = frame.headTube ?? HEAD_TUBE_LENGTH;
    const headAngle = frame.headAngle ?? 65;
    const crownGroundY = frame.stack != null && frame.reach != null
        ? bbHeight + (frame.stack - headTubeLength * Math.sin((headAngle * Math.PI) / 180)) - sagFork
        : barGroundY - headTubeLength;

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
        gripRise,
        clampGroundY,
        headTopGroundY,
        spacersMm,
        headTubeLength: frame.headTube ?? HEAD_TUBE_LENGTH,
        crownGroundY,
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
        /** animation: vertical wheel lift in mm (rock under the wheel) */
        wheelLift?: { front?: number; rear?: number } | null;
        /** rear wheel travel for the shock leverage (mm) */
        rearTravel?: number | null;
        /** animation: frame lift absorbed by the rider (arms/legs bend) */
        riderAbsorb?: number | null;
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
    // Both wheels stand on the ground unless the animation lifts them over a
    // rock; a negative lift means the suspension extends on the other end.
    const frontLift = opts.wheelLift?.front ?? 0;
    const rearLift = opts.wheelLift?.rear ?? 0;
    const rearAxle: SketchPoint = { x: -chainstay, y: radii.rear - bbHeight + rearLift };
    const frontAxle: SketchPoint = { x: wheelbase - chainstay, y: radii.front - bbHeight + frontLift };

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
    const saddleAlongTube = derived.saddleY != null ? derived.saddleY / Math.sin(seatRad) : null;
    const saddleSeated: SketchPoint = derived.saddleY != null
        ? {
            x: derived.saddleX ?? -assumedSaddleSetback(saddleAlongTube ?? 0, seatAngle),
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

    // Cockpit detail chain (mirrors computeContactGeometry exactly):
    // headTop → steererTop (spacers along the steerer) → stemEnd → bar
    // (rise). Only used when the recomputed bar matches the derived one —
    // a measured bar override can't be split into parts, so we fall back
    // to the simple stem line then.
    const cockpit = geo.cockpit ?? {};
    const stemLength = cockpit.stemLength;
    const stemAngle = (cockpit.stemAngle ?? 0) * Math.PI / 180;
    const spacersMm = cockpit.spacers ?? 0;
    const barRiseMm = cockpit.barRise ?? 0;
    let steererTop: SketchPoint | null = null;
    let stemEnd: SketchPoint | null = null;
    if (stemLength != null && frame.headAngle != null) {
        const headRad2 = (frame.headAngle * Math.PI) / 180;
        const top: SketchPoint = {
            x: headTop.x - spacersMm * Math.cos(headRad2),
            y: headTop.y + spacersMm * Math.sin(headRad2),
        };
        const end: SketchPoint = {
            x: top.x + stemLength * Math.cos(stemAngle),
            y: top.y + stemLength * Math.sin(stemAngle),
        };
        if (
            derived.barX != null && derived.barY != null
            && Math.abs(end.x - derived.barX) < 1
            && Math.abs(end.y + barRiseMm - derived.barY) < 1
        ) {
            steererTop = top;
            stemEnd = end;
        }
    }

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
    // Animation: the frame lifts beyond the suspension and the rider absorbs it —
    // the body (hip/shoulder) stays put in the world, so it drops in the
    // frame-fixed sketch while the arms/legs bend to take up the movement.
    const absorb = Math.max(0, opts.riderAbsorb ?? 0);
    const hip: SketchPoint = riderMode === 'seated'
        ? { x: saddle.x - HIP_BEHIND_NOSE, y: saddle.y + HIP_ABOVE_SADDLE - absorb }
        : { x: bb.x - hipOffset.back, y: seatedHip.y + hipOffset.rise - absorb };

    const fallbackAngle = fallbackTorsoAngle(riderMode);
    const armFactor = Math.max(0.4, riderArmFactor(riderMode) - absorb / arm);
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
    const riderElbowFar: SketchPoint = { x: elbow.x + FAR_ARM_OFFSET.x, y: elbow.y + FAR_ARM_OFFSET.y };
    const riderHandFar: SketchPoint = { x: hand.x + FAR_ARM_OFFSET.x, y: hand.y + FAR_ARM_OFFSET.y };

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
    // Leg extension range over the whole revolution: same hip, pedal at the
    // bottom and top dead centres — what the crank length really changes.
    const legRangeDeg = inseam
        ? {
            bottom: kneeBend(inseam * THIGH_RATIO, inseam * SHIN_RATIO, distance(hip, { x: bb.x, y: bb.y - crank })),
            top: kneeBend(inseam * THIGH_RATIO, inseam * SHIN_RATIO, distance(hip, { x: bb.x, y: bb.y + crank })),
        }
        : null;
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
    const frontAxleGround: SketchPoint = { x: frontAxle.x, y: radii.front - bbHeight };
    const forkSpring: SpringLine = {
        top: forkTop,
        bottom: frontAxle,
        used: Math.max(0, distance(headBottom, frontAxleGround) - distance(forkTop, frontAxle)),
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
    // Animation: the rear wheel travel compresses the shock via the leverage
    const rearTravel = Math.max(1, opts.rearTravel ?? opts.shockStroke);
    const shockUsed = Math.min(
        opts.shockStroke,
        sagShock + Math.max(0, rearLift) * (opts.shockStroke / rearTravel),
    );
    const shockLen = Math.max(opts.shockStroke, 3 * opts.shockStroke - shockUsed);
    const shockSpring: SpringLine = {
        top: shockTop,
        bottom: {
            x: shockTop.x + shockDir.x * shockLen,
            y: shockTop.y + shockDir.y * shockLen,
        },
        used: shockUsed,
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
        steererTop: steererTop ? drop(steererTop) : null,
        stemEnd: stemEnd ? drop(stemEnd) : null,
        riderHip: drop(hip),
        riderShoulder: drop(shoulder),
        riderHead: drop(head),
        riderHeadRadius: 60,
        torsoAngleDeg,
        torsoAngleSource: barReach ? 'ik' : 'fallback',
        riderElbow: drop(elbow),
        riderElbowFar: drop(riderElbowFar),
        riderHandFar: drop(riderHandFar),
        riderKnee: knee ? drop(knee) : null,
        riderPedal: drop(pedal),
        riderLegs: riderLegs.map(leg => ({
            pedal: drop(leg.pedal),
            knee: leg.knee ? drop(leg.knee) : null,
            near: leg.near,
        })),
        saddleClamp: drop(saddleClamp),
        kneeBendDeg,
        legRangeDeg,
        kopsOffsetMm,
        wheelRadiusRear: radii.rear,
        wheelRadiusFront: radii.front,
        sagFork,
        sagShock,
        forkSpring,
        shockSpring,
    };
}
