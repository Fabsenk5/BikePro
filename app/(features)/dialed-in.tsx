/**
 * F1: Dialed-In — Fahrwerks-Log (V3)
 *
 * Flexible Suspension Settings:
 * - Rebound: Clicks-only OR Low-Speed/High-Speed
 * - Compression: Clicks-only OR Lever (Open/Mid/Closed) OR Low-Speed/High-Speed
 * - PSI, SAG%, Travel, Tokens
 * - Tire setup (Front/Rear)
 * - Bike integration with Component Tracker
 */
import { BPButton, BPCard, BPChip, BPEmptyState, BPInput, BPModal, BPPicker, BPSegmentedControl, BPSlider, BPToggle, screenContentStyle } from '@/components/ui';
import { featureColors, theme } from '@/constants/Colors';
import { confirmDialog } from '@/lib/dialog';
import { newId, syncDeleteFromTable, syncLoadBikes, syncLoadPreference, syncLoadTable, syncSaveTable } from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = featureColors['dialed-in'];
const SETUPS_KEY = '@bikepro_setups';
const UNITS_KEY = '@bikepro_units';
const BAR_TO_PSI = 14.5038;

// --- Types ---
type ReboundMode = 'clicks' | 'hsls' | 'none';
type CompressionMode = 'clicks' | 'lever' | 'hsls' | 'none';

interface SuspensionConfig {
    reboundMode: ReboundMode;
    compressionMode: CompressionMode;
}

interface SuspensionValues {
    psi: number;
    sagPercent: number;
    travel: number;
    stroke?: number;  // shock-only: actual piston stroke in mm
    mode?: 'air' | 'coil';  // shock-only: air spring or coil spring (default 'air')
    springRate?: number;    // coil-only: spring rate in lb/in
    // Rebound
    reboundClicks: number;    // clicks-only mode
    reboundLSR: number;       // HS/LS mode
    reboundHSR: number;       // HS/LS mode
    // Compression
    compressionClicks: number; // clicks-only mode
    compressionLever: string;  // lever mode: 'open' | 'mid' | 'closed'
    compressionLSC: number;    // HS/LS mode
    compressionHSC: number;    // HS/LS mode
    // Config
    config: SuspensionConfig;
    tokens: number;
}

interface TireSetup {
    frontBar: number;
    rearBar: number;
    frontWidth: string;
    rearWidth: string;
    frontTire: string;
    rearTire: string;
}

interface Setup {
    id: string;
    name: string;
    location: string;
    bikeId: string;       // linked to Component Tracker bike
    bikeName: string;     // display name (cached)
    fork: SuspensionValues;
    shock: SuspensionValues;
    tires: TireSetup;
    tags?: string[];
    notes: string;
    createdAt: string;
}

// Bike type from Component Tracker
interface TrackerBike {
    id: string;
    name: string;
    type: string;
    model: string;
    year: string;
    size: string;
    components: any[];
}

interface WizardIssue {
    label: string;
    solution: string;
}

interface WizardCategory {
    id: string;
    title: string;
    icon: string;
    issues: WizardIssue[];
}

const defaultConfig: SuspensionConfig = { reboundMode: 'clicks', compressionMode: 'clicks' };

const defaultFork: SuspensionValues = {
    psi: 80, sagPercent: 20, travel: 170, stroke: 170,
    reboundClicks: 10, reboundLSR: 10, reboundHSR: 5,
    compressionClicks: 10, compressionLever: 'open',
    compressionLSC: 10, compressionHSC: 3,
    config: { ...defaultConfig }, tokens: 1,
};

const defaultShock: SuspensionValues = {
    psi: 200, sagPercent: 30, travel: 140, stroke: 57,
    mode: 'air', springRate: 400,
    reboundClicks: 8, reboundLSR: 8, reboundHSR: 3,
    compressionClicks: 8, compressionLever: 'open',
    compressionLSC: 8, compressionHSC: 2,
    config: { ...defaultConfig }, tokens: 1,
};

const defaultTires: TireSetup = {
    frontBar: 1.7, rearBar: 1.9, frontWidth: '2.5', rearWidth: '2.4',
    frontTire: '', rearTire: '',
};

