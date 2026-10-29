/**
 * F13: Body Scan — Foto-Körperanalyse (MVP).
 *
 * Flow: Foto → Referenz (A4/Karte per 4 Ecken oder Körpergröße) →
 * Körperpunkte antippen → Ergebnis + Profil-Übernahme + Verlauf.
 * Fotos bleiben grundsätzlich lokal (kein Upload, keine Bilddaten in Records).
 */
import BodySkeletonOverlay from '@/components/BodySkeletonOverlay';
import { BPButton, BPCard, BPInput, BPPicker, screenContentStyle } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { showAlert } from '@/lib/dialog';
import {
    BODY_SCANS_KEY,
    BODY_SCANS_MAX,
    BODY_SCANS_PREF_KEY,
    computeMeasuresWithHeight,
    computeMeasuresWithReference,
    implausibleMeasures,
    mapMeasuresToProfile,
    mmToCmString,
    quadAreaNorm,
    REFERENCE_DIMS_MM,
    type BodyKeypointId,
    type BodyPoints,
    type BodyScanRecord,
    type Confidence,
    type MeasureKey,
    type NormPoint,
    type ReferenceType,
    type ScanResult,
} from '@/lib/bodyScan';
import { newId, syncLoadPreference, syncLoadProfile, syncSavePreference, syncSaveProfile } from '@/lib/sync';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#E040FB';

type Step = 'photo' | 'reference' | 'points' | 'result';

interface Target {
    id: BodyKeypointId;
    optional: boolean;
}

const TARGETS: Target[] = [
    { id: 'crown', optional: false },
    { id: 'shoulderL', optional: false },
    { id: 'shoulderR', optional: false },
    { id: 'elbowR', optional: true },
    { id: 'wristR', optional: true },
    { id: 'handR', optional: true },
    { id: 'hipL', optional: true },
    { id: 'hipR', optional: true },
    { id: 'kneeR', optional: true },
    { id: 'ankleR', optional: false },
    { id: 'crotch', optional: false },
];

const CORNER_LABELS = ['tl', 'tr', 'br', 'bl'];

const SKELETON_CONNECTIONS: [string, string][] = [
    ['shoulderL', 'shoulderR'],
    ['shoulderR', 'elbowR'],
    ['elbowR', 'wristR'],
    ['wristR', 'handR'],
    ['hipL', 'hipR'],
    ['hipR', 'kneeR'],
    ['kneeR', 'ankleR'],
    ['crown', 'crotch'],
    ['crotch', 'ankleR'],
];

function aspectOf(uri: string): Promise<number> {
    return new Promise(resolve => {
        try {
            Image.getSize(
                uri,
                (w, h) => resolve(w > 0 && h > 0 ? w / h : 0.75),
                () => resolve(0.75),
            );
        } catch {
            resolve(0.75);
        }
    });
}

const confidenceIcon = (c: Confidence): string =>
    c === 'high' ? '🟢' : c === 'medium' ? '🟡' : c === 'low' ? '🟠' : '⚪';

