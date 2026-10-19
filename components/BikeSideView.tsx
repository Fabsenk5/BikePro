/**
 * BikeSideView — simple technical side-view sketch (geometric shapes) with sag.
 * Pure presentation; all coordinates come from lib/bikeSketch.ts.
 * Animation mode: wheels roll in place while a rock passes under them — the
 * suspension compresses first, then (big rock) the bike lifts and the rider
 * absorbs the rest with arms and legs.
 */
import { BPButton } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { buildAnimationFrame, buildBikeSketch, CrankMode, RiderMode, SketchPoint, SpringLine, springPoints, wheelRadii } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline } from 'react-native-svg';

const ACCENT = '#00BFA5';
const ANIMATION_MS = 6400;
// Fixed view frame for every bike and every state (mm, BB-relative): BB at
// the horizontal centre, ground at a fixed height — so geometries overlay
// directly and the bike lifts over rocks instead of the ground dropping.
const VIEW_SIDE = 1300;   // mm to each side of the BB
const VIEW_TOP = 1700;    // mm above the BB (rider + headroom)
const VIEW_BOTTOM = -400; // mm below the BB (ground of the biggest wheel)
const GRID_STEP = 100; // 10 cm grid with the BB (sketch origin) as reference
// Grid tiers for quick measuring: 10 cm faint, 50 cm medium, 100 cm strong,
// 0 axes strongest — but never as strong as the axes themselves.
const gridTier = (v: number): { strokeWidth: number; opacity: number } =>
    v === 0 ? { strokeWidth: 1.5, opacity: 0.9 }
    : v % 1000 === 0 ? { strokeWidth: 1.2, opacity: 0.65 }
    : v % 500 === 0 ? { strokeWidth: 1.0, opacity: 0.5 }
    : { strokeWidth: 0.7, opacity: 0.35 };
/** animation frame budget (~30 fps): rAF updates are skipped inside it */
const FRAME_BUDGET_MS = 1000 / 30;

interface Props {
    geometry: BikeGeometry;
    derived: ContactGeometry;
    sagPercent: number;
    forkTravel: number;
    shockStroke: number;
    rearTravel?: number | null;
    torsoLength?: number | null;
    inseam?: number | null;
    armLength?: number | null;
    crankLength?: number | null;
    crankMode?: CrankMode;
    riderMode: RiderMode;
    dropperTravel?: number | null;
    width: number;
}

