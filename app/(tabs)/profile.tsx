/**
 * Profile Screen — Shows user info, admin badge, stats, and logout.
 * If not logged in, shows login prompt.
 */
import { BPButton, BPCard } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { syncLoadPreference, syncLoadProfile, syncLoadTable, syncSaveProfile } from '@/lib/sync';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const ACCENT = theme.colors.accent;

export default function ProfileScreen() {
    const { user, isAdmin, isLoading, isConfigured, signOut } = useAuth();
    const { t, i18n } = useTranslation();
    const [rideCount, setRideCount] = useState(0);
    const [setupCount, setSetupCount] = useState(0);
    const [componentCount, setComponentCount] = useState(0);

    // Profile inputs
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [inseam, setInseam] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    const toggleLanguage = () => {
        const nextLang = i18n.language.startsWith('de') ? 'en' : 'de';
        i18n.changeLanguage(nextLang);
    };

    useEffect(() => {
        syncLoadTable('rides', '@bikepro_rides').then((d) => setRideCount(d.length));
        syncLoadTable('suspension_setups', '@bikepro_setups').then((d) => setSetupCount(d.length));
        syncLoadPreference<any[]>('shred_check', '@bikepro_components').then((d) => setComponentCount(d?.length ?? 0));

        syncLoadProfile().then((p) => {
            setWeight(p.weight ?? '');
            setHeight(p.height ?? '');
            setInseam(p.inseam ?? '');
        });
    }, [user]);

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        await syncSaveProfile({ weight, height, inseam });
        setTimeout(() => setSavingProfile(false), 500); // small delay for UX
    };

    const handleLogout = async () => {
        await signOut();
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={ACCENT} size="large" />
            </View>
        );
    }

    // Not logged in
    if (!user) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
                <View style={styles.center}>
                    <Text style={styles.avatar}>🔒</Text>
                    <Text style={styles.title}>{t('profile.not_logged_in.title')}</Text>
                    <Text style={styles.subtitle}>
                        {t('profile.not_logged_in.subtitle')}
                    </Text>
                    <View style={{ marginTop: theme.spacing.xl, width: '80%' }}>
                        <BPButton
                            title={`🔐 ${t('common.login_register')}`}
                            onPress={() => router.push('/auth')}
                            color={ACCENT}
                        />
                    </View>
                </View>
            </View>
        );
    }

    // Logged in
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* User info */}
                <View style={styles.headerWrap}>
                    <Text style={styles.avatar}>{isAdmin ? '👑' : '🚵'}</Text>
                    <Text style={styles.title}>{displayName}</Text>
                    <Text style={styles.email}>{user.email}</Text>

                    {isAdmin && (
                        <View style={styles.adminBadge}>
                            <Text style={styles.adminText}>⚡ ADMIN</Text>
                        </View>
                    )}

                    {!isConfigured && (
                        <View style={styles.offlineBadge}>
                            <Text style={styles.offlineText}>⚡ Offline-Modus</Text>
                        </View>
                    )}
                </View>

                {/* Stats */}
                <BPCard style={styles.statsCard}>
                    <Text style={styles.sectionTitle}>📊 {t('profile.stats.title')}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: theme.colors.accentLime }]}>{rideCount}</Text>
                            <Text style={styles.statLabel}>{t('profile.stats.rides')}</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: theme.colors.accentCyan }]}>{setupCount}</Text>
                            <Text style={styles.statLabel}>{t('profile.stats.setups')}</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: theme.colors.accentOrange }]}>{componentCount}</Text>
                            <Text style={styles.statLabel}>{t('profile.stats.parts')}</Text>
                        </View>
                    </View>
                </BPCard>

                {/* Account info */}
                <BPCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>🔐 Account</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>E-Mail</Text>
                        <Text style={styles.infoValue}>{user.email}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Rolle</Text>
                        <Text style={[styles.infoValue, isAdmin && { color: theme.colors.accentOrange }]}>
                            {isAdmin ? '👑 Admin' : '🚵 User'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Modus</Text>
                        <Text style={styles.infoValue}>
                            {isConfigured ? '☁️ Cloud (Supabase)' : '📱 Offline (Lokal)'}
                        </Text>
                    </View>
                </BPCard>
                {/* Rider Profile (Body metrics) */}
                <BPCard style={[styles.infoCard, { marginBottom: theme.spacing.md }]}>
                    <Text style={styles.sectionTitle}>⚖️ {t('profile.body_metrics', { defaultValue: 'Körperdaten (Für Berechnungen)' })}</Text>
                    <View style={styles.inputRow}>
                        <BPInput label="Gewicht (fahrfertig)" placeholder="z.B. 82" value={weight} onChangeText={setWeight} suffix="kg" keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} />
                    </View>
                    <View style={styles.inputRow}>
                        <BPInput label="Körpergröße" placeholder="z.B. 182" value={height} onChangeText={setHeight} suffix="cm" keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} />
                        <BPInput label="Schrittinnenlänge" placeholder="z.B. 86" value={inseam} onChangeText={setInseam} suffix="cm" keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} />
                    </View>
                    <View style={{ marginTop: theme.spacing.md }}>
                        <BPButton title={savingProfile ? "Speichere..." : "Daten speichern"} onPress={handleSaveProfile} color={theme.colors.accentCyan} size="md" variant={savingProfile ? 'secondary' : 'primary'} />
                    </View>
                </BPCard>

                {/* Settings & Language */}
                <BPCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>🌐 {t('profile.language')}</Text>
                    <View style={{ marginTop: theme.spacing.sm }}>
                        <BPButton
                            title={i18n.language.startsWith('de') ? t('profile.german') : t('profile.english')}
                            onPress={toggleLanguage}
                            variant="secondary"
                            color={ACCENT}
                            fullWidth
                        />
                    </View>
                </BPCard>

                {/* Logout */}
                <View style={{ marginTop: theme.spacing.lg }}>
                    <BPButton
                        title={`🚪 ${t('common.logout')}`}
                        onPress={handleLogout}
                        color="#F44336"
                        variant="secondary"
                        fullWidth
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    headerWrap: { alignItems: 'center', marginBottom: theme.spacing.xl },
    avatar: { fontSize: 64, marginBottom: theme.spacing.sm },
    title: { color: theme.colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 1 },
    subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: theme.spacing.sm, textAlign: 'center' },
    email: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
    adminBadge: {
        backgroundColor: theme.colors.accentOrange + '20',
        borderColor: theme.colors.accentOrange,
        borderWidth: 1, borderRadius: theme.radius.full,
        paddingHorizontal: 16, paddingVertical: 6, marginTop: theme.spacing.md,
    },
    adminText: { color: theme.colors.accentOrange, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    offlineBadge: {
        backgroundColor: theme.colors.accentCyan + '20',
        borderColor: theme.colors.accentCyan,
        borderWidth: 1, borderRadius: theme.radius.full,
        paddingHorizontal: 16, paddingVertical: 6, marginTop: theme.spacing.sm,
    },
    offlineText: { color: theme.colors.accentCyan, fontSize: 11, fontWeight: '700' },
    statsCard: { padding: theme.spacing.md, marginBottom: theme.spacing.md },
    sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.md },
    statsRow: { flexDirection: 'row', gap: theme.spacing.md },
    statCard: {
        flex: 1, backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, alignItems: 'center',
    },
    statValue: { fontSize: 28, fontWeight: '900' },
    statLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
    infoCard: { padding: theme.spacing.md },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    infoLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
    infoValue: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
});
