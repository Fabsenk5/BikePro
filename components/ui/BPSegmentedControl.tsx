/**
 * BPSegmentedControl — Segmented option row
 * UI Supervisor: Full-width segments, accent active segment
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const onAccent = theme.colors.onAccent;

interface BPSegmentedOption {
    label: string;
    value: string;
}

interface BPSegmentedControlProps {
    options: BPSegmentedOption[];
    value: string;
    onChange: (value: string) => void;
    accentColor?: string;
    containerStyle?: ViewStyle;
}

export default function BPSegmentedControl({
    options,
    value,
    onChange,
    accentColor = theme.colors.accent,
    containerStyle,
}: BPSegmentedControlProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {options.map((option, index) => {
                const active = option.value === value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            styles.segment,
                            active && { backgroundColor: accentColor },
                            index > 0 && styles.segmentDivider,
                        ]}
                        onPress={() => onChange(option.value)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: active }}
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                active && styles.segmentTextActive,
                            ]}
                            numberOfLines={1}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 3,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 8,
        borderRadius: theme.radius.sm,
    },
    segmentDivider: {
        marginLeft: 3,
    },
    segmentText: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: onAccent,
        fontWeight: '700',
    },
});
