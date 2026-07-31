/**
 * BPCard — Content card component
 * UI Supervisor: Dark surface, subtle border, accent bar option
 */
import { theme } from '@/constants/Colors';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface BPCardProps {
    children: React.ReactNode;
    accentColor?: string;
    style?: StyleProp<ViewStyle>;
    noPadding?: boolean;
    onPress?: () => void;
}

export default function BPCard({
    children,
    accentColor,
    style,
    noPadding = false,
    onPress,
}: BPCardProps) {
    const content = (
        <>
            {accentColor && (
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
            )}
            {children}
        </>
    );

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.card,
                    !noPadding && styles.padded,
                    (hovered || pressed) && styles.hover,
                    style,
                ]}
            >
                {content}
            </Pressable>
        );
    }

    return (
        <View style={[styles.card, !noPadding && styles.padded, style]}>
            {content}
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
    hover: {
        backgroundColor: theme.colors.surfaceHover,
    },
});
