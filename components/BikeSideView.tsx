/**
 * BikeSideView — simple technical side-view sketch (geometric shapes) with sag.
 * Pure presentation; all coordinates come from lib/bikeSketch.ts.
 * Animation mode: wheels roll in place while a rock passes under them — the
 * suspension compresses first, then (big rock) the bike lifts and the rider
 * absorbs the rest with arms and legs.
 */
import { BPButton } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { buildBikeSketch, CrankMode, RiderMode, SketchPoint, SpringLine, springPoints, wheelRadii } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline } from 'react-native-svg';

const ACCENT = '#00BFA5';
const ANIMATION_MS = 6400;

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
    const toggle = () => {
        if (!playing) startedAt.current = Date.now() - progress * ANIMATION_MS;
        setPlaying(p => !p);
    };
    useEffect(() => {
        if (!playing) return;
        let raf = 0;
        const tick = () => {
            setProgress(((Date.now() - startedAt.current) % ANIMATION_MS) / ANIMATION_MS);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing]);

    const animActive = playing || progress > 0;
    const chainstay = geometry.frame?.chainstay ?? 0;
    const wheelbase = geometry.frame?.wheelbase ?? 0;
    const radii = wheelRadii(geometry.frame?.wheelSize);
    const rearTravelMm = rearTravel ?? shockStroke;

    // Rocks: first one just reaches the suspension travel (min of both ends),
    // then a bigger one that exceeds the fork travel so the rider absorbs.
    const rockSmall = Math.max(20, Math.min(forkTravel, shockStroke));
    const rockBig = Math.round(forkTravel * 1.25);
    const phase = progress < 0.5 ? 0 : 1;
    const local = (progress - phase * 0.5) / 0.5;
    const rockHeight = phase === 0 ? rockSmall : rockBig;
    const rockStart = wheelbase - chainstay + 420;
    const rockEnd = -chainstay - 420;
    const rockX = rockStart + (rockEnd - rockStart) * local;

    // Wheel hit: smooth climb as the rock passes under the axle
    const hitFor = (axleX: number, radius: number) => {
        const t = Math.max(0, 1 - Math.abs(rockX - axleX) / radius);
        return rockHeight * t * t * (3 - 2 * t);
    };
    const frontHit = animActive ? hitFor(wheelbase - chainstay, radii.front) : 0;
    const rearHit = animActive ? hitFor(-chainstay, radii.rear) : 0;

    // Beyond the suspension the frame lifts and the rider absorbs the rest:
    // arms/legs bend, torso and head stay stable.
    const frontAbsorb = Math.max(0, frontHit - forkTravel);
    const rearAbsorb = Math.max(0, rearHit - rearTravelMm);
    const absorb = Math.max(frontAbsorb, rearAbsorb);
    const sagForkMm = (forkTravel * sagPercent) / 100;
    const sagShockMm = (shockStroke * sagPercent) / 100;
    const rearSagWheel = rearTravelMm > 0 ? (sagShockMm * rearTravelMm) / shockStroke : sagShockMm;
    const frontLift = Math.max(-sagForkMm, frontHit - absorb);
    const rearLift = Math.max(-rearSagWheel, rearHit - absorb);

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
    if (!sketch) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    const height = Math.round(width * 0.62);
    const pad = 16;
    // Fixed view frame for every bike and every state: BB at the horizontal
    // centre, ground at a fixed height — so geometries overlay directly and
    // the bike lifts over rocks instead of the ground dropping.
    const VIEW_SIDE = 1300;   // mm to each side of the BB
    const VIEW_TOP = 1700;    // mm above the BB (rider + headroom)
    const VIEW_BOTTOM = -400; // mm below the BB (ground of the biggest wheel)
    const scale = Math.min(
        (width / 2 - pad) / VIEW_SIDE,
        (height - pad * 2) / (VIEW_TOP - VIEW_BOTTOM),
    );
    const tx = (x: number) => width / 2 + x * scale;
    const tyGround = (y: number) => height - pad - (y - VIEW_BOTTOM) * scale;
    const ty = (y: number) => tyGround(y) + absorb * scale;

    // 10 cm grid with the BB (sketch origin) as reference
    const GRID_STEP = 100;
    const gridXs: number[] = [];
    for (let x = -VIEW_SIDE + GRID_STEP; x < VIEW_SIDE; x += GRID_STEP) gridXs.push(x);
    const gridYs: number[] = [];
    for (let y = Math.ceil(VIEW_BOTTOM / GRID_STEP) * GRID_STEP; y <= VIEW_TOP; y += GRID_STEP) gridYs.push(y);
    const gridColor = theme.colors.border;

    const tube = (a: SketchPoint, b: SketchPoint, color: string, strokeWidth = 3) => (
        <Line
            x1={tx(a.x)} y1={ty(a.y)} x2={tx(b.x)} y2={ty(b.y)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        />
    );

    // Zigzag spring: solid body, coil over the travel, solid rest
    const spring = (line: SpringLine, color: string) => {
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
    };

    const frameColor = theme.colors.text;
    const wheelColor = theme.colors.textMuted;

    return (
        <View>
            <Svg width={width} height={height}>
                {/* 10 cm grid, origin at the BB */}
                {gridXs.map(x => (
                    <Line
                        key={`gx-${x}`} x1={tx(x)} y1={tyGround(VIEW_BOTTOM)} x2={tx(x)} y2={tyGround(VIEW_TOP)}
                        stroke={gridColor} strokeWidth={x === 0 ? 1.5 : 0.7}
                        opacity={x === 0 ? 0.9 : 0.35}
                    />
                ))}
                {gridYs.map(y => (
                    <Line
                        key={`gy-${y}`} x1={tx(-VIEW_SIDE)} y1={tyGround(y)} x2={tx(VIEW_SIDE)} y2={tyGround(y)}
                        stroke={gridColor} strokeWidth={y === 0 ? 1.5 : 0.7}
                        opacity={y === 0 ? 0.9 : 0.35}
                    />
                ))}
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
                {animActive && ([
                    { axle: sketch.rearAxle, radius: sketch.wheelRadiusRear },
                    { axle: sketch.frontAxle, radius: sketch.wheelRadiusFront },
                ]).map((wheel, i) => {
                    const spin = (phase * (rockStart - rockEnd) + (rockStart - rockX)) / wheel.radius;
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
                })}
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
                {spring(sketch.shockSpring, frameColor)}
                {/* stem + bar */}
                {tube(sketch.headTop, sketch.bar, frameColor, 3)}
                {tube(
                    { x: sketch.bar.x - 45, y: sketch.bar.y + 10 },
                    { x: sketch.bar.x + 45, y: sketch.bar.y - 10 },
                    frameColor, 4,
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
                {/* rider: torso from the hip (rotation point), bent arms and legs */}
                {tube(sketch.riderHip, sketch.riderShoulder, ACCENT, 3)}
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
            <BPButton
                title={playing ? t('geometry.animation_stop') : t('geometry.animation_play')}
                onPress={toggle}
                variant="secondary"
                color={ACCENT}
                size="sm"
                style={{ marginBottom: theme.spacing.sm }}
            />
            {animActive && (
                <Text style={styles.hint}>
                    {t('geometry.animation_used', {
                        fork: Math.round(Math.max(0, frontLift)),
                        forkMax: Math.round(forkTravel),
                        shock: Math.round(Math.max(0, rearLift) * (shockStroke / rearTravelMm)),
                        shockMax: Math.round(shockStroke),
                        absorb: Math.round(absorb),
                    })}
                </Text>
            )}
            {riderMode === 'seated' && crankMode === 'vertical' && sketch.kneeBendDeg != null && (
                <Text style={styles.hint}>{t('geometry.knee_bend_caption', { deg: sketch.kneeBendDeg })}</Text>
            )}
            <Text style={styles.hint}>{t('geometry.torso_angle_caption', { deg: sketch.torsoAngleDeg })}</Text>
            <Text style={styles.hint}>
                {t('geometry.springs_legend_side', {
                    fork: Math.round(forkTravel),
                    shock: Math.round(shockStroke),
                    sag: sagPercent,
                })}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
