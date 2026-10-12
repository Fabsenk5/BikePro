/**
 * BikeSideView — simple technical side-view sketch (geometric shapes) with sag.
 * Pure presentation; all coordinates come from lib/bikeSketch.ts.
 */
import { theme } from '@/constants/Colors';
import { buildBikeSketch, SketchPoint } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

const ACCENT = '#00BFA5';

interface Props {
    geometry: BikeGeometry;
    derived: ContactGeometry;
    sagPercent: number;
    forkTravel: number;
    shockStroke: number;
    torsoLength?: number | null;
    width: number;
}

export default function BikeSideView({
    geometry,
    derived,
    sagPercent,
    forkTravel,
    shockStroke,
    torsoLength,
    width,
}: Props) {
    const { t } = useTranslation();

    const sketch = useMemo(
        () => buildBikeSketch(geometry, derived, { sagPercent, forkTravel, shockStroke, torsoLength }),
        [geometry, derived, sagPercent, forkTravel, shockStroke, torsoLength],
    );

    if (!sketch) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    const height = Math.round(width * 0.62);
    const pad = 16;
    const minX = sketch.rearAxle.x - sketch.wheelRadiusRear;
    const maxX = sketch.frontAxle.x + sketch.wheelRadiusFront;
    const minY = -20;
    const maxY = Math.max(
        sketch.wheelRadiusRear * 2,
        sketch.saddle.y + 200,
        sketch.riderHead.y + sketch.riderHeadRadius,
        sketch.headTop.y,
    );
    const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
    const tx = (x: number) => pad + (x - minX) * scale;
    const ty = (y: number) => height - pad - (y - minY) * scale;

    const tube = (a: SketchPoint, b: SketchPoint, color: string, strokeWidth = 3) => (
        <Line
            x1={tx(a.x)} y1={ty(a.y)} x2={tx(b.x)} y2={ty(b.y)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        />
    );

    const frameColor = theme.colors.text;
    const wheelColor = theme.colors.textMuted;

    return (
        <View>
            <Svg width={width} height={height}>
                {/* ground */}
                <Line x1={pad} y1={ty(0)} x2={width - pad} y2={ty(0)} stroke={theme.colors.border} strokeWidth={1} />
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
                {/* fork */}
                {tube(sketch.headBottom, sketch.frontAxle, ACCENT, 3)}
                {/* stem + bar */}
                {tube(sketch.headTop, sketch.bar, frameColor, 3)}
                {tube(
                    { x: sketch.bar.x - 45, y: sketch.bar.y + 10 },
                    { x: sketch.bar.x + 45, y: sketch.bar.y - 10 },
                    frameColor, 4,
                )}
                {/* seatpost + saddle */}
                {tube(sketch.seatCluster, sketch.saddle, frameColor, 2)}
                <Polygon
                    points={[
                        `${tx(sketch.saddle.x - 120)},${ty(sketch.saddle.y)}`,
                        `${tx(sketch.saddle.x + 40)},${ty(sketch.saddle.y + 10)}`,
                        `${tx(sketch.saddle.x + 40)},${ty(sketch.saddle.y - 10)}`,
                    ].join(' ')}
                    fill={theme.colors.accentOrange}
                />
                {/* rider */}
                {tube(sketch.riderHip, sketch.riderShoulder, ACCENT, 3)}
                {tube(sketch.riderShoulder, sketch.hand, ACCENT, 2)}
                {tube(sketch.riderHip, sketch.bb, ACCENT, 2)}
                <Circle
                    cx={tx(sketch.riderHead.x)} cy={ty(sketch.riderHead.y)}
                    r={sketch.riderHeadRadius * scale} stroke={ACCENT} strokeWidth={2} fill="none"
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
