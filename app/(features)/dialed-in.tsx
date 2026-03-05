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
import { BPButton, BPCard, BPInput, BPModal, BPPicker, BPSlider } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { syncLoadBikes, syncLoadTable, syncSaveTable } from '@/lib/sync';
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

const ACCENT = '#FF6B2C';
const SETUPS_KEY = '@bikepro_setups';

// --- Types ---
type ReboundMode = 'clicks' | 'hsls';
type CompressionMode = 'clicks' | 'lever' | 'hsls';

interface SuspensionConfig {
    reboundMode: ReboundMode;
    compressionMode: CompressionMode;
}

interface SuspensionValues {
    psi: number;
    sagPercent: number;
    travel: number;
    stroke?: number;  // shock-only: actual piston stroke in mm
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
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
    const [trackerBikes, setTrackerBikes] = useState<TrackerBike[]>([]);

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
    const [fork, setFork] = useState<SuspensionValues>({ ...defaultFork });
    const [shock, setShock] = useState<SuspensionValues>({ ...defaultShock });
    const [tires, setTires] = useState<TireSetup>({ ...defaultTires });
    const [activeTab, setActiveTab] = useState<'fork' | 'shock' | 'tires'>('fork');

    useEffect(() => { loadSetups(); loadBikes(); }, []);

    const loadSetups = async () => {
        const data = await syncLoadTable<Setup>('suspension_setups', SETUPS_KEY);
        setSetups(data);
    };

