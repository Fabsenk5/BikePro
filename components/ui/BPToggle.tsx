/**
 * BPToggle — Switch with label row
 * UI Supervisor: Dark row, accent-colored switch track
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';

const onAccent = theme.colors.onAccent;

interface BPToggleProps {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    accentColor?: string;
    description?: string;
    containerStyle?: ViewStyle;
}

export default function BPToggle({
    label,
    value,
    onValueChange,
    accentColor = theme.colors.accent,
    description,
    containerStyle,
}: BPToggleProps) {
    return (
        <View style={[styles.row, containerStyle]}>
            <View style={styles.textWrap}>
                <Text style={styles.label}>{label}</Text>
                {description && <Text style={styles.description}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: theme.colors.border, true: accentColor }}
                thumbColor={value ? onAccent : theme.colors.textMuted}
                accessibilityLabel={label}
                accessibilityState={{ checked: value }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        gap: theme.spacing.md,
    },
    textWrap: {
        flex: 1,
    },
    label: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    description: {
        color: theme.colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
});