export default function BodyScanScreen() {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('photo');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageAspect, setImageAspect] = useState(0.75);
    const [reference, setReference] = useState<ReferenceType>('a4-portrait');
    const [knownHeight, setKnownHeight] = useState('');
    const [corners, setCorners] = useState<NormPoint[]>([]);
    const [points, setPoints] = useState<BodyPoints>({});
    const [targetIdx, setTargetIdx] = useState(0);
    const [history, setHistory] = useState<BodyScanRecord[]>([]);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);

    useEffect(() => {
        syncLoadPreference<BodyScanRecord[]>(BODY_SCANS_PREF_KEY, BODY_SCANS_KEY)
            .then(d => {
                if (Array.isArray(d)) setHistory(d);
            })
            .catch(() => {});
    }, []);

    const pickImage = useCallback(async (camera: boolean) => {
        try {
            const fn = camera
                ? ImagePicker.launchCameraAsync
                : ImagePicker.launchImageLibraryAsync;
            const res = await fn({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
            if (res.canceled || !res.assets?.[0]?.uri) return;
            const uri = res.assets[0].uri;
            setImageUri(uri);
            setImageAspect(await aspectOf(uri));
            setCorners([]);
            setPoints({});
            setTargetIdx(0);
            setApplied(false);
            setStep('reference');
        } catch {
            showAlert(t('bodyscan.title'), t('bodyscan.photo_error'));
        }
    }, [t]);

    const needsReferenceCorners = reference !== 'height';

    const heightMm = useMemo(() => {
        const n = parseFloat(knownHeight.replace(',', '.'));
        return Number.isFinite(n) && n >= 100 && n <= 250 ? Math.round(n * 10) : null;
    }, [knownHeight]);

    const canStartPoints =
        imageUri != null && (needsReferenceCorners ? corners.length === 4 : heightMm != null);

    const activeTarget: Target | null = step === 'points' ? (TARGETS[targetIdx] ?? null) : null;

    const overlayPoints = useMemo(() => {
        if (step === 'reference') {
            return CORNER_LABELS.slice(0, Math.max(corners.length, Math.min(corners.length + 1, 4))).map(
                (_, i) => ({
                    id: CORNER_LABELS[i],
                    label: t(`bodyscan.corner_${CORNER_LABELS[i]}`),
                    point: corners[i] ?? null,
                }),
            );
        }
        return TARGETS.map(tg => ({
            id: tg.id,
            label: t(`bodyscan.point_${tg.id}`),
            point: points[tg.id] ?? null,
        }));
    }, [step, corners, points, t]);

    const activeId = step === 'reference' ? CORNER_LABELS[Math.min(corners.length, 3)] : activeTarget?.id ?? null;

    const handleTap = useCallback(
        (p: NormPoint) => {
            if (step === 'reference') {
                if (corners.length < 4) setCorners(prev => [...prev, p]);
                return;
            }
            if (step === 'points' && activeTarget) {
                setPoints(prev => ({ ...prev, [activeTarget.id]: p }));
            }
        },
        [step, corners.length, activeTarget],
    );

    const nextTarget = useCallback(() => {
        if (targetIdx >= TARGETS.length - 1) {
            setStep('result');
        } else {
            setTargetIdx(i => i + 1);
        }
    }, [targetIdx]);

    const skipTarget = useCallback(() => {
        if (!activeTarget) return;
        setPoints(prev => {
            const next = { ...prev };
            delete next[activeTarget.id];
            return next;
        });
        nextTarget();
    }, [activeTarget, nextTarget]);

    const result: ScanResult | null = useMemo(() => {
        if (step !== 'result' || !imageUri) return null;
        if (needsReferenceCorners) {
            if (corners.length !== 4) return null;
            return computeMeasuresWithReference(points, corners, reference as Exclude<ReferenceType, 'height'>);
        }
        if (heightMm == null) return null;
        return computeMeasuresWithHeight(points, heightMm, imageAspect);
    }, [step, imageUri, needsReferenceCorners, corners, points, reference, heightMm, imageAspect]);

    const warnings = useMemo(
        () => (result ? implausibleMeasures(result.measures) : []),
        [result],
    );
    const warningKeys = useMemo(() => new Set(warnings.map(w => w.key)), [warnings]);

    const profilePatch = useMemo(
        () => (result ? mapMeasuresToProfile(result.measures) : {}),
        [result],
    );

    const handleApply = useCallback(async () => {
        if (!result || applying) return;
        if (Object.keys(profilePatch).length === 0) {
            showAlert(t('bodyscan.title'), t('bodyscan.nothing_plausible'));
            return;
        }
        setApplying(true);
        try {
            const current = await syncLoadProfile();
            const ok = await syncSaveProfile({ ...current, ...profilePatch });
            // Verlauf (nur Maße, nie Fotos) — lokal + Cloud via user_preferences
            const record: BodyScanRecord = {
                id: newId(),
                dateISO: new Date().toISOString(),
                referenceType: reference,
                perspectiveCorrected: result.perspectiveCorrected,
                measures: result.measures,
                hasPhoto: false,
            };
            const nextHistory = [record, ...history].slice(0, BODY_SCANS_MAX);
            setHistory(nextHistory);
            await syncSavePreference(BODY_SCANS_PREF_KEY, BODY_SCANS_KEY, nextHistory);
            setApplied(true);
            showAlert(t('bodyscan.title'), ok ? t('bodyscan.applied_ok') : t('bodyscan.applied_offline'));
        } finally {
            setApplying(false);
        }
    }, [result, applying, profilePatch, reference, history, t]);

    const handleDeleteRecord = useCallback(
        async (id: string) => {
            const next = history.filter(r => r.id !== id);
            setHistory(next);
            await syncSavePreference(BODY_SCANS_PREF_KEY, BODY_SCANS_KEY, next);
        },
        [history],
    );

    const requiredMissing = useMemo(
        () => TARGETS.filter(tg => !tg.optional && !points[tg.id]).map(tg => tg.id),
        [points],
    );

    const rows: { key: MeasureKey; label: string; profileKey?: string }[] = [
        { key: 'heightMm', label: t('bodyscan.m_height'), profileKey: 'height' },
        { key: 'inseamMm', label: t('bodyscan.m_inseam'), profileKey: 'inseam' },
        { key: 'torsoMm', label: t('bodyscan.m_torso'), profileKey: 'torsoLength' },
        { key: 'shoulderWidthMm', label: t('bodyscan.m_shoulder'), profileKey: 'shoulderWidth' },
        { key: 'armLengthMm', label: t('bodyscan.m_arm'), profileKey: 'armLength' },
        { key: 'upperArmMm', label: t('bodyscan.m_upperarm') },
        { key: 'forearmMm', label: t('bodyscan.m_forearm') },
        { key: 'thighMm', label: t('bodyscan.m_thigh') },
        { key: 'shankMm', label: t('bodyscan.m_shank') },
    ];

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('bodyscan.title') }} />
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Schritt-Anzeige */}
                <BPCard style={styles.card}>
                    <Text style={styles.stepper}>
                        {['photo', 'reference', 'points', 'result'].map((s, i) => (
                            <Text key={s} style={s === step ? styles.stepActive : styles.stepIdle}>
                                {`${i + 1}. ${t(`bodyscan.step_${s}`)}${i < 3 ? '  ›  ' : ''}`}
                            </Text>
                        ))}
                    </Text>
                </BPCard>

                {step === 'photo' && (
                    <BPCard style={styles.card} accentColor={ACCENT}>
                        <Text style={styles.cardTitle}>📸 {t('bodyscan.photo_title')}</Text>
                        <Text style={styles.hint}>{t('bodyscan.photo_hint')}</Text>
                        <BPButton title={t('bodyscan.photo_library')} onPress={() => pickImage(false)} color={ACCENT} fullWidth />
                        <View style={{ height: theme.spacing.sm }} />
                        <BPButton title={t('bodyscan.photo_camera')} onPress={() => pickImage(true)} variant="secondary" color={ACCENT} fullWidth />
                        {history.length > 0 && (
                            <View style={{ marginTop: theme.spacing.md }}>
                                <Text style={styles.sectionTitle}>🕘 {t('bodyscan.history_title')}</Text>
                                {history.map(r => (
                                    <View key={r.id} style={styles.historyRow}>
                                        <Text style={styles.historyText}>
                                            {new Date(r.dateISO).toLocaleDateString()} · {(r.measures.heightMm != null ? `${mmToCmString(r.measures.heightMm)} cm` : '–')}
                                            {r.perspectiveCorrected ? '' : ` · ${t('bodyscan.no_correction')}`}
                                        </Text>
                                        <Text style={styles.delete} onPress={() => handleDeleteRecord(r.id)}>
                                            {t('common.delete')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </BPCard>
                )}

                {step === 'reference' && imageUri && (
                    <>
                        <BPCard style={styles.card} accentColor={ACCENT}>
                            <Text style={styles.cardTitle}>📐 {t('bodyscan.ref_title')}</Text>
                            <BPPicker
                                label={t('bodyscan.ref_type')}
                                options={[
                                    { label: t('bodyscan.ref_a4_portrait'), value: 'a4-portrait' },
                                    { label: t('bodyscan.ref_a4_landscape'), value: 'a4-landscape' },
                                    { label: t('bodyscan.ref_card'), value: 'card' },
                                    { label: t('bodyscan.ref_height'), value: 'height' },
                                ]}
                                value={reference}
                                onValueChange={v => {
                                    setReference(v as ReferenceType);
                                    setCorners([]);
                                }}
                                accentColor={ACCENT}
                            />
                            {needsReferenceCorners ? (
                                <Text style={styles.hint}>
                                    {t('bodyscan.ref_tap_hint', {
                                        n: corners.length + 1,
                                        label: t(`bodyscan.corner_${CORNER_LABELS[Math.min(corners.length, 3)]}`),
                                        w: REFERENCE_DIMS_MM[reference as Exclude<ReferenceType, 'height'>].w,
                                        h: REFERENCE_DIMS_MM[reference as Exclude<ReferenceType, 'height'>].h,
                                    })}
                                </Text>
                            ) : (
                                <>
                                    <Text style={styles.hint}>{t('bodyscan.height_hint')}</Text>
                                    <BPInput
                                        label={t('profile.height_label')}
                                        value={knownHeight}
                                        onChangeText={setKnownHeight}
                                        suffix="cm"
                                        keyboardType="numeric"
                                        accentColor={ACCENT}
                                    />
                                </>
                            )}
                        </BPCard>
                        {needsReferenceCorners && (
                            <BPCard style={styles.card}>
                                <BodySkeletonOverlay
                                    imageUri={imageUri}
                                    imageAspect={imageAspect}
                                    points={overlayPoints}
                                    activeId={activeId}
                                    accentColor={ACCENT}
                                    onTap={handleTap}
                                />
                                <View style={styles.row}>
                                    <BPButton
                                        title={t('bodyscan.undo')}
                                        onPress={() => setCorners(prev => prev.slice(0, -1))}
                                        variant="secondary"
                                        color={ACCENT}
                                        size="sm"
                                        disabled={corners.length === 0}
                                    />
                                    <BPButton
                                        title={t('bodyscan.redo_photo')}
                                        onPress={() => setStep('photo')}
                                        variant="ghost"
                                        color={ACCENT}
                                        size="sm"
                                    />
                                </View>
                            </BPCard>
                        )}
                        <BPButton
                            title={t('bodyscan.to_points')}
                            onPress={() => {
                                setTargetIdx(0);
                                setStep('points');
                            }}
                            color={ACCENT}
                            fullWidth
                            disabled={!canStartPoints}
                        />
                        {!canStartPoints && needsReferenceCorners && (
                            <Text style={[styles.hint, { marginTop: theme.spacing.sm }]}>
                                {t('bodyscan.ref_missing', { area: Math.round(quadAreaNorm(corners.length === 4 ? corners : []) * 1000) / 10 })}
                            </Text>
                        )}
                    </>
                )}

                {step === 'points' && imageUri && activeTarget && (
                    <>
                        <BPCard style={styles.card} accentColor={ACCENT}>
                            <Text style={styles.cardTitle}>
                                👆 {t('bodyscan.tap_title', { n: targetIdx + 1, total: TARGETS.length })}
                            </Text>
                            <Text style={styles.tapTarget}>{t(`bodyscan.point_${activeTarget.id}`)}</Text>
                            <Text style={styles.hint}>{t(`bodyscan.point_${activeTarget.id}_hint`)}</Text>
                            {activeTarget.optional && (
                                <Text style={styles.hint}>{t('bodyscan.optional_hint')}</Text>
                            )}
                        </BPCard>
                        <BPCard style={styles.card}>
                            <BodySkeletonOverlay
                                imageUri={imageUri}
                                imageAspect={imageAspect}
                                points={overlayPoints}
                                activeId={activeId}
                                connections={SKELETON_CONNECTIONS}
                                accentColor={ACCENT}
                                onTap={handleTap}
                            />
                            <View style={styles.row}>
                                <BPButton
                                    title={t('common.back')}
                                    onPress={() => (targetIdx === 0 ? setStep('reference') : setTargetIdx(i => i - 1))}
                                    variant="secondary"
                                    color={ACCENT}
                                    size="sm"
                                />
                                {activeTarget.optional && (
                                    <BPButton
                                        title={t('bodyscan.skip')}
                                        onPress={skipTarget}
                                        variant="ghost"
                                        color={ACCENT}
                                        size="sm"
                                    />
                                )}
                                <BPButton
                                    title={targetIdx >= TARGETS.length - 1 ? t('bodyscan.to_result') : t('bodyscan.next_point')}
                                    onPress={nextTarget}
                                    color={ACCENT}
                                    size="sm"
                                    disabled={!points[activeTarget.id]}
                                />
                            </View>
                        </BPCard>
                    </>
                )}

                {step === 'result' && (
                    <>
                        <BPCard style={styles.card} accentColor={ACCENT}>
                            <Text style={styles.cardTitle}>📏 {t('bodyscan.result_title')}</Text>
                            {!result ? (
                                <>
                                    <Text style={styles.hint}>{t('bodyscan.result_missing')}</Text>
                                    {requiredMissing.length > 0 && (
                                        <Text style={styles.hint}>
                                            {t('bodyscan.result_missing_points', { list: requiredMissing.map(id => t(`bodyscan.point_${id}`)).join(', ') })}
                                        </Text>
                                    )}
                                    <BPButton title={t('common.back')} onPress={() => setStep('points')} color={ACCENT} fullWidth />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.hint}>
                                        {result.perspectiveCorrected
                                            ? t('bodyscan.corrected_hint')
                                            : t('bodyscan.uncorrected_hint')}
                                    </Text>
                                    {rows.map(({ key, label, profileKey }) => {
                                        const v = result.measures[key];
                                        const conf = result.confidences[key];
                                        const flagged = warningKeys.has(key);
                                        const patchVal = profileKey
                                            ? (profilePatch as Record<string, string | undefined>)[profileKey]
                                            : undefined;
                                        return (
                                            <View key={key} style={styles.measureRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.measureLabel}>
                                                        {confidenceIcon(conf)} {label}
                                                    </Text>
                                                    {flagged && (
                                                        <Text style={styles.warnText}>{t('bodyscan.implausible_hint')}</Text>
                                                    )}
                                                    {patchVal && (
                                                        <Text style={styles.patchText}>
                                                            → {t('bodyscan.into_profile', { v: patchVal })}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={styles.measureValue}>
                                                    {v != null ? `${mmToCmString(v)} cm` : '–'}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                    <View style={{ height: theme.spacing.sm }} />
                                    <BPButton
                                        title={applying ? t('profile.saving') : applied ? t('bodyscan.applied') : t('bodyscan.apply')}
                                        onPress={handleApply}
                                        color={ACCENT}
                                        fullWidth
                                        disabled={applying || applied}
                                    />
                                    <View style={{ height: theme.spacing.sm }} />
                                    <View style={styles.row}>
                                        <BPButton
                                            title={t('bodyscan.open_geometry')}
                                            onPress={() => router.push('/(features)/geometry')}
                                            variant="secondary"
                                            color={ACCENT}
                                            size="sm"
                                        />
                                        <BPButton
                                            title={t('bodyscan.new_scan')}
                                            onPress={() => {
                                                setStep('photo');
                                                setImageUri(null);
                                            }}
                                            variant="ghost"
                                            color={ACCENT}
                                            size="sm"
                                        />
                                    </View>
                                </>
                            )}
                        </BPCard>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    card: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    cardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: theme.spacing.sm },
    sectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
    hint: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: theme.spacing.sm, lineHeight: 18 },
    stepper: { color: theme.colors.textSecondary, fontSize: 12 },
    stepActive: { color: theme.colors.text, fontWeight: '800' },
    stepIdle: { color: theme.colors.textMuted },
    tapTarget: { color: ACCENT, fontSize: 20, fontWeight: '900', marginBottom: 4 },
    row: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md, alignItems: 'center', justifyContent: 'space-between' },
    measureRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    measureLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
    measureValue: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
    warnText: { color: theme.colors.accentRed, fontSize: 12, marginTop: 2 },
    patchText: { color: theme.colors.accentLime, fontSize: 12, marginTop: 2 },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    historyText: { color: theme.colors.textSecondary, fontSize: 13, flex: 1 },
    delete: { color: theme.colors.accentRed, fontSize: 13, fontWeight: '700', paddingLeft: theme.spacing.md },
});
