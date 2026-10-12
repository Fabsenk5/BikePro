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
    wheelRadiusRear: number;
    wheelRadiusFront: number;
    sagFork: number;
    sagShock: number;
}

const HEAD_TUBE_LENGTH = 110;
const DEFAULT_TORSO = 550;

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
}

/** Approximate shoulder rise above the bar in attack position (mm). */
const SHOULDER_RISE_ABOVE_BAR = 250;

export function buildFrontSketch(
    geo: BikeGeometry,
    derived: ContactGeometry,
    opts: { shoulderWidth?: number | null; sagPercent: number; forkTravel: number },
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
    };
}

export function buildBikeSketch(
    geo: BikeGeometry,
    derived: ContactGeometry,
    opts: { sagPercent: number; forkTravel: number; shockStroke: number; torsoLength?: number | null },
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
    const hip: SketchPoint = { x: saddle.x, y: saddle.y + 20 };
    const torsoAngle = (55 * Math.PI) / 180;
    const shoulder: SketchPoint = {
        x: hip.x + torso * Math.cos(torsoAngle),
        y: hip.y + torso * Math.sin(torsoAngle),
    };
    const head: SketchPoint = {
        x: shoulder.x + 90 * Math.cos(torsoAngle),
        y: shoulder.y + 90 * Math.sin(torsoAngle),
    };

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
        wheelRadiusRear: radii.rear,
        wheelRadiusFront: radii.front,
        sagFork,
        sagShock,
    };
}
