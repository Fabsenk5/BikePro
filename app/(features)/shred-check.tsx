/**
 * F2: Shred-Check — Komponenten-Tracker
 * Agent Manifest: f2_shred_check.md
 *
 * Tracking: km/Betriebsstunden für Gabel, Dämpfer, Kette, Reifen, Bremsbeläge
 * Service-Intervalle: Automatische Warnungen bei fälligem Service
 * Integration: Liest Ride-Log km für automatische Aggregation (später)
 * UI Supervisor: Wear & Tear Fortschrittsbalken
 */
import { BPButton, BPCard, BPInput, BPModal, BPPicker, BPProgressBar } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { confirmDialog } from '@/lib/dialog';
import { SyncBike, SyncComponent, syncLoadBikes, syncUpdateComponent, WearItem } from '@/lib/sync';
import { Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#FF5252'; // Shred-Check accent

// Emojis for component types managed in the Component Tracker
const typeEmojis: Record<string, string> = {
    fork: '🔱',
    shock: '🔩',
    chain: '⛓️',
    cassette: '⚙️',
    derailleur: '🔗',
    wheel_front: '🛞',
    wheel_rear: '🛞',
    brake_front: '🛑',
    brake_rear: '🛑',
    battery: '🔋',
    motor: '⚡',
};

function getTypeEmoji(type: string): string {
    return typeEmojis[type] ?? '🔧';
}

function getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
}

