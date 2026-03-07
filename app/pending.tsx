import { BPButton, BPCard } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function PendingScreen() {
    const { signOut } = useAuth();
    const { t } = useTranslation();

    const handleSignOut = async () => {
        await signOut();
        router.replace('/auth');
    };

    return (
        <View style={styles.container}>
            <BPCard style={styles.card}>
                <Text style={styles.emoji}>🚧</Text>
                <Text style={styles.title}>Account Pending</Text>
                <Text style={styles.description}>
                    Deine Registrierung war erfolgreich! Die BikePro App befindet sich aktuell in der geschlossenen Beta.
                    Dein Account muss erst von einem Administrator freigeschaltet werden, bevor du dich einloggen und die App nutzen kannst.
                </Text>

                <View style={styles.buttonContainer}>
                    <BPButton title="Zurück zum Login" onPress={handleSignOut} />
                </View>
            </BPCard>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    card: {
        padding: theme.spacing.xl,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 64,
        marginBottom: theme.spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: theme.spacing.xl,
    },
    buttonContainer: {
        width: '100%',
    },
});
