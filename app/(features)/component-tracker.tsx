/**
 * F9: Component Tracker — Gear & Setups
 * Agent Manifest: f9_component_tracker.md
 *
 * Bike-Master + Komponenten CRUD + flexible Setup-Werte (Torque, Angle etc.)
 * Storage: AsyncStorage (Supabase later)
 */
import { BPButton, BPCard, BPInput, BPModal, BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { syncLoadBikes, syncSaveBikes } from '@/lib/sync';
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

const ACCENT = '#26A69A';

// --- Types ---
interface SetupValue {
    key: string;
    value: string;
    unit: string;
}

interface Component {
    id: string;
    type: string;
    brand: string;
    model: string;
    weight: string;
    purchaseDate: string;
    setupValues: SetupValue[];
    notes: string;
}

interface Bike {
    id: string;
    name: string;
    type: string;
    model: string;
    year: string;
    size: string;
    components: Component[];
}

const bikeTypeOptions = [
    { label: '🚵 Enduro', value: 'enduro' },
    { label: '⛰️ Downhill', value: 'downhill' },
    { label: '🌲 Trail', value: 'trail' },
    { label: '⚡ E-MTB', value: 'emtb' },
    { label: '🏁 XC / Race', value: 'xc' },
    { label: '🦘 Dirt / Slopestyle', value: 'dirt' },
];

const bikeSizeOptions = [
    { label: 'XS', value: 'XS' },
    { label: 'S', value: 'S' },
    { label: 'M', value: 'M' },
    { label: 'L', value: 'L' },
    { label: 'XL', value: 'XL' },
    { label: 'XXL', value: 'XXL' },
];

export default function ComponentTrackerScreen() {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language.startsWith('de');
    const tirePressureUnit = isGerman ? 'bar' : 'psi';
    const [bikes, setBikes] = useState<Bike[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
    const [bikeModalVisible, setBikeModalVisible] = useState(false);
    const [compModalVisible, setCompModalVisible] = useState(false);
    const [editingBike, setEditingBike] = useState<Bike | null>(null);
    const [editingComp, setEditingComp] = useState<Component | null>(null);

    // Bike form
    const [bikeName, setBikeName] = useState('');
    const [bikeType, setBikeType] = useState('enduro');
    const [bikeModel, setBikeModel] = useState('');
    const [bikeYear, setBikeYear] = useState('2024');
    const [bikeSize, setBikeSize] = useState('L');

    // Component form
    const [compType, setCompType] = useState('handlebar');
    const [compBrand, setCompBrand] = useState('');
    const [compModel, setCompModel] = useState('');
    const [compWeight, setCompWeight] = useState('');
    const [compNotes, setCompNotes] = useState('');
    const [compSetup, setCompSetup] = useState<SetupValue[]>([]);
    const [compMoveToBikeId, setCompMoveToBikeId] = useState<string>('');

    const componentTypes = [
        { label: t('tracker.type_handlebar'), value: 'handlebar' },
        { label: t('tracker.type_brake_front'), value: 'brake_front' },
        { label: t('tracker.type_brake_rear'), value: 'brake_rear' },
        { label: t('tracker.type_saddle'), value: 'saddle' },
        { label: t('tracker.type_seatpost'), value: 'seatpost' },
        { label: t('tracker.type_grips'), value: 'grips' },
        { label: t('tracker.type_pedals'), value: 'pedals' },
        { label: t('tracker.type_fork'), value: 'fork' },
        { label: t('tracker.type_shock'), value: 'shock' },
        { label: t('tracker.type_wheel_front'), value: 'wheel_front' },
        { label: t('tracker.type_wheel_rear'), value: 'wheel_rear' },
        { label: t('tracker.type_chain'), value: 'chain' },
        { label: t('tracker.type_cassette'), value: 'cassette' },
        { label: t('tracker.type_derailleur'), value: 'derailleur' },
        { label: t('tracker.type_stem'), value: 'stem' },
        { label: t('tracker.type_battery'), value: 'battery' },
        { label: t('tracker.type_motor'), value: 'motor' },
        { label: t('tracker.type_other'), value: 'other' },
    ];

    const defaultSetupKeys: Record<string, SetupValue[]> = {
        handlebar: [{ key: 'Breite', value: '', unit: 'mm' }, { key: 'Rise', value: '', unit: 'mm' }, { key: 'Backsweep', value: '', unit: '°' }, { key: 'Upsweep', value: '', unit: '°' }],
        brake_front: [{ key: 'Scheibengröße', value: '', unit: 'mm' }, { key: 'Hebelweite', value: '', unit: 'mm' }, { key: 'Drehmoment Adapter', value: '', unit: 'Nm' }],
        brake_rear: [{ key: 'Scheibengröße', value: '', unit: 'mm' }, { key: 'Hebelweite', value: '', unit: 'mm' }, { key: 'Drehmoment Adapter', value: '', unit: 'Nm' }],
        saddle: [{ key: 'Neigung', value: '', unit: '°' }, { key: 'Höhe', value: '', unit: 'mm' }, { key: 'Setback', value: '', unit: 'mm' }],
        seatpost: [{ key: 'Hub', value: '', unit: 'mm' }, { key: 'Durchmesser', value: '', unit: 'mm' }, { key: 'Drehmoment Klemme', value: '', unit: 'Nm' }],
        grips: [{ key: 'Drehmoment', value: '', unit: 'Nm' }],
        pedals: [{ key: 'Drehmoment', value: '', unit: 'Nm' }, { key: 'Plattformgröße', value: '', unit: 'mm' }],
        stem: [{ key: 'Länge', value: '', unit: 'mm' }, { key: 'Winkel', value: '', unit: '°' }, { key: 'Drehmoment Lenker', value: '', unit: 'Nm' }, { key: 'Drehmoment Steuerrohr', value: '', unit: 'Nm' }],
        fork: [{ key: 'Federweg', value: '', unit: 'mm' }, { key: 'Offset', value: '', unit: 'mm' }],
        shock: [{ key: 'Federweg', value: '', unit: 'mm' }, { key: 'Einbaulänge', value: '', unit: 'mm' }, { key: 'Hub', value: '', unit: 'mm' }],
        wheel_front: [{ key: 'Größe', value: '', unit: '"' }, { key: 'Reifen', value: '', unit: '' }, { key: 'Druck', value: '', unit: tirePressureUnit }],
        wheel_rear: [{ key: 'Größe', value: '', unit: '"' }, { key: 'Reifen', value: '', unit: '' }, { key: 'Druck', value: '', unit: tirePressureUnit }],
        chain: [{ key: 'Glieder', value: '', unit: '' }, { key: 'Typ', value: '', unit: '' }],
        cassette: [{ key: 'Abstufung', value: '', unit: '' }, { key: 'Zähne', value: '', unit: '' }],
        derailleur: [{ key: 'Max. Zähne', value: '', unit: '' }, { key: 'Kettenblatt', value: '', unit: 'T' }],
        battery: [{ key: 'Kapazität', value: '', unit: 'Wh' }, { key: 'Ladezyklen', value: '', unit: '' }],
        motor: [{ key: 'Max. Drehmoment', value: '', unit: 'Nm' }, { key: 'Leistung', value: '', unit: 'W' }],
        other: [],
    };

    function getTypeLabel(type: string): string {
        return componentTypes.find(t => t.value === type)?.label ?? t('tracker.type_other');
    }

    useEffect(() => {
        syncLoadBikes().then((data) => {
            setBikes(data);
            if (data.length > 0) setSelectedBikeId(data[0].id);
        });
    }, []);

    const persist = async (updated: Bike[]) => {
        await syncSaveBikes(updated);
        setBikes(updated);
    };

    const selectedBike = bikes.find((b) => b.id === selectedBikeId) ?? null;

    // --- Bike CRUD ---
    const openNewBike = () => {
        setEditingBike(null);
        setBikeName('');
        setBikeType('enduro');
        setBikeModel('');
        setBikeYear('2024');
        setBikeSize('L');
        setBikeModalVisible(true);
    };

    const openEditBike = (bike: Bike) => {
        setEditingBike(bike);
        setBikeName(bike.name);
        setBikeType(bike.type);
        setBikeModel(bike.model);
        setBikeYear(bike.year);
        setBikeSize(bike.size ?? 'L');
        setBikeModalVisible(true);
    };

    const saveBike = () => {
        if (!bikeName.trim()) return;
        const bikeData: Bike = {
            id: editingBike?.id ?? Date.now().toString(),
            name: bikeName.trim(),
            type: bikeType,
            model: bikeModel.trim(),
            year: bikeYear,
            size: bikeSize,
            components: editingBike?.components ?? [],
        };
        let updated: Bike[];
        if (editingBike) {
            updated = bikes.map((b) => (b.id === editingBike.id ? bikeData : b));
        } else {
            updated = [...bikes, bikeData];
            setSelectedBikeId(bikeData.id);
        }
        persist(updated);
        setBikeModalVisible(false);
    };

    const deleteBike = (id: string) => {
        Alert.alert('Bike löschen?', 'Alle Komponenten gehen verloren.', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => {
                    const updated = bikes.filter((b) => b.id !== id);
                    persist(updated);
                    setSelectedBikeId(updated[0]?.id ?? null);
                },
            },
        ]);
    };

    // --- Component CRUD ---
    const openNewComp = () => {
        setEditingComp(null);
        setCompType('handlebar');
        setCompBrand('');
        setCompModel('');
        setCompWeight('');
        setCompNotes('');
        setCompSetup(defaultSetupKeys['handlebar']?.map(s => ({ ...s })) ?? []);
        setCompMoveToBikeId('');
        setCompModalVisible(true);
    };

    const openEditComp = (comp: Component) => {
        setEditingComp(comp);
        setCompType(comp.type);
        setCompBrand(comp.brand);
        setCompModel(comp.model);
        setCompWeight(comp.weight);
        setCompNotes(comp.notes);
        // Merge saved values with defaults so new fields show up
        const defaults = defaultSetupKeys[comp.type] ?? [];
        const saved = comp.setupValues ?? [];
        const merged = defaults.map(d => {
            const existing = saved.find(s => s.key === d.key);
            return existing ? { ...existing } : { ...d };
        });
        // Keep any saved keys that aren't in defaults (custom entries)
        saved.forEach(s => {
            if (!merged.find(m => m.key === s.key)) merged.push({ ...s });
        });
        setCompSetup(merged);
        setCompMoveToBikeId('');
        setCompModalVisible(true);
    };

    const handleCompTypeChange = (newType: string) => {
        setCompType(newType);
        if (!editingComp) {
            setCompSetup(defaultSetupKeys[newType]?.map(s => ({ ...s })) ?? []);
        }
    };

    const updateSetupValue = (index: number, value: string) => {
        setCompSetup(prev => prev.map((s, i) => i === index ? { ...s, value } : s));
    };

    const saveComp = () => {
        if (!selectedBike) return;
        const compData: Component = {
            id: editingComp?.id ?? Date.now().toString(),
            type: compType,
            brand: compBrand.trim(),
            model: compModel.trim(),
            weight: compWeight,
            purchaseDate: editingComp?.purchaseDate ?? new Date().toISOString().split('T')[0],
            setupValues: compSetup.filter(s => s.value.trim() !== ''),
            notes: compNotes.trim(),
        };

        let updatedBikes = [...bikes];

        // Move to different bike?
        if (editingComp && compMoveToBikeId && compMoveToBikeId !== selectedBike.id) {
            // Remove from current bike
            updatedBikes = updatedBikes.map(b =>
                b.id === selectedBike.id
                    ? { ...b, components: b.components.filter(c => c.id !== editingComp.id) }
                    : b
            );
            // Add to target bike
            updatedBikes = updatedBikes.map(b =>
                b.id === compMoveToBikeId
                    ? { ...b, components: [...b.components, compData] }
                    : b
            );
        } else {
            // Normal save (edit or create on current bike)
            const updatedBike = { ...selectedBike };
            if (editingComp) {
                updatedBike.components = updatedBike.components.map(c =>
                    c.id === editingComp.id ? compData : c
                );
            } else {
                updatedBike.components = [...updatedBike.components, compData];
            }
            updatedBikes = updatedBikes.map(b => b.id === selectedBike.id ? updatedBike : b);
        }

        persist(updatedBikes);
        setCompModalVisible(false);
    };

    const deleteComp = (compId: string) => {
        if (!selectedBike) return;
        Alert.alert('Komponente löschen?', '', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => {
                    const updatedBike = {
                        ...selectedBike,
                        components: selectedBike.components.filter(c => c.id !== compId),
                    };
                    persist(bikes.map(b => b.id === selectedBike.id ? updatedBike : b));
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: `🔩 ${t('features.component-tracker.title', { defaultValue: 'Component Tracker' })}`,
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Bike selector */}
                {bikes.length > 0 && (
                    <BPPicker
                        label="Bike auswählen"
                        options={bikes.map(b => ({
                            label: `${bikeTypeOptions.find(t => t.value === b.type)?.label.split(' ')[0] ?? '🚵'} ${b.name}`,
                            value: b.id,
                        }))}
                        value={selectedBikeId ?? ''}
                        onValueChange={setSelectedBikeId}
                        accentColor={ACCENT}
                    />
                )}

                <View style={styles.btnRow}>
                    <BPButton
                        title="+ Neues Bike"
                        onPress={openNewBike}
                        color={ACCENT}
                        size="md"
                        style={{ flex: 1 }}
                    />
                    {selectedBike && (
                        <BPButton
                            title="+ Komponente"
                            onPress={openNewComp}
                            variant="secondary"
                            color={ACCENT}
                            size="md"
                            style={{ flex: 1 }}
                        />
                    )}
                </View>

                {/* Selected bike info */}
                {selectedBike && (
                    <BPCard accentColor={ACCENT} style={styles.bikeCard}>
                        <View style={styles.bikeHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bikeName}>{selectedBike.name}</Text>
                                <Text style={styles.bikeInfo}>
                                    {selectedBike.model} • {selectedBike.year} • Gr. {selectedBike.size ?? '–'} • {bikeTypeOptions.find(t => t.value === selectedBike.type)?.label}
                                </Text>
                            </View>
                            <View style={styles.bikeActions}>
                                <TouchableOpacity onPress={() => openEditBike(selectedBike)}>
                                    <Text style={styles.actionIcon}>✏️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => deleteBike(selectedBike.id)}>
                                    <Text style={styles.actionIcon}>🗑</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={styles.compCount}>
                            {selectedBike.components.length} Komponenten
                        </Text>
                    </BPCard>
                )}

                {/* Components list */}
                {selectedBike?.components.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🔩</Text>
                        <Text style={styles.emptyTitle}>{t('tracker.components')}</Text>
                        <Text style={styles.emptySubtitle}>—</Text>
                    </View>
                )}

                {!selectedBike && bikes.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🚵</Text>
                        <Text style={styles.emptyTitle}>{t('tracker.no_bikes')}</Text>
                        <Text style={styles.emptySubtitle}>{t('tracker.add_first_bike')}</Text>
                    </View>
                )}

                {selectedBike?.components.map((comp) => (
                    <TouchableOpacity
                        key={comp.id}
                        onPress={() => openEditComp(comp)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.compRow}>
                            <View style={styles.compRowLeft}>
                                <Text style={styles.compRowType}>{getTypeLabel(comp.type)}</Text>
                                {(comp.brand || comp.model) ? (
                                    <Text style={styles.compRowBrand} numberOfLines={1}>
                                        {comp.brand} {comp.model}{comp.weight ? ` · ${comp.weight}g` : ''}
                                    </Text>
                                ) : null}
                            </View>
                            {comp.setupValues.length > 0 && (
                                <View style={styles.compRowChips}>
                                    {comp.setupValues.slice(0, 3).map((sv, i) => (
                                        <Text key={i} style={styles.compRowChip}>
                                            <Text style={styles.compRowChipKey}>{sv.key} </Text>
                                            <Text style={[styles.compRowChipVal, { color: ACCENT }]}>{sv.value}{sv.unit}</Text>
                                        </Text>
                                    ))}
                                    {comp.setupValues.length > 3 && (
                                        <Text style={styles.compRowChipMore}>+{comp.setupValues.length - 3}</Text>
                                    )}
                                </View>
                            )}
                            {comp.notes ? (
                                <Text style={styles.compRowNotes} numberOfLines={1}>{comp.notes}</Text>
                            ) : null}
                            <TouchableOpacity onPress={() => deleteComp(comp.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.compRowDelete}>
                                <Text style={{ fontSize: 14 }}>🗑</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Bike Modal */}
            <BPModal
                visible={bikeModalVisible}
                onClose={() => setBikeModalVisible(false)}
                title={editingBike ? t('tracker.edit_bike') : t('tracker.add_bike')}
            >
                <BPInput label={t('tracker.name')} placeholder="z.B. Canyon Torque" value={bikeName} onChangeText={setBikeName} accentColor={ACCENT} />
                <BPPicker label={t('tracker.type')} options={bikeTypeOptions} value={bikeType} onValueChange={setBikeType} accentColor={ACCENT} />
                <View style={styles.inputRow}>
                    <BPInput label={t('tracker.model')} placeholder="z.B. CF 8.0" value={bikeModel} onChangeText={setBikeModel} accentColor={ACCENT} containerStyle={{ flex: 2 }} />
                    <BPPicker label={t('tracker.size')} options={bikeSizeOptions} value={bikeSize} onValueChange={setBikeSize} accentColor={ACCENT} />
                </View>
                <BPInput label={t('tracker.year')} placeholder="2024" value={bikeYear} onChangeText={setBikeYear} keyboardType="numeric" accentColor={ACCENT} />
                <View style={{ marginTop: theme.spacing.lg }}>
                    <BPButton title={t('common.save')} onPress={saveBike} color={ACCENT} fullWidth size="lg" disabled={!bikeName.trim()} />
                </View>
            </BPModal>

            {/* Component Modal */}
            <BPModal
                visible={compModalVisible}
                onClose={() => setCompModalVisible(false)}
                title={editingComp ? t('tracker.edit_component') : t('tracker.add_component')}
            >
                <BPPicker label={t('tracker.type')} options={componentTypes} value={compType} onValueChange={handleCompTypeChange} accentColor={ACCENT} />
                <View style={styles.inputRow}>
                    <BPInput label={t('tracker.brand')} placeholder="z.B. Shimano" value={compBrand} onChangeText={setCompBrand} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('tracker.model')} placeholder="z.B. XT M8120" value={compModel} onChangeText={setCompModel} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
                <BPInput label={t('tracker.weight')} placeholder="0" value={compWeight} onChangeText={setCompWeight} suffix="g" keyboardType="numeric" accentColor={ACCENT} />

                {/* Dynamic setup fields */}
                {compSetup.length > 0 && (
                    <View style={styles.setupSection}>
                        <Text style={styles.setupSectionTitle}>⚙️ {t('tracker.setup_values')}</Text>
                        {compSetup.map((sv, i) => (
                            <BPInput
                                key={`${sv.key}-${i}`}
                                label={sv.key}
                                placeholder="—"
                                value={sv.value}
                                onChangeText={(v) => updateSetupValue(i, v)}
                                suffix={sv.unit}
                                accentColor={ACCENT}
                            />
                        ))}
                    </View>
                )}

                <BPInput label="Notizen" placeholder="..." value={compNotes} onChangeText={setCompNotes} multiline numberOfLines={2} accentColor={ACCENT} />

                {/* Move to different bike (only when editing and >1 bike exists) */}
                {editingComp && bikes.length > 1 && (
                    <View style={styles.moveSection}>
                        <Text style={styles.moveSectionTitle}>🔄 {t('tracker.move_component')}</Text>
                        <BPPicker
                            label="Ziel-Bike"
                            options={[
                                { label: `📌 Aktuell: ${selectedBike?.name}`, value: '' },
                                ...bikes.filter(b => b.id !== selectedBikeId).map(b => ({
                                    label: `→ ${b.name} (${b.size ?? ''})`,
                                    value: b.id,
                                })),
                            ]}
                            value={compMoveToBikeId}
                            onValueChange={setCompMoveToBikeId}
                            accentColor={ACCENT}
                        />
                    </View>
                )}

                <View style={{ marginTop: theme.spacing.lg }}>
                    <BPButton title={t('common.save')} onPress={saveComp} color={ACCENT} fullWidth size="lg" />
                </View>
            </BPModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    btnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    bikeCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    bikeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    bikeName: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
    bikeInfo: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
    bikeActions: { flexDirection: 'row', gap: 12 },
    actionIcon: { fontSize: 16, padding: 4 },
    compCount: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
    emptySubtitle: { color: theme.colors.textMuted, fontSize: 14, marginTop: 8 },
    compRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 10,
        flexWrap: 'wrap',
    },
    compRowLeft: {
        minWidth: 140,
    },
    compRowType: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
    compRowBrand: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 1 },
    compRowChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        flex: 1,
    },
    compRowChip: {
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.sm,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    compRowChipKey: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
    compRowChipVal: { fontSize: 11, fontWeight: '800' },
    compRowChipMore: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', alignSelf: 'center' },
    compRowNotes: { color: theme.colors.textMuted, fontSize: 10, fontStyle: 'italic', flex: 1 },
    compRowDelete: { padding: 4 },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    setupSection: { marginTop: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md },
    setupSectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
    moveSection: { marginTop: theme.spacing.md, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: ACCENT + '40' },
    moveSectionTitle: { color: ACCENT, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
});
