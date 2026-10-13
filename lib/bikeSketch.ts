/**
 * Bike side-view sketch — pure coordinate math for the technical drawing.
 *
 * Points are in millimetres, BB-relative with y pointing up; the SVG component
 * maps them to screen space. Sag lowers frame and rider along a linear pitch
 * between the rear and front axle — the wheels stay on the ground, so the
 * fork/shock visually compress.
 */
import { BikeGeometry, ContactGeometry, GRIP_INSET_MM } from './geometry';

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
    /** knee of the bent leg (null when no inseam is known) */
    riderKnee: SketchPoint | null;
    riderPedal: SketchPoint;
    /** knee bend in degrees (0 = straight) at the current pedal position */
    kneeBendDeg: number | null;
    /** knee-over-pedal horizontal offset (positive = knee ahead) — horizontal mode */
    kopsOffsetMm: number | null;
    wheelRadiusRear: number;
    wheelRadiusFront: number;
    sagFork: number;
    sagShock: number;
}

const HEAD_TUBE_LENGTH = 110;
const DEFAULT_TORSO = 550;
/** Hip joint sits above the saddle surface (mm). */
const HIP_ABOVE_SADDLE = 60;
/** Functional leg segments relative to inseam (shin includes the foot to the pedal). */
const THIGH_RATIO = 0.53;
const SHIN_RATIO = 0.67;

export type CrankMode = 'horizontal' | 'vertical';

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
}

/** Approximate shoulder rise above the bar in attack position (mm). */
const SHOULDER_RISE_ABOVE_BAR = 250;

export function buildFrontSketch(
    geo: BikeGeometry,
    derived: ContactGeometry,
    opts: {
        shoulderWidth?: number | null;
        sagPercent: number;
        forkTravel: number;
        tireWidthMm?: number | null;
    },
): FrontSketch | null {
    const frame = geo.frame ?? {};
    const cockpit = geo.cockpit ?? {};
    if (cockpit.barWidth == null || derived.barY == null) return null;

    const bbDrop = frame.bbDrop ?? 30;
    const radii = wheelRadii(frame.wheelSize);
    const bbHeight = geo.measured?.bbHeight ?? (radii.front - bbDrop);
    const sagFork = Math.max(0, (opts.forkTravel * opts.sagPercent) / 100);
    const barGroundY = bbHeight + derived.barY - sagFork;
    const gripHalfSpan = Math.max(0, cockpit.barWidth / 2 - GRIP_INSET_MM);
    const shoulderHalfWidth = opts.shoulderWidth != null && opts.shoulderWidth > 0
        ? opts.shoulderWidth / 2
        : null;
    const shoulderY = barGroundY + SHOULDER_RISE_ABOVE_BAR;

    return {
        wheelRadius: radii.front,
        barWidth: cockpit.barWidth,
        gripHalfSpan,
        shoulderHalfWidth,
        barGroundY,
        shoulderY,
        hipY: barGroundY - 100,
        headCenter: { x: 0, y: shoulderY + 90 },
        headRadius: 60,
        tireWidthMm: opts.tireWidthMm != null && opts.tireWidthMm > 0 ? opts.tireWidthMm : 60,
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
    },
): BikeSketch | null {
    const frame = geo.frame ?? {};
    const { chainstay, wheelbase, stack, reach } = frame;
    if (chainstay == null || wheelbase == null || stack == null || reach == null) return null;

    const bbDrop = frame.bbDrop ?? 30;
    const headAngle = frame.headAngle ?? 65;
    const seatAngle = frame.seatAngle ?? 75;
    const seatTube = frame.seatTube ?? 440;

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
    const headBottom: SketchPoint = {
        x: headTop.x - HEAD_TUBE_LENGTH * Math.cos(headRad),
        y: headTop.y - HEAD_TUBE_LENGTH * Math.sin(headRad),
    };

    const seatRad = (seatAngle * Math.PI) / 180;
    const seatCluster: SketchPoint = {
        x: -seatTube * Math.cos(seatRad),
        y: seatTube * Math.sin(seatRad),
    };

    const saddle: SketchPoint = derived.saddleX != null && derived.saddleY != null
        ? { x: derived.saddleX, y: derived.saddleY }
        : seatCluster;
    const bar: SketchPoint = derived.barX != null && derived.barY != null
        ? { x: derived.barX, y: derived.barY }
        : { x: headTop.x + 40, y: headTop.y };
    const hand: SketchPoint = derived.handX != null && derived.handY != null
        ? { x: derived.handX, y: derived.handY }
        : bar;

    // Rider: hip at the saddle, torso leans up-forward, arms reach down to the bar
    const torso = opts.torsoLength ?? DEFAULT_TORSO;
    const hip: SketchPoint = { x: saddle.x, y: saddle.y + HIP_ABOVE_SADDLE };
    const torsoAngle = (55 * Math.PI) / 180;
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

    // Leg: two-bone IK from hip to pedal, knee forward of the hip–pedal line
    const crank = opts.crankLength ?? geo.cockpit?.crankLength ?? 170;
    const crankMode = opts.crankMode ?? 'horizontal';
    const pedal: SketchPoint = crankMode === 'vertical'
        ? { x: bb.x, y: bb.y - crank }
        : { x: bb.x + crank, y: bb.y };
    const inseam = opts.inseam != null && opts.inseam > 0 ? opts.inseam : null;
    let knee: SketchPoint | null = null;
    let kneeBendDeg: number | null = null;
    if (inseam) {
        const thigh = inseam * THIGH_RATIO;
        const shin = inseam * SHIN_RATIO;
        knee = twoBoneIK(hip, pedal, thigh, shin);
        kneeBendDeg = kneeBend(thigh, shin, distance(hip, pedal));
    }
    const kopsOffsetMm = crankMode === 'horizontal' && knee ? knee.x - pedal.x : null;

    // Sag: linear pitch between the axles (wheels stay on the ground)
    const sagFork = Math.max(0, (opts.forkTravel * opts.sagPercent) / 100);
    const sagShock = Math.max(0, (opts.shockStroke * opts.sagPercent) / 100);
    const drop = (p: SketchPoint): SketchPoint => {
        const t = Math.max(0, Math.min(1, (p.x - rearAxle.x) / (frontAxle.x - rearAxle.x)));
        const d = sagShock + (sagFork - sagShock) * t;
        return { x: p.x, y: p.y - d };
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
        kneeBendDeg,
        kopsOffsetMm,
        wheelRadiusRear: radii.rear,
        wheelRadiusFront: radii.front,
        sagFork,
        sagShock,
    };
}
