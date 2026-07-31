/**
 * Profile Screen — Shows user info, admin badge, stats, and logout.
 * If not logged in, shows login prompt.
 */
import { BPButton, BPCard, BPInput, BPPicker, screenContentStyle } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { showAlert } from '@/lib/dialog';
import { syncLoadBikes, syncLoadPreference, syncLoadProfile, syncLoadTable, syncSavePreference, syncSaveProfile } from '@/lib/sync';
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

const UNITS_KEY = '@bikepro_units';
const LB_PER_KG = 2.20462;

interface UnitsPref {
    pressure: 'bar' | 'psi';
    weight: 'kg' | 'lb';
}

/** Format a kg value (stored string) for display in the given weight unit */
function formatWeightForUnit(kgStr: string, unit: 'kg' | 'lb'): string {
    const kg = parseFloat(kgStr);
    if (isNaN(kg)) return kgStr;
    if (unit === 'lb') return String(Math.round(kg * LB_PER_KG * 10) / 10);
    return kgStr;
}

/** Convert a user input value in the given unit to a kg string (internal storage unit) */
function weightInputToKg(input: number, unit: 'kg' | 'lb'): number {
    return unit === 'lb' ? input / LB_PER_KG : input;
}

export default function ProfileScreen() {
    const { user, isAdmin, isLoading, isConfigured, signOut } = useAuth();
    const { t, i18n } = useTranslation();
    const [rideCount, setRideCount] = useState(0);
    const [setupCount, setSetupCount] = useState(0);
    const [componentCount, setComponentCount] = useState(0);
    const [loadingTimedOut, setLoadingTimedOut] = useState(false);

    // Profile inputs
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [inseam, setInseam] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [weightError, setWeightError] = useState('');
    const [heightError, setHeightError] = useState('');
    const [inseamError, setInseamError] = useState('');

    // Units preference (pressure bar/psi, weight kg/lb); weight is stored internally in kg
    const [units, setUnits] = useState<UnitsPref>({
        pressure: i18n.language.startsWith('de') ? 'bar' : 'psi',
        weight: 'kg',
    });

    const toggleLanguage = () => {
        const nextLang = i18n.language.startsWith('de') ? 'en' : 'de';
        i18n.changeLanguage(nextLang);
    };

    // Loading timeout — show error state after 8s instead of infinite spinner
    useEffect(() => {
        if (!isLoading) {
            setLoadingTimedOut(false);
            return;
        }
        const timer = setTimeout(() => setLoadingTimedOut(true), 8000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    useEffect(() => {
        syncLoadTable('rides', '@bikepro_rides').then((d) => setRideCount(d.length)).catch(() => {});
        syncLoadTable('suspension_setups', '@bikepro_setups').then((d) => setSetupCount(d.length)).catch(() => {});
        syncLoadBikes().then((bikes) => setComponentCount(bikes.reduce((sum, b) => sum + b.components.length, 0))).catch(() => {});

        (async () => {
            const stored = await syncLoadPreference<UnitsPref>('units', UNITS_KEY).catch(() => null);
            const pref: UnitsPref = stored ?? {
                pressure: i18n.language.startsWith('de') ? 'bar' : 'psi',
                weight: 'kg',
            };
            setUnits(pref);
            try {
                const p = await syncLoadProfile();
                setWeight(p.weight ? formatWeightForUnit(p.weight, pref.weight) : '');
                setHeight(p.height ?? '');
                setInseam(p.inseam ?? '');
            } catch {}
        })();
    }, [user]);

    const handleUnitsChange = (patch: Partial<UnitsPref>) => {
        // Keep the displayed weight value consistent when toggling kg/lb
        if (patch.weight && patch.weight !== units.weight && weight.trim()) {
            const parsed = parseFloat(weight.replace(',', '.'));
            if (!isNaN(parsed)) {
                const kg = weightInputToKg(parsed, units.weight);
                setWeight(formatWeightForUnit(String(kg), patch.weight));
            }
        }
        const next = { ...units, ...patch };
        setUnits(next);
        syncSavePreference('units', UNITS_KEY, next);
    };

    const handleSaveProfile = async () => {
        // Validate numeric fields (accept comma as decimal separator); empty = unset
        const wInput = weight.trim() ? parseFloat(weight.replace(',', '.')) : null;
        const h = height.trim() ? parseFloat(height.replace(',', '.')) : null;
        const i = inseam.trim() ? parseFloat(inseam.replace(',', '.')) : null;

        // Weight input is in the selected unit; validate and store internally in kg
        const wKg = wInput !== null && !isNaN(wInput) ? weightInputToKg(wInput, units.weight) : wInput;

        const wErr = wKg !== null && (isNaN(wKg) || wKg < 20 || wKg > 300) ? t('profile.error_weight') : '';
        const hErr = h !== null && (isNaN(h) || h < 50 || h > 250) ? t('profile.error_height') : '';
        const iErr = i !== null && (isNaN(i) || i < 30 || i > 120) ? t('profile.error_inseam') : '';
        setWeightError(wErr);
        setHeightError(hErr);
        setInseamError(iErr);
        if (wErr || hErr || iErr) return;

        setSavingProfile(true);
        const weightKg = wKg !== null && !isNaN(wKg) ? String(Math.round(wKg * 10) / 10) : '';
        const ok = await syncSaveProfile({ weight: weightKg, height, inseam });
        setSavingProfile(false);
        if (!ok) {
            showAlert(t('profile.save_error_title'), t('profile.save_error_msg'));
        }
    };

    const handleLogout = async () => {
        await signOut();
    };

    if (isLoading && !loadingTimedOut) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={ACCENT} size="large" />
            </View>
        );
    }

    if (isLoading && loadingTimedOut) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
                <Text style={[styles.title, { fontSize: 20 }]}>{t('profile.connection_title')}</Text>
                <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                    {t('profile.connection_msg')}
                </Text>
                <View style={{ width: '80%' }}>
                    <BPButton
                        title={t('profile.retry')}
                        onPress={() => {
                            setLoadingTimedOut(false);
                            // Force re-render by navigating to self
                            router.replace('/(tabs)/profile');
                        }}
                        color={ACCENT}
                    />
                </View>
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
                            <Text style={styles.offlineText}>{t('profile.offline_badge')}</Text>
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
                        <Text style={styles.infoLabel}>{t('profile.role_label')}</Text>
                        <Text style={[styles.infoValue, isAdmin && { color: theme.colors.accentOrange }]}>
                            {isAdmin ? t('profile.role_admin') : t('profile.role_user')}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{t('profile.mode_label')}</Text>
                        <Text style={styles.infoValue}>
                            {isConfigured ? t('profile.mode_cloud') : t('profile.mode_offline')}
                        </Text>
                    </View>
                </BPCard>
                {/* Rider Profile (Body metrics) */}
                <BPCard style={[styles.infoCard, { marginBottom: theme.spacing.md }]}>
                    <Text style={styles.sectionTitle}>⚖️ {t('profile.body_metrics')}</Text>
                    <View style={styles.inputRow}>
                        <BPInput label={t('profile.weight_label')} placeholder="z.B. 82" value={weight} onChangeText={setWeight} suffix={units.weight} keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} error={weightError} />
                    </View>
                    <View style={styles.inputRow}>
                        <BPInput label={t('profile.height_label')} placeholder="z.B. 182" value={height} onChangeText={setHeight} suffix="cm" keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} error={heightError} />
                        <BPInput label={t('profile.inseam_label')} placeholder="z.B. 86" value={inseam} onChangeText={setInseam} suffix="cm" keyboardType="numeric" accentColor={theme.colors.accentCyan} containerStyle={{ flex: 1 }} error={inseamError} />
                    </View>
                    <View style={{ marginTop: theme.spacing.md }}>
                        <BPButton title={savingProfile ? t('profile.saving') : t('profile.save_data')} onPress={handleSaveProfile} color={theme.colors.accentCyan} size="md" variant={savingProfile ? 'secondary' : 'primary'} />
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

                {/* Units */}
                <BPCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>📏 {t('profile.units.title')}</Text>
                    <BPPicker
                        label={t('profile.units.pressure')}
                        options={[{ label: 'bar', value: 'bar' }, { label: 'psi', value: 'psi' }]}
                        value={units.pressure}
                        onValueChange={(v) => handleUnitsChange({ pressure: v as UnitsPref['pressure'] })}
                        accentColor={ACCENT}
                    />
                    <BPPicker
                        label={t('profile.units.weight')}
                        options={[{ label: 'kg', value: 'kg' }, { label: 'lb', value: 'lb' }]}
                        value={units.weight}
                        onValueChange={(v) => handleUnitsChange({ weight: v as UnitsPref['weight'] })}
                        accentColor={ACCENT}
                        containerStyle={{ marginBottom: 0 }}
                    />
                </BPCard>

                {/* Logout */}
                <View style={{ marginTop: theme.spacing.lg }}>
                    <BPButton
                        title={`🚪 ${t('common.logout')}`}
                        onPress={handleLogout}
                        variant="danger"
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
    scrollContent: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
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