    const loadBikes = async () => {
        const bikes = await syncLoadBikes();
        setTrackerBikes(bikes);
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

    const handleBikeChange = (newBikeId: string) => {
        setBikeId(newBikeId);
        if (!newBikeId) return;

        const bike = trackerBikes.find(b => b.id === newBikeId);
        if (!bike) return;

        setFork(prev => {
            let next = { ...prev };
            const forkComp = bike.components.find((c: any) => c.type === 'fork');
            if (forkComp && forkComp.setupValues) {
                const travel = forkComp.setupValues.find((s: any) => s.key === 'Federweg')?.value;
                const stroke = forkComp.setupValues.find((s: any) => s.key === 'Hub')?.value;
                if (travel) next.travel = parseInt(travel, 10) || next.travel;
                if (stroke) next.stroke = parseInt(stroke, 10) || next.stroke;
            }
            return next;
        });

        setShock(prev => {
            let next = { ...prev };
            const shockComp = bike.components.find((c: any) => c.type === 'shock');
            if (shockComp && shockComp.setupValues) {
                const travel = shockComp.setupValues.find((s: any) => s.key === 'Federweg')?.value;
                const stroke = shockComp.setupValues.find((s: any) => s.key === 'Hub')?.value;
                if (travel) next.travel = parseInt(travel, 10) || next.travel;
                if (stroke) next.stroke = parseInt(stroke, 10) || next.stroke;
            }
            return next;
        });
    };

    const openNewSetup = () => {
        setEditingSetup(null);
        setName(''); setLocation(''); setNotes(''); setActiveTab('fork');
        setTires({ ...defaultTires });

        let resetFork = { ...defaultFork, config: { ...defaultConfig } };
        let resetShock = { ...defaultShock, config: { ...defaultConfig } };

        if (trackerBikes.length > 0) {
            const defaultId = trackerBikes[0].id;
            setBikeId(defaultId);
            const bike = trackerBikes[0];

            const forkComp = bike.components.find((c: any) => c.type === 'fork');
            if (forkComp && forkComp.setupValues) {
                const travel = forkComp.setupValues.find((s: any) => s.key === 'Federweg')?.value;
                const stroke = forkComp.setupValues.find((s: any) => s.key === 'Hub')?.value;
                if (travel) resetFork.travel = parseInt(travel, 10) || resetFork.travel;
                if (stroke) resetFork.stroke = parseInt(stroke, 10) || resetFork.stroke;
            }

            const shockComp = bike.components.find((c: any) => c.type === 'shock');
            if (shockComp && shockComp.setupValues) {
                const travel = shockComp.setupValues.find((s: any) => s.key === 'Federweg')?.value;
                const stroke = shockComp.setupValues.find((s: any) => s.key === 'Hub')?.value;
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
        setFork({ ...defaultFork, ...setup.fork, config: { ...defaultConfig, ...setup.fork?.config } });
        setShock({ ...defaultShock, ...setup.shock, config: { ...defaultConfig, ...setup.shock?.config } });
        setTires({ ...defaultTires, ...setup.tires });
        setActiveTab('fork');
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        const setupData: Setup = {
            id: editingSetup?.id ?? Date.now().toString(),
            name: name.trim(), location: location.trim(),
            bikeId, bikeName: getSelectedBikeName(),
            fork, shock, tires, notes: notes.trim(),
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

    const handleDelete = (id: string) => {
        Alert.alert('Setup löschen?', '', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: () => saveSetups(setups.filter(s => s.id !== id)) },
        ]);
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

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('dialed.title'), headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.text }} />
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <BPButton title={t('dialed.add_setup')} onPress={openNewSetup} color={ACCENT} fullWidth size="lg" />

                {setups.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>⚙️</Text>
                        <Text style={styles.emptyTitle}>{t('dialed.no_setups')}</Text>
                        <Text style={styles.emptySubtitle}>{t('dialed.create_first_setup')}</Text>
                    </View>
                ) : (
                    setups.map(setup => (
                        <TouchableOpacity key={setup.id} onPress={() => openEditSetup(setup)} activeOpacity={0.8}>
                            <BPCard accentColor={ACCENT} style={styles.setupCard}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>{setup.name}</Text>
                                        {setup.bikeName ? (
                                            <Text style={styles.cardBike}>🚵 {setup.bikeName}</Text>
                                        ) : null}
                                        {setup.location ? <Text style={styles.cardLocation}>📍 {setup.location}</Text> : null}
                                    </View>
                                    <TouchableOpacity onPress={() => handleDelete(setup.id)}>
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
                                            {setup.fork.stroke && setup.fork.sagPercent ? (
                                                <Text>
                                                    <Text style={[styles.valueNum, { color: theme.colors.text }]}>
                                                        {Math.round(setup.fork.stroke * (setup.fork.sagPercent / 100))}
                                                    </Text>
                                                    <Text style={styles.valueLabel}> mm </Text>
                                                    <Text style={[styles.valueLabel, { fontStyle: 'italic', fontSize: 10 }]}>
                                                        ({setup.fork.sagPercent}%)
                                                    </Text>
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
                                            <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.shock.psi}</Text>
                                            <Text style={styles.valueLabel}> PSI  </Text>
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
                                        <Text style={styles.tireText}>🛞 VR: {setup.tires.frontBar?.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '?'} bar</Text>
                                        <Text style={styles.tireText}>🛞 HR: {setup.tires.rearBar?.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '?'} bar</Text>
                                    </View>
                                )}

                                {setup.notes ? <Text style={styles.cardNotes}>{setup.notes}</Text> : null}
                            </BPCard>
                        </TouchableOpacity>
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
                <BPPicker
                    label={t('dialed.component')}
                    options={[
                        { label: t('dialed.fork'), value: 'fork' },
                        { label: t('dialed.shock'), value: 'shock' },
                        { label: t('dialed.tires'), value: 'tires' },
                    ]}
                    value={activeTab}
                    onValueChange={v => setActiveTab(v as 'fork' | 'shock' | 'tires')}
                    accentColor={ACCENT}
                />

                {/* Suspension Inputs */}
                {activeSuspension && (
                    <>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.pressure')} value={activeSuspension.psi} min={activeTab === 'fork' ? 40 : 80} max={activeTab === 'fork' ? 160 : 400} step={1} unit=" PSI" accentColor={ACCENT} onValueChange={v => updateSusValue('psi', v)} />
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
                        <View style={styles.configSection}>
                            <Text style={styles.subSectionTitle}>{t('dialed.rebound')}</Text>
                            <View style={styles.configToggle}>
                                <Text style={styles.configLabel}>{t('dialed.rebound_hsls')}</Text>
                                <Switch
                                    value={activeConfig.reboundMode === 'hsls'}
                                    onValueChange={v => updateConfig('reboundMode', v ? 'hsls' : 'clicks')}
                                    trackColor={{ false: theme.colors.border, true: ACCENT + '80' }}
                                    thumbColor={activeConfig.reboundMode === 'hsls' ? ACCENT : theme.colors.textMuted}
                                />
                            </View>

                            {activeConfig.reboundMode === 'clicks' ? (
                                <BPSlider label="Rebound Clicks" value={activeSuspension.reboundClicks} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundClicks', v)} />
                            ) : (
                                <View style={styles.inputRow}>
                                    <View style={{ flex: 1 }}>
                                        <BPSlider label="Low-Speed (LSR)" value={activeSuspension.reboundLSR} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundLSR', v)} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <BPSlider label="High-Speed (HSR)" value={activeSuspension.reboundHSR} min={0} max={15} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundHSR', v)} />
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* ─── COMPRESSION CONFIG ─── */}
                        <View style={styles.configSection}>
                            <Text style={styles.subSectionTitle}>{t('dialed.compression')}</Text>
                            <BPPicker
                                label={t('dialed.compression_type')}
                                options={[
                                    { label: t('dialed.clicks'), value: 'clicks' },
                                    { label: t('dialed.lever'), value: 'lever' },
                                    { label: t('dialed.hsls'), value: 'hsls' },
                                ]}
                                value={activeConfig.compressionMode}
                                onValueChange={v => updateConfig('compressionMode', v)}
                                accentColor={ACCENT}
                            />

                            {activeConfig.compressionMode === 'clicks' && (
                                <BPSlider label="Compression Clicks" value={activeSuspension.compressionClicks} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionClicks', v)} />
                            )}

                            {activeConfig.compressionMode === 'lever' && (
                                <BPPicker label={t('dialed.lever_pos')} options={leverOptions} value={activeSuspension.compressionLever} onValueChange={v => updateSusValue('compressionLever', v)} accentColor={ACCENT} />
                            )}

                            {activeConfig.compressionMode === 'hsls' && (
                                <View style={styles.inputRow}>
                                    <View style={{ flex: 1 }}>
                                        <BPSlider label="Low-Speed (LSC)" value={activeSuspension.compressionLSC} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionLSC', v)} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <BPSlider label="High-Speed (HSC)" value={activeSuspension.compressionHSC} min={0} max={15} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionHSC', v)} />
                                    </View>
                                </View>
                            )}
                        </View>

                        <BPPicker label={t('dialed.tokens')} options={tokenOptions} value={activeSuspension.tokens.toString()} onValueChange={v => updateSusValue('tokens', parseInt(v, 10))} accentColor={ACCENT} />
                    </>
                )}

                {/* Tire Inputs */}
                {activeTab === 'tires' && (
                    <>
                        <Text style={styles.subSectionTitle}>{t('dialed.front_tire')}</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.pressure_front')} value={tires.frontBar} min={0.8} max={3.0} step={0.05} unit=" bar" accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, frontBar: v }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label={t('dialed.width')} options={tireWidthOptions} value={tires.frontWidth} onValueChange={v => setTires(p => ({ ...p, frontWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label={t('dialed.tire_front')} placeholder={t('dialed.tire_front_placeholder')} value={tires.frontTire} onChangeText={v => setTires(p => ({ ...p, frontTire: v }))} accentColor={ACCENT} />

                        <Text style={styles.subSectionTitle}>{t('dialed.rear_tire')}</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label={t('dialed.pressure_rear')} value={tires.rearBar} min={0.8} max={3.0} step={0.05} unit=" bar" accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, rearBar: v }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label={t('dialed.width')} options={tireWidthOptions} value={tires.rearWidth} onValueChange={v => setTires(p => ({ ...p, rearWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label={t('dialed.tire_rear')} placeholder={t('dialed.tire_rear_placeholder')} value={tires.rearTire} onChangeText={v => setTires(p => ({ ...p, rearTire: v }))} accentColor={ACCENT} />
                    </>
                )}

                <BPInput label={t('dialed.notes')} placeholder={t('dialed.notes_placeholder')} value={notes} onChangeText={setNotes} multiline numberOfLines={3} accentColor={ACCENT} />

                <View style={styles.modalActions}>
                    <BPButton title={t('common.save')} onPress={handleSave} color={ACCENT} fullWidth size="lg" disabled={!name.trim()} />
                </View>
            </BPModal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
    emptySubtitle: { color: theme.colors.textMuted, fontSize: 14, marginTop: 8 },
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
    modalActions: { marginTop: theme.spacing.lg },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    subSectionTitle: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: 4 },
    configSection: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginTop: theme.spacing.sm },
    configToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
    configLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