export default function ShredCheckScreen() {
    const { t, i18n } = useTranslation();
    const [bikes, setBikes] = useState<SyncBike[]>([]);

    const formatDate = (iso: string): string => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // We don't edit components here anymore, ComponentTracker is master.
    // We only update km/service status.
    const loadBikes = async () => {
        const data = await syncLoadBikes();
        setBikes(data ?? []);
    };

    useFocusEffect(
        useCallback(() => {
            loadBikes();
        }, [])
    );

    const updateComponentInBikes = async (compId: string, updateFn: (comp: SyncComponent) => SyncComponent) => {
        const bike = bikes.find(b => b.components.some(c => c.id === compId));
        const comp = bike?.components.find(c => c.id === compId);
        if (!bike || !comp) return;
        const updatedComp = updateFn(comp);
        // Targeted write: patch local cache + upsert only this component's row
        await syncUpdateComponent(bike.id, updatedComp);
        setBikes(bikes.map(b => b.id === bike.id
            ? { ...b, components: b.components.map(c => c.id === compId ? updatedComp : c) }
            : b
        ));
    };

    const handleService = async (comp: SyncComponent, item: WearItem) => {
        const confirmed = await confirmDialog(
            'Service durchgeführt?',
            `${item.label} (${comp.brand || ''} ${comp.model || comp.type}) — km-Zähler zurücksetzen?`
        );
        if (!confirmed) return;
        updateComponentInBikes(comp.id, c => ({
            ...c,
            wearItems: (c.wearItems || []).map(w =>
                w.id === item.id
                    ? { ...w, currentKm: 0, lastServiceDate: getTodayISO() }
                    : w
            )
        }));
    };

    // km input modal (Alert.prompt is iOS-only, Alert is a no-op on web)
    const [kmModalVisible, setKmModalVisible] = useState(false);
    const [kmInput, setKmInput] = useState('');
    const [kmError, setKmError] = useState('');
    const [kmBikeId, setKmBikeId] = useState(''); // bike selected for "Tour erfassen"
    const [kmTarget, setKmTarget] = useState<
        { kind: 'item'; comp: SyncComponent; item: WearItem } | { kind: 'global' } | null
    >(null);

    const openKmModal = (target: NonNullable<typeof kmTarget>) => {
        setKmTarget(target);
        setKmInput('');
        setKmError('');
        setKmModalVisible(true);
    };

    const handleAddKmItem = (comp: SyncComponent, item: WearItem) => {
        openKmModal({ kind: 'item', comp, item });
    };

    const handleAddGlobalKm = () => {
        setKmBikeId(bikes[0]?.id ?? ''); // default: first bike (no "all bikes" option)
        openKmModal({ kind: 'global' });
    };

    const handleKmSubmit = async () => {
        // Accept comma decimals ("12,5")
        const km = parseFloat(kmInput.replace(',', '.'));
        if (isNaN(km) || km <= 0) {
            setKmError(t('shred.km_invalid'));
            return;
        }

        if (kmTarget?.kind === 'item') {
            const { comp, item } = kmTarget;
            updateComponentInBikes(comp.id, c => ({
                ...c,
                wearItems: (c.wearItems || []).map(w =>
                    w.id === item.id
                        ? { ...w, currentKm: w.currentKm + km }
                        : w
                )
            }));
        } else if (kmTarget?.kind === 'global') {
            const bike = bikes.find(b => b.id === kmBikeId);
            if (!bike) return; // no bike selected/available
            const changed: SyncComponent[] = [];
            const updatedComps = bike.components.map(c => {
                if (c.isWearTracked !== true || !c.wearItems || c.wearItems.length === 0) return c;
                const updatedComp = {
                    ...c,
                    wearItems: c.wearItems.map(w => ({
                        ...w,
                        currentKm: w.currentKm + km
                    }))
                };
                changed.push(updatedComp);
                return updatedComp;
            });
            // Targeted writes: upsert only the affected component rows
            await Promise.all(changed.map(c => syncUpdateComponent(bike.id, c)));
            setBikes(bikes.map(b => b.id === bike.id ? { ...b, components: updatedComps } : b));
        }

        setKmModalVisible(false);
        setKmTarget(null);
    };

    // Extract all components that have wear tracking enabled
    const allTrackedComps = bikes.flatMap(b => b.components.filter(c => c.isWearTracked === true));

    // Component id → bike name (identical components on different bikes must stay distinguishable)
    const bikeNameByCompId = new Map<string, string>();
    bikes.forEach(b => b.components.forEach(c => bikeNameByCompId.set(c.id, b.name)));

    // Sort by worst wear item percentage
    const sorted = [...allTrackedComps].sort((a, b) => {
        const maxPctA = Math.max(...(a.wearItems?.map(w => w.currentKm / w.serviceIntervalKm) || [0]), 0);
        const maxPctB = Math.max(...(b.wearItems?.map(w => w.currentKm / w.serviceIntervalKm) || [0]), 0);
        return maxPctB - maxPctA;
    });

    // Count how many individual items need service across all components
    const needsService = sorted.reduce((count, comp) => {
        return count + (comp.wearItems || []).filter(w => (w.currentKm / w.serviceIntervalKm) >= 0.8).length;
    }, 0);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('shred.title'),
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Alert banner */}
                {needsService > 0 && (
                    <BPCard style={styles.alertCard}>
                        <Text style={styles.alertText}>
                            {needsService === 1 ? t('shred.needs_service_one') : t('shred.needs_service_many', { count: needsService })}
                        </Text>
                    </BPCard>
                )}

                <View style={{ marginBottom: theme.spacing.md, gap: theme.spacing.sm }}>
                    <BPButton
                        title={`+ ${t('shred.log_ride')}`}
                        onPress={handleAddGlobalKm}
                        color={ACCENT}
                        size="md"
                        fullWidth
                        disabled={bikes.length === 0}
                    />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                        {t('shred.manage_hint', { defaultValue: 'Komponenten und deren Verschleiß-Status werden im Component Tracker verwaltet.' })}
                    </Text>
                </View>

                {sorted.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🔧</Text>
                        <Text style={styles.emptyTitle}>{t('shred.no_components')}</Text>
                        <Text style={styles.emptySubtitle}>
                            {t('shred.add_first')}
                        </Text>
                    </View>
                ) : (
                    sorted.map((comp) => {
                        const items = comp.wearItems || [];
                        return (
                            <View key={comp.id} style={{ marginBottom: 12 }}>
                                <BPCard style={styles.compCard}>
                                    <View style={styles.compHeader}>
                                        <Text style={styles.compEmoji}>{getTypeEmoji(comp.type)}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.compTitle}>{comp.brand || ''} {comp.model || ''}</Text>
                                            <Text style={styles.compType}>{t(`tracker.type_${comp.type}`, { defaultValue: comp.type })}</Text>
                                            <Text style={styles.compBike}>{bikeNameByCompId.get(comp.id) ?? ''}</Text>
                                        </View>
                                    </View>

                                    {items.map((item) => (
                                        <View key={item.id} style={styles.wearItemContainer}>
                                            <View style={styles.wearItemHeader}>
                                                <Text style={styles.wearItemLabel}>{item.label}</Text>
                                                <Text style={styles.compDate}>
                                                    Service: {formatDate(item.lastServiceDate)}
                                                </Text>
                                            </View>
                                            <BPProgressBar
                                                label={`${item.currentKm} / ${item.serviceIntervalKm} km`}
                                                value={item.currentKm}
                                                max={item.serviceIntervalKm}
                                                unit="%"
                                                colorThresholds
                                                containerStyle={{ marginTop: 4 }}
                                            />
                                            <View style={styles.compActions}>
                                                <TouchableOpacity
                                                    style={styles.actionBtn}
                                                    onPress={() => handleAddKmItem(comp, item)}
                                                >
                                                    <Text style={styles.actionBtnText}>{t('shred.add_km')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.serviceBtn]}
                                                    onPress={() => handleService(comp, item)}
                                                >
                                                    <Text style={[styles.actionBtnText, styles.serviceBtnText]}>
                                                        {t('shred.service_done')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    {comp.notes ? (
                                        <Text style={styles.compNotes}>{comp.notes}</Text>
                                    ) : null}
                                </BPCard>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* km input modal (replaces iOS-only Alert.prompt) */}
            <BPModal
                visible={kmModalVisible}
                onClose={() => setKmModalVisible(false)}
                title={kmTarget?.kind === 'global' ? t('shred.log_ride_title') : t('shred.add_km_title')}
            >
                {kmTarget?.kind === 'item' ? (
                    <Text style={styles.kmModalSub}>
                        {kmTarget.item.label} ({kmTarget.comp.brand || ''} {kmTarget.comp.model || kmTarget.comp.type})
                    </Text>
                ) : (
                    <>
                        <Text style={styles.kmModalSub}>{t('shred.log_ride_msg')}</Text>
                        <BPPicker
                            label={t('shred.select_bike')}
                            options={bikes.map(b => ({ label: b.name, value: b.id }))}
                            value={kmBikeId}
                            onValueChange={setKmBikeId}
                            accentColor={ACCENT}
                        />
                    </>
                )}

                <BPInput
                    label={t('shred.km_label')}
                    placeholder="0"
                    value={kmInput}
                    onChangeText={(v) => { setKmInput(v); setKmError(''); }}
                    keyboardType="numeric"
                    suffix="km"
                    accentColor={ACCENT}
                    error={kmError}
                />

                <BPButton
                    title={t('common.save')}
                    onPress={handleKmSubmit}
                    color={ACCENT}
                    fullWidth
                />
            </BPModal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
    },
    alertCard: {
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.accentRed + '15',
        borderColor: theme.colors.accentRed + '40',
    },
    alertText: {
        color: theme.colors.accentRed,
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl * 2,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: theme.spacing.md,
    },
    emptyTitle: {
        color: theme.colors.text,
        fontSize: 20,
        fontWeight: '700',
    },
    emptySubtitle: {
        color: theme.colors.textMuted,
        fontSize: 14,
        marginTop: 8,
    },
    compCard: {
        marginTop: theme.spacing.md,
        padding: theme.spacing.md,
    },
    compHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    compEmoji: {
        fontSize: 28,
    },
    compTitle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    compType: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginTop: 1,
    },
    compBike: {
        color: theme.colors.textMuted,
        fontSize: 11,
        marginTop: 1,
    },
    compNotes: {
        color: theme.colors.textMuted,
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: theme.spacing.sm,
    },
    compDate: {
        color: theme.colors.textMuted,
        fontSize: 11,
    },
    wearItemContainer: {
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        borderTopWidth: 1,
        borderColor: theme.colors.border + '60',
    },
    wearItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    wearItemLabel: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    compActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
    },
    actionBtn: {
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.sm,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    actionBtnText: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    serviceBtn: {
        borderColor: theme.colors.accentLime + '60',
        backgroundColor: theme.colors.accentLime + '10',
    },
    serviceBtnText: {
        color: theme.colors.accentLime,
    },
    kmModalSub: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        marginBottom: theme.spacing.md,
    },
});
