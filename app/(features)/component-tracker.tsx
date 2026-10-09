/**
 * F9: Component Tracker — Gear & Setups
 * Agent Manifest: f9_component_tracker.md
 *
 * Bike-Master + Komponenten CRUD + flexible Setup-Werte (Torque, Angle etc.)
 * Storage: AsyncStorage (Supabase later)
 */
import { BPButton, BPCard, BPChip, BPEmptyState, BPInput, BPModal, BPPicker, BPSlider, BPToggle, screenContentStyle } from '@/components/ui';
import { featureColors, theme } from '@/constants/Colors';
import { confirmDialog, showAlert } from '@/lib/dialog';
import { setupLabelLocalized, wearLabelLocalized } from '@/lib/componentLabels';
import { newId, SetupValue, SyncBike, SyncComponent, syncDeleteBike, syncDeleteComponent, syncLoadBikes, syncLoadPreference, syncLoadTable, syncSaveBikes, syncSaveTable, syncUpdateComponent, WearItem } from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const ACCENT = featureColors['component-tracker'];

type Bike = SyncBike;
type Component = SyncComponent;

interface UnitsPref {
    pressure: 'bar' | 'psi';
    weight: 'kg' | 'lb';
}

const BAR_TO_PSI = 14.5038;

function convertPressure(value: number, from: string, to: string): number {
    if (from === to) return value;
    if (from === 'bar' && to === 'psi') return value * BAR_TO_PSI;
    if (from === 'psi' && to === 'bar') return value / BAR_TO_PSI;
    return value;
}

