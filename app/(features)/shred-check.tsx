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
import { syncLoadBikes, syncLoadPreference, syncSavePreference } from '@/lib/sync';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
    const [components, setComponents] = useState<BikeComponent[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingComp, setEditingComp] = useState<BikeComponent | null>(null);

    const formatDate = (iso: string): string => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState('chain');
    const [currentKm, setCurrentKm] = useState('0');
    const [serviceIntervalKm, setServiceIntervalKm] = useState('500');
    const [lastServiceDate, setLastServiceDate] = useState(getTodayISO());
    const [notes, setNotes] = useState('');

    // --- Import from Component Tracker ---
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importBikes, setImportBikes] = useState<any[]>([]);
    const [importSelectedBikeId, setImportSelectedBikeId] = useState<string>('');

    const openImport = async () => {
        const bikes = await syncLoadBikes();
        setImportBikes(bikes);
        setImportSelectedBikeId(bikes.length > 0 ? bikes[0].id : '');
        setImportModalVisible(true);
    };

    const importSelectedBike = importBikes.find(b => b.id === importSelectedBikeId);

    // Map tracker type -> shred type (best-effort match)
    const trackerToShredType: Record<string, string> = {
        fork: 'fork_small', shock: 'shock_small', chain: 'chain',
        wheel_front: 'tire_front', wheel_rear: 'tire_rear',
        brake_front: 'brake_front', brake_rear: 'brake_rear',
        cassette: 'cassette', derailleur: 'derailleur', other: 'other',
    };

    const handleImportComp = (comp: any) => {
        const shredType = trackerToShredType[comp.type] ?? 'other';
        const compData: BikeComponent = {
            id: Date.now().toString(),
            name: `${comp.brand ?? ''} ${comp.model ?? ''}`.trim() || getTypeName(shredType),
            type: shredType,
            currentKm: 0,
            serviceIntervalKm: defaultIntervals[shredType] ?? 500,
            lastServiceDate: getTodayISO(),
            installedDate: getTodayISO(),
            notes: comp.notes ?? '',
        };
        persist([compData, ...components]);
        setImportModalVisible(false);
    };

    useEffect(() => {
        syncLoadPreference<BikeComponent[]>('shred_check', STORAGE_KEY).then(data => setComponents(data ?? []));
    }, []);

    const persist = async (updated: BikeComponent[]) => {
        await syncSavePreference('shred_check', STORAGE_KEY, updated);
        setComponents(updated);
    };

    const openNew = () => {
        setEditingComp(null);
        setName('');
        setType('chain');
        setCurrentKm('0');
        setServiceIntervalKm(defaultIntervals['chain'].toString());
        setLastServiceDate(getTodayISO());
        setNotes('');
        setModalVisible(true);
    };

    const openEdit = (comp: BikeComponent) => {
        setEditingComp(comp);
        setName(comp.name);
        setType(comp.type);
        setCurrentKm(comp.currentKm.toString());
        setServiceIntervalKm(comp.serviceIntervalKm.toString());
        setLastServiceDate(comp.lastServiceDate);
        setNotes(comp.notes);
        setModalVisible(true);
    };

    const handleTypeChange = (newType: string) => {
        setType(newType);
        if (!editingComp) {
            setServiceIntervalKm((defaultIntervals[newType] ?? 500).toString());
        }
    };

    const handleSave = () => {
        const compData: BikeComponent = {
            id: editingComp?.id ?? Date.now().toString(),
            name: name.trim() || getTypeName(type),
            type,
            currentKm: parseFloat(currentKm) || 0,
            serviceIntervalKm: parseInt(serviceIntervalKm, 10) || 500,
            lastServiceDate,
            installedDate: editingComp?.installedDate ?? getTodayISO(),
            notes: notes.trim(),
        };

        let updated: BikeComponent[];
        if (editingComp) {
            updated = components.map((c) => (c.id === editingComp.id ? compData : c));
        } else {
            updated = [compData, ...components];
        }
        persist(updated);
        setModalVisible(false);
    };

    const handleService = (comp: BikeComponent) => {
        Alert.alert(
            'Service durchgeführt?',
            `${getTypeEmoji(comp.type)} ${comp.name} — km-Zähler zurücksetzen?`,
            [
                { text: 'Abbrechen', style: 'cancel' },
                {
                    text: '✅ Service erledigt',
                    onPress: () => {
                        const updated = components.map((c) =>
                            c.id === comp.id
                                ? { ...c, currentKm: 0, lastServiceDate: getTodayISO() }
                                : c
                        );
                        persist(updated);
                    },
                },
            ]
        );
    };

    const handleDelete = (id: string) => {
        Alert.alert('Komponente löschen?', '', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => persist(components.filter((c) => c.id !== id)),
            },
        ]);
    };

    const handleAddKm = (comp: BikeComponent) => {
        Alert.prompt
            ? Alert.prompt('km hinzufügen', `Wie viele km für ${comp.name}?`, (val) => {
                const km = parseFloat(val);
                if (!isNaN(km) && km > 0) {
                    const updated = components.map((c) =>
                        c.id === comp.id ? { ...c, currentKm: c.currentKm + km } : c
                    );
                    persist(updated);
                }
            })
            : (() => {
                // Fallback for platforms without Alert.prompt
                const km = 10; // add 10km as default
                const updated = components.map((c) =>
                    c.id === comp.id ? { ...c, currentKm: c.currentKm + km } : c
                );
                persist(updated);
            })();
    };

    // Sort: most worn first
    const sorted = [...components].sort((a, b) => {
        const pctA = a.currentKm / a.serviceIntervalKm;
        const pctB = b.currentKm / b.serviceIntervalKm;
        return pctB - pctA;
    });

    const needsService = sorted.filter(
        (c) => c.currentKm / c.serviceIntervalKm >= 0.8
    ).length;

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

                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
                    <BPButton
                        title={t('shred.add_component')}
                        onPress={openNew}
                        color={ACCENT}
                        size="lg"
                        style={{ flex: 1 }}
                    />
                    <BPButton
                        title={t('shred.import_from_tracker')}
                        onPress={openImport}
                        variant="secondary"
                        color={ACCENT}
                        size="lg"
                        style={{ flex: 1 }}
                    />
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
                        const pct = (comp.currentKm / comp.serviceIntervalKm) * 100;
                        return (
                            <TouchableOpacity
                                key={comp.id}
                                onPress={() => openEdit(comp)}
                                activeOpacity={0.8}
                            >
                                <BPCard style={styles.compCard}>
                                    <View style={styles.compHeader}>
                                        <Text style={styles.compEmoji}>{getTypeEmoji(comp.type)}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.compTitle}>{comp.name}</Text>
                                            <Text style={styles.compType}>{getTypeName(comp.type)}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDelete(comp.id)}>
                                            <Text style={styles.deleteIcon}>🗑</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <BPProgressBar
                                        label={`${comp.currentKm} / ${comp.serviceIntervalKm} km`}
                                        value={comp.currentKm}
                                        max={comp.serviceIntervalKm}
                                        unit="%"
                                        colorThresholds
                                        containerStyle={{ marginTop: theme.spacing.sm }}
                                    />

                                    <View style={styles.compFooter}>
                                        <Text style={styles.compDate}>
                                            {t('shred.service_label')} {formatDate(comp.lastServiceDate)}
                                        </Text>
                                        <View style={styles.compActions}>
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                onPress={() => handleAddKm(comp)}
                                            >
                                                <Text style={styles.actionBtnText}>{t('shred.add_10km')}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.serviceBtn]}
                                                onPress={() => handleService(comp)}
                                            >
                                                <Text style={[styles.actionBtnText, styles.serviceBtnText]}>
                                                    {t('shred.service_done')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {comp.notes ? (
                                        <Text style={styles.compNotes}>{comp.notes}</Text>
                                    ) : null}
                                </BPCard>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* Create/Edit Modal */}
            <BPModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={editingComp ? t('shred.edit_component') : t('shred.new_component')}
            >
                <BPPicker
                    label={t('shred.type')}
                    options={componentTypes}
                    value={type}
                    onValueChange={handleTypeChange}
                    accentColor={ACCENT}
                />
                <BPInput
                    label={t('shred.name_optional')}
                    placeholder={t('shred.name_placeholder')}
                    value={name}
                    onChangeText={setName}
                    accentColor={ACCENT}
                />

                <View style={styles.inputRow}>
                    <BPInput
                        label={t('shred.current_km')}
                        placeholder="0"
                        value={currentKm}
                        onChangeText={setCurrentKm}
                        keyboardType="numeric"
                        suffix="km"
                        accentColor={ACCENT}
                        containerStyle={{ flex: 1 }}
                    />
                    <BPInput
                        label={t('shred.interval_km')}
                        placeholder="500"
                        value={serviceIntervalKm}
                        onChangeText={setServiceIntervalKm}
                        keyboardType="numeric"
                        suffix="km"
                        accentColor={ACCENT}
                        containerStyle={{ flex: 1 }}
                    />
                </View>

                <BPInput
                    label={t('shred.last_service')}
                    placeholder="YYYY-MM-DD"
                    value={lastServiceDate}
                    onChangeText={setLastServiceDate}
                    accentColor={ACCENT}
                />
                <BPInput
                    label={t('shred.notes')}
                    placeholder="z.B. Schwalbe Magic Mary, Soft compound"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={2}
                    accentColor={ACCENT}
                />

                <View style={styles.modalActions}>
                    <BPButton
                        title={t('common.save')}
                        onPress={handleSave}
                        color={ACCENT}
                        fullWidth
                        size="lg"
                    />
                </View>
            </BPModal>

            {/* Import Modal */}
            <BPModal
                visible={importModalVisible}
                onClose={() => setImportModalVisible(false)}
                title={t('shred.import_title')}
            >
                {importBikes.length === 0 ? (
                    <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: theme.spacing.lg }}>
                        {t('shred.import_no_bikes')}
                    </Text>
                ) : (
                    <>
                        <BPPicker
                            label={t('shred.import_select_bike')}
                            options={importBikes.map(b => ({ label: `${b.name}`, value: b.id }))}
                            value={importSelectedBikeId}
                            onValueChange={setImportSelectedBikeId}
                            accentColor={ACCENT}
                        />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            {t('shred.import_select_component')}
                        </Text>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {importSelectedBike?.components?.map((comp: any) => (
                                <TouchableOpacity
                                    key={comp.id}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 12, backgroundColor: theme.colors.elevated,
                                        borderRadius: theme.radius.md, marginBottom: 6,
                                        borderWidth: 1, borderColor: theme.colors.border,
                                    }}
                                    onPress={() => handleImportComp(comp)}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                                            {comp.brand} {comp.model}
                                        </Text>
                                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                                            {comp.type}
                                        </Text>
                                    </View>
                                    <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>
                                        {t('shred.import_btn')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                )}
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
    deleteIcon: {
        fontSize: 16,
        padding: 4,
    },
    compFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    compDate: {
        color: theme.colors.textMuted,
        fontSize: 11,
    },
    compActions: {
        flexDirection: 'row',
        gap: 8,
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
    compNotes: {
        color: theme.colors.textMuted,
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: theme.spacing.sm,
    },
    inputRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    modalActions: {
        marginTop: theme.spacing.lg,
    },
});
