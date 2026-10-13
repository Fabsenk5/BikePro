/**
 * BikeSideView — simple technical side-view sketch (geometric shapes) with sag.
 * Pure presentation; all coordinates come from lib/bikeSketch.ts.
 * Animation mode: wheels roll in place while a rock passes under them — the
 * suspension compresses first, then (big rock) the bike lifts and the rider
 * absorbs the rest with arms and legs.
 */
import { BPButton } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { BikeSketch, buildBikeSketch, CrankMode, RiderMode, SketchPoint, SpringLine, springPoints, wheelRadii } from '@/lib/bikeSketch';
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
    // Bounds from the un-sagged sketches of all rider modes: the zoom stays
    // fixed while sag, pose and animation change (side and front view alike).
    const baseSketches = useMemo(
        () => (['seated', 'standing', 'attack-flat', 'attack-steep'] as RiderMode[])
            .map(mode => buildBikeSketch(geometry, derived, { sagPercent: 0, forkTravel, shockStroke, ...poseOpts, riderMode: mode }))
            .filter((s): s is BikeSketch => s != null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [geometry, derived, forkTravel, shockStroke, torsoLength, inseam, armLength, crankLength, crankMode, dropperTravel],
    );
    if (!sketch || !baseSketches.length) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    const height = Math.round(width * 0.62);
    const pad = 16;
    const minX = Math.min(...baseSketches.map(s => s.rearAxle.x - s.wheelRadiusRear));
    const maxX = Math.max(...baseSketches.map(s => s.frontAxle.x + s.wheelRadiusFront));
    const minY = Math.min(...baseSketches.map(s => s.groundY)) - 20;
    const maxY = Math.max(...baseSketches.flatMap(s => [
        s.wheelRadiusRear * 2,
        s.saddle.y + 200,
        s.riderHead.y + s.riderHeadRadius,
        s.headTop.y,
    ]));
    const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
    const tx = (x: number) => pad + (x - minX) * scale;
    const ty = (y: number) => height - pad - (y - minY) * scale;

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
                {/* ground (drops when the frame lifts over a big rock) */}
                <Line
                    x1={pad} y1={ty(sketch.groundY - absorb)} x2={width - pad} y2={ty(sketch.groundY - absorb)}
                    stroke={theme.colors.border} strokeWidth={1}
                />
                {/* rock rolling towards the bike */}
                {animActive && (
                    <Polygon
                        points={[
                            `${tx(rockX - rockHeight * 0.8)},${ty(sketch.groundY - absorb)}`,
                            `${tx(rockX - rockHeight * 0.5)},${ty(sketch.groundY - absorb + rockHeight * 0.75)}`,
                            `${tx(rockX)},${ty(sketch.groundY - absorb + rockHeight)}`,
                            `${tx(rockX + rockHeight * 0.55)},${ty(sketch.groundY - absorb + rockHeight * 0.7)}`,
                            `${tx(rockX + rockHeight * 0.8)},${ty(sketch.groundY - absorb)}`,
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
