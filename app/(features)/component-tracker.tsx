/**
 * F9: Component Tracker — Gear & Setups
 * Agent Manifest: f9_component_tracker.md
 *
 * Bike-Master + Komponenten CRUD + flexible Setup-Werte (Torque, Angle etc.)
 * Storage: AsyncStorage (Supabase later)
 */
import { BPButton, BPCard, BPInput, BPModal, BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { SyncBike, SyncComponent, syncLoadBikes, syncLoadTable, syncSaveBikes, WearItem } from '@/lib/sync';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#26A69A';

type Bike = SyncBike;
type Component = SyncComponent;

export interface SetupValue {
    key: string;
    value: string;
    unit: string;
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
    const [setups, setSetups] = useState<any[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
    const [bikeModalVisible, setBikeModalVisible] = useState(false);
    const [compModalVisible, setCompModalVisible] = useState(false);
    const [editingBike, setEditingBike] = useState<Bike | null>(null);
    const [editingComp, setEditingComp] = useState<SyncComponent | null>(null);

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
    // Wear tracking state
    const [compIsWearTracked, setCompIsWearTracked] = useState(false);
    const getTodayISO = () => new Date().toISOString().split('T')[0];
    const [compWearItems, setCompWearItems] = useState<WearItem[]>([]);

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
        fork: [{ key: 'Federweg', value: '', unit: 'mm' }, { key: 'Offset', value: '', unit: 'mm' }, { key: 'Hub', value: '', unit: 'mm' }],
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

    function getDefaultWearItems(type: string, installedDate: string): WearItem[] {
        const list: WearItem[] = [];
        switch (type) {
            case 'brake_front':
            case 'brake_rear':
                list.push({ id: 'pads', label: 'Bremsbeläge', currentKm: 0, serviceIntervalKm: 500, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'rotor', label: 'Bremsscheibe', currentKm: 0, serviceIntervalKm: 3000, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'fluid', label: 'Bremsflüssigkeit', currentKm: 0, serviceIntervalKm: 1500, lastServiceDate: installedDate, installedDate });
                break;
            case 'fork':
                list.push({ id: 'lower_leg', label: 'Kleiner Service (Lower Legs)', currentKm: 0, serviceIntervalKm: 750, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'full_service', label: 'Großer Service', currentKm: 0, serviceIntervalKm: 1500, lastServiceDate: installedDate, installedDate });
                break;
            case 'shock':
                list.push({ id: 'air_can', label: 'Luftkammer Service', currentKm: 0, serviceIntervalKm: 750, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'full_service', label: 'Großer Service', currentKm: 0, serviceIntervalKm: 1500, lastServiceDate: installedDate, installedDate });
                break;
            case 'chain':
                list.push({ id: 'chain', label: 'Kette', currentKm: 0, serviceIntervalKm: 500, lastServiceDate: installedDate, installedDate });
                break;
            case 'cassette':
                list.push({ id: 'cassette', label: 'Kassette', currentKm: 0, serviceIntervalKm: 1500, lastServiceDate: installedDate, installedDate });
                break;
            case 'wheel_front':
                list.push({ id: 'tire', label: 'Reifen VR', currentKm: 0, serviceIntervalKm: 1200, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'sealant', label: 'Dichtmilch', currentKm: 0, serviceIntervalKm: 300, lastServiceDate: installedDate, installedDate });
                break;
            case 'wheel_rear':
                list.push({ id: 'tire', label: 'Reifen HR', currentKm: 0, serviceIntervalKm: 800, lastServiceDate: installedDate, installedDate });
                list.push({ id: 'sealant', label: 'Dichtmilch', currentKm: 0, serviceIntervalKm: 300, lastServiceDate: installedDate, installedDate });
                break;
            case 'derailleur':
                list.push({ id: 'jockey_wheels', label: 'Schaltröllchen', currentKm: 0, serviceIntervalKm: 2000, lastServiceDate: installedDate, installedDate });
                break;
            case 'battery':
                list.push({ id: 'battery', label: 'Akku', currentKm: 0, serviceIntervalKm: 5000, lastServiceDate: installedDate, installedDate });
                break;
            case 'motor':
                list.push({ id: 'motor', label: 'Motor', currentKm: 0, serviceIntervalKm: 5000, lastServiceDate: installedDate, installedDate });
                break;
            default:
                list.push({ id: 'general', label: 'Verschleißteil', currentKm: 0, serviceIntervalKm: 500, lastServiceDate: installedDate, installedDate });
                break;
        }
        return list;
    }

    useEffect(() => {
        syncLoadBikes().then((data) => {
            setBikes(data);
            if (data.length > 0) setSelectedBikeId(data[0].id);
        });
        syncLoadTable('suspension_setups', '@bikepro_setups').then((data) => {
            setSetups(data ?? []);
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

        setCompIsWearTracked(false);
        setCompWearItems(getDefaultWearItems('handlebar', getTodayISO()));

        setCompModalVisible(true);
    };

    const openEditComp = (comp: SyncComponent) => {
        setEditingComp(comp);
        setCompType(comp.type);
        setCompBrand(comp.brand);
        setCompModel(comp.model);
        setCompWeight(comp.weight);
        setCompNotes(comp.notes);

        setCompIsWearTracked(comp.isWearTracked ?? false);

        let initialWear = comp.wearItems || [];
        if (comp.isWearTracked && initialWear.length === 0) {
            initialWear = getDefaultWearItems(comp.type, comp.installedDate ?? getTodayISO()).map(w => ({
                ...w,
                currentKm: comp.currentKm ?? 0,
                serviceIntervalKm: comp.serviceIntervalKm ?? w.serviceIntervalKm,
                lastServiceDate: comp.lastServiceDate ?? getTodayISO(),
            }));
        } else if (!comp.isWearTracked && initialWear.length === 0) {
            initialWear = getDefaultWearItems(comp.type, getTodayISO());
        }
        setCompWearItems(initialWear);

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
            setCompWearItems(getDefaultWearItems(newType, getTodayISO()));
        }
    };

    const updateSetupValue = (index: number, value: string) => {
        setCompSetup(prev => prev.map((s, i) => i === index ? { ...s, value } : s));
    };

    const updateWearItem = (index: number, field: keyof WearItem, value: string) => {
        setCompWearItems(prev => prev.map((w, i) => {
            if (i !== index) return w;
            if (field === 'currentKm' || field === 'serviceIntervalKm') {
                return { ...w, [field]: parseInt(value || '0', 10) };
            }
            return { ...w, [field]: value };
        }));
    };

    const saveComp = () => {
        if (!selectedBike) return;
        const compData: SyncComponent = {
            id: editingComp?.id ?? Date.now().toString(),
            type: compType,
            brand: compBrand.trim(),
            model: compModel.trim(),
            weight: compWeight,
            purchaseDate: editingComp?.purchaseDate ?? getTodayISO(),
            setupValues: compSetup.filter(s => s.value.trim() !== ''),
            notes: compNotes.trim(),
            isWearTracked: compIsWearTracked,
            wearItems: compIsWearTracked ? compWearItems : [],
            // Keep legacy fields populated from the first item for backwards compat logic outside this screen if needed,
            // or just 0 if not tracked.
            currentKm: compIsWearTracked && compWearItems.length > 0 ? compWearItems[0].currentKm : 0,
            serviceIntervalKm: compIsWearTracked && compWearItems.length > 0 ? compWearItems[0].serviceIntervalKm : 500,
            lastServiceDate: compIsWearTracked && compWearItems.length > 0 ? compWearItems[0].lastServiceDate : getTodayISO(),
            installedDate: compIsWearTracked && compWearItems.length > 0 ? compWearItems[0].installedDate : getTodayISO(),
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
                                    {['fork', 'shock', 'wheel_front', 'wheel_rear'].includes(comp.type) && setups.filter(s => s.bikeId === selectedBike?.id).length > 0 && (
                                        <View style={{ backgroundColor: ACCENT + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                                            <Text style={{ color: ACCENT, fontSize: 10, fontWeight: '700' }}>
                                                🎯 {setups.filter(s => s.bikeId === selectedBike?.id).length} Setups
                                            </Text>
                                        </View>
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

                {/* --- Wear Tracking Section --- */}
                <View style={styles.wearSection}>
                    <View style={styles.wearToggleRow}>
                        <Text style={styles.wearSectionTitle}>♻️ {t('tracker.wear_tracking', { defaultValue: 'Verschleiß erfassen?' })}</Text>
                        <Switch
                            value={compIsWearTracked}
                            onValueChange={setCompIsWearTracked}
                            trackColor={{ false: theme.colors.border, true: ACCENT + '80' }}
                            thumbColor={compIsWearTracked ? ACCENT : theme.colors.textMuted}
                        />
                    </View>

                    {compIsWearTracked && compWearItems.map((item, index) => (
                        <View key={item.id} style={{ marginTop: 12, padding: 12, backgroundColor: theme.colors.background, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border }}>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }}>{item.label}</Text>
                            <View style={styles.inputRow}>
                                <BPInput label="Aktuelle km" value={item.currentKm.toString()} onChangeText={(val) => updateWearItem(index, 'currentKm', val)} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                                <BPInput label="Intervall" value={item.serviceIntervalKm.toString()} onChangeText={(val) => updateWearItem(index, 'serviceIntervalKm', val)} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                            </View>
                            <View style={styles.inputRow}>
                                <BPInput label="Einbaudatum" value={item.installedDate} onChangeText={(val) => updateWearItem(index, 'installedDate', val)} placeholder="YYYY-MM-DD" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                                <BPInput label="Letzter Service" value={item.lastServiceDate} onChangeText={(val) => updateWearItem(index, 'lastServiceDate', val)} placeholder="YYYY-MM-DD" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                            </View>
                        </View>
                    ))}
                </View>

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
    wearSection: {
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
    },
    wearToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wearSectionTitle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    compRowDelete: { padding: 4 },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    setupSection: { marginTop: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md },
    setupSectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
    moveSection: { marginTop: theme.spacing.md, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: ACCENT + '40' },
    moveSectionTitle: { color: ACCENT, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
});
