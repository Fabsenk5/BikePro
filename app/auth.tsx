/**
 * Auth Screen — Login / Register / Password Reset
 * Styled consistently with BikePro dark theme.
 */
import { BPButton, BPCard, BPInput, screenContentStyle } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { showAlert } from '@/lib/dialog';
import { getSupabase } from '@/lib/supabase';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

type Mode = 'login' | 'register' | 'forgot';

export default function AuthScreen() {
    const { signIn, signUp, signOut, isConfigured, isPasswordRecovery } = useAuth();
    const { t } = useTranslation();
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            setError(t('auth.error_missing'));
            return;
        }
        if (password.length < 8) {
            setError(t('auth.error_short'));
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const result = mode === 'login'
            ? await signIn(email.trim(), password)
            : await signUp(email.trim(), password);

        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            if (mode === 'register' && isConfigured) {
                setSuccess(t('auth.success_register'));
            } else {
                router.replace('/(tabs)/profile');
            }
        }
    };

    const handleResetRequest = async () => {
        if (!email.trim()) {
            setError(t('auth.error_missing_email'));
            return;
        }
        const supabase = getSupabase();
        if (!supabase) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        const redirectTo = Platform.OS === 'web' ? window.location.origin : undefined;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo }
        );

        setLoading(false);

        if (resetError) {
            showAlert(t('auth.title'), resetError.message);
        } else {
            setSuccess(t('auth.success_reset_email'));
        }
    };

    const handleSetNewPassword = async () => {
        if (password.length < 8) {
            setError(t('auth.error_short'));
            return;
        }
        const supabase = getSupabase();
        if (!supabase) return;

        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
        } else {
            showAlert(t('auth.title'), t('auth.success_password_updated'));
            // Sign out so the user logs in fresh with the new password
            await signOut();
            setPassword('');
            setMode('login');
        }
    };

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
        setSuccess(null);
    };

    const subtitle = isPasswordRecovery
        ? t('auth.recovery_title')
        : mode === 'login'
            ? t('auth.welcome_back')
            : mode === 'register'
                ? t('auth.create_account')
                : t('auth.forgot_title');

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: `🔐 ${t('auth.title')}`,
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
                        <Text style={styles.logoSub}>{subtitle}</Text>
                    </View>

                    {/* Mode info */}
                    {!isConfigured && (
                        <View style={styles.offlineBanner}>
                            <Text style={styles.offlineText}>
                                {t('auth.offline_mode')}
                            </Text>
                        </View>
                    )}

                    {/* Password recovery form (arrived via reset link) */}
                    {isPasswordRecovery ? (
                        <BPCard style={styles.formCard}>
                            <BPInput
                                label={t('auth.new_password_label')}
                                placeholder={t('auth.password_placeholder')}
                                value={password}
                                onChangeText={(v) => { setPassword(v); setError(null); }}
                                secureTextEntry
                                selectionColor={ACCENT}
                            />

                            {error && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>❌ {error}</Text>
                                </View>
                            )}

                            <View style={{ marginTop: theme.spacing.md }}>
                                <BPButton
                                    title={t('auth.btn_set_password')}
                                    onPress={handleSetNewPassword}
                                    color={ACCENT}
                                    loading={loading}
                                />
                            </View>
                        </BPCard>
                    ) : mode === 'forgot' ? (
                        /* Forgot-password form */
                        <BPCard style={styles.formCard}>
                            <Text style={styles.hintText}>{t('auth.forgot_hint')}</Text>

                            <BPInput
                                label={t('auth.email_label')}
                                placeholder={t('auth.email_placeholder')}
                                value={email}
                                onChangeText={(v) => { setEmail(v); setError(null); }}
                                keyboardType="email-address"
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
                                <BPButton
                                    title={t('auth.btn_send_reset')}
                                    onPress={handleResetRequest}
                                    color={ACCENT}
                                    loading={loading}
                                />
                            </View>

                            <BPButton
                                title={t('auth.back_to_login')}
                                onPress={() => switchMode('login')}
                                variant="ghost"
                                color={ACCENT}
                                size="sm"
                                style={styles.toggleBtn}
                            />
                        </BPCard>
                    ) : (
                        /* Login / Register form */
                        <BPCard style={styles.formCard}>
                            <BPInput
                                label={t('auth.email_label')}
                                placeholder={t('auth.email_placeholder')}
                                value={email}
                                onChangeText={(v) => { setEmail(v); setError(null); }}
                                keyboardType="email-address"
                                selectionColor={ACCENT}
                            />

                            <BPInput
                                label={t('auth.password_label')}
                                placeholder={t('auth.password_placeholder')}
                                value={password}
                                onChangeText={(v) => { setPassword(v); setError(null); }}
                                secureTextEntry
                                selectionColor={ACCENT}
                            />

                            {mode === 'login' && isConfigured && (
                                <TouchableOpacity
                                    onPress={() => switchMode('forgot')}
                                    style={styles.forgotBtn}
                                >
                                    <Text style={styles.forgotText}>
                                        {t('auth.forgot_password')}
                                    </Text>
                                </TouchableOpacity>
                            )}

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
                                <BPButton
                                    title={mode === 'login' ? t('auth.btn_login') : t('auth.btn_register')}
                                    onPress={handleSubmit}
                                    color={ACCENT}
                                    loading={loading}
                                />
                            </View>

                            <BPButton
                                title={mode === 'login'
                                    ? t('auth.toggle_to_register')
                                    : t('auth.toggle_to_login')}
                                onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                variant="ghost"
                                color={ACCENT}
                                size="sm"
                                style={styles.toggleBtn}
                            />
                        </BPCard>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: {
        ...screenContentStyle,
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
    hintText: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: theme.spacing.md },
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
    toggleBtn: { marginTop: theme.spacing.lg, alignSelf: 'center' },
    forgotBtn: { alignSelf: 'flex-end', marginTop: theme.spacing.xs },
    forgotText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
