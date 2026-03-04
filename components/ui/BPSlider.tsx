import { theme } from '@/constants/Colors';
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface BPSliderProps {
    label?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    accentColor?: string;
    onValueChange: (value: number) => void;
    containerStyle?: ViewStyle;
}

export default function BPSlider({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    accentColor = theme.colors.accent,
    onValueChange,
    containerStyle,
}: BPSliderProps) {
    const progress = Math.max(0, Math.min(1, (value - min) / (max - min)));

    const handleIncrement = useCallback(() => {
        const next = Math.min(max, value + step);
        onValueChange(Math.round(next * 100) / 100);
    }, [value, max, step, onValueChange]);

    const handleDecrement = useCallback(() => {
        const next = Math.max(min, value - step);
        onValueChange(Math.round(next * 100) / 100);
    }, [value, min, step, onValueChange]);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <View style={styles.headerRow}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={[styles.valueText, { color: accentColor }]}>
                        {value}{unit}
                    </Text>
                </View>
            )}

            <View style={styles.sliderRow}>
                {/* Minus button */}
                <TouchableOpacity
                    style={[styles.stepButton, { borderColor: accentColor }]}
                    onPress={handleDecrement}
                    activeOpacity={0.6}
                >
                    <Text style={styles.stepButtonText}>−</Text>
                </TouchableOpacity>

                {/* Track */}
                <View style={styles.track}>
                    <View
                        style={[
                            styles.fill,
                            {
                                width: `${progress * 100}%`,
                                backgroundColor: accentColor,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.glow,
                            {
                                width: `${progress * 100}%`,
                                backgroundColor: accentColor,
                            },
                        ]}
                    />
                </View>

                {/* Plus button */}
                <TouchableOpacity
                    style={[styles.stepButton, { borderColor: accentColor }]}
                    onPress={handleIncrement}
                    activeOpacity={0.6}
                >
                    <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.rangeRow}>
                <Text style={styles.rangeText}>{min}{unit}</Text>
                <Text style={styles.rangeText}>{max}{unit}</Text>
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
        marginBottom: 8,
    },
    label: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    valueText: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        backgroundColor: theme.colors.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepButtonText: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 22,
    },
    track: {
        flex: 1,
        height: 8,
        backgroundColor: theme.colors.elevated,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
    glow: {
        position: 'absolute',
        top: -2,
        left: 0,
        height: 12,
        borderRadius: 6,
        opacity: 0.2,
    },
    rangeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    rangeText: {
        color: theme.colors.textMuted,
        fontSize: 10,
        fontWeight: '500',
    },
});
