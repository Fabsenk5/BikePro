/**
 * F13: Body Scan — Foto-Overlay zum Antippen von Punkten.
 *
 * Das Bild wird exakt im Seitenverhältnis gerendert (kein Letterboxing),
 * dadurch mappen Taps linear auf normalisierte Koordinaten (0..1).
 * Punkte + Verbindungslinien als SVG-Overlay (Skelett-Vorschau).
 */
import { theme } from '@/constants/Colors';
import React, { useCallback, useState } from 'react';
import {
    Image,
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { NormPoint } from '@/lib/bodyScan';

interface TapPoint {
    id: string;
    label: string;
    point: NormPoint | null;
}

interface BodySkeletonOverlayProps {
    imageUri: string;
    imageAspect: number;
    points: TapPoint[];
    activeId: string | null;
    connections?: [string, string][];
    accentColor?: string;
    onTap: (point: NormPoint) => void;
}

export default function BodySkeletonOverlay({
    imageUri,
    imageAspect,
    points,
    activeId,
    connections = [],
    accentColor = theme.colors.accent,
    onTap,
}: BodySkeletonOverlayProps) {
    const [box, setBox] = useState({ w: 0, h: 0 });

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
    }, []);

    const handlePress = useCallback(
        (e: any) => {
            const native = e?.nativeEvent ?? {};
            let lx: number | undefined = native.locationX;
            let ly: number | undefined = native.locationY;
            if ((lx == null || ly == null) && box.w > 0) {
                // Fallback (Web): aus Client-Koordinaten + Bounding-Box rechnen
                const target = e?.currentTarget as unknown as
                    | { getBoundingClientRect?: () => { left: number; top: number } }
                    | undefined;
                const rect = target?.getBoundingClientRect?.();
                const cx = native.clientX ?? native.pageX;
                const cy = native.clientY ?? native.pageY;
                if (rect && cx != null && cy != null) {
                    lx = cx - rect.left;
                    ly = cy - rect.top;
                }
            }
            if (lx == null || ly == null || box.w <= 0 || box.h <= 0) return;
            const nx = Math.min(1, Math.max(0, lx / box.w));
            const ny = Math.min(1, Math.max(0, ly / box.h));
            onTap({ x: nx, y: ny });
        },
        [box, onTap],
    );

    const byId = new Map(points.map(p => [p.id, p.point]));

    return (
        <View
            style={[styles.box, { aspectRatio: imageAspect }]}
            onLayout={handleLayout}
            accessibilityLabel="Foto mit Messpunkten"
        >
            <Image
                source={{ uri: imageUri }}
                style={styles.image}
                // Aspect der Box == Bild-Aspect (aspectRatio-Prop) → stretch ist verzerrungsfrei.
                resizeMode="stretch"
            />
            <Svg
                style={StyleSheet.absoluteFillObject}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                pointerEvents="none"
            >
                {connections.map(([a, b], i) => {
                    const pa = byId.get(a);
                    const pb = byId.get(b);
                    if (!pa || !pb) return null;
                    return (
                        <Line
                            key={`${a}-${b}-${i}`}
                            x1={pa.x * 100}
                            y1={pa.y * 100}
                            x2={pb.x * 100}
                            y2={pb.y * 100}
                            stroke={accentColor}
                            strokeWidth={0.7}
                            strokeLinecap="round"
                            opacity={0.9}
                        />
                    );
                })}
                {points.map(p =>
                    p.point ? (
                        <Circle
                            key={p.id}
                            cx={p.point.x * 100}
                            cy={p.point.y * 100}
                            r={1.4}
                            fill={p.id === activeId ? '#fff' : accentColor}
                            stroke={p.id === activeId ? accentColor : '#00000088'}
                            strokeWidth={0.4}
                        />
                    ) : null,
                )}
                {points.map(p =>
                    p.point && p.id === activeId ? (
                        <Circle
                            key={`ring-${p.id}`}
                            cx={p.point.x * 100}
                            cy={p.point.y * 100}
                            r={2.6}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={0.5}
                            strokeDasharray="1 0.8"
                        />
                    ) : null,
                )}
            </Svg>
            <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel="Punkt setzen"
            />
            {/* Nummern-Badges für gesetzte Punkte (lesbar, nicht nur Dots) */}
            {points.map((p, i) =>
                p.point ? (
                    <View
                        key={`n-${p.id}`}
                        pointerEvents="none"
                        style={[
                            styles.badge,
                            {
                                left: `${p.point.x * 100}%`,
                                top: `${p.point.y * 100}%`,
                                backgroundColor: p.id === activeId ? '#fff' : accentColor,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                { color: p.id === activeId ? accentColor : theme.colors.onAccent },
                            ]}
                        >
                            {i + 1}
                        </Text>
                    </View>
                ) : null,
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    box: {
        width: '100%',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    badge: {
        position: 'absolute',
        width: 20,
        height: 20,
        marginLeft: -22,
        marginTop: -22,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
});
