/**
 * BikeFrontView — simple technical front-view sketch (geometric shapes).
 * Shows grip span vs shoulder width; coordinates from lib/bikeSketch.ts.
 * Same rider modes and fixed zoom behaviour as the side view; the springs
 * show the fork only (there is no rear shock to draw from the front).
 */
import { theme } from '@/constants/Colors';
import { buildFrontSketch, CrankMode, RiderMode, SketchPoint, springPoints } from '@/lib/bikeSketch';
import { BikeGeometry, ContactGeometry } from '@/lib/geometry';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline } from 'react-native-svg';

const ACCENT = '#00BFA5';
// Fixed view frame like the side view (mm, ground-relative): identical zoom
// for every bike and pose so geometries overlay directly.
const VIEW_HALF = 600; // mm to each side of the centre
const VIEW_TOP = 1900;  // mm above the ground

interface Props {
    geometry: BikeGeometry;
    derived: ContactGeometry;
    shoulderWidth?: number | null;
    sagPercent: number;
    forkTravel: number;
    shockStroke?: number | null;
    tireWidthMm?: number | null;
    torsoLength?: number | null;
    armLength?: number | null;
    riderMode: RiderMode;
    dropperTravel?: number | null;
    crankMode?: CrankMode;
    crankLength?: number | null;
    inseam?: number | null;
    width: number;
}

