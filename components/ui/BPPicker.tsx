/**
 * BPPicker — Segment picker / dropdown component
 * UI Supervisor: Dark chips with neon active state
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

interface BPPickerOption {
    label: string;
    value: string;
}

interface BPPickerProps {
    label?: string;
    options: BPPickerOption[];
    value: string;
    onValueChange: (value: string) => void;
    accentColor?: string;
    containerStyle?: ViewStyle;
}

export default function BPPicker({
    label,
    options,
    value,
    onValueChange,
    accentColor = theme.colors.accent,
    containerStyle,
}: BPPickerProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionsRow}
            >
                {options.map((option) => {
                    const active = option.value === value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.chip,
                                active && { backgroundColor: accentColor, borderColor: accentColor },
                            ]}
                            onPress={() => onValueChange(option.value)}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    active && styles.chipTextActive,
                                ]}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    label: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    chipText: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#000',
        fontWeight: '700',
    },
});
