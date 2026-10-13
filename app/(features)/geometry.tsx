/**
 * F11: Geometrie & Fit — Sitz- und Stehgeometrie über Bikes hinweg vergleichen.
 *
 * Daten: bikes.geometry (Rahmen-Specs, Cockpit, Sitzwerte, Zollstock-Messwerte),
 * vorbefüllt aus dem Component Tracker (Lenker/Vorbau/Sattel) und dem Profil
 * (Körpermaße). Rechenlogik, Zielbänder und Symptom-Engine in lib/geometry.ts.
 */
import { BPButton, BPCard, BPChip, BPEmptyState, BPInput, BPPicker, BPSegmentedControl, BPSlider, screenContentStyle } from '@/components/ui';
import BikeSideView from '@/components/BikeSideView';
import BikeFrontView from '@/components/BikeFrontView';
import { theme } from '@/constants/Colors';
import { showAlert } from '@/lib/dialog';
import {
    assumedSaddleSetback,
    BikeGeometry,
    computeContactGeometry,
    Discipline,
    DISCIPLINE_REFERENCES,
    evaluateFit,
    FitCheck,
    recommendForSymptoms,
    RiderBody,
    saddleHeightTarget,
    sanitizeGeometry,
    stripComputedMeasured,
    SymptomId,
    SYMPTOMS,
} from '@/lib/geometry';
import { CrankMode, DEFAULT_DROPPER_TRAVEL, RiderMode, wheelRadii } from '@/lib/bikeSketch';
import { SyncBike, syncLoadBikes, syncLoadPrimaryBikeId, syncLoadProfile, syncSaveBikes } from '@/lib/sync';
import { travelStrokeDefaults } from '@/lib/suspensionDefaults';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const ACCENT = '#00BFA5';

type Tab = 'analysis' | 'frame' | 'cockpit' | 'measured' | 'compare';

interface GeometryForm {
    // frame
    stack: string; reach: string; headAngle: string; seatAngle: string;
    chainstay: string; wheelbase: string; bbDrop: string; seatTube: string; headTube: string;
    size: string; wheelSize: string;
    // cockpit
    barRise: string; backsweep: string; upsweep: string; barWidth: string;
    stemLength: string; stemAngle: string; spacers: string; crankLength: string;
    // fit
    saddleHeight: string; saddleSetback: string;
    // measured
    mBarX: string; mBarY: string; mSeatedReach: string; mDrop: string; mBbHeight: string;
    // meta
    source: string;
}

const EMPTY_FORM: GeometryForm = {
    stack: '', reach: '', headAngle: '', seatAngle: '', chainstay: '', wheelbase: '', bbDrop: '', seatTube: '', headTube: '', size: '', wheelSize: '',
    barRise: '', backsweep: '', upsweep: '', barWidth: '', stemLength: '', stemAngle: '', spacers: '', crankLength: '',
    saddleHeight: '', saddleSetback: '',
    mBarX: '', mBarY: '', mSeatedReach: '', mDrop: '', mBbHeight: '',
    source: '',
};

const toNum = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

const str = (value: number | string | undefined): string =>
    value === undefined || value === null ? '' : String(value);

/** Format a number for input fields using the locale decimal separator (63,5 in DE). */
const numStr = (value: number, language: string): string => {
    const s = String(value);
    return language.startsWith('de') ? s.replace('.', ',') : s;
};

/** First non-empty setup value for one of the given keys. */
const setupVal = (comp: any, keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = comp?.setupValues?.find((s: any) => s.key === key)?.value;
        if (value !== undefined && String(value).trim() !== '') return String(value);
    }
    return undefined;
};

const disciplineForBikeType = (type?: string): Discipline => {
    switch (type) {
        case 'xc': return 'tour';
        case 'trail': return 'trail';
        case 'downhill':
        case 'dirt': return 'dh';
        default: return 'enduro';
    }
};

const buildGeometryFromForm = (f: GeometryForm): BikeGeometry => ({
    frame: {
        stack: toNum(f.stack), reach: toNum(f.reach), headAngle: toNum(f.headAngle), seatAngle: toNum(f.seatAngle),
        chainstay: toNum(f.chainstay), wheelbase: toNum(f.wheelbase), bbDrop: toNum(f.bbDrop), seatTube: toNum(f.seatTube),
        headTube: toNum(f.headTube),
        size: f.size.trim() || undefined, wheelSize: f.wheelSize.trim() || undefined,
    },
    cockpit: {
        barRise: toNum(f.barRise), backsweep: toNum(f.backsweep), upsweep: toNum(f.upsweep), barWidth: toNum(f.barWidth),
        stemLength: toNum(f.stemLength), stemAngle: toNum(f.stemAngle), spacers: toNum(f.spacers), crankLength: toNum(f.crankLength),
    },
    fit: { saddleHeight: toNum(f.saddleHeight), saddleSetback: toNum(f.saddleSetback) },
    measured: {
        barX: toNum(f.mBarX), barY: toNum(f.mBarY), seatedReach: toNum(f.mSeatedReach),
        saddleToBarDrop: toNum(f.mDrop), bbHeight: toNum(f.mBbHeight),
    },
    meta: { source: f.source.trim() || undefined },
});

