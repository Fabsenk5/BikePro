import { theme } from '@/constants/Colors';
import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
            <View style={styles.content}>
                <Text style={styles.avatar}>👤</Text>
                <Text style={styles.title}>Dein Profil</Text>
                <Text style={styles.subtitle}>
                    Login & Einstellungen kommen bald.
                </Text>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Rides</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Setups</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Parks</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    avatar: {
        fontSize: 64,
        marginBottom: theme.spacing.md,
    },
    title: {
        color: theme.colors.text,
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 1,
    },
    subtitle: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        marginTop: theme.spacing.sm,
        textAlign: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    statCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        alignItems: 'center',
        minWidth: 80,
    },
    statValue: {
        color: theme.colors.accent,
        fontSize: 24,
        fontWeight: '900',
    },
    statLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