export default function BikeSideView({
    geometry,
    derived,
    sagPercent,
    forkTravel,
    shockStroke,
    rearTravel,
    torsoLength,
    inseam,
    armLength,
    crankLength,
    crankMode,
    riderMode,
    dropperTravel,
    width,
}: Props) {
    const { t } = useTranslation();

    // ─── Animation state ───
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const startedAt = useRef(0);
    const lastFrame = useRef(0);
    const toggle = () => {
        if (!playing) startedAt.current = Date.now() - progress * ANIMATION_MS;
        setPlaying(p => !p);
    };
    useEffect(() => {
        if (!playing) return;
        let raf = 0;
        const tick = (ts: number) => {
            // throttle to ~30 fps: skip state updates inside the frame budget
            if (ts - lastFrame.current >= FRAME_BUDGET_MS) {
                lastFrame.current = ts;
                setProgress(((Date.now() - startedAt.current) % ANIMATION_MS) / ANIMATION_MS);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing]);
    // prefers-reduced-motion (window-guarded): the wheels don't spin
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        [],
    );

    const animActive = playing || progress > 0;
    const chainstay = geometry.frame?.chainstay ?? 0;
    const wheelbase = geometry.frame?.wheelbase ?? 0;
    const radii = wheelRadii(geometry.frame?.wheelSize);
    const rearTravelMm = rearTravel ?? shockStroke;
    const animFrame = buildAnimationFrame({
        progress,
        frontAxleX: wheelbase - chainstay,
        rearAxleX: -chainstay,
        frontRadius: radii.front,
        rearRadius: radii.rear,
        forkTravel,
        shockStroke,
        rearTravel: rearTravelMm,
        sagPercent,
    });
    const { rockHeight, rockX, frontLift, rearLift, absorb } = animFrame;
    // cumulative rolling distance for the wheel spin (continuous over phases)
    const rockStart = wheelbase - chainstay + 420;
    const rockEnd = -chainstay - 420;
    const spinDistance = (progress < 0.5 ? 0 : rockStart - rockEnd) + (rockStart - rockX);

    const poseOpts = { torsoLength, inseam, armLength, crankLength, crankMode, riderMode, dropperTravel };
    const sketch = useMemo(
        () => buildBikeSketch(geometry, derived, {
            sagPercent, forkTravel, shockStroke, ...poseOpts,
            wheelLift: { front: frontLift, rear: rearLift },
            rearTravel: rearTravelMm,
            riderAbsorb: absorb,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [geometry, derived, sagPercent, forkTravel, shockStroke, torsoLength, inseam, armLength, crankLength, crankMode, riderMode, dropperTravel, frontLift, rearLift, rearTravelMm, absorb],
    );
    // Bounds are fixed (see below), so no per-bike base sketches are needed —
    // the zoom and origin stay identical across bikes, modes and animation.

    const height = Math.round(width * 0.62);
    const pad = 16;
    const scale = useMemo(
        () => Math.min(
            (width / 2 - pad) / VIEW_SIDE,
            (height - pad * 2) / (VIEW_TOP - VIEW_BOTTOM),
        ),
        [width, height],
    );
    const tx = useCallback((x: number) => width / 2 + x * scale, [width, scale]);
    const tyGround = useCallback(
        (y: number) => height - pad - (y - VIEW_BOTTOM) * scale,
        [height, scale],
    );
    // the bike lifts by the absorbed amount (screen y decreases upwards)
    const ty = useCallback((y: number) => tyGround(y) - absorb * scale, [tyGround, absorb, scale]);

    const gridXs = useMemo(() => {
        const xs: number[] = [];
        for (let x = -VIEW_SIDE + GRID_STEP; x < VIEW_SIDE; x += GRID_STEP) xs.push(x);
        return xs;
    }, []);
    const gridYs = useMemo(() => {
        const ys: number[] = [];
        for (let y = Math.ceil(VIEW_BOTTOM / GRID_STEP) * GRID_STEP; y <= VIEW_TOP; y += GRID_STEP) ys.push(y);
        return ys;
    }, []);
    const gridColor = theme.colors.border;
    const grid = useMemo(() => (
        <>
            {gridXs.map(x => {
                const tier = gridTier(x);
                return (
                    <Line
                        key={`gx-${x}`} x1={tx(x)} y1={tyGround(VIEW_BOTTOM)} x2={tx(x)} y2={tyGround(VIEW_TOP)}
                        stroke={gridColor} strokeWidth={tier.strokeWidth}
                        opacity={tier.opacity}
                    />
                );
            })}
            {gridYs.map(y => {
                const tier = gridTier(y);
                return (
                    <Line
                        key={`gy-${y}`} x1={tx(-VIEW_SIDE)} y1={tyGround(y)} x2={tx(VIEW_SIDE)} y2={tyGround(y)}
                        stroke={gridColor} strokeWidth={tier.strokeWidth}
                        opacity={tier.opacity}
                    />
                );
            })}
        </>
    ), [gridXs, gridYs, gridColor, tx, tyGround]);

    const tube = useCallback((a: SketchPoint, b: SketchPoint, color: string, strokeWidth = 3) => (
        <Line
            x1={tx(a.x)} y1={ty(a.y)} x2={tx(b.x)} y2={ty(b.y)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        />
    ), [tx, ty]);

    // Zigzag spring: solid body, coil over the travel, solid rest
    const spring = useCallback((line: SpringLine, color: string) => {
        const { coil, solids } = springPoints(line.top, line.bottom, line.used, line.travel, line.lead);
        return (
            <>
                <Polyline
                    points={coil.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round"
                />
                {solids.map(([from, to], i) => (
                    <React.Fragment key={i}>{tube(from, to, color, 2)}</React.Fragment>
                ))}
            </>
        );
    }, [tx, ty, tube]);

    const frameColor = theme.colors.text;
    const wheelColor = theme.colors.textMuted;

    // Spinning spokes while the rock rolls underneath (static with
    // prefers-reduced-motion: no rotation)
    const spokes = useMemo(() => {
        if (!animActive || !sketch) return null;
        return ([
            { axle: sketch.rearAxle, radius: sketch.wheelRadiusRear },
            { axle: sketch.frontAxle, radius: sketch.wheelRadiusFront },
        ]).map((wheel, i) => {
            const spin = reducedMotion ? 0 : spinDistance / wheel.radius;
            return (
                <G key={`spokes-${i}`} opacity={0.6}>
                    {[0, Math.PI / 2].map((offset, j) => {
                        const dx = Math.cos(spin + offset) * wheel.radius;
                        const dy = Math.sin(spin + offset) * wheel.radius;
                        return (
                            <Line
                                key={j}
                                x1={tx(wheel.axle.x - dx)} y1={ty(wheel.axle.y - dy)}
                                x2={tx(wheel.axle.x + dx)} y2={ty(wheel.axle.y + dy)}
                                stroke={wheelColor} strokeWidth={1.5}
                            />
                        );
                    })}
                </G>
            );
        });
    }, [animActive, reducedMotion, spinDistance, sketch, wheelColor, tx, ty]);

    if (!sketch) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    return (
        <View>
            <Svg
                width={width} height={height}
                accessibilityLabel={`${t('geometry.view_title')} – ${t('geometry.view_mode_side')}`}
                accessibilityRole="image"
                role="img"
            >
                {/* 10 cm grid, origin at the BB */}
                {grid}
                {/* ground — fixed; the bike lifts over rocks instead */}
                <Line
                    x1={pad} y1={tyGround(sketch.groundY)} x2={width - pad} y2={tyGround(sketch.groundY)}
                    stroke={theme.colors.border} strokeWidth={1}
                />
                {/* rock rolling towards the bike */}
                {animActive && (
                    <Polygon
                        points={[
                            `${tx(rockX - rockHeight * 0.8)},${tyGround(sketch.groundY)}`,
                            `${tx(rockX - rockHeight * 0.5)},${tyGround(sketch.groundY + rockHeight * 0.75)}`,
                            `${tx(rockX)},${tyGround(sketch.groundY + rockHeight)}`,
                            `${tx(rockX + rockHeight * 0.55)},${tyGround(sketch.groundY + rockHeight * 0.7)}`,
                            `${tx(rockX + rockHeight * 0.8)},${tyGround(sketch.groundY)}`,
                        ].join(' ')}
                        fill={theme.colors.textMuted} opacity={0.5}
                    />
                )}
                {/* wheels (spokes spin while the rock rolls underneath) */}
                <Circle cx={tx(sketch.rearAxle.x)} cy={ty(sketch.rearAxle.y)} r={sketch.wheelRadiusRear * scale} stroke={wheelColor} strokeWidth={2} fill="none" />
                <Circle cx={tx(sketch.frontAxle.x)} cy={ty(sketch.frontAxle.y)} r={sketch.wheelRadiusFront * scale} stroke={wheelColor} strokeWidth={2} fill="none" />
                {spokes}
                {/* front triangle */}
                {tube(sketch.bb, sketch.headBottom, frameColor)}
                {tube(sketch.bb, sketch.seatCluster, frameColor)}
                {tube(sketch.headTop, sketch.seatCluster, frameColor)}
                {tube(sketch.headTop, sketch.headBottom, frameColor, 5)}
                {/* rear triangle */}
                {tube(sketch.bb, sketch.rearAxle, frameColor, 2)}
                {tube(sketch.seatCluster, sketch.rearAxle, frameColor, 2)}
                {/* fork + shock as springs (orange = used hub) */}
                {spring(sketch.forkSpring, frameColor)}
                {/* hardtail (no shock travel): the damper degenerates to a solid line */}
                {shockStroke > 0
                    ? spring(sketch.shockSpring, frameColor)
                    : tube(sketch.shockSpring.top, sketch.shockSpring.bottom, frameColor, 2)}
                {/* cockpit, split exactly like the contact model: spacers along
                    the steerer, stem, rise, then the bar sweeping back/up to
                    the grip. Without complete data the simple stem line stays. */}
                {sketch.steererTop && sketch.stemEnd ? (
                    <>
                        {tube(sketch.headTop, sketch.steererTop, frameColor, 3)}
                        {tube(sketch.steererTop, sketch.stemEnd, frameColor, 4)}
                        {tube(sketch.stemEnd, sketch.bar, frameColor, 3)}
                        {tube(sketch.bar, sketch.hand, frameColor, 3)}
                        <Circle
                            cx={tx(sketch.hand.x)} cy={ty(sketch.hand.y)}
                            r={Math.max(2, 16 * scale)} fill={theme.colors.accentOrange}
                        />
                    </>
                ) : (
                    <>
                        {tube(sketch.headTop, sketch.bar, frameColor, 3)}
                        {tube(
                            { x: sketch.bar.x - 45, y: sketch.bar.y + 10 },
                            { x: sketch.bar.x + 45, y: sketch.bar.y - 10 },
                            frameColor, 4,
                        )}
                    </>
                )}
                {/* seatpost (along the seat angle) + saddle (nose forward) */}
                {tube(sketch.seatCluster, sketch.saddleClamp, frameColor, 2)}
                <Polygon
                    points={[
                        `${tx(sketch.saddle.x)},${ty(sketch.saddle.y)}`,
                        `${tx(sketch.saddle.x - 130)},${ty(sketch.saddle.y + 16)}`,
                        `${tx(sketch.saddle.x - 130)},${ty(sketch.saddle.y - 16)}`,
                    ].join(' ')}
                    fill={theme.colors.accentOrange}
                />
                {/* rider: torso from the hip (rotation point), bent arms and legs.
                    Far-side arm and leg are dimmed depth cues, like the legs. */}
                {tube(sketch.riderHip, sketch.riderShoulder, ACCENT, 3)}
                <G opacity={0.45}>
                    {tube(sketch.riderShoulder, sketch.riderElbowFar, ACCENT, 2)}
                    {tube(sketch.riderElbowFar, sketch.riderHandFar, ACCENT, 2)}
                </G>
                {tube(sketch.riderShoulder, sketch.riderElbow, ACCENT, 2)}
                {tube(sketch.riderElbow, sketch.hand, ACCENT, 2)}
                {sketch.riderLegs.filter(leg => !leg.near).map((leg, i) => (
                    <G key={`far-${i}`} opacity={0.45}>
                        {leg.knee && tube(sketch.riderHip, leg.knee, ACCENT, 2)}
                        {tube(leg.knee ?? sketch.riderHip, leg.pedal, ACCENT, 2)}
                        {tube(sketch.bb, leg.pedal, frameColor, 2)}
                        <Circle
                            cx={tx(leg.pedal.x)} cy={ty(leg.pedal.y)}
                            r={Math.max(2, 20 * scale)} fill={ACCENT}
                        />
                    </G>
                ))}
                {sketch.riderLegs.filter(leg => leg.near).map((leg, i) => (
                    <G key={`near-${i}`}>
                        {leg.knee && tube(sketch.riderHip, leg.knee, ACCENT, 2)}
                        {tube(leg.knee ?? sketch.riderHip, leg.pedal, ACCENT, 2)}
                        {tube(sketch.bb, leg.pedal, frameColor, 2)}
                        <Circle
                            cx={tx(leg.pedal.x)} cy={ty(leg.pedal.y)}
                            r={Math.max(2, 25 * scale)} fill={ACCENT}
                        />
                    </G>
                ))}
                <Circle
                    cx={tx(sketch.riderHead.x)} cy={ty(sketch.riderHead.y)}
                    r={sketch.riderHeadRadius * scale} stroke={ACCENT} strokeWidth={2} fill="none"
                />
            </Svg>
            <View accessibilityHint={playing ? t('geometry.animation_stop') : t('geometry.animation_play')}>
                <BPButton
                    title={playing ? t('geometry.animation_stop') : t('geometry.animation_play')}
                    onPress={toggle}
                    variant="secondary"
                    color={ACCENT}
                    size="sm"
                    style={{ marginBottom: theme.spacing.sm }}
                />
            </View>
            {animActive && (
                <Text style={styles.hint}>
                    {t('geometry.animation_used', {
                        fork: Math.round(Math.min(forkTravel, (forkTravel * sagPercent) / 100 + Math.max(0, frontLift))),
                        forkMax: Math.round(forkTravel),
                        shock: Math.round(Math.min(shockStroke, (shockStroke * sagPercent) / 100 + Math.max(0, rearLift) * (rearTravelMm > 0 ? shockStroke / rearTravelMm : 0))),
                        shockMax: Math.round(shockStroke),
                        absorb: Math.round(absorb),
                    })}
                </Text>
            )}
            {riderMode === 'seated' && crankMode === 'vertical' && sketch.kneeBendDeg != null && sketch.legRangeDeg != null && (
                <Text style={styles.hint}>{t('geometry.knee_bend_caption', { bottom: sketch.legRangeDeg.bottom, top: sketch.legRangeDeg.top })}</Text>
            )}
            {sketch.torsoAngleSource === 'ik' && (
                <Text style={styles.hint}>{t('geometry.torso_angle_caption', { deg: sketch.torsoAngleDeg })}</Text>
            )}
            {shockStroke > 0 ? (
                <Text style={styles.hint}>
                    {t('geometry.springs_legend_side', {
                        fork: Math.round(forkTravel),
                        shock: Math.round(shockStroke),
                        sag: sagPercent,
                    })}
                </Text>
            ) : (
                <Text style={styles.hint}>
                    {t('geometry.springs_legend_no_shock', {
                        fork: Math.round(forkTravel),
                        sag: sagPercent,
                    })}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