export default function BikeFrontView({
    geometry,
    derived,
    shoulderWidth,
    sagPercent,
    forkTravel,
    shockStroke,
    tireWidthMm,
    torsoLength,
    armLength,
    riderMode,
    dropperTravel,
    crankMode,
    crankLength,
    inseam,
    width,
}: Props) {
    const { t } = useTranslation();

    const sketch = useMemo(
        () => buildFrontSketch(geometry, derived, {
            shoulderWidth, sagPercent, forkTravel, shockStroke, tireWidthMm, torsoLength,
            riderMode, dropperTravel, crankMode, crankLength, armLength, inseam,
        }),
        [geometry, derived, shoulderWidth, sagPercent, forkTravel, shockStroke, tireWidthMm, torsoLength, riderMode, dropperTravel, crankMode, crankLength, armLength, inseam],
    );
    const height = Math.round(width * 0.62);
    const pad = 16;
    const scale = Math.min((width - pad * 2) / (VIEW_HALF * 2), (height - pad * 2) / VIEW_TOP);
    const tx = useCallback((x: number) => width / 2 + x * scale, [width, scale]);
    const ty = useCallback((y: number) => height - pad - y * scale, [height, scale]);

    const line = useCallback((x1: number, y1: number, x2: number, y2: number, color: string, strokeWidth = 3) => (
        <Line
            x1={tx(x1)} y1={ty(y1)} x2={tx(x2)} y2={ty(y2)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        />
    ), [tx, ty]);

    const frameColor = theme.colors.text;
    const wheelColor = theme.colors.textMuted;

    // Zigzag spring: solid crown body, coil over the travel, solid lowers
    const spring = useCallback((top: SketchPoint, bottom: SketchPoint, used: number, travel: number) => {
        const { coil, solids } = springPoints(top, bottom, used, travel, travel / 2);
        return (
            <>
                <Polyline
                    points={coil.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ')}
                    fill="none" stroke={frameColor} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round"
                />
                {solids.map(([from, to], i) => (
                    <React.Fragment key={i}>
                        {line(from.x, from.y, to.x, to.y, frameColor, 2)}
                    </React.Fragment>
                ))}
            </>
        );
    }, [tx, ty, line, frameColor]);

    if (!sketch) {
        return <Text style={styles.hint}>{t('geometry.view_no_data')}</Text>;
    }

    // Shoulders are drawn even without a profile value — 225 mm half width assumed.
    const shoulderHalf = sketch.shoulderHalfWidth ?? 225;

    // Bent arms: elbow above the shoulder–grip line, slightly outward
    const elbowX = (shoulderHalf + sketch.gripHalfSpan) / 2 + 25;
    const elbowY = (sketch.shoulderY + sketch.barGroundY) / 2 + 60;
    // Fork legs run outside the tire; the crown comes from the sketch
    // (same head-tube geometry as the side view)
    const legX = Math.max(30, sketch.tireWidthMm / 2 + 10);
    const crownY = sketch.crownGroundY;
    // Dropper post below the saddle: long when extended (seated), short when
    // compressed (standing and both attack modes ride the dropper down)
    const postLength = riderMode !== 'seated' ? 40 : 140;

    return (
        <View>
            <Svg
                width={width} height={height}
                accessibilityLabel={`${t('geometry.view_title')} – ${t('geometry.view_mode_front')}`}
                accessibilityRole="image"
                role="img"
            >
                {/* ground */}
                <Line x1={pad} y1={ty(0)} x2={width - pad} y2={ty(0)} stroke={theme.colors.border} strokeWidth={1} />
                {/* front wheel seen head-on: tire width + hub */}
                <Line
                    x1={tx(0)} y1={ty(0)} x2={tx(0)} y2={ty(sketch.wheelRadius * 2)}
                    stroke={wheelColor} strokeWidth={Math.max(2, sketch.tireWidthMm * scale)} strokeLinecap="round"
                />
                <Circle cx={tx(0)} cy={ty(sketch.wheelRadius)} r={Math.max(3, 16 * scale)} stroke={wheelColor} strokeWidth={2} fill="none" />
                {/* fork legs as springs + crown + steerer */}
                {spring({ x: -20, y: crownY }, { x: -legX, y: sketch.wheelRadius }, sketch.forkUsed, sketch.forkTravel)}
                {spring({ x: 20, y: crownY }, { x: legX, y: sketch.wheelRadius }, sketch.forkUsed, sketch.forkTravel)}
                {line(-26, crownY, 26, crownY, frameColor, 4)}
                {line(0, crownY, 0, sketch.barGroundY, frameColor, 3)}
                {/* bar + grips */}
                {line(-sketch.barWidth / 2, sketch.barGroundY, sketch.barWidth / 2, sketch.barGroundY, frameColor, 4)}
                <Circle cx={tx(-sketch.gripHalfSpan)} cy={ty(sketch.barGroundY)} r={22 * scale} fill={ACCENT} />
                <Circle cx={tx(sketch.gripHalfSpan)} cy={ty(sketch.barGroundY)} r={22 * scale} fill={ACCENT} />
                {/* saddle + dropper post (seated: extended, standing: compressed) */}
                {line(0, sketch.saddleGroundY - 6, 0, sketch.saddleGroundY - 6 - postLength, frameColor, 3)}
                {line(-45, sketch.saddleGroundY, 45, sketch.saddleGroundY, theme.colors.accentOrange, 4)}
                {/* rider: legs, hips, torso and bent arms.
                    The front view has no near/far perspective — both legs sit
                    side by side. In vertical crank mode the leg on the raised
                    pedal is dimmed to tell the legs apart; in horizontal mode
                    both feet share the BB height and are drawn equally.
                    Without an inseam (knee null) the legs run straight hip → foot. */}
                {sketch.legs.map((leg, i) => {
                    const dimmed = crankMode === 'vertical' && leg.foot.y > sketch.bbGroundY;
                    return (
                        <G key={i} opacity={dimmed ? 0.45 : 1}>
                            {leg.knee ? (
                                <>
                                    {line(leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, ACCENT, 2)}
                                    {line(leg.knee.x, leg.knee.y, leg.foot.x, leg.foot.y, ACCENT, 2)}
                                </>
                            ) : (
                                line(leg.hip.x, leg.hip.y, leg.foot.x, leg.foot.y, ACCENT, 2)
                            )}
                            <Circle cx={tx(leg.foot.x)} cy={ty(leg.foot.y)} r={Math.max(2, 18 * scale)} fill={ACCENT} />
                        </G>
                    );
                })}
                {line(-sketch.legs[0].hip.x, sketch.hipY, sketch.legs[0].hip.x, sketch.hipY, ACCENT, 3)}
                {line(0, sketch.hipY, 0, sketch.shoulderY, ACCENT, 3)}
                {line(-shoulderHalf, sketch.shoulderY, shoulderHalf, sketch.shoulderY, ACCENT, 3)}
                {line(-shoulderHalf, sketch.shoulderY, -elbowX, elbowY, ACCENT, 2)}
                {line(-elbowX, elbowY, -sketch.gripHalfSpan, sketch.barGroundY, ACCENT, 2)}
                {line(shoulderHalf, sketch.shoulderY, elbowX, elbowY, ACCENT, 2)}
                {line(elbowX, elbowY, sketch.gripHalfSpan, sketch.barGroundY, ACCENT, 2)}
                <Circle
                    cx={tx(sketch.headCenter.x)} cy={ty(sketch.headCenter.y)}
                    r={sketch.headRadius * scale} stroke={ACCENT} strokeWidth={2} fill="none"
                />
            </Svg>
            {sketch.shoulderHalfWidth != null ? (
                <Text style={styles.hint}>
                    {t('geometry.view_front_caption', {
                        grip: Math.round(sketch.gripHalfSpan * 2),
                        shoulder: Math.round(sketch.shoulderHalfWidth * 2),
                        delta: Math.round(sketch.gripHalfSpan * 2 - sketch.shoulderHalfWidth * 2),
                    })}
                </Text>
            ) : (
                <Text style={styles.hint}>{t('geometry.view_front_assumed')}</Text>
            )}
            <Text style={styles.hint}>
                {t('geometry.springs_legend_front', { fork: Math.round(forkTravel) })}
            </Text>
            <Text style={styles.hint}>{t('geometry.view_front_hint')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
