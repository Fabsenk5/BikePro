/**
 * BPEmptyState — Placeholder for empty lists/sections
 * UI Supervisor: Muted icon, centered copy, optional action button
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import BPButton from './BPButton';

interface BPEmptyStateProps {
    icon: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    containerStyle?: ViewStyle;
}

export default function BPEmptyState({
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
    containerStyle,
}: BPEmptyStateProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {actionLabel && onAction && (
                <BPButton
                    title={actionLabel}
                    onPress={onAction}
                    variant="secondary"
                    size="sm"
                    style={styles.action}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
    },
    icon: {
        fontSize: 40,
        marginBottom: theme.spacing.md,
        opacity: 0.7,
    },
    title: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: theme.colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 19,
    },
    action: {
        marginTop: theme.spacing.md,
    },
});