export default function GeometryScreen() {
    const { t, i18n } = useTranslation();
    const [bikes, setBikes] = useState<SyncBike[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState('');
    const [discipline, setDiscipline] = useState<Discipline>('enduro');
    const [tab, setTab] = useState<Tab>('analysis');
    const [symptoms, setSymptoms] = useState<SymptomId[]>([]);
    const [referenceBikeId, setReferenceBikeId] = useState('');
    const [rider, setRider] = useState<RiderBody>({});
    const [form, setForm] = useState<GeometryForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [sag, setSag] = useState(20);
    const [viewMode, setViewMode] = useState<'side' | 'front'>('side');
    const [crankMode, setCrankMode] = useState<CrankMode>('horizontal');
    const [riderMode, setRiderMode] = useState<RiderMode>('seated');
    const { width: windowWidth } = useWindowDimensions();
    const viewWidth = Math.max(260, Math.min(windowWidth, 960) - 2 * 24 - 2 * 16);

    const selectedBike = bikes.find(b => b.id === selectedBikeId);

    const forkTravel = useMemo(() => {
        const fork = selectedBike?.components.find(c => c.type === 'fork');
        const value = parseFloat(fork?.setupValues?.find(s => s.key === 'travel')?.value ?? '');
        return Number.isFinite(value) && value > 0 ? value : travelStrokeDefaults(selectedBike?.type).travel;
    }, [selectedBike]);

    // Dropper hub for the standing pose: tracker value first, then a travel
    // number in the model name ("Dropper V3 210mm"); null → lib default.
    const dropperTravel = useMemo(() => {
        const post = selectedBike?.components.find(c => c.type === 'seatpost');
        const raw = setupVal(post, ['Hub', 'Travel', 'travel']);
        const hub = raw ? parseFloat(raw.replace(',', '.')) : NaN;
        if (Number.isFinite(hub) && hub >= 60 && hub <= 260) return Math.round(hub);
        const matches = [...(post?.model ?? '').matchAll(/(\d{2,3})\s*mm/gi)];
        const last = matches.length ? parseInt(matches[matches.length - 1][1], 10) : NaN;
        return Number.isFinite(last) && last >= 60 && last <= 260 ? last : null;
    }, [selectedBike]);

    // Front tire width (mm) for the head-on sketch, from the wheel component
    const frontTireWidthMm = useMemo(() => {
        const wheel = selectedBike?.components.find(c => c.type === 'wheel_front');
        const raw = setupVal(wheel, ['width', 'Breite']);
        const inches = raw ? parseFloat(raw.replace(',', '.')) : NaN;
        return Number.isFinite(inches) && inches > 0 ? Math.round(inches * 25.4) : null;
    }, [selectedBike]);

    const shockStroke = useMemo(() => {
        const shock = selectedBike?.components.find(c => c.type === 'shock');
        const value = parseFloat(shock?.setupValues?.find(s => s.key === 'stroke')?.value ?? '');
        return Number.isFinite(value) && value > 0 ? value : travelStrokeDefaults(selectedBike?.type).stroke;
    }, [selectedBike]);

    const update = (key: keyof GeometryForm, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const fillForm = useCallback((bike?: SyncBike) => {
        const geo = bike?.geometry;
        const f: GeometryForm = { ...EMPTY_FORM };
        const set = (key: keyof GeometryForm, value?: number | string) => {
            if (value === undefined || value === null) return;
            (f as any)[key] = typeof value === 'number' ? numStr(value, i18n.language) : String(value);
        };

        if (geo?.frame) {
            set('stack', geo.frame.stack); set('reach', geo.frame.reach);
            set('headAngle', geo.frame.headAngle); set('seatAngle', geo.frame.seatAngle);
            set('chainstay', geo.frame.chainstay); set('wheelbase', geo.frame.wheelbase);
            set('bbDrop', geo.frame.bbDrop); set('seatTube', geo.frame.seatTube);
            set('headTube', geo.frame.headTube);
            set('size', geo.frame.size); set('wheelSize', geo.frame.wheelSize);
        }
        if (geo?.cockpit) {
            set('barRise', geo.cockpit.barRise); set('backsweep', geo.cockpit.backsweep);
            set('upsweep', geo.cockpit.upsweep); set('barWidth', geo.cockpit.barWidth);
            set('stemLength', geo.cockpit.stemLength); set('stemAngle', geo.cockpit.stemAngle);
            set('spacers', geo.cockpit.spacers); set('crankLength', geo.cockpit.crankLength);
        }
        if (geo?.fit) {
            set('saddleHeight', geo.fit.saddleHeight); set('saddleSetback', geo.fit.saddleSetback);
        }
        if (geo?.measured) {
            set('mBarX', geo.measured.barX); set('mBarY', geo.measured.barY);
            set('mSeatedReach', geo.measured.seatedReach); set('mDrop', geo.measured.saddleToBarDrop);
            set('mBbHeight', geo.measured.bbHeight);
        }
        if (geo?.meta?.source) f.source = geo.meta.source;

        // Prefill still-empty cockpit/fit fields from the Component Tracker
        const bar = bike?.components.find(c => c.type === 'handlebar');
        const stem = bike?.components.find(c => c.type === 'stem');
        const saddle = bike?.components.find(c => c.type === 'saddle');
        const wheel = bike?.components.find(c => c.type === 'wheel_front');
        if (!f.barRise) set('barRise', setupVal(bar, ['Rise']));
        if (!f.backsweep) set('backsweep', setupVal(bar, ['Backsweep']));
        if (!f.upsweep) set('upsweep', setupVal(bar, ['Upsweep']));
        if (!f.barWidth) set('barWidth', setupVal(bar, ['Breite', 'width']));
        if (!f.stemLength) set('stemLength', setupVal(stem, ['Länge']));
        if (!f.stemAngle) set('stemAngle', setupVal(stem, ['Winkel']));
        if (!f.saddleSetback) set('saddleSetback', setupVal(saddle, ['Setback']));
        if (!f.wheelSize) set('wheelSize', setupVal(wheel, ['size']));

        setForm(f);
    }, [i18n.language]);

    const load = useCallback(async () => {
        const [bikesData, primaryId, profile] = await Promise.all([
            syncLoadBikes(),
            syncLoadPrimaryBikeId(),
            syncLoadProfile(),
        ]);
        setBikes(bikesData);
        const preferred = (primaryId && bikesData.some(b => b.id === primaryId)) ? primaryId : (bikesData[0]?.id ?? '');
        setSelectedBikeId(prev => prev || preferred);
        const toMm = (value?: string) => {
            const n = toNum(value ?? '');
            return n !== null && n !== undefined ? n * 10 : null;
        };
        setRider({
            height: toMm(profile.height),
            inseam: toMm(profile.inseam),
            armLength: toMm(profile.armLength),
            torsoLength: toMm(profile.torsoLength),
            shoulderWidth: toMm(profile.shoulderWidth),
        });
    }, []);

    useEffect(() => { load(); }, [load]);
    useRefreshOnForeground(load);

    useEffect(() => {
        if (!selectedBikeId) return;
        fillForm(bikes.find(b => b.id === selectedBikeId));
    }, [selectedBikeId, bikes, fillForm]);

    const handleBikeChange = (id: string) => {
        setSelectedBikeId(id);
        const bike = bikes.find(b => b.id === id);
        if (bike) setDiscipline(disciplineForBikeType(bike.type));
    };

    const geometry = useMemo(() => buildGeometryFromForm(form), [form]);

    // Assumed saddle height (0.883 × inseam) and setback (from the seat-tube
    // geometry) when none are entered yet — the model and sketches work before
    // the tape measurement exists; both are offered as gray placeholders.
    const assumedSaddleHeight = rider.inseam ? saddleHeightTarget(rider.inseam) : null;
    const assumedSetback = useMemo(() => {
        const height = geometry.fit?.saddleHeight ?? assumedSaddleHeight;
        if (height == null) return null;
        return assumedSaddleSetback(height, geometry.frame?.seatAngle ?? 75);
    }, [geometry, assumedSaddleHeight]);
    const displayGeometry = useMemo(() => {
        const fit = { ...geometry.fit };
        if (fit.saddleHeight == null && assumedSaddleHeight != null) fit.saddleHeight = assumedSaddleHeight;
        if (fit.saddleSetback == null && assumedSetback != null) fit.saddleSetback = assumedSetback;
        if (fit.saddleHeight === geometry.fit?.saddleHeight && fit.saddleSetback === geometry.fit?.saddleSetback) {
            return geometry;
        }
        return { ...geometry, fit };
    }, [geometry, assumedSaddleHeight, assumedSetback]);

    const derived = useMemo(() => computeContactGeometry(displayGeometry), [displayGeometry]);

    // Model values for the measured fields: computed from frame + cockpit + fit.
    // Shown as gray placeholders and used by the model while the field is empty.
    const autoMeasured = useMemo(() => {
        const frontRadius = wheelRadii(geometry.frame?.wheelSize).front;
        const bbDrop = geometry.frame?.bbDrop ?? 30;
        return {
            barX: derived.barX,
            barY: derived.barY,
            seatedReach: derived.seatedReach,
            saddleToBarDrop: derived.saddleToBarDrop,
            bbHeight: frontRadius - bbDrop,
        };
    }, [geometry, derived]);

    const autoStr = (value: number | null | undefined) =>
        value == null ? undefined : String(Math.round(value));
    const reference = DISCIPLINE_REFERENCES[discipline];
    const checks = useMemo(() => evaluateFit(geometry, derived, reference, rider), [geometry, derived, reference, rider]);
    const advice = useMemo(() => recommendForSymptoms(symptoms, geometry, derived, rider), [symptoms, geometry, derived, rider]);

    const referenceBike = bikes.find(b => b.id === referenceBikeId);
    const refDerived = useMemo(
        () => (referenceBike?.geometry ? computeContactGeometry(referenceBike.geometry) : null),
        [referenceBike],
    );
    const compareRows = useMemo(() => {
        if (!referenceBike?.geometry || !refDerived) return [];
        const ref = referenceBike.geometry;
        const row = (id: string, a: number | null | undefined, b: number | null | undefined, digits = 0) => ({
            id,
            a: a ?? null,
            b: b ?? null,
            delta: a != null && b != null ? a - b : null,
            digits,
        });
        return [
            row('reach', geometry.frame?.reach, ref.frame?.reach),
            row('stack', geometry.frame?.stack, ref.frame?.stack),
            row('rad', derived.rad, refDerived.rad),
            row('barY', derived.barY, refDerived.barY),
            row('drop', derived.saddleToBarDrop, refDerived.saddleToBarDrop),
            row('seatedReach', derived.seatedReach, refDerived.seatedReach),
            row('stem', geometry.cockpit?.stemLength, ref.cockpit?.stemLength),
            row('rise', geometry.cockpit?.barRise, ref.cockpit?.barRise),
            row('width', geometry.cockpit?.barWidth, ref.cockpit?.barWidth),
            row('saddleHeight', geometry.fit?.saddleHeight, ref.fit?.saddleHeight),
        ];
    }, [geometry, derived, referenceBike, refDerived]);

    const fmtValue = (value: number | null, digits = 0) =>
        value == null ? '–' : value.toLocaleString(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });

    const statusIcon = (status: FitCheck['status']) =>
        status === 'ok' ? '✅' : status === 'low' ? '⬇️' : status === 'high' ? '⬆️' : '➖';

    const fmtCheck = (check: FitCheck) => {
        if (check.value == null) return '–';
        if (check.id === 'radRatio') return fmtValue(check.value, 2);
        return `${fmtValue(Math.round(check.value))} mm`;
    };

    const handleSave = async () => {
        if (!selectedBikeId) return;
        setSaving(true);
        try {
            const fresh = await syncLoadBikes();
            const cleaned = sanitizeGeometry(buildGeometryFromForm(form));
            // Keep the model live: measured values that equal the computed model
            // are not persisted (only real tape deviations override it).
            if (cleaned) {
                const stripped = stripComputedMeasured(cleaned.measured, autoMeasured);
                if (stripped) cleaned.measured = stripped;
                else delete cleaned.measured;
            }
            const updated = fresh.map(b => (b.id === selectedBikeId ? { ...b, geometry: cleaned } : b));
            const ok = await syncSaveBikes(updated);
            setBikes(updated);
            showAlert(t('geometry.title'), ok ? t('geometry.saved') : t('geometry.save_error'));
        } catch {
            showAlert(t('geometry.title'), t('geometry.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const toggleSymptom = (id: SymptomId) =>
        setSymptoms(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

    const field = (
        key: keyof GeometryForm,
        labelKey: string,
        options?: { suffix?: string; placeholder?: string; numeric?: boolean; decimal?: boolean },
    ) => (
        <BPInput
            label={t(labelKey)}
            value={form[key]}
            onChangeText={(v) => update(key, v)}
            keyboardType={options?.numeric === false ? 'default' : options?.decimal ? 'decimal-pad' : 'numeric'}
            suffix={options?.suffix ?? 'mm'}
            placeholder={options?.placeholder ?? '—'}
            accentColor={ACCENT}
            containerStyle={{ flex: 1 }}
        />
    );

    if (bikes.length === 0) {
        return (
            <View style={styles.container}>
                <Stack.Screen options={{ title: t('geometry.title') }} />
                <StatusBar barStyle="light-content" />
                <BPEmptyState icon="📐" title={t('geometry.no_bikes')} subtitle={t('geometry.no_bikes_hint')} />
                <View style={styles.emptyAction}>
                    <BPButton
                        title={t('geometry.create_bike')}
                        onPress={() => router.push('/(features)/component-tracker')}
                        color={ACCENT}
                        fullWidth
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('geometry.title') }} />
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <BPPicker
                    label={t('geometry.bike_label')}
                    options={bikes.map(b => ({ label: b.name, value: b.id }))}
                    value={selectedBikeId}
                    onValueChange={handleBikeChange}
                    accentColor={ACCENT}
                />

                <BPSegmentedControl
                    options={[
                        { label: t('geometry.tab_analysis'), value: 'analysis' },
                        { label: t('geometry.tab_frame'), value: 'frame' },
                        { label: t('geometry.tab_cockpit'), value: 'cockpit' },
                        { label: t('geometry.tab_measured'), value: 'measured' },
                        { label: t('geometry.tab_compare'), value: 'compare' },
                    ]}
                    value={tab}
                    onChange={(v) => setTab(v as Tab)}
                    accentColor={ACCENT}
                    containerStyle={{ marginBottom: theme.spacing.md }}
                />

                {tab === 'analysis' && (
                    <>
                        <BPCard style={styles.card}>
                            <Text style={styles.cardTitle}>🖼️ {t('geometry.view_title')}</Text>
                            <BPSegmentedControl
                                options={[
                                    { label: t('geometry.view_mode_side'), value: 'side' },
                                    { label: t('geometry.view_mode_front'), value: 'front' },
                                ]}
                                value={viewMode}
                                onChange={(v) => setViewMode(v as 'side' | 'front')}
                                accentColor={ACCENT}
                                containerStyle={{ marginBottom: theme.spacing.sm }}
                            />
                            <BPSegmentedControl
                                options={[
                                    { label: t('geometry.rider_mode_seated'), value: 'seated' },
                                    { label: t('geometry.rider_mode_standing'), value: 'standing' },
                                ]}
                                value={riderMode}
                                onChange={(v) => setRiderMode(v as RiderMode)}
                                accentColor={ACCENT}
                                containerStyle={{ marginBottom: theme.spacing.md }}
                            />
                            {viewMode === 'side' ? (
                                <>
                                    <BPSegmentedControl
                                        options={[
                                            { label: t('geometry.crank_horizontal'), value: 'horizontal' },
                                            { label: t('geometry.crank_vertical'), value: 'vertical' },
                                        ]}
                                        value={crankMode}
                                        onChange={(v) => setCrankMode(v as CrankMode)}
                                        accentColor={ACCENT}
                                        containerStyle={{ marginBottom: theme.spacing.sm }}
                                    />
                                    <BikeSideView
                                        geometry={displayGeometry}
                                        derived={derived}
                                        sagPercent={sag}
                                        forkTravel={forkTravel}
                                        shockStroke={shockStroke}
                                        torsoLength={rider.torsoLength}
                                        inseam={rider.inseam}
                                        crankLength={toNum(form.crankLength)}
                                        crankMode={crankMode}
                                        riderMode={riderMode}
                                        dropperTravel={dropperTravel}
                                        width={viewWidth}
                                    />
                                </>
                            ) : (
                                <BikeFrontView
                                    geometry={displayGeometry}
                                    derived={derived}
                                    shoulderWidth={rider.shoulderWidth}
                                    sagPercent={sag}
                                    forkTravel={forkTravel}
                                    shockStroke={shockStroke}
                                    tireWidthMm={frontTireWidthMm}
                                    torsoLength={rider.torsoLength}
                                    riderMode={riderMode}
                                    dropperTravel={dropperTravel}
                                    crankMode={crankMode}
                                    crankLength={toNum(form.crankLength)}
                                    width={viewWidth}
                                />
                            )}
                            <BPSlider
                                label={t('geometry.view_sag_label')}
                                value={sag}
                                min={0}
                                max={35}
                                step={1}
                                unit="%"
                                accentColor={ACCENT}
                                onValueChange={setSag}
                            />
                            {viewMode === 'side' && (
                                <Text style={styles.hint}>{t('geometry.view_hint')}</Text>
                            )}
                            {riderMode === 'standing' && dropperTravel == null && (
                                <Text style={styles.hint}>
                                    {t('geometry.dropper_default_hint', { mm: DEFAULT_DROPPER_TRAVEL })}
                                </Text>
                            )}
                        </BPCard>

                        <BPCard style={styles.card}>
                            <Text style={styles.cardTitle}>📊 {t('geometry.metrics_title')}</Text>
                            {geometry.fit?.saddleHeight == null && assumedSaddleHeight != null && (
                                <Text style={styles.hint}>
                                    {t('geometry.metrics_assumed_saddle', { mm: assumedSaddleHeight })}
                                </Text>
                            )}
                            <View style={styles.metricGrid}>
                                {([
                                    ['reach', geometry.frame?.reach, 0],
                                    ['stack', geometry.frame?.stack, 0],
                                    ['rad', derived.rad, 0],
                                    ['drop', derived.saddleToBarDrop, 0],
                                    ['seatedReach', derived.seatedReach, 0],
                                    ['barY', derived.barY, 0],
                                ] as [string, number | null | undefined, number][]).map(([id, value, digits]) => (
                                    <View key={id} style={styles.metricCell}>
                                        <Text style={styles.metricValue}>{fmtValue(value ?? null, digits)}</Text>
                                        <Text style={styles.metricLabel}>{t(`geometry.metric_${id}`)}</Text>
                                    </View>
                                ))}
                            </View>
                        </BPCard>

                        <BPPicker
                            label={t('geometry.discipline_label')}
                            options={[
                                { label: t('geometry.discipline_tour'), value: 'tour' },
                                { label: t('geometry.discipline_trail'), value: 'trail' },
                                { label: t('geometry.discipline_enduro'), value: 'enduro' },
                                { label: t('geometry.discipline_dh'), value: 'dh' },
                            ]}
                            value={discipline}
                            onValueChange={(v) => setDiscipline(v as Discipline)}
                            accentColor={ACCENT}
                        />

                        <BPCard style={styles.card}>
                            <Text style={styles.cardTitle}>🎯 {t('geometry.checks_title')}</Text>
                            {checks.map(check => (
                                <View key={check.id} style={styles.checkRow}>
                                    <Text style={styles.checkLabel}>
                                        {statusIcon(check.status)} {t(`geometry.check_${check.id}`)}
                                    </Text>
                                    <Text style={styles.checkValue}>
                                        {fmtCheck(check)}
                                        {check.band
                                            ? `  (${t('geometry.band', {
                                                min: check.id === 'radRatio' ? check.band.min.toFixed(2) : Math.round(check.band.min),
                                                max: check.id === 'radRatio' ? check.band.max.toFixed(2) : Math.round(check.band.max),
                                            })})`
                                            : ''}
                                    </Text>
                                </View>
                            ))}
                        </BPCard>

                        <BPCard style={styles.card}>
                            <Text style={styles.cardTitle}>🩺 {t('geometry.symptoms_title')}</Text>
                            <View style={styles.chipRow}>
                                {SYMPTOMS.map(id => (
                                    <BPChip
                                        key={id}
                                        small
                                        color={ACCENT}
                                        selected={symptoms.includes(id)}
                                        label={t(`geometry.symptom_${id}`)}
                                        onPress={() => toggleSymptom(id)}
                                    />
                                ))}
                            </View>
                            {symptoms.map(id => (
                                <View key={id} style={styles.adviceBlock}>
                                    <Text style={styles.adviceTitle}>{t(`geometry.symptom_${id}`)}</Text>
                                    {(advice[id] ?? []).map((action, index) => (
                                        <Text key={index} style={styles.adviceText}>
                                            • {t(action.key, action.params)}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </BPCard>
                    </>
                )}

                {tab === 'frame' && (
                    <BPCard style={styles.card}>
                        <Text style={styles.cardTitle}>📐 {t('geometry.frame_title')}</Text>
                        <Text style={styles.hint}>{t('geometry.frame_hint')}</Text>
                        <View style={styles.inputRow}>
                            {field('stack', 'geometry.field_stack')}
                            {field('reach', 'geometry.field_reach')}
                        </View>
                        <View style={styles.inputRow}>
                            {field('headAngle', 'geometry.field_head_angle', { suffix: '°', decimal: true })}
                            {field('seatAngle', 'geometry.field_seat_angle', { suffix: '°', decimal: true })}
                        </View>
                        <View style={styles.inputRow}>
                            {field('chainstay', 'geometry.field_chainstay')}
                            {field('wheelbase', 'geometry.field_wheelbase')}
                        </View>
                        <View style={styles.inputRow}>
                            {field('bbDrop', 'geometry.field_bb_drop')}
                            {field('seatTube', 'geometry.field_seat_tube')}
                        </View>
                        <View style={styles.inputRow}>
                            {field('headTube', 'geometry.field_head_tube')}
                        </View>
                        {toNum(form.bbDrop) != null && toNum(form.bbDrop)! > 100 && (
                            <Text style={styles.warning}>{t('geometry.bbdrop_warning')}</Text>
                        )}
                        {field('size', 'geometry.field_size', { suffix: '', placeholder: 'L', numeric: false })}
                        <BPPicker
                            label={t('geometry.field_wheel_size')}
                            options={[
                                { label: '29"', value: '29' },
                                { label: '27.5"', value: '27.5' },
                                { label: '26"', value: '26' },
                                { label: 'Mullet (29/27.5)', value: 'mullet' },
                            ]}
                            value={form.wheelSize}
                            onValueChange={(v) => update('wheelSize', v)}
                            accentColor={ACCENT}
                        />
                        {field('source', 'geometry.source_label', { suffix: '', placeholder: t('geometry.source_placeholder'), numeric: false })}
                    </BPCard>
                )}

                {tab === 'cockpit' && (
                    <BPCard style={styles.card}>
                        <Text style={styles.cardTitle}>🔧 {t('geometry.cockpit_title')}</Text>
                        <Text style={styles.hint}>{t('geometry.tracker_hint')}</Text>
                        <View style={styles.inputRow}>
                            {field('barRise', 'geometry.field_bar_rise')}
                            {field('backsweep', 'geometry.field_backsweep', { suffix: '°', decimal: true })}
                            {field('upsweep', 'geometry.field_upsweep', { suffix: '°', decimal: true })}
                        </View>
                        <View style={styles.inputRow}>
                            {field('barWidth', 'geometry.field_bar_width')}
                            {field('stemLength', 'geometry.field_stem_length')}
                        </View>
                        <View style={styles.inputRow}>
                            {field('stemAngle', 'geometry.field_stem_angle', { suffix: '°', decimal: true })}
                            {field('spacers', 'geometry.field_spacers')}
                            {field('crankLength', 'geometry.field_crank_length')}
                        </View>
                        <View style={styles.inputRow}>
                            {field('saddleHeight', 'geometry.field_saddle_height', { placeholder: assumedSaddleHeight != null ? String(assumedSaddleHeight) : '—' })}
                            {field('saddleSetback', 'geometry.field_saddle_setback', { placeholder: assumedSetback != null ? String(assumedSetback) : '—' })}
                        </View>
                        {(assumedSaddleHeight != null || assumedSetback != null) && (
                            <BPButton
                                title={t('geometry.cockpit_apply', {
                                    height: assumedSaddleHeight ?? '—',
                                    setback: assumedSetback ?? '—',
                                })}
                                onPress={() => setForm(prev => ({
                                    ...prev,
                                    saddleHeight: prev.saddleHeight
                                        || (assumedSaddleHeight != null ? numStr(assumedSaddleHeight, i18n.language) : ''),
                                    saddleSetback: prev.saddleSetback
                                        || (assumedSetback != null ? numStr(assumedSetback, i18n.language) : ''),
                                }))}
                                variant="secondary"
                                color={ACCENT}
                                size="sm"
                                style={{ marginTop: theme.spacing.sm }}
                            />
                        )}
                    </BPCard>
                )}

                {tab === 'measured' && (
                    <BPCard style={styles.card}>
                        <Text style={styles.cardTitle}>📏 {t('geometry.measured_title')}</Text>
                        <Text style={styles.hint}>{t('geometry.measured_hint')}</Text>
                        <View style={styles.inputRow}>
                            {field('mBarY', 'geometry.field_measured_bary', { placeholder: autoStr(autoMeasured.barY) })}
                            {field('mBarX', 'geometry.field_measured_barx', { placeholder: autoStr(autoMeasured.barX) })}
                        </View>
                        <View style={styles.inputRow}>
                            {field('mSeatedReach', 'geometry.field_measured_seated_reach', { placeholder: autoStr(autoMeasured.seatedReach) })}
                            {field('mDrop', 'geometry.field_measured_drop', { placeholder: autoStr(autoMeasured.saddleToBarDrop) })}
                        </View>
                        <View style={styles.inputRow}>
                            {field('mBbHeight', 'geometry.field_measured_bb_height', { placeholder: autoStr(autoMeasured.bbHeight) })}
                        </View>
                        <BPButton
                            title={t('geometry.measured_apply')}
                            onPress={() => setForm(prev => ({
                                ...prev,
                                mBarY: autoStr(autoMeasured.barY) ?? '',
                                mBarX: autoStr(autoMeasured.barX) ?? '',
                                mSeatedReach: autoStr(autoMeasured.seatedReach) ?? '',
                                mDrop: autoStr(autoMeasured.saddleToBarDrop) ?? '',
                                mBbHeight: autoStr(autoMeasured.bbHeight) ?? '',
                            }))}
                            variant="secondary"
                            color={ACCENT}
                            size="sm"
                            style={{ marginTop: theme.spacing.sm }}
                        />
                        <BPButton
                            title={t('geometry.wiki_measure_link')}
                            onPress={() => router.push({ pathname: '/(features)/setup-guide', params: { article: 'geo_measure', category: 'geometrie' } })}
                            variant="secondary"
                            color={ACCENT}
                            size="sm"
                            style={{ marginTop: theme.spacing.sm }}
                        />
                    </BPCard>
                )}

                {tab === 'compare' && (
                    <BPCard style={styles.card}>
                        <Text style={styles.cardTitle}>⚖️ {t('geometry.compare_title')}</Text>
                        {bikes.length < 2 ? (
                            <Text style={styles.hint}>{t('geometry.compare_need_two')}</Text>
                        ) : (
                            <>
                                <BPPicker
                                    label={t('geometry.compare_reference_bike')}
                                    options={bikes.filter(b => b.id !== selectedBikeId).map(b => ({ label: b.name, value: b.id }))}
                                    value={referenceBikeId}
                                    onValueChange={setReferenceBikeId}
                                    accentColor={ACCENT}
                                />
                                {referenceBike && (
                                    <>
                                        <View style={[styles.compareRow, styles.compareHeader]}>
                                            <Text style={[styles.compareCell, styles.compareHeadText]}>{t('geometry.compare_metric')}</Text>
                                            <Text style={[styles.compareCell, styles.compareHeadText]}>{t('geometry.compare_mine')}</Text>
                                            <Text style={[styles.compareCell, styles.compareHeadText]}>{referenceBike.name}</Text>
                                            <Text style={[styles.compareCell, styles.compareHeadText]}>Δ</Text>
                                        </View>
                                        {compareRows.map(row => (
                                            <View key={row.id} style={styles.compareRow}>
                                                <Text style={[styles.compareCell, styles.compareLabel]}>{t(`geometry.compare_${row.id}`)}</Text>
                                                <Text style={styles.compareCell}>{fmtValue(row.a, row.digits)}</Text>
                                                <Text style={styles.compareCell}>{fmtValue(row.b, row.digits)}</Text>
                                                <Text style={[
                                                    styles.compareCell,
                                                    { color: row.delta == null ? theme.colors.textMuted : row.delta > 0 ? ACCENT : theme.colors.accentOrange },
                                                ]}>
                                                    {row.delta == null ? '–' : `${row.delta > 0 ? '+' : ''}${fmtValue(row.delta, row.digits)}`}
                                                </Text>
                                            </View>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </BPCard>
                )}

                {(tab === 'frame' || tab === 'cockpit' || tab === 'measured') && (
                    <View style={styles.saveWrap}>
                        <BPButton
                            title={saving ? t('geometry.saving') : t('geometry.save_btn')}
                            onPress={handleSave}
                            color={ACCENT}
                            fullWidth
                            disabled={saving}
                        />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    emptyAction: { paddingHorizontal: theme.spacing.lg },
    card: { padding: theme.spacing.md, marginBottom: theme.spacing.md },
    cardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.md },
    hint: { color: theme.colors.textMuted, fontSize: 12, marginBottom: theme.spacing.sm, lineHeight: 17 },
    warning: { color: theme.colors.accentOrange, fontSize: 12, marginBottom: theme.spacing.sm, lineHeight: 17 },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    metricCell: {
        flexGrow: 1, flexBasis: '30%', backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm, alignItems: 'center',
    },
    metricValue: { color: ACCENT, fontSize: 20, fontWeight: '900' },
    metricLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    checkRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border + '60',
    },
    checkLabel: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    checkValue: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    adviceBlock: { marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border + '60' },
    adviceTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800', marginBottom: 4 },
    adviceText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.border + '40' },
    compareHeader: { borderBottomColor: theme.colors.border, marginBottom: 2 },
    compareHeadText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    compareCell: { flex: 1, color: theme.colors.text, fontSize: 12, fontWeight: '600' },
    compareLabel: { color: theme.colors.textSecondary },
    saveWrap: { marginTop: theme.spacing.sm },
});
