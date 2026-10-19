/**
 * F12: Lenker-Finder — MTB handlebar comparison (Bar Finder).
 *
 * Curated, research-verified handlebar DB (constants/handlebars.ts) plus
 * user-added bars. Fit recommendation from profile + current cockpit,
 * wishlist via user_preferences, one-tap adopt into the Component Tracker.
 */
import {
    BPButton,
    BPChip,
    BPCard,
    BPEmptyState,
    BPInput,
    BPModal,
    BPPicker,
    BPSearchInput,
    BPSegmentedControl,
    BPToggle,
    screenContentStyle,
} from '@/components/ui';
import { theme } from '@/constants/Colors';
import { HANDLEBARS, HandlebarEntry } from '@/constants/handlebars';
import {
    BarFilter,
    BarStyle,
    barTarget,
    EMPTY_FILTER,
    matchesFilter,
    scoreBars,
} from '@/lib/barFinder';
import { showAlert } from '@/lib/dialog';
import {
    newId,
    SyncBike,
    SyncComponent,
    syncLoadBikes,
    syncLoadPreference,
    syncLoadPrimaryBikeId,
    syncLoadProfile,
    syncSavePreference,
    syncUpdateComponent,
} from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#FF9800';
const WISHLIST_KEY = 'bar_wishlist';
const WISHLIST_STORAGE = '@bikepro_bar_wishlist';
const CUSTOM_KEY = 'bar_custom';
const CUSTOM_STORAGE = '@bikepro_bar_custom';

