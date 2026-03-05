/**
 * F2: Shred-Check — Komponenten-Tracker
 * Agent Manifest: f2_shred_check.md
 *
 * Tracking: km/Betriebsstunden für Gabel, Dämpfer, Kette, Reifen, Bremsbeläge
 * Service-Intervalle: Automatische Warnungen bei fälligem Service
 * Integration: Liest Ride-Log km für automatische Aggregation (später)
 * UI Supervisor: Wear & Tear Fortschrittsbalken
 */
import { BPButton, BPCard, BPProgressBar } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { SyncBike, SyncComponent, syncLoadBikes, syncSaveBikes, WearItem } from '@/lib/sync';
import { Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#FF5252'; // Shred-Check accent
const STORAGE_KEY = '@bikepro_components';

// --- Types ---
interface BikeComponent {
    id: string;
    name: string;
    type: string;
    currentKm: number;
    serviceIntervalKm: number;
    lastServiceDate: string;
    installedDate: string;
    notes: string;
}

const componentTypes = [
    { label: '🔱 Gabel (kleiner Service)', value: 'fork_small' },
    { label: '🔱 Gabel (großer Service)', value: 'fork_full' },
    { label: '🔩 Dämpfer (kleiner Service)', value: 'shock_small' },
    { label: '🔩 Dämpfer (großer Service)', value: 'shock_full' },
    { label: '⛓️ Kette', value: 'chain' },
    { label: '🛞 Reifen VR', value: 'tire_front' },
    { label: '🛞 Reifen HR', value: 'tire_rear' },
    { label: '🛑 Bremsbeläge VR', value: 'brake_front' },
    { label: '🛑 Bremsbeläge HR', value: 'brake_rear' },
    { label: '💧 Bremsflüssigkeit', value: 'brake_fluid' },
    { label: '🔗 Bremsscheibe VR', value: 'disc_front' },
    { label: '🔗 Bremsscheibe HR', value: 'disc_rear' },
    { label: '🔗 Schaltwerk', value: 'derailleur' },
    { label: '⚙️ Kassette', value: 'cassette' },
    { label: '🔄 Steuersatzlager', value: 'headset' },
    { label: '🔄 Tretlager', value: 'bb' },
    { label: '🔄 Hinterbaulager', value: 'pivot' },
    { label: '🔄 Nabenlager', value: 'hub' },
    { label: '🎗️ Felgenband', value: 'rimtape' },
    { label: '💧 Dichtmilch', value: 'sealant' },
    { label: '🧵 Züge / Leitungen', value: 'cables' },
    { label: '🔧 Andere', value: 'other' },
];

// Default service intervals in km (realistische Werte basierend auf Herstellerempfehlungen)
const defaultIntervals: Record<string, number> = {
    fork_small: 100,     // Alle ~50h → Lower legs service
    fork_full: 200,      // Alle ~100-200h → Full service mit Ölwechsel
    shock_small: 125,    // Alle ~50h → Luftkammer-Service
    shock_full: 250,     // Alle ~100-200h → Full service
    chain: 400,          // Alle 300-500km je nach Bedingungen
    tire_front: 1200,    // Abhängig von Compound und Terrain
    tire_rear: 800,      // Hinterreifen verschleißt schneller
    brake_front: 500,    // Abhängig von Bremsstil (Bikepark = schneller)
    brake_rear: 350,     // Hinten wird mehr gebremst
    brake_fluid: 1500,   // Jährlich oder bei schwammigem Griff
    disc_front: 5000,    // Hält sehr lange
    disc_rear: 3000,     // Hinterrad verschleißt schneller
    derailleur: 2000,    // Hauptsächlich Schaltauge prüfen
    cassette: 1500,      // Alle 2-3 Ketten
    headset: 3000,       // Kontrollieren, fetten
    bb: 2000,            // Alle 1-2 Jahre (je nach Lager-Typ)
    pivot: 1000,         // Häufiger bei Matsch / Bikepark
    hub: 3000,           // Alle 1-2 Jahre
    rimtape: 2000,       // Bei Tubeless regelmäßig prüfen
    sealant: 300,        // Alle 3-6 Monate nachfüllen
    cables: 3000,        // Abhängig von Verschmutzung
    other: 500,
};

function getTypeEmoji(type: string): string {
    return componentTypes.find((t) => t.value === type)?.label.split(' ')[0] ?? '🔧';
}

function getTypeName(type: string): string {
    return componentTypes.find((t) => t.value === type)?.label.split(' ').slice(1).join(' ') ?? type;
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
        const updatedBikes = bikes.map(b => ({
            ...b,
            components: b.components.map(c => c.id === compId ? updateFn(c) : c)
        }));
        await syncSaveBikes(updatedBikes);
        setBikes(updatedBikes);
    };

    const handleService = (comp: SyncComponent, item: WearItem) => {
        Alert.alert(
            'Service durchgeführt?',
            `${item.label} (${comp.brand || ''} ${comp.model || comp.type}) — km-Zähler zurücksetzen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: '✅ Erledigt',
                    onPress: () => {
                        updateComponentInBikes(comp.id, c => ({
                            ...c,
                            wearItems: (c.wearItems || []).map(w =>
                                w.id === item.id
                                    ? { ...w, currentKm: 0, lastServiceDate: getTodayISO() }
                                    : w
                            )
                        }));
                    },
                },
            ]
        );
    };

    const handleAddKmItem = (comp: SyncComponent, item: WearItem) => {
        Alert.prompt
            ? Alert.prompt('km hinzufügen', `Für ${item.label} (${comp.brand || ''} ${comp.model || comp.type})`, (val) => {
                const km = parseFloat(val);
                if (!isNaN(km) && km > 0) {
                    updateComponentInBikes(comp.id, c => ({
                        ...c,
                        wearItems: (c.wearItems || []).map(w =>
                            w.id === item.id
                                ? { ...w, currentKm: w.currentKm + km }
                                : w
                        )
                    }));
                }
            })
            : (() => {
                const km = 10;
                updateComponentInBikes(comp.id, c => ({
                    ...c,
                    wearItems: (c.wearItems || []).map(w =>
                        w.id === item.id
                            ? { ...w, currentKm: w.currentKm + km }
                            : w
                    )
                }));
            })();
    };

    const handleAddGlobalKm = () => {
        Alert.prompt
            ? Alert.prompt('Tour erfassen', 'Wie viele Kilometer bist du gefahren?', (val) => {
                const km = parseFloat(val);
                if (!isNaN(km) && km > 0) {
                    const updatedBikes = bikes.map(b => ({
                        ...b,
                        components: b.components.map(c => {
                            if (!c.isWearTracked || !c.wearItems) return c;
                            return {
                                ...c,
                                wearItems: c.wearItems.map(w => ({
                                    ...w,
                                    currentKm: w.currentKm + km
                                }))
                            };
                        })
                    }));
                    syncSaveBikes(updatedBikes);
                    setBikes(updatedBikes);
                }
            })
            : Alert.alert('Fehler', 'Nicht unterstützt auf dieser Plattform.');
    };

    // Extract all components that have wear tracking enabled
    const allTrackedComps = bikes.flatMap(b => b.components.filter(c => c.isWearTracked === true));

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
                        title="+ Alle (Tour erfassen)"
                        onPress={handleAddGlobalKm}
                        color={ACCENT}
                        size="md"
                        fullWidth
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
                                            <Text style={styles.compType}>{getTypeName(comp.type)}</Text>
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
                                                    <Text style={styles.actionBtnText}>{t('shred.add_10km', { defaultValue: '+10 km' })}</Text>
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
});
