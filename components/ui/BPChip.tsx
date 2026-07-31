/**
 * BPChip — Selectable tag chip
 * UI Supervisor: Pill chip, accent selected state, optional small size
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

const onAccent = theme.colors.onAccent;

interface BPChipProps {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    color?: string;
    small?: boolean;
    style?: ViewStyle;
}

export default function BPChip({
    label,
    selected = false,
    onPress,
    color = theme.colors.accent,
    small = false,
    style,
}: BPChipProps) {
    return (
        <TouchableOpacity
            style={[
                styles.chip,
                small && styles.chipSmall,
                selected && { backgroundColor: color, borderColor: color },
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={!onPress}
        >
            <Text
                style={[
                    styles.chipText,
                    small && styles.chipTextSmall,
                    selected && styles.chipTextSelected,
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    chipSmall: {
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    chipText: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextSmall: {
        fontSize: 11,
    },
    chipTextSelected: {
        color: onAccent,
        fontWeight: '700',
    },
});
