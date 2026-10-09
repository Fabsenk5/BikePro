/**
 * SagCalculator — target sag in % and mm for the selected bike, plus the
 * manufacturer recommendation for the rider's weight when a spec table exists.
 * Embedded in the Setup Guide articles "Grundsetup" and "SAG".
 */
import { BPButton, BPCard, BPPicker, BPSegmentedControl } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { formatSpecSummary, resolveSpecRow } from '@/lib/specTable';
import { sagRangeMm, SagCharacter, SagRange, SAG_TARGETS, travelStrokeDefaults } from '@/lib/suspensionDefaults';
import { SyncBike, syncLoadBikes, syncLoadPreference, syncLoadProfile } from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

const ACCENT = theme.colors.accentCyan;
const PRIMARY_BIKE_KEY = '@bikepro_primary_bike';

export default function SagCalculator() {
    const { t, i18n } = useTranslation();
    const [bikes, setBikes] = useState<SyncBike[]>([]);
    const [bikeId, setBikeId] = useState('');
    const [character, setCharacter] = useState<SagCharacter>('balanced');
    const [weightKg, setWeightKg] = useState<number | null>(null);

    const load = useCallback(() => {
        Promise.all([
            syncLoadBikes(),
            syncLoadPreference<string>('primary_bike', PRIMARY_BIKE_KEY),
            syncLoadProfile(),
        ]).then(([bikesData, primaryId, profile]) => {
            setBikes(bikesData ?? []);
            setBikeId(prev => prev || primaryId || bikesData?.[0]?.id || '');
            const w = parseFloat(profile?.weight ?? '');
            setWeightKg(Number.isFinite(w) && w > 0 ? w : null);
        }).catch(() => {});
    }, []);

    useEffect(load, [load]);
    useRefreshOnForeground(load);

    const bike = bikes.find(b => b.id === bikeId);
    const targets = SAG_TARGETS[character];

    const suspensionMm = useMemo(() => {
        const fork = bike?.components.find(c => c.type === 'fork');
        const forkTravel = parseFloat(fork?.setupValues?.find(s => s.key === 'travel')?.value ?? '');
        const shock = bike?.components.find(c => c.type === 'shock');
        const shockStroke = parseFloat(shock?.setupValues?.find(s => s.key === 'stroke')?.value ?? '');
        const fallback = travelStrokeDefaults(bike?.type);
        return {
            fork: Number.isFinite(forkTravel) && forkTravel > 0 ? forkTravel : fallback.travel,
            shock: Number.isFinite(shockStroke) && shockStroke > 0 ? shockStroke : fallback.stroke,
        };
    }, [bike]);

    const specLines = useMemo(() => {
        if (!bike || weightKg === null) return [];
        const lines: { key: string; label: string; values: string; nearest: boolean; source?: string }[] = [];
        for (const type of ['fork', 'shock'] as const) {
            const comp = bike.components.find(c => c.type === type);
            if (!comp?.specTable?.length) continue;
            const resolved = resolveSpecRow(comp.specTable, weightKg);
            if (!resolved) continue;
            const summary = formatSpecSummary(resolved.row);
            if (!summary) continue;
            lines.push({
                key: type,
                label: t(type === 'fork' ? 'setup_guide.sag_fork_label' : 'setup_guide.sag_shock_label'),
                values: summary,
                nearest: resolved.fallback,
                source: comp.specSource || undefined,
            });
        }
        return lines;
    }, [bike, weightKg, t]);

    const hasSpecTable = !!bike?.components.some(c =>
        (c.type === 'fork' || c.type === 'shock') && (c.specTable?.length ?? 0) > 0);

    const specTarget = bike?.components.find(c => c.type === 'fork') ?? bike?.components.find(c => c.type === 'shock');

    const fmtPct = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 1 });

    const fmtPctRange = (range: SagRange) =>
        range.min === range.max ? fmtPct(range.min) : `${fmtPct(range.min)}–${fmtPct(range.max)}`;

    const fmtMm = (v: number) =>
        v.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const fmtMmRange = (range: SagRange) =>
        range.min === range.max ? fmtMm(range.min) : `${fmtMm(range.min)}–${fmtMm(range.max)}`;

    const forkMm = sagRangeMm(targets.fork, suspensionMm.fork);
    const shockMm = sagRangeMm(targets.shock, suspensionMm.shock);

    return (
        <BPCard accentColor={ACCENT} style={styles.card}>
            <Text style={styles.title}>{t('setup_guide.sag_widget_title')}</Text>

            <BPPicker
                label={t('setup_guide.sag_widget_bike')}
                options={[
                    { label: t('setup_guide.sag_widget_no_bike_label'), value: '' },
                    ...bikes.map(b => ({ label: b.name, value: b.id })),
                ]}
                value={bikeId}
                onValueChange={setBikeId}
                accentColor={ACCENT}
            />

            <BPSegmentedControl
                options={[
                    { label: t('setup_guide.sag_char_firm'), value: 'firm' },
                    { label: t('setup_guide.sag_char_balanced'), value: 'balanced' },
                    { label: t('setup_guide.sag_char_comfortable'), value: 'comfortable' },
                ]}
                value={character}
                onChange={(v) => setCharacter(v as SagCharacter)}
                accentColor={ACCENT}
                containerStyle={{ marginBottom: theme.spacing.md }}
            />

            {bike ? (
                <View>
                    <View style={styles.targetRow}>
                        <Text style={styles.targetLabel}>🔱 {t('setup_guide.sag_fork_label')}</Text>
                        <Text style={styles.targetValue}>
                            {fmtPctRange(targets.fork)} % → {fmtMmRange(forkMm)} mm
                        </Text>
                    </View>
                    <View style={styles.targetRow}>
                        <Text style={styles.targetLabel}>🔩 {t('setup_guide.sag_shock_label')}</Text>
                        <Text style={styles.targetValue}>
                            {fmtPctRange(targets.shock)} % → {fmtMmRange(shockMm)} mm
                        </Text>
                    </View>
                    <Text style={styles.hint}>{t('setup_guide.sag_mm_hint')}</Text>

                    {specLines.length > 0 && weightKg !== null && (
                        <View style={styles.specBox}>
                            <Text style={styles.specHeading}>
                                {t('setup_guide.sag_spec_heading', { weight: weightKg })}
                            </Text>
                            {specLines.map(line => (
                                <Text key={line.key} style={styles.specLine}>
                                    {line.label}: {line.values}
                                    {line.nearest ? ` (${t('setup_guide.sag_spec_nearest')})` : ''}
                                    {line.source ? ` · ${t('setup_guide.sag_spec_source_label')}: ${line.source}` : ''}
                                </Text>
                            ))}
                        </View>
                    )}
                    {hasSpecTable && weightKg === null && (
                        <Text style={styles.hint}>{t('setup_guide.sag_no_weight')}</Text>
                    )}
                    {!hasSpecTable && (
                        <View>
                            <Text style={styles.hint}>{t('setup_guide.sag_no_spec')}</Text>
                            {specTarget && (
                                <BPButton
                                    title={t('setup_guide.sag_add_spec')}
                                    onPress={() => router.push({ pathname: '/(features)/component-tracker', params: { editComponent: specTarget.id } })}
                                    variant="secondary"
                                    color={ACCENT}
                                    size="sm"
                                    style={{ marginTop: 4 }}
                                />
                            )}
                        </View>
                    )}
                </View>
            ) : (
                <Text style={styles.hint}>
                    {t('setup_guide.sag_without_bike_text', {
                        fork: fmtPctRange(targets.fork),
                        shock: fmtPctRange(targets.shock),
                    })}
                </Text>
            )}

            <View style={styles.buttons}>
                <BPButton
                    title={t('setup_guide.sag_create_bike')}
                    onPress={() => router.push({ pathname: '/(features)/component-tracker', params: { newBike: '1' } })}
                    variant="outline"
                    color={ACCENT}
                    size="sm"
                    style={{ flex: 1 }}
                />
                <BPButton
                    title={t('setup_guide.sag_to_pressure')}
                    onPress={() => router.push({ pathname: '/(features)/pressure-bot', params: bikeId ? { bikeId } : {} })}
                    variant="secondary"
                    color={ACCENT}
                    size="sm"
                    style={{ flex: 1 }}
                    disabled={!bike}
                />
            </View>
        </BPCard>
    );
}

const styles = StyleSheet.create({
    card: { marginTop: 12, padding: theme.spacing.md, backgroundColor: theme.colors.elevated },
    title: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: theme.spacing.md },
    targetRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    targetLabel: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
    targetValue: { color: ACCENT, fontSize: 14, fontWeight: '800' },
    hint: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing.sm, lineHeight: 17 },
    specBox: {
        marginTop: theme.spacing.sm, padding: theme.spacing.sm,
        backgroundColor: theme.colors.background, borderRadius: theme.radius.sm,
        borderWidth: 1, borderColor: ACCENT + '40',
    },
    specHeading: { color: theme.colors.text, fontSize: 12, fontWeight: '800', marginBottom: 4 },
    specLine: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
    buttons: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
});
