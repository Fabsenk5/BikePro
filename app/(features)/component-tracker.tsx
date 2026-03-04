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

const componentTypes = [
    { label: '🔩 Lenker', value: 'handlebar' },
    { label: '🛑 Bremse VR', value: 'brake_front' },
    { label: '🛑 Bremse HR', value: 'brake_rear' },
    { label: '🪑 Sattel', value: 'saddle' },
    { label: '🏋️ Sattelstütze', value: 'seatpost' },
    { label: '✊ Griffe', value: 'grips' },
    { label: '👟 Pedale', value: 'pedals' },
    { label: '🔱 Gabel', value: 'fork' },
    { label: '🔩 Dämpfer', value: 'shock' },
    { label: '🛞 Laufrad VR', value: 'wheel_front' },
    { label: '🛞 Laufrad HR', value: 'wheel_rear' },
    { label: '⛓️ Kette', value: 'chain' },
    { label: '⚙️ Kassette', value: 'cassette' },
    { label: '🔗 Schaltwerk', value: 'derailleur' },
    { label: '🎯 Vorbau', value: 'stem' },
    { label: '🔧 Andere', value: 'other' },
];

// Default setup keys per component type
const defaultSetupKeys: Record<string, SetupValue[]> = {
    handlebar: [
        { key: 'Breite', value: '', unit: 'mm' },
        { key: 'Rise', value: '', unit: 'mm' },
        { key: 'Backsweep', value: '', unit: '°' },
        { key: 'Upsweep', value: '', unit: '°' },
    ],
    brake_front: [
        { key: 'Scheibengröße', value: '', unit: 'mm' },
        { key: 'Hebelweite', value: '', unit: 'mm' },
        { key: 'Drehmoment Adapter', value: '', unit: 'Nm' },
    ],
    brake_rear: [
        { key: 'Scheibengröße', value: '', unit: 'mm' },
        { key: 'Hebelweite', value: '', unit: 'mm' },
        { key: 'Drehmoment Adapter', value: '', unit: 'Nm' },
    ],
    saddle: [
        { key: 'Neigung', value: '', unit: '°' },
        { key: 'Höhe', value: '', unit: 'mm' },
        { key: 'Setback', value: '', unit: 'mm' },
    ],
    seatpost: [
        { key: 'Hub', value: '', unit: 'mm' },
        { key: 'Durchmesser', value: '', unit: 'mm' },
        { key: 'Drehmoment Klemme', value: '', unit: 'Nm' },
    ],
    grips: [
        { key: 'Drehmoment', value: '', unit: 'Nm' },
    ],
    pedals: [
        { key: 'Drehmoment', value: '', unit: 'Nm' },
        { key: 'Plattformgröße', value: '', unit: 'mm' },
    ],
    stem: [
        { key: 'Länge', value: '', unit: 'mm' },
        { key: 'Winkel', value: '', unit: '°' },
        { key: 'Drehmoment Lenker', value: '', unit: 'Nm' },
        { key: 'Drehmoment Steuerrohr', value: '', unit: 'Nm' },
    ],
    fork: [
        { key: 'Federweg', value: '', unit: 'mm' },
        { key: 'Offset', value: '', unit: 'mm' },
    ],
    shock: [
        { key: 'Federweg', value: '', unit: 'mm' },
        { key: 'Einbaulänge', value: '', unit: 'mm' },
        { key: 'Hub', value: '', unit: 'mm' },
    ],
    wheel_front: [
        { key: 'Größe', value: '', unit: '"' },
        { key: 'Reifen', value: '', unit: '' },
        { key: 'Druck', value: '', unit: 'bar' },
    ],
    wheel_rear: [
        { key: 'Größe', value: '', unit: '"' },
        { key: 'Reifen', value: '', unit: '' },
        { key: 'Druck', value: '', unit: 'bar' },
    ],
    chain: [
        { key: 'Glieder', value: '', unit: '' },
        { key: 'Typ', value: '', unit: '' },
    ],
    cassette: [
        { key: 'Abstufung', value: '', unit: '' },
        { key: 'Zähne', value: '', unit: '' },
    ],
    derailleur: [
        { key: 'Max. Zähne', value: '', unit: '' },
        { key: 'Kettenblatt', value: '', unit: 'T' },
    ],
    other: [],
};

function getTypeLabel(type: string): string {
    return componentTypes.find(t => t.value === type)?.label ?? '🔧 Andere';
}