// Semantic setup keys get their labels via i18n (tracker.key_<key>)
const SEMANTIC_SETUP_KEYS = ['size', 'width', 'tire_type', 'casing', 'mount', 'pressure', 'travel', 'stroke'];

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
    const [unitsPref, setUnitsPref] = useState<UnitsPref>({ pressure: isGerman ? 'bar' : 'psi', weight: 'kg' });
    const tirePressureUnit = unitsPref.pressure;
    const [bikes, setBikes] = useState<Bike[]>([]);
    const [setups, setSetups] = useState<any[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
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
    const [bikeWeight, setBikeWeight] = useState('');

    // Component form
    const [compType, setCompType] = useState('handlebar');
    const [compBrand, setCompBrand] = useState('');
    const [compModel, setCompModel] = useState('');
    const [compWeight, setCompWeight] = useState('');
    const [compPrice, setCompPrice] = useState('');
    const [compMaxClicks, setCompMaxClicks] = useState('');
    const [compReboundMode, setCompReboundMode] = useState('');
    const [compCompressionMode, setCompCompressionMode] = useState('');
    const [compNotes, setCompNotes] = useState('');
    const [compSetup, setCompSetup] = useState<SetupValue[]>([]);
    const [compMoveToBikeId, setCompMoveToBikeId] = useState<string>('');
    // Wear tracking state
    const [compIsWearTracked, setCompIsWearTracked] = useState(false);
    const getTodayISO = () => new Date().toISOString().split('T')[0];
    const [compWearItems, setCompWearItems] = useState<WearItem[]>([]);

    // Service Log Inline UI
    const [addingServiceForIndex, setAddingServiceForIndex] = useState(-1);
    const [newServiceNote, setNewServiceNote] = useState('');
    const [newServiceCost, setNewServiceCost] = useState('');

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
        fork: [{ key: 'travel', value: '', unit: 'mm' }, { key: 'Offset', value: '', unit: 'mm' }, { key: 'stroke', value: '', unit: 'mm' }],
        shock: [{ key: 'travel', value: '', unit: 'mm' }, { key: 'Einbaulänge', value: '', unit: 'mm' }, { key: 'stroke', value: '', unit: 'mm' }],
        wheel_front: [{ key: 'size', value: '', unit: '"' }, { key: 'width', value: '', unit: '"' }, { key: 'Reifen', value: '', unit: '' }, { key: 'tire_type', value: '', unit: '' }, { key: 'casing', value: '', unit: '' }, { key: 'mount', value: '', unit: '' }, { key: 'pressure', value: '', unit: tirePressureUnit }],
        wheel_rear: [{ key: 'size', value: '', unit: '"' }, { key: 'width', value: '', unit: '"' }, { key: 'Reifen', value: '', unit: '' }, { key: 'tire_type', value: '', unit: '' }, { key: 'casing', value: '', unit: '' }, { key: 'mount', value: '', unit: '' }, { key: 'pressure', value: '', unit: tirePressureUnit }],
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

    function setupLabel(key: string): string {
        if (SEMANTIC_SETUP_KEYS.includes(key)) return t(`tracker.key_${key}`);
        return setupLabelLocalized(t, key) ?? key;
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
        }
        return list;
    }

    // specific setup field options
    const wheelSizeOptions = [
        { label: '26"', value: '26' },
        { label: '27.5"', value: '27.5' },
        { label: '29"', value: '29' },
    ];
    const tireWidthOptions = [
        { label: '2.0"', value: '2.0' }, { label: '2.2"', value: '2.2' },
        { label: '2.3"', value: '2.3' }, { label: '2.35"', value: '2.35' },
        { label: '2.4"', value: '2.4' }, { label: '2.5"', value: '2.5' },
        { label: '2.6"', value: '2.6' }, { label: '2.8" (Plus)', value: '2.8' },
    ];
    const tireTypeOptions = [
        { label: t('tracker.type_xc', { defaultValue: 'XC / Marathon' }), value: 'xc' },
        { label: t('tracker.type_trail', { defaultValue: 'Trail' }), value: 'trail' },
        { label: t('tracker.type_enduro', { defaultValue: 'Enduro' }), value: 'enduro' },
        { label: t('tracker.type_dh', { defaultValue: 'Downhill' }), value: 'dh' },
        { label: t('tracker.type_mud', { defaultValue: 'Matschreifen' }), value: 'mud' },
    ];
    const casingOptions = [
        { label: t('tracker.casing_light', { defaultValue: 'Light / Super Race' }), value: 'light' },
        { label: t('tracker.casing_standard', { defaultValue: 'Standard / EXO' }), value: 'standard' },
        { label: t('tracker.casing_reinforced', { defaultValue: 'Reinforced / EXO+' }), value: 'reinforced' },
        { label: t('tracker.casing_doubledown', { defaultValue: 'DoubleDown (DD)' }), value: 'doubledown' },
        { label: t('tracker.casing_dh', { defaultValue: 'DH / Super Gravity' }), value: 'dh' },
    ];
    const setupMountOptions = [
        { label: t('tracker.setup_tubeless', { defaultValue: 'Tubeless' }), value: 'tubeless' },
        { label: t('tracker.setup_tube_butyl', { defaultValue: 'Schlauch (Butyl)' }), value: 'tube_butyl' },
        { label: t('tracker.setup_tube_latex', { defaultValue: 'Schlauch (Latex/TPU)' }), value: 'tube_latex' },
        { label: t('tracker.setup_insert', { defaultValue: 'Tire Insert (z.B. CushCore)' }), value: 'insert' },
    ];
    const loadData = async () => {
        const data = await syncLoadBikes();
        setBikes(data);
        if (data.length > 0 && !selectedBikeId) {
            setSelectedBikeId(data[0].id);
        }
        const setupsData = await syncLoadTable('suspension_setups', '@bikepro_setups');
        setSetups(setupsData ?? []);
        const units = await syncLoadPreference<UnitsPref>('units', '@bikepro_units');
        if (units) {
            setUnitsPref({
                pressure: units.pressure ?? (isGerman ? 'bar' : 'psi'),
                weight: units.weight ?? 'kg',
            });
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData().finally(() => setLoading(false));
        }, [])
    );

    // Pull newer cloud data when the app/tab becomes visible again
    useRefreshOnForeground(loadData);

    // Structural changes (bike add/rename/delete, component move/delete) rewrite the
    // whole bikes table. The mutation is applied to a FRESH copy so km updates made
    // meanwhile by Shred-Check / Ride-Log are not overwritten with stale state.
    const persistStructural = async (mutate: (fresh: Bike[]) => Bike[]): Promise<Bike[]> => {
        const fresh = await syncLoadBikes();
        const updated = mutate(fresh);
        await syncSaveBikes(updated);
        setBikes(updated);
        return updated;
    };

    const selectedBike = bikes.find((b) => b.id === selectedBikeId) ?? null;

    // --- Bike CRUD ---
    const openNewBike = () => {
        setEditingBike(null);
        setBikeName('');
        setBikeType('enduro');
        setBikeModel('');
        setBikeWeight('');
        setBikeYear('2024');
        setBikeSize('L');
        setBikeModalVisible(true);
    };

    const openEditBike = (bike: Bike) => {
        setEditingBike(bike);
        setBikeName(bike.name);
        setBikeType(bike.type);
        setBikeModel(bike.model);
        setBikeWeight(bike.weight?.toString() ?? '');
        setBikeYear(bike.year);
        setBikeSize(bike.size ?? 'L');
        setBikeModalVisible(true);
    };

    const saveBike = async () => {
        if (!bikeName.trim()) return;
        const parsedWeight = parseFloat(bikeWeight);
        const bikeData: Bike = {
            id: editingBike?.id ?? newId(),
            name: bikeName.trim(),
            type: bikeType,
            model: bikeModel.trim(),
            weight: isNaN(parsedWeight) ? undefined : parsedWeight,
            year: bikeYear,
            size: bikeSize,
            components: editingBike?.components ?? [],
        };
        await persistStructural(fresh =>
            editingBike
                // Keep fresh components — they may have newer km than the screen state
                ? fresh.map((b) => (b.id === editingBike.id ? { ...bikeData, components: b.components } : b))
                : [...fresh, bikeData]
        );
        if (!editingBike) setSelectedBikeId(bikeData.id);

        // Propagate renames to linked suspension setups
        if (editingBike && editingBike.name !== bikeData.name && setups.some(s => s.bikeId === editingBike.id)) {
            const updatedSetups = setups.map(s =>
                s.bikeId === editingBike.id ? { ...s, bikeName: bikeData.name } : s
            );
            setSetups(updatedSetups);
            await syncSaveTable('suspension_setups', '@bikepro_setups', updatedSetups);
        }

        setBikeModalVisible(false);
    };

    const deleteBike = async (id: string) => {
        const confirmed = await confirmDialog(
            t('tracker.delete_bike_title'),
            t('tracker.delete_bike_message'),
            t('common.cancel')
        );
        if (!confirmed) return;

        await syncDeleteBike(id);
        const updated = await persistStructural(fresh => fresh.filter((b) => b.id !== id));
        setSelectedBikeId(updated[0]?.id ?? null);

        // Unlink suspension setups referencing this bike (rides keep their stored snapshot)
        if (setups.some(s => s.bikeId === id)) {
            const updatedSetups = setups.map(s =>
                s.bikeId === id ? { ...s, bikeId: '' } : s
            );
            setSetups(updatedSetups);
            await syncSaveTable('suspension_setups', '@bikepro_setups', updatedSetups);
        }
    };

    // --- Component CRUD ---
    const openNewComp = () => {
        setEditingComp(null);
        setCompType('handlebar');
        setCompBrand('');
        setCompModel('');
        setCompWeight('');
        setCompPrice('');
        setCompMaxClicks('');
        setCompReboundMode('');
        setCompCompressionMode('');
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
        setCompPrice(comp.price ?? '');
        setCompMaxClicks(comp.maxClicks ?? '');
        setCompReboundMode(comp.reboundMode ?? '');
        setCompCompressionMode(comp.compressionMode ?? '');
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
        // Self-heal: older loads persisted handlebar width under the tire key
        // 'width' — treat it as the bar-width field 'Breite' again.
        const saved = (comp.setupValues ?? []).map(s =>
            comp.type === 'handlebar' && s.key === 'width' ? { ...s, key: 'Breite' } : s
        );
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

    const updateSetupValue = (index: number, value: string, unit?: string) => {
        setCompSetup(prev => prev.map((s, i) =>
            i === index ? { ...s, value, ...(unit !== undefined ? { unit } : {}) } : s
        ));
    };

    const updateWearItem = (index: number, field: keyof WearItem, value: string) => {
        setCompWearItems(prev => prev.map((w, i) => {
            if (i !== index) return w;
            if (field === 'currentKm') {
                const parsed = parseInt(value, 10);
                if (isNaN(parsed) || parsed < 0) return w;
                return { ...w, currentKm: parsed };
            }
            if (field === 'serviceIntervalKm') {
                const parsed = parseInt(value, 10);
                if (isNaN(parsed) || parsed < 1) return w;
                return { ...w, serviceIntervalKm: parsed };
            }
            return { ...w, [field]: value };
        }));
    };

    const saveComp = async () => {
        if (!selectedBike) return;
        const compData: SyncComponent = {
            id: editingComp?.id ?? newId(),
            type: compType,
            brand: compBrand.trim(),
            model: compModel.trim(),
            weight: compWeight,
            price: compPrice.trim(),
            purchaseDate: editingComp?.purchaseDate ?? getTodayISO(),
            setupValues: compSetup.filter(s => s.value.trim() !== ''),
            maxClicks: compMaxClicks.trim() || undefined,
            reboundMode: compReboundMode || undefined,
            compressionMode: compCompressionMode || undefined,
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

        // Move to different bike? (structural change → full resave on fresh state)
        if (editingComp && compMoveToBikeId && compMoveToBikeId !== selectedBike.id) {
            await persistStructural(fresh => {
                // Remove from current bike
                let updatedBikes = fresh.map(b =>
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
                return updatedBikes;
            });
        } else {
            // Normal save (edit or create on current bike) → targeted single-row write
            const ok = await syncUpdateComponent(selectedBike.id, compData);
            if (!ok) {
                showAlert(t('common.sync_pending_title'), t('common.sync_pending_msg'));
            }
            setBikes(bikes.map(b => b.id === selectedBike.id
                ? {
                    ...b,
                    components: editingComp
                        ? b.components.map(c => (c.id === editingComp.id ? compData : c))
                        : [...b.components, compData],
                }
                : b
            ));
        }

        setCompModalVisible(false);
    };

    const deleteComp = async (compId: string) => {
        if (!selectedBike) return;
        const confirmed = await confirmDialog(
            t('tracker.delete_component_title'),
            t('tracker.delete_component_message'),
            t('common.cancel')
        );
        if (!confirmed) return;

        await syncDeleteComponent(compId);
        await persistStructural(fresh =>
            fresh.map(b => b.id === selectedBike.id
                ? { ...b, components: b.components.filter(c => c.id !== compId) }
                : b
            )
        );
    };
    const handleShareBike = async () => {
        if (!selectedBike) return;
        const comps = selectedBike.components;
        let totalWeight = 0;
        let totalPrice = 0;

        const lines = comps.map(c => {
            const w = parseFloat(c.weight);
            const p = parseFloat(c.price ?? '0') || 0;
            if (!isNaN(w)) totalWeight += w;
            totalPrice += p;
            return `- ${getTypeLabel(c.type)}: ${c.brand} ${c.model} (${!isNaN(w) ? w + 'g' : '-'} | ${p > 0 ? p.toFixed(2) + '€' : '-'})`;
        });

        const msg = t('tracker.share_msg', {
            name: selectedBike.name,
            lines: lines.join('\n'),
            weight: Math.round(totalWeight * 10) / 10,
            price: totalPrice.toFixed(2),
        });
        try {
            await Share.share({ message: msg });
        } catch (error) {
            console.warn(error);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('features.component-tracker.title', { defaultValue: 'Component Tracker' }),
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
                        label={t('tracker.select_bike')}
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
                        title={t('tracker.add_bike_btn')}
                        onPress={openNewBike}
                        color={ACCENT}
                        size="md"
                        style={{ flex: 1 }}
                    />
                    {selectedBike && (
                        <BPButton
                            title={t('tracker.add_comp_btn')}
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
                                    {selectedBike.model} • {selectedBike.year} • Gr. {selectedBike.size ?? '–'} • {selectedBike.weight ? selectedBike.weight + ' kg • ' : ''}{bikeTypeOptions.find(t => t.value === selectedBike.type)?.label}
                                </Text>
                            </View>
                            <View style={styles.bikeActions}>
                                <TouchableOpacity onPress={handleShareBike}>
                                    <Text style={styles.actionIcon}>📋</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openEditBike(selectedBike)}>
                                    <Text style={styles.actionIcon}>✏️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => deleteBike(selectedBike.id)}>
                                    <Text style={styles.actionIcon}>🗑</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.compCount}>
                                {t('tracker.comp_count', { count: selectedBike.components.length })}
                            </Text>
                            <Text style={styles.compCount}>
                                {t('tracker.total_value', { value: selectedBike.components.reduce((sum, c) => sum + (parseFloat(c.price ?? '0') || 0), 0).toFixed(2) })}
                                {'  '}
                                {t('tracker.total_maintenance', { value: selectedBike.components.reduce((sum, c) => sum + (c.wearItems ?? []).reduce((s, w) => s + (w.serviceHistory ?? []).reduce((h, sh) => h + (sh.cost || 0), 0), 0), 0).toFixed(2) })}
                            </Text>
                        </View>
                    </BPCard>
                )}

                {/* Loading (initial load) */}
                {loading && (
                    <View style={styles.emptyState}>
                        <ActivityIndicator color={ACCENT} />
                    </View>
                )}

                {/* Components list */}
                {selectedBike?.components.length === 0 && (
                    <BPEmptyState icon="🔩" title={t('tracker.components')} subtitle="—" />
                )}

                {!loading && !selectedBike && bikes.length === 0 && (
                    <BPEmptyState icon="🚵" title={t('tracker.no_bikes')} subtitle={t('tracker.add_first_bike')} />
                )}

                {selectedBike?.components.map((comp) => (
                    <BPCard
                        key={comp.id}
                        onPress={() => openEditComp(comp)}
                        style={styles.compRow}
                    >
                        <View style={styles.compRowLeft}>
                            <Text style={styles.compRowType}>{getTypeLabel(comp.type)}</Text>
                            {(comp.brand || comp.model) ? (
                                <Text style={styles.compRowBrand} numberOfLines={2}>
                                    {comp.brand} {comp.model}{comp.weight ? ` · ${comp.weight}g` : ''}
                                </Text>
                            ) : null}
                            {comp.notes ? (
                                <Text style={styles.compRowNotes} numberOfLines={2}>{comp.notes}</Text>
                            ) : null}
                        </View>
                        {comp.setupValues.length > 0 && (
                            <View style={styles.compRowChips}>
                                {comp.setupValues.slice(0, 3).map((sv, i) => (
                                    <BPChip key={i} small label={`${setupLabel(sv.key)} ${sv.value}${sv.unit}`} />
                                ))}
                                {comp.setupValues.length > 3 && (
                                    <BPChip small label={`+${comp.setupValues.length - 3}`} />
                                )}
                                {['fork', 'shock', 'wheel_front', 'wheel_rear'].includes(comp.type) && setups.filter(s => s.bikeId === selectedBike?.id).length > 0 && (
                                    <BPChip small selected color={ACCENT} label={`🎯 ${setups.filter(s => s.bikeId === selectedBike?.id).length} Setups`} />
                                )}
                            </View>
                        )}
                        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); deleteComp(comp.id); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.compRowDelete}>
                            <Text style={{ fontSize: 18 }}>🗑</Text>
                        </TouchableOpacity>
                    </BPCard>
                ))}
            </ScrollView>

            {/* Bike Modal */}
            <BPModal
                visible={bikeModalVisible}
                onClose={() => setBikeModalVisible(false)}
                title={editingBike ? t('tracker.edit_bike') : t('tracker.add_bike')}
            >
                <BPInput label={t('tracker.name')} placeholder={t('tracker.placeholder_bike')} value={bikeName} onChangeText={setBikeName} accentColor={ACCENT} />
                <BPPicker label={t('tracker.type')} options={bikeTypeOptions} value={bikeType} onValueChange={setBikeType} accentColor={ACCENT} />
                <View style={[styles.inputRow, { gap: theme.spacing.md }]}>
                    <BPInput label={t('tracker.model')} placeholder={t('tracker.placeholder_model')} value={bikeModel} onChangeText={setBikeModel} accentColor={ACCENT} containerStyle={{ flex: 3 }} />
                    <BPPicker label={t('tracker.size')} options={bikeSizeOptions} value={bikeSize} onValueChange={setBikeSize} accentColor={ACCENT} containerStyle={{ flex: 2 }} />
                </View>
                <View style={[styles.inputRow, { gap: theme.spacing.md }]}>
                    <BPInput label={t('tracker.year')} placeholder="2024" value={bikeYear} onChangeText={setBikeYear} keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('tracker.weight_kg')} placeholder="15.5" value={bikeWeight} onChangeText={setBikeWeight} keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
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
                <View style={styles.inputRow}>
                    <BPInput label={t('tracker.weight')} placeholder="0" value={compWeight} onChangeText={setCompWeight} suffix="g" keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('tracker.price')} placeholder="0.00" value={compPrice} onChangeText={setCompPrice} suffix="€" keyboardType="numeric" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
                {['fork', 'shock'].includes(compType) && (
                    <>
                        <BPInput label={t('tracker.max_clicks')} placeholder="z.B. 14" value={compMaxClicks} onChangeText={setCompMaxClicks} keyboardType="numeric" accentColor={ACCENT} />
                        <BPPicker 
                            label={t('tracker.rebound_mode')} 
                            options={[{label: t('tracker.mode_select'), value: ''}, {label: t('tracker.mode_none'), value: 'none'}, {label: t('tracker.mode_clicks'), value: 'clicks'}, {label: t('tracker.mode_hsls'), value: 'hsls'}]} 
                            value={compReboundMode} 
                            onValueChange={setCompReboundMode} 
                            accentColor={ACCENT} 
                        />
                        <BPPicker 
                            label={t('tracker.compression_mode')} 
                            options={[{label: t('tracker.mode_select'), value: ''}, {label: t('tracker.mode_none'), value: 'none'}, {label: t('tracker.mode_clicks'), value: 'clicks'}, {label: t('tracker.mode_lever'), value: 'lever'}, {label: t('tracker.mode_comp_hsls'), value: 'hsls'}]} 
                            value={compCompressionMode} 
                            onValueChange={setCompCompressionMode} 
                            accentColor={ACCENT} 
                        />
                    </>
                )}

                {/* Dynamic setup fields */}
                {compSetup.length > 0 && (
                    <View style={styles.setupSection}>
                        <Text style={styles.setupSectionTitle}>⚙️ {t('tracker.setup_values')}</Text>
                        {compSetup.map((sv, i) => {
                            if (sv.key === 'size') {
                                return <BPPicker key={i} label={setupLabel(sv.key)} options={[{ label: t('tracker.select_placeholder'), value: '' }, ...wheelSizeOptions]} value={sv.value} onValueChange={(v) => updateSetupValue(i, v)} accentColor={ACCENT} />
                            }
                            if (sv.key === 'Breite' && compType === 'handlebar') {
                                return (
                                    <BPSlider
                                        key={i}
                                        label={setupLabel(sv.key)}
                                        value={parseFloat(sv.value || '780')}
                                        min={700}
                                        max={820}
                                        step={5}
                                        accentColor={ACCENT}
                                        formatValue={(v) => `${v.toFixed(0)} ${sv.unit}`}
                                        onValueChange={(val) => updateSetupValue(i, val.toFixed(0))}
                                    />
                                )
                            }
                            if (sv.key === 'width') {
                                return <BPPicker key={i} label={setupLabel(sv.key)} options={[{ label: t('tracker.select_placeholder'), value: '' }, ...tireWidthOptions]} value={sv.value} onValueChange={(v) => updateSetupValue(i, v)} accentColor={ACCENT} />
                            }
                            if (sv.key === 'tire_type') {
                                return <BPPicker key={i} label={setupLabel(sv.key)} options={[{ label: t('tracker.select_placeholder'), value: '' }, ...tireTypeOptions]} value={sv.value} onValueChange={(v) => updateSetupValue(i, v)} accentColor={ACCENT} />
                            }
                            if (sv.key === 'casing') {
                                return <BPPicker key={i} label={setupLabel(sv.key)} options={[{ label: t('tracker.select_placeholder'), value: '' }, ...casingOptions]} value={sv.value} onValueChange={(v) => updateSetupValue(i, v)} accentColor={ACCENT} />
                            }
                            if (sv.key === 'mount') {
                                return <BPPicker key={i} label={setupLabel(sv.key)} options={[{ label: t('tracker.select_placeholder'), value: '' }, ...setupMountOptions]} value={sv.value} onValueChange={(v) => updateSetupValue(i, v)} accentColor={ACCENT} />
                            }
                            if (sv.key === 'pressure') {
                                const isBar = tirePressureUnit === 'bar';
                                const min = isBar ? 1.0 : 14;
                                const max = isBar ? 3.5 : 50;
                                const fallback = isBar ? 1.8 : 26;
                                const parsed = parseFloat(sv.value);
                                // Convert stored values saved in the other unit for display
                                const displayVal = isNaN(parsed)
                                    ? fallback
                                    : Math.min(max, Math.max(min, convertPressure(parsed, sv.unit || tirePressureUnit, tirePressureUnit)));
                                return (
                                    <BPSlider
                                        key={i}
                                        label={setupLabel(sv.key)}
                                        value={displayVal}
                                        min={min}
                                        max={max}
                                        step={isBar ? 0.1 : 1}
                                        accentColor={ACCENT}
                                        formatValue={(v) => `${v.toFixed(isBar ? 1 : 0)} ${tirePressureUnit}`}
                                        onValueChange={(val) => updateSetupValue(i, isBar ? val.toFixed(1) : val.toFixed(0), tirePressureUnit)}
                                    />
                                )
                            }
                            return (
                                <BPInput
                                    key={`${sv.key}-${i}`}
                                    label={setupLabel(sv.key)}
                                    placeholder="—"
                                    value={sv.value}
                                    onChangeText={(v) => updateSetupValue(i, v)}
                                    suffix={sv.unit}
                                    accentColor={ACCENT}
                                />
                            );
                        })}
                    </View>
                )}

                <BPInput label={t('tracker.notes')} placeholder="..." value={compNotes} onChangeText={setCompNotes} multiline numberOfLines={2} accentColor={ACCENT} />

                {/* --- Wear Tracking Section --- */}
                <View style={styles.wearSection}>
                    <BPToggle
                        label={`♻️ ${t('tracker.wear_tracking', { defaultValue: 'Verschleiß erfassen?' })}`}
                        value={compIsWearTracked}
                        onValueChange={setCompIsWearTracked}
                        accentColor={ACCENT}
                    />

                    {compIsWearTracked && compWearItems.map((item, index) => (
                        <View key={item.id} style={{ marginTop: 12, padding: 12, backgroundColor: theme.colors.background, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border }}>
                            <Text style={{ fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }}>{wearLabelLocalized(t, item)}</Text>
                            <View style={styles.inputRow}>
                                <BPInput label={t('tracker.wear_current_km')} value={item.currentKm.toString()} onChangeText={(val) => updateWearItem(index, 'currentKm', val)} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                                <BPInput label={t('tracker.wear_interval')} value={item.serviceIntervalKm.toString()} onChangeText={(val) => updateWearItem(index, 'serviceIntervalKm', val)} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                            </View>
                            <View style={[styles.inputRow, { alignItems: 'center', marginTop: 8 }]}>
                                <BPInput label={t('tracker.wear_installed')} value={item.installedDate} onChangeText={(val) => updateWearItem(index, 'installedDate', val)} placeholder="YYYY-MM-DD" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                                <BPInput label={t('tracker.wear_last_service')} value={item.lastServiceDate} onChangeText={(val) => updateWearItem(index, 'lastServiceDate', val)} placeholder="YYYY-MM-DD" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                            </View>
                            {/* Service Log Injection */}
                            <View style={{ marginTop: 4, alignItems: 'flex-start' }}>
                                <BPButton title={t('tracker.wear_log_service')} onPress={() => {
                                    if (addingServiceForIndex !== index) { setNewServiceNote(''); setNewServiceCost(''); }
                                    setAddingServiceForIndex(addingServiceForIndex === index ? -1 : index);
                                }} size="sm" variant="secondary" color={ACCENT} />
                            </View>

                            {addingServiceForIndex === index && (
                                <View style={{ marginTop: 8, padding: 8, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 4, color: theme.colors.text }}>{t('tracker.wear_add_service')}</Text>
                                    <BPInput label={t('tracker.wear_service_note')} placeholder={t('tracker.wear_service_note_placeholder')} value={newServiceNote} onChangeText={setNewServiceNote} accentColor={ACCENT} />
                                    <BPInput label={t('tracker.wear_service_cost')} placeholder="0" value={newServiceCost} onChangeText={setNewServiceCost} keyboardType="numeric" suffix="€" accentColor={ACCENT} />
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                        <BPButton title={t('tracker.wear_save_reset')} onPress={() => {
                                            const today = getTodayISO();
                                            const cost = parseFloat(newServiceCost.replace(',', '.')) || 0;
                                            const updatedHistory = [...(item.serviceHistory ?? []), { date: today, note: newServiceNote, cost: cost > 0 ? cost : undefined, type: 'maintenance' }];
                                            setCompWearItems(prev => prev.map((w, i) => i === index ? { ...w, currentKm: 0, lastServiceDate: today, serviceHistory: updatedHistory } : w));
                                            setAddingServiceForIndex(-1);
                                            setNewServiceNote('');
                                            setNewServiceCost('');
                                        }} size="sm" color={theme.colors.accentCyan} style={{ flex: 1 }} />
                                        <BPButton title={t('common.cancel')} onPress={() => { setAddingServiceForIndex(-1); setNewServiceNote(''); setNewServiceCost(''); }} size="sm" variant="secondary" color={theme.colors.textMuted} />
                                    </View>
                                </View>
                            )}

                            {item.serviceHistory && item.serviceHistory.length > 0 && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{t('tracker.wear_history')}</Text>
                                    {item.serviceHistory.map((sh, idx) => (
                                        <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', width: 80 }}>{sh.date}</Text>
                                            <Text style={{ color: theme.colors.text, fontSize: 12, flex: 1 }}>{sh.note}{sh.cost ? ` · ${sh.cost}€` : ''}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* Move to different bike (only when editing and >1 bike exists) */}
                {editingComp && bikes.length > 1 && (
                    <View style={styles.moveSection}>
                        <Text style={styles.moveSectionTitle}>🔄 {t('tracker.move_component')}</Text>
                        <BPPicker
                            label={t('tracker.move_bike_label')}
                            options={[
                                { label: t('tracker.move_current', { name: selectedBike?.name ?? '' }), value: '' },
                                ...bikes.filter(b => b.id !== selectedBikeId).map(b => ({
                                    label: t('tracker.move_option', { name: b.name, size: b.size ?? '' }),
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
    scrollContent: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    btnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    bikeCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    bikeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    bikeName: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
    bikeInfo: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
    bikeActions: { flexDirection: 'row', gap: 12 },
    actionIcon: { fontSize: 16, padding: 4 },
    compCount: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    compRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
        gap: 8,
    },
    compRowLeft: {
        flex: 1,
        gap: 2,
    },
    compRowType: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    compRowBrand: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 16 },
    compRowChips: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    compRowNotes: { color: theme.colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 4 },
    wearSection: {
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.md,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
    },
    compRowDelete: { padding: 4 },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    setupSection: { marginTop: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md },
    setupSectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
    moveSection: { marginTop: theme.spacing.md, padding: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: ACCENT + '40' },
    moveSectionTitle: { color: ACCENT, fontSize: 14, fontWeight: '700', marginBottom: theme.spacing.sm },
});
