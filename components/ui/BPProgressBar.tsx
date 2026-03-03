/**
 * BPProgressBar — Wear & tear progress bar
 * UI Supervisor: Neon fill with color thresholds (green → yellow → red)
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface BPProgressBarProps {
    label?: string;
    value: number; // 0–100
    max?: number;
    unit?: string;
    showPercentage?: boolean;
    colorThresholds?: boolean; // auto green/yellow/red
    accentColor?: string;
    containerStyle?: ViewStyle;
}

function getThresholdColor(pct: number): string {
    if (pct < 50) return theme.colors.accentLime;
    if (pct < 80) return theme.colors.accentYellow;
    return theme.colors.accentRed;
}

export default function BPProgressBar({
    label,
    value,
    max = 100,
    unit = '%',
    showPercentage = true,
    colorThresholds = true,
    accentColor,
    containerStyle,
}: BPProgressBarProps) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    const fillColor = accentColor
        ? accentColor
        : colorThresholds
            ? getThresholdColor(pct)
            : theme.colors.accent;

    return (
        <View style={[styles.container, containerStyle]}>
            {(label || showPercentage) && (
                <View style={styles.headerRow}>
                    {label && <Text style={styles.label}>{label}</Text>}
                    {showPercentage && (
                        <Text style={[styles.valueText, { color: fillColor }]}>
                            {Math.round(pct)}{unit}
                        </Text>
                    )}
                </View>
            )}
            <View style={styles.track}>
                <View
                    style={[
                        styles.fill,
                        { width: `${pct}%`, backgroundColor: fillColor },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    label: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    valueText: {
        fontSize: 14,
        fontWeight: '800',
    },
    track: {
        height: 8,
        backgroundColor: theme.colors.elevated,
        borderRadius: 4,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
});
