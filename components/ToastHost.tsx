/**
 * ToastHost — renders the toast queue from lib/toast.ts.
 * Mounted once in app/_layout.tsx above the screens.
 * Dark card with accent border per type; fixed bottom-center on web.
 */
import { theme } from '@/constants/Colors';
import { dismissToast, getToasts, subscribeToasts, Toast, ToastType } from '@/lib/toast';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const typeAccent: Record<ToastType, string> = {
    success: theme.colors.accentLime,
    error: theme.colors.accentRed,
    info: theme.colors.accent,
};

export default function ToastHost() {
    const [toasts, setToasts] = useState<Toast[]>(getToasts());

    useEffect(() => subscribeToasts(setToasts), []);

    if (toasts.length === 0) return null;

    return (
        <View style={styles.host} pointerEvents="box-none" accessibilityLiveRegion="polite">
            {toasts.map((toast) => (
                <Pressable
                    key={toast.id}
                    onPress={() => dismissToast(toast.id)}
                    style={[styles.toast, { borderLeftColor: typeAccent[toast.type] }]}
                    accessibilityRole="alert"
                >
                    {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
                    <Text style={styles.message}>{toast.message}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
        bottom: theme.spacing.lg,
        left: 0,
        right: 0,
        alignItems: 'center',
        gap: theme.spacing.sm,
        zIndex: 9999,
        paddingHorizontal: theme.spacing.md,
    },
    toast: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderLeftWidth: 3,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        maxWidth: 420,
        width: '100%',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    title: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    message: {
        color: theme.colors.textSecondary,
        fontSize: 13,
    },
});
