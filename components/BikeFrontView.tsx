/**
 * BikeFrontView — simple technical front-view sketch (geometric shapes).
 * Shows grip span vs shoulder width; coordinates from lib/bikeSketch.ts.
 */
import { theme } from '@/constants/Colors';
import { buildFrontSketch } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const ACCENT = '#00BFA5';

interface Props {
    geometry: BikeGeometry;
    derived: ContactGeometry;
    shoulderWidth?: number | null;
    sagPercent: number;
    forkTravel: number;
    width: number;
}

export default function BikeFrontView({
    geometry,
    derived,
    shoulderWidth,
    sagPercent,
    forkTravel,
    width,
}: Props) {
    const { t } = useTranslation();

    const sketch = useMemo(
        () => buildFrontSketch(geometry, derived, { shoulderWidth, sagPercent, forkTravel }),
        [geometry, derived, shoulderWidth, sagPercent, forkTravel],
    );

    if (!sketch) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    const height = Math.round(width * 0.62);
    const pad = 16;
    const maxHalf = Math.max(sketch.barWidth / 2, sketch.shoulderHalfWidth ?? 0, sketch.wheelRadius) + 60;
    const maxY = Math.max(sketch.headCenter.y + sketch.headRadius, sketch.wheelRadius * 2) + 40;
    const scale = Math.min((width - pad * 2) / (maxHalf * 2), (height - pad * 2) / maxY);
    const tx = (x: number) => width / 2 + x * scale;
    const ty = (y: number) => height - pad - y * scale;

    const line = (x1: number, y1: number, x2: number, y2: number, color: string, strokeWidth = 3) => (
        <Line
            x1={tx(x1)} y1={ty(y1)} x2={tx(x2)} y2={ty(y2)}
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
                {/* front wheel */}
                <Circle cx={tx(0)} cy={ty(sketch.wheelRadius)} r={sketch.wheelRadius * scale} stroke={wheelColor} strokeWidth={2} fill="none" />
                {/* fork legs + crown + steerer */}
                {line(-30, sketch.wheelRadius, -20, sketch.barGroundY - 110, frameColor, 3)}
                {line(30, sketch.wheelRadius, 20, sketch.barGroundY - 110, frameColor, 3)}
                {line(-26, sketch.barGroundY - 110, 26, sketch.barGroundY - 110, frameColor, 4)}
                {line(0, sketch.barGroundY - 110, 0, sketch.barGroundY, frameColor, 3)}
                {/* bar + grips */}
                {line(-sketch.barWidth / 2, sketch.barGroundY, sketch.barWidth / 2, sketch.barGroundY, frameColor, 4)}
                <Circle cx={tx(-sketch.gripHalfSpan)} cy={ty(sketch.barGroundY)} r={22 * scale} fill={ACCENT} />
                <Circle cx={tx(sketch.gripHalfSpan)} cy={ty(sketch.barGroundY)} r={22 * scale} fill={ACCENT} />
                {/* rider */}
                {line(0, sketch.hipY, 0, sketch.shoulderY, ACCENT, 3)}
                {sketch.shoulderHalfWidth != null && (
                    <>
                        {line(-sketch.shoulderHalfWidth, sketch.shoulderY, sketch.shoulderHalfWidth, sketch.shoulderY, ACCENT, 3)}
                        {line(-sketch.shoulderHalfWidth, sketch.shoulderY, -sketch.gripHalfSpan, sketch.barGroundY, ACCENT, 2)}
                        {line(sketch.shoulderHalfWidth, sketch.shoulderY, sketch.gripHalfSpan, sketch.barGroundY, ACCENT, 2)}
                    </>
                )}
                <Circle
                    cx={tx(sketch.headCenter.x)} cy={ty(sketch.headCenter.y)}
                    r={sketch.headRadius * scale} stroke={ACCENT} strokeWidth={2} fill="none"
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
