/**
 * BPCard — Content card component
 * UI Supervisor: Dark surface, subtle border, accent bar option
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface BPCardProps {
    children: React.ReactNode;
    accentColor?: string;
    style?: StyleProp<ViewStyle>;
    noPadding?: boolean;
}

export default function BPCard({
    children,
    accentColor,
    style,
    noPadding = false,
}: BPCardProps) {
    return (
        <View style={[styles.card, !noPadding && styles.padded, style]}>
            {accentColor && (
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
            )}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        position: 'relative',
    },
    padded: {
        padding: theme.spacing.md,
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
});