export default function ComponentTrackerScreen() {
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
        setCompSetup(comp.setupValues.map(s => ({ ...s })));
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
                    title: '🔩 Component Tracker',
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
                        <Text style={styles.emptyTitle}>Keine Komponenten</Text>
                        <Text style={styles.emptySubtitle}>Füge die Parts deines Bikes hinzu!</Text>
                    </View>
                )}

                {!selectedBike && bikes.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🚵</Text>
                        <Text style={styles.emptyTitle}>Kein Bike angelegt</Text>
                        <Text style={styles.emptySubtitle}>Erstelle zuerst dein Bike!</Text>
                    </View>
                )}

                {selectedBike?.components.map((comp) => (
                    <TouchableOpacity
                        key={comp.id}
                        onPress={() => openEditComp(comp)}
                        activeOpacity={0.8}
                    >
                        <BPCard style={styles.compCard}>
                            <View style={styles.compHeader}>
                                <Text style={styles.compTypeLabel}>{getTypeLabel(comp.type)}</Text>
                                <TouchableOpacity onPress={() => deleteComp(comp.id)}>
                                    <Text style={{ fontSize: 14 }}>🗑</Text>
                                </TouchableOpacity>
                            </View>
                            {(comp.brand || comp.model) && (
                                <Text style={styles.compBrandModel}>
                                    {comp.brand} {comp.model}
                                </Text>
                            )}
                            {comp.weight && (
                                <Text style={styles.compWeight}>{comp.weight}g</Text>
                            )}

                            {/* Setup values */}
                            {comp.setupValues.length > 0 && (
                                <View style={styles.setupGrid}>
                                    {comp.setupValues.map((sv, i) => (
                                        <View key={i} style={styles.setupChip}>
                                            <Text style={styles.setupKey}>{sv.key}</Text>
                                            <Text style={[styles.setupVal, { color: ACCENT }]}>
                                                {sv.value}{sv.unit}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {comp.notes ? (
                                <Text style={styles.compNotes}>{comp.notes}</Text>
                            ) : null}
                        </BPCard>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Bike Modal */}
            <BPModal
                visible={bikeModalVisible}
                onClose={() => setBikeModalVisible(false)}
                title={editingBike ? 'Bike bearbeiten' : 'Neues Bike'}
            >
                <BPInput label="Bike-Name" placeholder="z.B. Canyon Torque" value={bikeName} onChangeText={setBikeName} accentColor={ACCENT} />
                <BPPicker label="Typ" options={bikeTypeOptions} value={bikeType} onValueChange={setBikeType} accentColor={ACCENT} />
                <View style={styles.inputRow}>
                    <BPInput label="Modell" placeholder="z.B. CF 8.0" value={bikeModel} onChangeText={setBikeModel} accentColor={ACCENT} containerStyle={{ flex: 2 }} />
                    <BPPicker label="Größe" options={bikeSizeOptions} value={bikeSize} onValueChange={setBikeSize} accentColor={ACCENT} />
                </View>
                <BPInput label="Baujahr" placeholder="2024" value={bikeYear} onChangeText={setBikeYear} keyboardType="numeric" accentColor={ACCENT} />
                <View style={{ marginTop: theme.spacing.lg }}>
                    <BPButton title="Speichern" onPress={saveBike} color={ACCENT} fullWidth size="lg" disabled={!bikeName.trim()} />
                </View>
            </BPModal>

            {/* Component Modal */}
            <BPModal
                visible={compModalVisible}
                onClose={() => setCompModalVisible(false)}
                title={editingComp ? 'Komponente bearbeiten' : 'Neue Komponente'}
            >
                <BPPicker label="Typ" options={componentTypes} value={compType} onValueChange={handleCompTypeChange} accentColor={ACCENT} />
                <View style={styles.inputRow}>
                    <BPInput label="Hersteller" placeholder="z.B. Shimano" value={compBrand} onChangeText={setCompBrand} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label="Modell" placeholder="z.B. XT M8120" value={compModel} onChangeText={setCompModel} accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
                <BPInput label="Gewicht" placeholder="0" value={compWeight} onChangeText={setCompWeight} suffix="g" keyboardType="numeric" accentColor={ACCENT} />

                {/* Dynamic setup fields */}
                {compSetup.length > 0 && (
                    <View style={styles.setupSection}>
                        <Text style={styles.setupSectionTitle}>⚙️ Setup-Werte</Text>
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
                        <Text style={styles.moveSectionTitle}>🔄 An anderes Bike verschieben</Text>
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
                    <BPButton title="Speichern" onPress={saveComp} color={ACCENT} fullWidth size="lg" />
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
    compCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md },
    compHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    compTypeLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    compBrandModel: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
    compWeight: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
    setupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm },
    setupChip: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', gap: 4, alignItems: 'center' },
    setupKey: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    setupVal: { fontSize: 13, fontWeight: '800' },
    compNotes: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: theme.spacing.sm },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    setupSection: { marginTop: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md },
    setupSectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
    moveSection: { marginTop: theme.spacing.md, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: ACCENT + '40' },
    moveSectionTitle: { color: ACCENT, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
});
