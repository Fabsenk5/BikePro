import { BPButton, BPCard } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function PendingScreen() {
    const { signOut, activationError, retryActivation } = useAuth();
    const { t } = useTranslation();
    const [retrying, setRetrying] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        router.replace('/auth');
    };

    const handleRetry = async () => {
        setRetrying(true);
        try {
            await retryActivation();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <View style={styles.container}>
            <BPCard style={styles.card}>
                <Text style={styles.emoji}>{activationError ? '📡' : '🚧'}</Text>
                <Text style={styles.title}>
                    {activationError ? t('pending.error_title') : t('pending.title')}
                </Text>
                <Text style={styles.description}>
                    {activationError ? t('pending.error_msg') : t('pending.description')}
                </Text>

                <View style={styles.buttonContainer}>
                    {activationError && (
                        <BPButton
                            title={t('pending.retry')}
                            onPress={handleRetry}
                            loading={retrying}
                            style={styles.retryButton}
                        />
                    )}
                    <BPButton title={t('pending.back_to_login')} variant="secondary" onPress={handleSignOut} />
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
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
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
    retryButton: {
        marginBottom: theme.spacing.sm,
    },
});
