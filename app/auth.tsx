/**
 * Auth Screen — Login / Register
 * Styled consistently with BikePro dark theme.
 */
import { BPButton, BPCard, BPInput } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = theme.colors.accent;

export default function AuthScreen() {
    const { signIn, signUp, isConfigured } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Bitte E-Mail und Passwort eingeben.');
            return;
        }
        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const result = isLogin
            ? await signIn(email.trim(), password)
            : await signUp(email.trim(), password);

        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            if (!isLogin && isConfigured) {
                setSuccess('Registrierung erfolgreich! Prüfe deine E-Mail zur Bestätigung.');
            } else {
                router.replace('/(tabs)/profile');
            }
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '🔐 Anmeldung',
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo */}
                    <View style={styles.logoWrap}>
                        <Text style={styles.logoEmoji}>🚵</Text>
                        <Text style={styles.logoTitle}>BikePro</Text>
                        <Text style={styles.logoSub}>
                            {isLogin ? 'Willkommen zurück!' : 'Erstelle deinen Account'}
                        </Text>
                    </View>

                    {/* Mode info */}
                    {!isConfigured && (
                        <View style={styles.offlineBanner}>
                            <Text style={styles.offlineText}>
                                ⚡ Offline-Modus — Daten werden lokal gespeichert
                            </Text>
                        </View>
                    )}

                    {/* Form */}
                    <BPCard style={styles.formCard}>
                        <BPInput
                            label="E-Mail"
                            placeholder="deine@email.de"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setError(null); }}
                            keyboardType="email-address"
                            selectionColor={ACCENT}
                        />

                        <BPInput
                            label="Passwort"
                            placeholder="••••••••"
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(null); }}
                            secureTextEntry
                            selectionColor={ACCENT}
                        />

                        {error && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>❌ {error}</Text>
                            </View>
                        )}

                        {success && (
                            <View style={styles.successBox}>
                                <Text style={styles.successText}>✅ {success}</Text>
                            </View>
                        )}

                        <View style={{ marginTop: theme.spacing.md }}>
                            {loading ? (
                                <ActivityIndicator color={ACCENT} size="large" />
                            ) : (
                                <BPButton
                                    title={isLogin ? '🔐 Einloggen' : '🚀 Registrieren'}
                                    onPress={handleSubmit}
                                    color={ACCENT}
                                />
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
                            style={styles.toggleBtn}
                        >
                            <Text style={styles.toggleText}>
                                {isLogin
                                    ? 'Noch kein Account? → Registrieren'
                                    : 'Schon registriert? → Einloggen'}
                            </Text>
                        </TouchableOpacity>
                    </BPCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: {
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        justifyContent: 'center',
        flexGrow: 1,
    },
    logoWrap: { alignItems: 'center', marginBottom: theme.spacing.xl },
    logoEmoji: { fontSize: 64, marginBottom: theme.spacing.sm },
    logoTitle: {
        color: theme.colors.text, fontSize: 32, fontWeight: '900',
        letterSpacing: 2, textTransform: 'uppercase',
    },
    logoSub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
    offlineBanner: {
        backgroundColor: theme.colors.accentOrange + '20',
        borderColor: theme.colors.accentOrange,
        borderWidth: 1, borderRadius: theme.radius.md,
        padding: theme.spacing.sm, marginBottom: theme.spacing.md,
        alignItems: 'center',
    },
    offlineText: { color: theme.colors.accentOrange, fontSize: 12, fontWeight: '600' },
    formCard: { padding: theme.spacing.lg },
    errorBox: {
        backgroundColor: '#F4433620', borderRadius: theme.radius.md,
        padding: theme.spacing.sm, marginTop: theme.spacing.sm,
    },
    errorText: { color: '#F44336', fontSize: 13, fontWeight: '600' },
    successBox: {
        backgroundColor: '#4CAF5020', borderRadius: theme.radius.md,
        padding: theme.spacing.sm, marginTop: theme.spacing.sm,
    },
    successText: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
    toggleBtn: { marginTop: theme.spacing.lg, alignItems: 'center' },
    toggleText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
});