const tokenOptions = [
    { label: '0', value: '0' }, { label: '1', value: '1' }, { label: '2', value: '2' },
    { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' },
];

const tireWidthOptions = [
    { label: '2.3"', value: '2.3' }, { label: '2.35"', value: '2.35' },
    { label: '2.4"', value: '2.4' }, { label: '2.5"', value: '2.5' }, { label: '2.6"', value: '2.6' },
];

export default function DialedInScreen() {
    const { t, i18n } = useTranslation();
    const [setups, setSetups] = useState<Setup[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
    const [trackerBikes, setTrackerBikes] = useState<TrackerBike[]>([]);
    const [rides, setRides] = useState<any[]>([]);
    const [pressureUnit, setPressureUnit] = useState<'bar' | 'psi'>('bar');

    const [wizardVisible, setWizardVisible] = useState(false);
    const [wizardStep, setWizardStep] = useState<'category' | 'issue' | 'solution'>('category');
    const [selectedCategory, setSelectedCategory] = useState<WizardCategory | null>(null);
    const [wizardSolution, setWizardSolution] = useState('');

    const TAG_OPTIONS = [
        { label: t('dialed.tag_wet'), value: 'wet' },
        { label: t('dialed.tag_dry'), value: 'dry' },
        { label: t('dialed.tag_park'), value: 'park' },
        { label: t('dialed.tag_trail'), value: 'trail' },
        { label: t('dialed.tag_tech'), value: 'tech' },
        { label: t('dialed.tag_flow'), value: 'flow' },
        { label: t('dialed.tag_race'), value: 'race' }
    ];

    const tuningCategories: WizardCategory[] = [
        {
            id: 'grip',
            title: t('dialed.wizard_cat_grip'),
            icon: '🏁',
            issues: [
                { label: t('dialed.wizard_grip_1_label'), solution: t('dialed.wizard_grip_1_solution') },
                { label: t('dialed.wizard_grip_2_label'), solution: t('dialed.wizard_grip_2_solution') }
            ]
        },
        {
            id: 'balance',
            title: t('dialed.wizard_cat_balance'),
            icon: '🚲',
            issues: [
                { label: t('dialed.wizard_balance_1_label'), solution: t('dialed.wizard_balance_1_solution') },
                { label: t('dialed.wizard_balance_2_label'), solution: t('dialed.wizard_balance_2_solution') }
            ]
        },
        {
            id: 'harsh',
            title: t('dialed.wizard_cat_harsh'),
            icon: '⛰️',
            issues: [
                { label: t('dialed.wizard_harsh_1_label'), solution: t('dialed.wizard_harsh_1_solution') },
                { label: t('dialed.wizard_harsh_2_label'), solution: t('dialed.wizard_harsh_2_solution') }
            ]
        },
        {
            id: 'pedaling',
            title: t('dialed.wizard_cat_pedaling'),
            icon: '🦵',
            issues: [
                { label: t('dialed.wizard_pedaling_1_label'), solution: t('dialed.wizard_pedaling_1_solution') },
                { label: t('dialed.wizard_pedaling_2_label'), solution: t('dialed.wizard_pedaling_2_solution') }
            ]
        },
        {
            id: 'chatter',
            title: t('dialed.wizard_cat_chatter'),
            icon: '🪨',
            issues: [
                { label: t('dialed.wizard_chatter_1_label'), solution: t('dialed.wizard_chatter_1_solution') },
                { label: t('dialed.wizard_chatter_2_label'), solution: t('dialed.wizard_chatter_2_solution') }
            ]
        }
    ];

    const leverOptions = [
        { label: t('dialed.open'), value: 'open' },
        { label: t('dialed.mid'), value: 'mid' },
        { label: t('dialed.closed'), value: 'closed' },
    ];

    // Helper: render rebound display text for card
    function reboundDisplay(sus: SuspensionValues): string {
        const cfg = sus.config ?? defaultConfig;
        if (cfg.reboundMode === 'hsls') return `LSR ${sus.reboundLSR}  HSR ${sus.reboundHSR}`;
        return `Rebound ${sus.reboundClicks} Clicks`;
    }

    // Helper: render compression display text for card
    function compDisplay(sus: SuspensionValues): string {
        const cfg = sus.config ?? defaultConfig;
        if (cfg.compressionMode === 'hsls') return `LSC ${sus.compressionLSC}  HSC ${sus.compressionHSC}`;
        if (cfg.compressionMode === 'lever') {
            const lbl = leverOptions.find(l => l.value === sus.compressionLever)?.label ?? sus.compressionLever;
            return `Comp: ${lbl}`;
        }
        return `Comp ${sus.compressionClicks} Clicks`;
    }

    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [bikeId, setBikeId] = useState('');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [fork, setFork] = useState<SuspensionValues>({ ...defaultFork });
    const [shock, setShock] = useState<SuspensionValues>({ ...defaultShock });
    const [tires, setTires] = useState<TireSetup>({ ...defaultTires });
    const [activeTab, setActiveTab] = useState<'fork' | 'shock' | 'tires'>('fork');

    const params = useLocalSearchParams();
    const router = useRouter();
    const [lastHandledTs, setLastHandledTs] = useState('');

    useFocusEffect(
        useCallback(() => {
            Promise.all([loadSetups(), loadBikes(), loadUnits(), loadRides()]).finally(() => setLoading(false));
        }, [])
    );

    const refreshOnForeground = useCallback(() => {
        Promise.all([loadSetups(), loadBikes(), loadUnits(), loadRides()]).catch(() => {});
    }, []);

    // Pull newer cloud data when the app/tab becomes visible again
    useRefreshOnForeground(refreshOnForeground);

    useEffect(() => {
        if (params.ts && typeof params.ts === 'string' && params.ts !== lastHandledTs && trackerBikes.length > 0) {
            setLastHandledTs(params.ts);

            setEditingSetup(null);
            setName(''); setLocation(''); setNotes(''); setTags([]);
            setActiveTab('tires');

            let resetFork = { ...defaultFork, config: { ...defaultConfig } };
            let resetShock = { ...defaultShock, config: { ...defaultConfig } };

            let applyBikeId = '';
            let parsedFork = { ...resetFork };
            let parsedShock = { ...resetShock };

            if (params.bikeId && typeof params.bikeId === 'string' && trackerBikes.some(b => b.id === params.bikeId)) {
                applyBikeId = params.bikeId;
            } else if (trackerBikes.length > 0) {
                applyBikeId = trackerBikes[0].id;
            }

            setBikeId(applyBikeId);
            const bike = trackerBikes.find(b => b.id === applyBikeId);
            if (bike) {
                const forkComp = bike.components.find((c: any) => c.type === 'fork');
                if (forkComp && forkComp.setupValues) {
                    const travel = forkComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                    const stroke = forkComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                    if (travel) parsedFork.travel = parseInt(travel, 10) || parsedFork.travel;
                    if (stroke) parsedFork.stroke = parseInt(stroke, 10) || parsedFork.stroke;
                }

                const shockComp = bike.components.find((c: any) => c.type === 'shock');
                if (shockComp && shockComp.setupValues) {
                    const travel = shockComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                    const stroke = shockComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                    if (travel) parsedShock.travel = parseInt(travel, 10) || parsedShock.travel;
                    if (stroke) parsedShock.stroke = parseInt(stroke, 10) || parsedShock.stroke;
                }
            }

            // Apply Pressure Bot Overrides
            if (params.forkPsi) {
                parsedFork.psi = parseInt(params.forkPsi as string, 10) || parsedFork.psi;
                setName(t('dialed.pressure_bot_name'));
            }
            if (params.forkClicks) {
                const c = parseInt(params.forkClicks as string, 10) || parsedFork.reboundClicks;
                parsedFork.reboundClicks = c;
                parsedFork.reboundLSR = c;
                parsedFork.reboundHSR = c;
            }
            if (params.forkCompClicks) {
                const c = parseInt(params.forkCompClicks as string, 10) || parsedFork.compressionClicks;
                parsedFork.compressionClicks = c;
                parsedFork.compressionLSC = c;
                parsedFork.compressionHSC = c;
            }

            if (params.shockPsi) {
                parsedShock.psi = parseInt(params.shockPsi as string, 10) || parsedShock.psi;
            }
            if (params.shockMode === 'coil' || params.shockMode === 'air') {
                parsedShock.mode = params.shockMode as 'air' | 'coil';
            }
            if (params.springRate) {
                parsedShock.springRate = parseInt(params.springRate as string, 10) || parsedShock.springRate;
            }
            if (params.shockClicks) {
                const c = parseInt(params.shockClicks as string, 10) || parsedShock.reboundClicks;
                parsedShock.reboundClicks = c;
                parsedShock.reboundLSR = c;
                parsedShock.reboundHSR = c;
            }
            if (params.shockCompClicks) {
                const c = parseInt(params.shockCompClicks as string, 10) || parsedShock.compressionClicks;
                parsedShock.compressionClicks = c;
                parsedShock.compressionLSC = c;
                parsedShock.compressionHSC = c;
            }

            setFork(parsedFork);
            setShock(parsedShock);

            setTires(prev => ({
                ...defaultTires,
                frontBar: params.frontBar ? parseFloat(params.frontBar as string) : defaultTires.frontBar,
                rearBar: params.rearBar ? parseFloat(params.rearBar as string) : defaultTires.rearBar
            }));

            setModalVisible(true);
        }
    }, [params.ts, trackerBikes.length]);

    const loadSetups = async () => {
        const data = await syncLoadTable<Setup>('suspension_setups', SETUPS_KEY);
        setSetups(data);
    };

    const loadBikes = async () => {
        const bikes = await syncLoadBikes();
        setTrackerBikes(bikes);
    };

    const loadUnits = async () => {
        const isGerman = i18n.language?.startsWith('de');
        const pref = await syncLoadPreference<{ pressure: 'bar' | 'psi'; weight: 'kg' | 'lb' }>('units', UNITS_KEY);
        setPressureUnit(pref?.pressure ?? (isGerman ? 'bar' : 'psi'));
    };

    const loadRides = async () => {
        const data = await syncLoadTable<any>('rides', '@bikepro_rides');
        setRides(data ?? []);
    };

    const saveSetups = async (updated: Setup[]) => {
        await syncSaveTable('suspension_setups', SETUPS_KEY, updated);
        setSetups(updated);
    };

    const bikeOptions = [
        { label: t('dialed.no_bike'), value: '' },
        ...trackerBikes.map(b => ({
            label: `${b.name} (${b.size ?? ''} ${b.model})`,
            value: b.id,
        })),
    ];

    const getSelectedBikeName = () => {
        if (!bikeId) return '';
        return trackerBikes.find(b => b.id === bikeId)?.name ?? '';
    };

    // Resolve bike name at runtime (handles renamed bikes from Component Tracker)
    const getBikeDisplayName = (setup: Setup): string =>
        (setup.bikeId && trackerBikes.find(b => b.id === setup.bikeId)?.name) || setup.bikeName || '';

    // Tire pressure is stored in bar; convert only at display/input boundaries
    const toDisplayPressure = (bar: number) => pressureUnit === 'psi' ? Math.round(bar * BAR_TO_PSI) : bar;
    const fromDisplayPressure = (v: number) => pressureUnit === 'psi' ? Math.round((v / BAR_TO_PSI) * 100) / 100 : v;
    const formatTirePressure = (bar?: number) => {
        if (bar == null) return '?';
        if (pressureUnit === 'psi') return `${Math.round(bar * BAR_TO_PSI)} psi`;
        return `${bar.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bar`;
    };

    const handleBikeChange = (newBikeId: string) => {
        setBikeId(newBikeId);
        if (!newBikeId) return;

        const bike = trackerBikes.find(b => b.id === newBikeId);
        if (!bike) return;

        setFork(prev => {
            let next = { ...prev };
            const forkComp = bike.components.find((c: any) => c.type === 'fork');
            if (forkComp && forkComp.setupValues) {
                const travel = forkComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                const stroke = forkComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                if (travel) next.travel = parseInt(travel, 10) || next.travel;
                if (stroke) next.stroke = parseInt(stroke, 10) || next.stroke;
            }
            return next;
        });

        setShock(prev => {
            let next = { ...prev };
            const shockComp = bike.components.find((c: any) => c.type === 'shock');
            if (shockComp && shockComp.setupValues) {
                const travel = shockComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                const stroke = shockComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                if (travel) next.travel = parseInt(travel, 10) || next.travel;
                if (stroke) next.stroke = parseInt(stroke, 10) || next.stroke;
            }
            return next;
        });
    };

    const openNewSetup = () => {
        setEditingSetup(null);
        setName(''); setLocation(''); setNotes(''); setTags([]); setActiveTab('fork');
        setTires({ ...defaultTires });

        let resetFork = { ...defaultFork, config: { ...defaultConfig } };
        let resetShock = { ...defaultShock, config: { ...defaultConfig } };

        if (trackerBikes.length > 0) {
            const defaultId = trackerBikes[0].id;
            setBikeId(defaultId);
            const bike = trackerBikes[0];

            const forkComp = bike.components.find((c: any) => c.type === 'fork');
            if (forkComp && forkComp.setupValues) {
                const travel = forkComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                const stroke = forkComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                if (travel) resetFork.travel = parseInt(travel, 10) || resetFork.travel;
                if (stroke) resetFork.stroke = parseInt(stroke, 10) || resetFork.stroke;
            }

            const shockComp = bike.components.find((c: any) => c.type === 'shock');
            if (shockComp && shockComp.setupValues) {
                const travel = shockComp.setupValues.find((s: any) => s.key === 'travel')?.value;
                const stroke = shockComp.setupValues.find((s: any) => s.key === 'stroke')?.value;
                if (travel) resetShock.travel = parseInt(travel, 10) || resetShock.travel;
                if (stroke) resetShock.stroke = parseInt(stroke, 10) || resetShock.stroke;
            }
        } else {
            setBikeId('');
        }

        setFork(resetFork);
        setShock(resetShock);
        setModalVisible(true);
    };

    const openEditSetup = (setup: Setup) => {
        setEditingSetup(setup);
        setName(setup.name); setLocation(setup.location);
        setNotes(setup.notes); setBikeId(setup.bikeId || '');
        setTags(setup.tags || []);
        setFork({ ...defaultFork, ...setup.fork, config: { ...defaultConfig, ...setup.fork?.config } });
        setShock({ ...defaultShock, ...setup.shock, config: { ...defaultConfig, ...setup.shock?.config } });
        setTires({ ...defaultTires, ...setup.tires });
        setActiveTab('fork');
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        const setupData: Setup = {
            id: editingSetup?.id ?? newId(),
            name: name.trim(), location: location.trim(),
            bikeId, bikeName: getSelectedBikeName(),
            fork, shock, tires, tags, notes: notes.trim(),
            createdAt: editingSetup?.createdAt ?? new Date().toISOString(),
        };
        let updated: Setup[];
        if (editingSetup) {
            updated = setups.map(s => s.id === editingSetup.id ? setupData : s);
        } else {
            updated = [setupData, ...setups];
        }
        saveSetups(updated);
        setModalVisible(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirmDialog(
            t('dialed.delete_setup_title'),
            t('dialed.delete_setup_message'),
            t('common.cancel')
        );
        if (!confirmed) return;
        await syncDeleteFromTable('suspension_setups', '@bikepro_setups', id);
        saveSetups(setups.filter(s => s.id !== id));
    };

    const activeSuspension = activeTab === 'fork' ? fork : activeTab === 'shock' ? shock : null;
    const setActiveSuspension = activeTab === 'fork' ? setFork : setShock;

    const updateSusValue = (key: keyof SuspensionValues, val: any) => {
        if (activeSuspension) setActiveSuspension((prev: SuspensionValues) => ({ ...prev, [key]: val }));
    };

    const updateConfig = (key: keyof SuspensionConfig, val: any) => {
        if (activeSuspension) {
            setActiveSuspension((prev: SuspensionValues) => ({
                ...prev,
                config: { ...prev.config, [key]: val },
            }));
        }
    };

    const activeConfig = activeSuspension?.config ?? defaultConfig;

    const getActiveComponentConfig = () => {
        let rMode = activeConfig.reboundMode;
        let cMode = activeConfig.compressionMode;
        let isReboundOverridden = false;
        let isCompressionOverridden = false;
        
        if (bikeId) {
            const bike = trackerBikes.find(b => b.id === bikeId);
            if (bike) {
                const comp = bike.components.find(c => c.type === activeTab);
                if (comp) {
                    if (comp.reboundMode) { rMode = comp.reboundMode as ReboundMode; isReboundOverridden = true; }
                    if (comp.compressionMode) { cMode = comp.compressionMode as CompressionMode; isCompressionOverridden = true; }
                }
            }
        }
        return { rMode, cMode, isReboundOverridden, isCompressionOverridden };
    };

    const compConfig = getActiveComponentConfig();

    // Helper to get max clicks for the active component from the bike
    const getActiveComponentMaxClicks = () => {
        if (!bikeId) return 25; // fallback
        const bike = trackerBikes.find(b => b.id === bikeId);
        if (!bike) return 25;
        const comp = bike.components.find(c => c.type === activeTab);
        if (!comp || !comp.maxClicks) return 25;
        const parsed = parseInt(comp.maxClicks, 10);
        return isNaN(parsed) ? 25 : parsed;
    };
    
    const currentMaxClicks = getActiveComponentMaxClicks();

    // Average setup rating from Ride-Log (rides with setupId + 1–5 setupRating)
    const ratingStats = useMemo(() => {
        const map: Record<string, { sum: number; count: number }> = {};
        rides.forEach(r => {
            const sid = r?.setupId;
            const rating = Number(r?.setupRating);
            if (!sid || !(rating >= 1 && rating <= 5)) return;
            const cur = map[sid] ?? { sum: 0, count: 0 };
            cur.sum += rating;
            cur.count += 1;
            map[sid] = cur;
        });
        return map;
    }, [rides]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('dialed.title') }} />
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.btnRow}>
                    <BPButton title={t('dialed.add_setup')} onPress={openNewSetup} color={ACCENT} size="md" style={{ flex: 2 }} />
                    <BPButton title="🧙 Wizard" onPress={() => { setWizardStep('category'); setSelectedCategory(null); setWizardSolution(''); setWizardVisible(true); }} color={theme.colors.accentCyan} size="md" style={{ flex: 1 }} />
                </View>

                {loading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator color={ACCENT} />
                    </View>
                ) : setups.length === 0 ? (
                    <BPEmptyState
                        icon="⚙️"
                        title={t('dialed.no_setups')}
                        subtitle={t('dialed.create_first_setup')}
                    />
                ) : (
                    setups.map(setup => (
                        <BPCard key={setup.id} accentColor={ACCENT} style={styles.setupCard} onPress={() => openEditSetup(setup)}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>{setup.name}</Text>
                                        {getBikeDisplayName(setup) ? (
                                            <Text style={styles.cardBike}>🚵 {getBikeDisplayName(setup)}</Text>
                                        ) : null}
                                        {setup.location ? <Text style={styles.cardLocation}>📍 {setup.location}</Text> : null}
                                    </View>
                                    <TouchableOpacity
                                        onPress={(e) => { e.stopPropagation?.(); handleDelete(setup.id); }}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('a11y.remove')}
                                    >
                                        <Text style={styles.deleteBtn}>🗑</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.valuesGrid}>
                                    {/* Fork */}
                                    <View style={styles.valueCol}>
                                        <Text style={styles.valueColTitle}>{t('dialed.fork')}</Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.fork.psi}</Text>
                                            <Text style={styles.valueLabel}> PSI  </Text>
                                            {setup.fork.travel && setup.fork.sagPercent ? (
                                                <Text>
                                                    <Text style={[styles.valueNum, { color: theme.colors.text }]}>
                                                        {Math.round(setup.fork.travel * (setup.fork.sagPercent / 100))}
                                                    </Text>
                                                    <Text style={styles.valueLabel}> mm SAG ({setup.fork.sagPercent}%)</Text>
                                                </Text>
                                            ) : (
                                                <Text>
                                                    <Text style={styles.valueNum}>{setup.fork.sagPercent}</Text>
                                                    <Text style={styles.valueLabel}>% SAG</Text>
                                                </Text>
                                            )}
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueSmall}>{reboundDisplay(setup.fork)}</Text>
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueSmall}>{compDisplay(setup.fork)}</Text>
                                        </Text>
                                    </View>

                                    {/* Shock */}
                                    <View style={styles.valueCol}>
                                        <Text style={styles.valueColTitle}>{t('dialed.shock')}</Text>
                                        <Text style={styles.valueRow}>
                                            {setup.shock.mode === 'coil' ? (
                                                <Text>
                                                    <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.shock.springRate ?? '?'}</Text>
                                                    <Text style={styles.valueLabel}> lb/in  </Text>
                                                </Text>
                                            ) : (
                                                <Text>
                                                    <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.shock.psi}</Text>
                                                    <Text style={styles.valueLabel}> PSI  </Text>
                                                </Text>
                                            )}
                                            {setup.shock.stroke && setup.shock.sagPercent ? (
                                                <Text>
                                                    <Text style={[styles.valueNum, { color: theme.colors.text }]}>
                                                        {Math.round(setup.shock.stroke * (setup.shock.sagPercent / 100))}
                                                    </Text>
                                                    <Text style={styles.valueLabel}> mm </Text>
                                                    <Text style={[styles.valueLabel, { fontStyle: 'italic', fontSize: 10 }]}>
                                                        ({setup.shock.sagPercent}%)
                                                    </Text>
                                                </Text>
                                            ) : (
                                                <Text>
                                                    <Text style={styles.valueNum}>{setup.shock.sagPercent}</Text>
                                                    <Text style={styles.valueLabel}>% SAG</Text>
                                                </Text>
                                            )}
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueSmall}>{reboundDisplay(setup.shock)}</Text>
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueSmall}>{compDisplay(setup.shock)}</Text>
                                        </Text>
                                    </View>
                                </View>

                                {setup.tires && (
                                    <View style={styles.tiresRow}>
                                        <Text style={styles.tireText}>🛞 VR: {formatTirePressure(setup.tires.frontBar)}</Text>
                                        <Text style={styles.tireText}>🛞 HR: {formatTirePressure(setup.tires.rearBar)}</Text>
                                    </View>
                                )}

                                {setup.tags && setup.tags.length > 0 && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                                        {setup.tags.map(tVal => {
                                            const lbl = TAG_OPTIONS.find(o => o.value === tVal)?.label || tVal;
                                            return (
                                                <BPChip key={tVal} label={lbl} color={ACCENT} small />
                                            );
                                        })}
                                    </View>
                                )}

                                {ratingStats[setup.id] && ratingStats[setup.id].count > 0 && (
                                    <Text style={styles.cardRating}>
                                        {t('dialed.setup_rating', {
                                            rating: (ratingStats[setup.id].sum / ratingStats[setup.id].count).toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                                            count: ratingStats[setup.id].count,
                                        })}
                                    </Text>
                                )}

                                {setup.notes ? <Text style={styles.cardNotes}>{setup.notes}</Text> : null}
                        </BPCard>
                    ))
                )}
            </ScrollView>

            {/* Modal */}
            <BPModal visible={modalVisible} onClose={() => setModalVisible(false)} title={editingSetup ? t('dialed.edit_setup') : t('dialed.new_setup')}>
                <BPInput label={t('dialed.setup_name')} placeholder={t('dialed.setup_name_placeholder')} value={name} onChangeText={setName} accentColor={ACCENT} />
                <BPInput label={t('dialed.location')} placeholder={t('dialed.location_placeholder')} value={location} onChangeText={setLocation} accentColor={ACCENT} />

                {/* Bike Integration */}
                <BPPicker label={t('dialed.bike')} options={bikeOptions} value={bikeId} onValueChange={handleBikeChange} accentColor={ACCENT} />

                {/* Component Tab */}
                <Text style={styles.configLabel}>{t('dialed.component')}</Text>
                <BPSegmentedControl
                    options={[
                        { label: t('dialed.fork'), value: 'fork' },
                        { label: t('dialed.shock'), value: 'shock' },
                        { label: t('dialed.tires'), value: 'tires' },
                    ]}
                    value={activeTab}
                    onChange={v => setActiveTab(v as 'fork' | 'shock' | 'tires')}
                    accentColor={ACCENT}
                />

                {/* Suspension Inputs */}
                {activeSuspension && (
                    <>
                        {activeTab === 'shock' && (
                            <BPToggle
                                label={t('dialed.coil_shock')}
                                value={(activeSuspension.mode ?? 'air') === 'coil'}
                                onValueChange={v => updateSusValue('mode', v ? 'coil' : 'air')}
                                accentColor={ACCENT}
                            />
                        )}
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                {activeTab === 'shock' && (activeSuspension.mode ?? 'air') === 'coil' ? (
                                    <BPSlider label={t('dialed.spring_rate')} value={activeSuspension.springRate ?? 400} min={200} max={800} step={25} unit=" lb/in" accentColor={ACCENT} onValueChange={v => updateSusValue('springRate', v)} />
                                ) : (
                                    <BPSlider label={t('dialed.pressure')} value={activeSuspension.psi} min={activeTab === 'fork' ? 40 : 80} max={activeTab === 'fork' ? 160 : 400} step={1} unit=" PSI" accentColor={ACCENT} onValueChange={v => updateSusValue('psi', v)} />
                                )}
                            </View>
                        </View>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="SAG" value={activeSuspension.sagPercent} min={10} max={45} step={1} unit="%" accentColor={ACCENT} onValueChange={v => updateSusValue('sagPercent', v)} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.travel')} value={activeSuspension.travel} min={80} max={220} step={5} unit=" mm" accentColor={ACCENT} onValueChange={v => updateSusValue('travel', v)} />
                            </View>
                        </View>
                        {['fork', 'shock'].includes(activeTab) && (
                            <BPSlider label={t('dialed.stroke')} value={activeSuspension.stroke ?? (activeTab === 'fork' ? 170 : 57)} min={30} max={220} step={1} unit=" mm" accentColor={ACCENT} onValueChange={v => updateSusValue('stroke', v)} />
                        )}

                        {/* ─── REBOUND CONFIG ─── */}
                        {compConfig.rMode !== 'none' && (
                            <View style={styles.configSection}>
                                <Text style={styles.subSectionTitle}>{t('dialed.rebound')}</Text>
                                {!compConfig.isReboundOverridden && (
                                    <BPToggle
                                        label={t('dialed.rebound_hsls')}
                                        value={compConfig.rMode === 'hsls'}
                                        onValueChange={v => updateConfig('reboundMode', v ? 'hsls' : 'clicks')}
                                        accentColor={ACCENT}
                                    />
                                )}

                                {compConfig.rMode === 'clicks' && (
                                    <BPSlider label="Rebound Clicks" value={activeSuspension.reboundClicks} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundClicks', v)} />
                                )}
                                {compConfig.rMode === 'hsls' && (
                                    <View style={styles.inputRow}>
                                        <View style={{ flex: 1 }}>
                                            <BPSlider label="Low-Speed (LSR)" value={activeSuspension.reboundLSR} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundLSR', v)} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <BPSlider label="High-Speed (HSR)" value={activeSuspension.reboundHSR} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundHSR', v)} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ─── COMPRESSION CONFIG ─── */}
                        {compConfig.cMode !== 'none' && (
                            <View style={styles.configSection}>
                                <Text style={styles.subSectionTitle}>{t('dialed.compression')}</Text>
                                {!compConfig.isCompressionOverridden && (
                                    <BPPicker
                                        label={t('dialed.compression_type')}
                                        options={[
                                            { label: t('dialed.clicks'), value: 'clicks' },
                                            { label: t('dialed.lever'), value: 'lever' },
                                            { label: t('dialed.hsls'), value: 'hsls' },
                                        ]}
                                        value={compConfig.cMode}
                                        onValueChange={v => updateConfig('compressionMode', v)}
                                        accentColor={ACCENT}
                                    />
                                )}

                                {compConfig.cMode === 'clicks' && (
                                    <BPSlider label="Compression Clicks" value={activeSuspension.compressionClicks} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionClicks', v)} />
                                )}

                                {compConfig.cMode === 'lever' && (
                                    <BPPicker label={t('dialed.lever_pos')} options={leverOptions} value={activeSuspension.compressionLever} onValueChange={v => updateSusValue('compressionLever', v)} accentColor={ACCENT} />
                                )}

                                {compConfig.cMode === 'hsls' && (
                                    <View style={styles.inputRow}>
                                        <View style={{ flex: 1 }}>
                                            <BPSlider label="Low-Speed (LSC)" value={activeSuspension.compressionLSC} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionLSC', v)} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <BPSlider label="High-Speed (HSC)" value={activeSuspension.compressionHSC} min={0} max={currentMaxClicks} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionHSC', v)} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        <BPPicker label={t('dialed.tokens')} options={tokenOptions} value={activeSuspension.tokens.toString()} onValueChange={v => updateSusValue('tokens', parseInt(v, 10))} accentColor={ACCENT} />
                    </>
                )}

                {/* Tire Inputs */}
                {activeTab === 'tires' && (
                    <>
                        <Text style={styles.subSectionTitle}>{t('dialed.front_tire')}</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.pressure_front')} value={toDisplayPressure(tires.frontBar)} min={pressureUnit === 'psi' ? 12 : 0.8} max={pressureUnit === 'psi' ? 44 : 3.0} step={pressureUnit === 'psi' ? 1 : 0.05} unit={pressureUnit === 'psi' ? ' psi' : ' bar'} accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, frontBar: fromDisplayPressure(v) }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label={t('dialed.width')} options={tireWidthOptions} value={tires.frontWidth} onValueChange={v => setTires(p => ({ ...p, frontWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label={t('dialed.tire_front')} placeholder={t('dialed.tire_front_placeholder')} value={tires.frontTire} onChangeText={v => setTires(p => ({ ...p, frontTire: v }))} accentColor={ACCENT} />

                        <Text style={styles.subSectionTitle}>{t('dialed.rear_tire')}</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.pressure_rear')} value={toDisplayPressure(tires.rearBar)} min={pressureUnit === 'psi' ? 12 : 0.8} max={pressureUnit === 'psi' ? 44 : 3.0} step={pressureUnit === 'psi' ? 1 : 0.05} unit={pressureUnit === 'psi' ? ' psi' : ' bar'} accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, rearBar: fromDisplayPressure(v) }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label={t('dialed.width')} options={tireWidthOptions} value={tires.rearWidth} onValueChange={v => setTires(p => ({ ...p, rearWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label={t('dialed.tire_rear')} placeholder={t('dialed.tire_rear_placeholder')} value={tires.rearTire} onChangeText={v => setTires(p => ({ ...p, rearTire: v }))} accentColor={ACCENT} />
                    </>
                )}

                <Text style={styles.subSectionTitle}>{t('dialed.tags_notes')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: theme.spacing.md }}>
                    {TAG_OPTIONS.map(tagOpt => {
                        const isActive = tags.includes(tagOpt.value);
                        return (
                            <BPChip
                                key={tagOpt.value}
                                label={tagOpt.label}
                                selected={isActive}
                                color={ACCENT}
                                onPress={() => setTags(prev => isActive ? prev.filter(t => t !== tagOpt.value) : [...prev, tagOpt.value])}
                            />
                        );
                    })}
                </View>
                <BPInput label={t('dialed.notes')} placeholder={t('dialed.notes_placeholder')} value={notes} onChangeText={setNotes} multiline numberOfLines={3} accentColor={ACCENT} />

                <View style={styles.modalActions}>
                    <BPButton title={t('common.save')} onPress={handleSave} color={ACCENT} fullWidth size="lg" disabled={!name.trim()} />
                </View>
            </BPModal>

            {/* Tuning Wizard Modal */}
            <BPModal visible={wizardVisible} onClose={() => setWizardVisible(false)} title={t('dialed.wizard_title')}>
                {wizardStep === 'category' && (
                    <>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: 14 }}>{t('dialed.wizard_q_category')}</Text>
                        {tuningCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => { setSelectedCategory(cat); setWizardStep('issue'); }}
                                style={{
                                    backgroundColor: theme.colors.surface,
                                    padding: 16, borderRadius: theme.radius.md,
                                    borderWidth: 1, borderColor: theme.colors.border,
                                    marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12
                                }}
                            >
                                <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{cat.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </>
                )}

                {wizardStep === 'issue' && selectedCategory && (
                    <>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: 14 }}>{t('dialed.wizard_q_issue')}</Text>
                        {selectedCategory.issues.map((issue, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => { setWizardSolution(issue.solution); setWizardStep('solution'); }}
                                style={{
                                    backgroundColor: theme.colors.surface,
                                    padding: 16, borderRadius: theme.radius.md,
                                    borderWidth: 1, borderColor: theme.colors.border,
                                    marginBottom: 8
                                }}
                            >
                                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{issue.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <BPButton title={t('dialed.wizard_back_categories')} onPress={() => setWizardStep('category')} variant="secondary" color={theme.colors.textMuted} fullWidth style={{ marginTop: 8 }} />
                    </>
                )}

                {wizardStep === 'solution' && (
                    <>
                        <Text style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, fontSize: 13, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 }}>{t('dialed.wizard_recommendation')}</Text>
                        <View style={{ backgroundColor: theme.colors.accentCyan + '20', padding: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.accentCyan + '60', marginBottom: theme.spacing.lg }}>
                            <Text style={{ color: theme.colors.text, fontSize: 16, lineHeight: 24, fontWeight: '600' }}>💡 {wizardSolution}</Text>
                        </View>
                        <BPButton title={t('dialed.wizard_create')} onPress={() => {
                            setWizardVisible(false);
                            openNewSetup();
                        }} color={ACCENT} fullWidth />
                        <BPButton title={t('common.back')} onPress={() => setWizardStep('issue')} variant="secondary" color={theme.colors.textMuted} fullWidth style={{ marginTop: 8 }} />
                    </>
                )}
            </BPModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    btnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    setupCard: { marginTop: theme.spacing.md, padding: theme.spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
    cardBike: { color: ACCENT, fontSize: 12, fontWeight: '700', marginTop: 2 },
    deleteBtn: { fontSize: 18, padding: 4 },
    cardLocation: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
    valuesGrid: { flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm },
    valueCol: { flex: 1, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm },
    valueColTitle: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
    valueRow: { textAlign: 'center', marginVertical: 2 },
    valueLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
    valueNum: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
    valueSmall: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
    tiresRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm },
    tireText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
    cardNotes: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: theme.spacing.sm },
    cardRating: { color: ACCENT, fontSize: 13, fontWeight: '700', marginTop: theme.spacing.sm },
    modalActions: { marginTop: theme.spacing.lg },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    subSectionTitle: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: 4 },
    configSection: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginTop: theme.spacing.sm },
    configLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
