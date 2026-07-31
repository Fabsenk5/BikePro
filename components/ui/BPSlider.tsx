import { theme } from '@/constants/Colors';
import Slider from '@react-native-community/slider';
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
    formatValue?: (value: number) => string;
    containerStyle?: ViewStyle;
    disabled?: boolean;
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
    formatValue,
    containerStyle,
    disabled,
}: BPSliderProps) {
    const display = (v: number) => (formatValue ? formatValue(v) : `${v}${unit}`);

    const handleIncrement = useCallback(() => {
        if (disabled) return;
        const v = Number(value) || 0;
        const s = Number(step) || 1;
        const next = Math.min(Number(max), v + s);
        onValueChange(Math.round((next + Number.EPSILON) * 1000) / 1000);
    }, [value, max, step, onValueChange, disabled]);

    const handleDecrement = useCallback(() => {
        if (disabled) return;
        const v = Number(value) || 0;
        const s = Number(step) || 1;
        const next = Math.max(Number(min), v - s);
        onValueChange(Math.round((next + Number.EPSILON) * 1000) / 1000);
    }, [value, min, step, onValueChange, disabled]);

    const handleSlide = useCallback((v: number) => {
        onValueChange(Math.round((v + Number.EPSILON) * 1000) / 1000);
    }, [onValueChange]);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <View style={styles.headerRow}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={[styles.valueText, { color: accentColor }]}>
                        {display(value)}
                    </Text>
                </View>
            )}

            <View style={styles.sliderRow}>
                {/* Minus button */}
                <TouchableOpacity
                    style={[styles.stepButton, { borderColor: accentColor }]}
                    onPress={handleDecrement}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={disabled}
                >
                    <Text style={styles.stepButtonText}>−</Text>
                </TouchableOpacity>

                {/* Draggable track */}
                <Slider
                    style={styles.slider}
                    value={Number(value) || 0}
                    minimumValue={min}
                    maximumValue={max}
                    step={step}
                    onValueChange={handleSlide}
                    minimumTrackTintColor={accentColor}
                    maximumTrackTintColor={theme.colors.elevated}
                    thumbTintColor={accentColor}
                    disabled={disabled}
                />

                {/* Plus button */}
                <TouchableOpacity
                    style={[styles.stepButton, { borderColor: accentColor }]}
                    onPress={handleIncrement}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={disabled}
                >
                    <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.rangeRow}>
                <Text style={styles.rangeText}>{display(min)}</Text>
                <Text style={styles.rangeText}>{display(max)}</Text>
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
    slider: {
        flex: 1,
        height: 36,
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
