/**
 * BikeSideView — simple technical side-view sketch (geometric shapes) with sag.
 * Pure presentation; all coordinates come from lib/bikeSketch.ts.
 */
import { theme } from '@/constants/Colors';
import { BikeSketch, buildBikeSketch, CrankMode, RiderMode, SketchPoint, SpringLine, springPoints } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

const ACCENT = '#00BFA5';

interface Props {
    geometry: BikeGeometry;
    derived: ContactGeometry;
    sagPercent: number;
    forkTravel: number;
    shockStroke: number;
    torsoLength?: number | null;
    inseam?: number | null;
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
    torsoLength,
    inseam,
    crankLength,
    crankMode,
    riderMode,
    dropperTravel,
    width,
}: Props) {
    const { t } = useTranslation();

    const poseOpts = { torsoLength, inseam, crankLength, crankMode, riderMode, dropperTravel };
    const sketch = useMemo(
        () => buildBikeSketch(geometry, derived, { sagPercent, forkTravel, shockStroke, ...poseOpts }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [geometry, derived, sagPercent, forkTravel, shockStroke, torsoLength, inseam, crankLength, crankMode, riderMode, dropperTravel],
    );
    // Bounds from the un-sagged sketches of both rider modes: the zoom stays
    // fixed while sag and pose change (side and front view behave the same).
    const baseSketches = useMemo(
        () => (['seated', 'standing'] as RiderMode[])
            .map(mode => buildBikeSketch(geometry, derived, { sagPercent: 0, forkTravel, shockStroke, ...poseOpts, riderMode: mode }))
            .filter((s): s is BikeSketch => s != null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [geometry, derived, forkTravel, shockStroke, torsoLength, inseam, crankLength, crankMode, dropperTravel],
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

    // Zigzag spring: coil over the travel, solid line for the rest
    const spring = (line: SpringLine, color: string) => {
        const { coil, solid } = springPoints(line.top, line.bottom, line.used, line.travel);
        return (
            <>
                <Polyline
                    points={coil.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round"
                />
                {tube(solid[0], solid[1], color, 2)}
            </>
        );
    };

    const frameColor = theme.colors.text;
    const wheelColor = theme.colors.textMuted;

    return (
        <View>
            <Svg width={width} height={height}>
                {/* ground */}
                <Line x1={pad} y1={ty(sketch.groundY)} x2={width - pad} y2={ty(sketch.groundY)} stroke={theme.colors.border} strokeWidth={1} />
                {/* wheels */}
                <Circle cx={tx(sketch.rearAxle.x)} cy={ty(sketch.rearAxle.y)} r={sketch.wheelRadiusRear * scale} stroke={wheelColor} strokeWidth={2} fill="none" />
                <Circle cx={tx(sketch.frontAxle.x)} cy={ty(sketch.frontAxle.y)} r={sketch.wheelRadiusFront * scale} stroke={wheelColor} strokeWidth={2} fill="none" />
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
                {/* seatpost + saddle (nose forward, wide tail at the back) */}
                {tube(sketch.seatCluster, { x: sketch.saddle.x - 60, y: sketch.saddle.y - 8 }, frameColor, 2)}
                <Polygon
                    points={[
                        `${tx(sketch.saddle.x)},${ty(sketch.saddle.y)}`,
                        `${tx(sketch.saddle.x - 130)},${ty(sketch.saddle.y + 16)}`,
                        `${tx(sketch.saddle.x - 130)},${ty(sketch.saddle.y - 16)}`,
                    ].join(' ')}
                    fill={theme.colors.accentOrange}
                />
                {/* rider: torso, bent arm, bent leg to the pedal */}
                {riderMode === 'seated' && tube({ x: sketch.saddle.x - 60, y: sketch.saddle.y }, sketch.riderHip, ACCENT, 3)}
                {tube(sketch.riderHip, sketch.riderShoulder, ACCENT, 3)}
                {tube(sketch.riderShoulder, sketch.riderElbow, ACCENT, 2)}
                {tube(sketch.riderElbow, sketch.hand, ACCENT, 2)}
                {sketch.riderKnee ? (
                    <>
                        {tube(sketch.riderHip, sketch.riderKnee, ACCENT, 2)}
                        {tube(sketch.riderKnee, sketch.riderPedal, ACCENT, 2)}
                    </>
                ) : (
                    tube(sketch.riderHip, sketch.riderPedal, ACCENT, 2)
                )}
                {tube(sketch.bb, sketch.riderPedal, frameColor, 2)}
                <Circle
                    cx={tx(sketch.riderPedal.x)} cy={ty(sketch.riderPedal.y)}
                    r={Math.max(2, 25 * scale)} fill={ACCENT}
                />
                <Circle
                    cx={tx(sketch.riderHead.x)} cy={ty(sketch.riderHead.y)}
                    r={sketch.riderHeadRadius * scale} stroke={ACCENT} strokeWidth={2} fill="none"
                />
            </Svg>
            {riderMode === 'seated' && crankMode === 'vertical' && sketch.kneeBendDeg != null && (
                <Text style={styles.hint}>{t('geometry.knee_bend_caption', { deg: sketch.kneeBendDeg })}</Text>
            )}
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