const toNum = (value?: string | null): number | null => {
    if (value == null) return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const toMm = (value?: string | null, minCm?: number, maxCm?: number): number | null => {
    const n = toNum(value);
    if (n == null) return null;
    if (minCm != null && (n < minCm || (maxCm != null && n > maxCm))) return null;
    return n * 10;
};
const todayISO = () => new Date().toISOString().split('T')[0];

const EMPTY_CUSTOM = {
    brand: '',
    model: '',
    widths: '',
    rises: '',
    backsweep: '',
    upsweep: '',
    clamp: '35',
    material: 'alloy' as 'carbon' | 'alloy',
    weight: '',
    price: '',
    colors: '',
    usp: '',
};

export default function BarFinderScreen() {
    const { t, i18n } = useTranslation();
    const lang: 'de' | 'en' = i18n.language.startsWith('de') ? 'de' : 'en';
    const [bikes, setBikes] = useState<SyncBike[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState('');
    const [heightMm, setHeightMm] = useState<number | null>(null);
    const [shoulderMm, setShoulderMm] = useState<number | null>(null);
    const [style, setStyle] = useState<BarStyle>('balanced');
    const [handPressure, setHandPressure] = useState(false);
    const [barTooHigh, setBarTooHigh] = useState(false);
    const [filter, setFilter] = useState<BarFilter>(EMPTY_FILTER);
    const [wishlist, setWishlist] = useState<string[]>([]);
    const [customBars, setCustomBars] = useState<HandlebarEntry[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [adoptRise, setAdoptRise] = useState('');
    const [customOpen, setCustomOpen] = useState(false);
    const [custom, setCustom] = useState(EMPTY_CUSTOM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const [bikesData, primaryId, profile, savedWishlist, savedCustom] = await Promise.all([
            syncLoadBikes(),
            syncLoadPrimaryBikeId(),
            syncLoadProfile(),
            syncLoadPreference<string[]>(WISHLIST_KEY, WISHLIST_STORAGE),
            syncLoadPreference<HandlebarEntry[]>(CUSTOM_KEY, CUSTOM_STORAGE),
        ]);
        setBikes(bikesData);
        setSelectedBikeId(prev => {
            if (prev) return prev;
            if (primaryId && bikesData.some(b => b.id === primaryId)) return primaryId;
            return bikesData[0]?.id ?? '';
        });
        if (profile) {
            setHeightMm(toMm(profile.height, 100, 250));
            setShoulderMm(toMm(profile.shoulderWidth, 25, 70));
        }
        if (Array.isArray(savedWishlist)) setWishlist(savedWishlist);
        if (Array.isArray(savedCustom)) setCustomBars(savedCustom.filter(b => b?.custom));
    }, []);

    useEffect(() => {
        load();
    }, [load]);
    useRefreshOnForeground(load);

    const selectedBike = bikes.find(b => b.id === selectedBikeId);
    const currentWidth = toNum(selectedBike?.geometry?.cockpit?.barWidth?.toString());
    const currentRise =
        toNum(selectedBike?.geometry?.cockpit?.barRise?.toString())
        ?? (() => {
            const bar = selectedBike?.components.find(c => c.type === 'handlebar');
            const raw = bar?.setupValues.find(s => s.key === 'Rise')?.value;
            return toNum(raw);
        })();

    const target = useMemo(
        () =>
            barTarget({
                heightMm,
                shoulderMm,
                currentWidthMm: currentWidth,
                currentRiseMm: currentRise,
                style,
                handPressure,
                barTooHigh,
            }),
        [heightMm, shoulderMm, currentWidth, currentRise, style, handPressure, barTooHigh],
    );

    const allBars = useMemo(() => [...customBars, ...HANDLEBARS], [customBars]);
    const ranked = useMemo(() => {
        const scored = scoreBars(allBars, {
            widthMm: target.widthMm,
            riseMm: target.riseMm,
            minBacksweepDeg: target.minBacksweepDeg,
        });
        return scored.filter(s => matchesFilter(s.entry, filter, wishlist.includes(s.entry.id)));
    }, [allBars, target, filter, wishlist]);

    const toggleWishlist = useCallback(
        async (id: string) => {
            const next = wishlist.includes(id) ? wishlist.filter(w => w !== id) : [...wishlist, id];
            setWishlist(next);
            await syncSavePreference(WISHLIST_KEY, WISHLIST_STORAGE, next);
        },
        [wishlist],
    );

    const adoptBar = useCallback(
        async (entry: HandlebarEntry, riseMm: number, widthMm: number) => {
            if (!selectedBike) {
                showAlert(t('barfinder.title'), t('barfinder.no_bike'));
                return;
            }
            setSaving(true);
            try {
                const usp = entry.usp[lang];
                const comp: SyncComponent = {
                    id: newId(),
                    type: 'handlebar',
                    brand: entry.brand,
                    model: entry.model,
                    weight: entry.weightG != null ? String(entry.weightG) : '',
                    price: entry.priceEur != null ? String(entry.priceEur) : '',
                    purchaseDate: todayISO(),
                    setupValues: [
                        { key: 'Breite', value: String(widthMm), unit: 'mm' },
                        { key: 'Rise', value: String(riseMm), unit: 'mm' },
                        { key: 'Backsweep', value: String(entry.backsweepDeg), unit: '°' },
                        { key: 'Upsweep', value: String(entry.upsweepDeg), unit: '°' },
                    ],
                    notes: `Lenker-Finder (${todayISO()})${usp ? ` – ${usp}` : ''}`,
                };
                const ok = await syncUpdateComponent(selectedBike.id, comp);
                showAlert(
                    t('barfinder.title'),
                    ok
                        ? t('barfinder.adopted', { bike: selectedBike.name, width: widthMm, rise: riseMm })
                        : t('barfinder.adopt_failed'),
                );
                if (ok) router.push('/(features)/component-tracker');
            } finally {
                setSaving(false);
            }
        },
        [selectedBike, t, lang],
    );

    const saveCustom = useCallback(async () => {
        const widths = custom.widths.split(/[,;]/).map(s => parseFloat(s.replace(',', '.'))).filter(n => Number.isFinite(n) && n >= 600 && n <= 900);
        const rises = custom.rises.split(/[,;]/).map(s => parseFloat(s.replace(',', '.'))).filter(n => Number.isFinite(n) && n >= 0 && n <= 80);
        const back = parseFloat(custom.backsweep.replace(',', '.'));
        const up = parseFloat(custom.upsweep.replace(',', '.'));
        if (!custom.brand.trim() || !custom.model.trim() || widths.length === 0 || rises.length === 0 || !Number.isFinite(back) || !Number.isFinite(up)) {
            showAlert(t('barfinder.title'), t('barfinder.custom_invalid'));
            return;
        }
        const entry: HandlebarEntry = {
            id: `custom-${Date.now()}`,
            brand: custom.brand.trim(),
            model: custom.model.trim(),
            widthsMm: widths,
            risesMm: rises,
            backsweepDeg: back,
            upsweepDeg: up,
            clampsMm: custom.clamp === 'both' ? [31.8, 35] : [parseFloat(custom.clamp)],
            weightG: toNum(custom.weight),
            priceEur: toNum(custom.price),
            priceChecked: todayISO(),
            colors: custom.colors.split(/[,;]/).map(s => s.trim()).filter(Boolean),
            material: custom.material,
            tags: [],
            usp: { de: custom.usp.trim(), en: custom.usp.trim() },
            verified: todayISO(),
            custom: true,
        };
        const next = [entry, ...customBars];
        setCustomBars(next);
        await syncSavePreference(CUSTOM_KEY, CUSTOM_STORAGE, next);
        setCustom(EMPTY_CUSTOM);
        setCustomOpen(false);
        showAlert(t('barfinder.title'), t('barfinder.custom_added', { name: `${entry.brand} ${entry.model}` }));
    }, [custom, customBars, t]);

    const openSource = (url?: string | null) => {
        if (url) Linking.openURL(url).catch(() => undefined);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('barfinder.title') }} />
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={screenContentStyle} showsVerticalScrollIndicator={false}>
                <BPCard style={styles.card}>
                    <Text style={styles.cardTitle}>🎯 {t('barfinder.target_title')}</Text>
                    {bikes.length > 0 && (
                        <BPPicker
                            label={t('barfinder.bike_label')}
                            options={bikes.map(b => ({ label: b.name, value: b.id }))}
                            value={selectedBikeId}
                            onValueChange={setSelectedBikeId}
                            accentColor={ACCENT}
                        />
                    )}
                    <BPSegmentedControl
                        options={[
                            { label: t('barfinder.style_playful'), value: 'playful' },
                            { label: t('barfinder.style_balanced'), value: 'balanced' },
                            { label: t('barfinder.style_stable'), value: 'stable' },
                        ]}
                        value={style}
                        onChange={v => setStyle(v as BarStyle)}
                        accentColor={ACCENT}
                        containerStyle={{ marginBottom: theme.spacing.sm }}
                    />
                    <BPToggle
                        label={t('barfinder.hands_label')}
                        description={t('barfinder.hands_description')}
                        value={handPressure}
                        onValueChange={setHandPressure}
                        accentColor={ACCENT}
                    />
                    <BPToggle
                        label={t('barfinder.high_label')}
                        description={t('barfinder.high_description')}
                        value={barTooHigh}
                        onValueChange={setBarTooHigh}
                        accentColor={ACCENT}
                        containerStyle={{ marginTop: theme.spacing.sm }}
                    />
                    <Text style={styles.hint}>
                        {t('barfinder.target_line', { width: target.widthMm, rise: target.riseMm })}
                    </Text>
                    {target.gripDeltaMm != null && shoulderMm != null && (
                        <Text style={styles.hint}>
                            {t('barfinder.grip_info', { delta: Math.round(target.gripDeltaMm), shoulder: Math.round(shoulderMm) })}
                        </Text>
                    )}
                    {target.minBacksweepDeg != null && (
                        <Text style={styles.hint}>{t('barfinder.sweep_info', { deg: target.minBacksweepDeg })}</Text>
                    )}
                </BPCard>

                <BPCard style={styles.card}>
                    <Text style={styles.cardTitle}>🔍 {t('barfinder.filter_title')}</Text>
                    <BPSearchInput
                        value={filter.query}
                        onChangeText={v => setFilter(prev => ({ ...prev, query: v }))}
                        placeholder={t('barfinder.search_placeholder')}
                        accentColor={ACCENT}
                    />
                    <BPSegmentedControl
                        options={[
                            { label: t('barfinder.material_all'), value: 'all' },
                            { label: t('barfinder.material_carbon'), value: 'carbon' },
                            { label: t('barfinder.material_alloy'), value: 'alloy' },
                        ]}
                        value={filter.material}
                        onChange={v => setFilter(prev => ({ ...prev, material: v as BarFilter['material'] }))}
                        accentColor={ACCENT}
                        containerStyle={{ marginVertical: theme.spacing.sm }}
                    />
                    <BPSegmentedControl
                        options={[
                            { label: t('barfinder.clamp_all'), value: 'all' },
                            { label: '31.8', value: '31.8' },
                            { label: '35', value: '35' },
                        ]}
                        value={filter.clamp}
                        onChange={v => setFilter(prev => ({ ...prev, clamp: v as BarFilter['clamp'] }))}
                        accentColor={ACCENT}
                        containerStyle={{ marginBottom: theme.spacing.sm }}
                    />
                    <BPToggle
                        label={t('barfinder.wishlist_only')}
                        value={filter.wishlistOnly}
                        onValueChange={v => setFilter(prev => ({ ...prev, wishlistOnly: v }))}
                        accentColor={ACCENT}
                    />
                </BPCard>

                <BPCard style={styles.card}>
                    <Text style={styles.cardTitle}>🚲 {t('barfinder.list_title', { count: ranked.length })}</Text>
                    {ranked.length === 0 && (
                        <BPEmptyState icon="🚲" title={t('barfinder.empty_title')} subtitle={t('barfinder.empty_subtitle')} />
                    )}
                    {ranked.map(({ entry, score, matchedWidthMm, matchedRiseMm }, index) => {
                        const expanded = expandedId === entry.id;
                        const usp = entry.usp[lang];
                        return (
                            <View key={entry.id} style={styles.barBlock}>
                                <View style={styles.barHead}>
                                    <Text style={styles.barName}>
                                        {entry.brand} {entry.model}
                                    </Text>
                                    {index === 0 && ranked.length > 1 && (
                                        <BPChip small label={t('barfinder.top_match')} color={ACCENT} selected />
                                    )}
                                </View>
                                <Text style={styles.barSpecs}>
                                    {entry.widthsMm.join('/')} mm · {t('barfinder.rise_label')} {entry.risesMm.join('/')} mm ·{' '}
                                    {entry.backsweepDeg}°/{entry.upsweepDeg}° · Ø {entry.clampsMm.join('/')} ·{' '}
                                    {t(`barfinder.material_${entry.material}`)}
                                </Text>
                                <View style={styles.chipRow}>
                                    {entry.tags.map(tag => (
                                        <BPChip key={tag} small label={t(`barfinder.tag_${tag}`)} color={ACCENT} />
                                    ))}
                                    {entry.custom && <BPChip small label={t('barfinder.custom_badge')} color={ACCENT} selected />}
                                </View>
                                <Text style={styles.hint}>
                                    {t('barfinder.recommended_line', { width: matchedWidthMm ?? '–', rise: matchedRiseMm ?? '–' })}
                                    {entry.weightG != null ? ` · ${entry.weightG} g${entry.weightNote ? ` (${entry.weightNote})` : ''}` : ''}
                                    {entry.priceEur != null
                                        ? ` · ${entry.priceEur} € (${t('barfinder.price_asof', { date: entry.priceChecked ?? '–' })})`
                                        : ` · ${t('barfinder.price_check')}`}
                                </Text>
                                <View style={styles.buttonRow}>
                                    <BPButton
                                        title={expanded ? t('barfinder.hide_details') : t('barfinder.show_details')}
                                        onPress={() => {
                                            setExpandedId(expanded ? null : entry.id);
                                            setAdoptRise('');
                                        }}
                                        variant="secondary"
                                        color={ACCENT}
                                        size="sm"
                                    />
                                    <BPButton
                                        title={wishlist.includes(entry.id) ? t('barfinder.unbookmark') : t('barfinder.bookmark')}
                                        onPress={() => toggleWishlist(entry.id)}
                                        variant={wishlist.includes(entry.id) ? 'primary' : 'secondary'}
                                        color={ACCENT}
                                        size="sm"
                                    />
                                </View>
                                {expanded && (
                                    <View style={styles.detailsBox}>
                                        {usp ? <Text style={styles.hint}>★ {usp}</Text> : null}
                                        {entry.colors.length > 0 && (
                                            <Text style={styles.hint}>
                                                {t('barfinder.colors_label')}: {entry.colors.join(', ')}
                                            </Text>
                                        )}
                                        <Text style={styles.hint}>
                                            {t('barfinder.verified_line', { date: entry.verified })}
                                            {entry.source ? ` · ${entry.source.replace(/^https?:\/\//, '').split('/')[0]}` : ''}
                                        </Text>
                                        {entry.shopUrl ? (
                                            <Text style={styles.link} onPress={() => openSource(entry.shopUrl)}>
                                                {t('barfinder.shop_link')}
                                            </Text>
                                        ) : null}
                                        <BPPicker
                                            label={t('barfinder.adopt_rise_label')}
                                            options={entry.risesMm.map(r => ({ label: `${r} mm`, value: String(r) }))}
                                            value={adoptRise || String(matchedRiseMm ?? entry.risesMm[0])}
                                            onValueChange={setAdoptRise}
                                            accentColor={ACCENT}
                                        />
                                        <BPButton
                                            title={t('barfinder.adopt', { name: `${entry.brand} ${entry.model}` })}
                                            onPress={() =>
                                                adoptBar(
                                                    entry,
                                                    parseInt(adoptRise || String(matchedRiseMm ?? entry.risesMm[0]), 10),
                                                    matchedWidthMm ?? entry.widthsMm[entry.widthsMm.length - 1],
                                                )
                                            }
                                            variant="primary"
                                            color={ACCENT}
                                            size="sm"
                                            disabled={saving || bikes.length === 0}
                                        />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </BPCard>

                <BPCard style={styles.card}>
                    <Text style={styles.cardTitle}>➕ {t('barfinder.custom_title')}</Text>
                    <Text style={styles.hint}>{t('barfinder.custom_hint')}</Text>
                    <BPButton
                        title={t('barfinder.custom_open')}
                        onPress={() => setCustomOpen(true)}
                        variant="secondary"
                        color={ACCENT}
                        size="sm"
                    />
                </BPCard>
            </ScrollView>

            <BPModal visible={customOpen} onClose={() => setCustomOpen(false)} title={t('barfinder.custom_title')} variant="sheet">
                <View>
                    <View style={styles.inputRow}>
                        <BPInput label={t('barfinder.custom_brand')} value={custom.brand} onChangeText={v => setCustom(p => ({ ...p, brand: v }))} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                        <BPInput label={t('barfinder.custom_model')} value={custom.model} onChangeText={v => setCustom(p => ({ ...p, model: v }))} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    </View>
                    <View style={styles.inputRow}>
                        <BPInput label={t('barfinder.custom_widths')} value={custom.widths} onChangeText={v => setCustom(p => ({ ...p, widths: v }))} keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                        <BPInput label={t('barfinder.custom_rises')} value={custom.rises} onChangeText={v => setCustom(p => ({ ...p, rises: v }))} keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    </View>
                    <View style={styles.inputRow}>
                        <BPInput label={t('barfinder.custom_backsweep')} value={custom.backsweep} onChangeText={v => setCustom(p => ({ ...p, backsweep: v }))} keyboardType="numeric" suffix="°" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                        <BPInput label={t('barfinder.custom_upsweep')} value={custom.upsweep} onChangeText={v => setCustom(p => ({ ...p, upsweep: v }))} keyboardType="numeric" suffix="°" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    </View>
                    <BPSegmentedControl
                        options={[
                            { label: '31.8', value: '31.8' },
                            { label: '35', value: '35' },
                            { label: t('barfinder.custom_clamp_both'), value: 'both' },
                        ]}
                        value={custom.clamp}
                        onChange={v => setCustom(p => ({ ...p, clamp: v }))}
                        accentColor={ACCENT}
                        containerStyle={{ marginVertical: theme.spacing.sm }}
                    />
                    <BPSegmentedControl
                        options={[
                            { label: t('barfinder.material_carbon'), value: 'carbon' },
                            { label: t('barfinder.material_alloy'), value: 'alloy' },
                        ]}
                        value={custom.material}
                        onChange={v => setCustom(p => ({ ...p, material: v as 'carbon' | 'alloy' }))}
                        accentColor={ACCENT}
                        containerStyle={{ marginBottom: theme.spacing.sm }}
                    />
                    <View style={styles.inputRow}>
                        <BPInput label={t('barfinder.custom_weight')} value={custom.weight} onChangeText={v => setCustom(p => ({ ...p, weight: v }))} keyboardType="numeric" suffix="g" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                        <BPInput label={t('barfinder.custom_price')} value={custom.price} onChangeText={v => setCustom(p => ({ ...p, price: v }))} keyboardType="numeric" suffix="€" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    </View>
                    <BPInput label={t('barfinder.custom_colors')} value={custom.colors} onChangeText={v => setCustom(p => ({ ...p, colors: v }))} accentColor={ACCENT} />
                    <BPInput label={t('barfinder.custom_usp')} value={custom.usp} onChangeText={v => setCustom(p => ({ ...p, usp: v }))} accentColor={ACCENT} />
                    <BPButton
                        title={t('barfinder.custom_save')}
                        onPress={saveCustom}
                        variant="primary"
                        color={ACCENT}
                        size="sm"
                        style={{ marginTop: theme.spacing.md }}
                    />
                </View>
            </BPModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { marginBottom: theme.spacing.md },
    cardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: theme.spacing.sm },
    hint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: theme.spacing.xs },
    link: { color: ACCENT, fontSize: 12, lineHeight: 17, marginTop: theme.spacing.xs, textDecorationLine: 'underline' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.xs },
    buttonRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    barBlock: { paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border + '60' },
    barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    barName: { color: theme.colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
    barSpecs: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
    detailsBox: { marginTop: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: 8 },
});
