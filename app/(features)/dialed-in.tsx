/**
 * F1: Dialed-In — Fahrwerks-Log (Enhanced V2)
 * Agent Manifest: f1_dialed_in.md
 *
 * CRUD für Fahrwerks-Setups mit erweiterten Parametern:
 * - PSI, SAG%, Federweg
 * - Rebound (Low-Speed / High-Speed)
 * - Compression (Low-Speed / High-Speed)
 * - Volume Spacer / Tokens
 * - Reifendruck (Front/Rear)
 */
import { BPButton, BPCard, BPInput, BPModal, BPPicker, BPSlider } from '@/components/ui';
import { theme } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const ACCENT = '#FF6B2C';
const STORAGE_KEY = '@bikepro_setups';

// --- Types ---
interface SuspensionValues {
    psi: number;
    sagPercent: number;
    travel: number;
    reboundLSR: number;
    reboundHSR: number;
    compressionLSC: number;
    compressionHSC: number;
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
    bikeType: string;
    fork: SuspensionValues;
    shock: SuspensionValues;
    tires: TireSetup;
    notes: string;
    createdAt: string;
}

const defaultFork: SuspensionValues = {
    psi: 80, sagPercent: 20, travel: 170,
    reboundLSR: 10, reboundHSR: 5,
    compressionLSC: 10, compressionHSC: 3,
    tokens: 1,
};

const defaultShock: SuspensionValues = {
    psi: 200, sagPercent: 30, travel: 165,
    reboundLSR: 8, reboundHSR: 3,
    compressionLSC: 8, compressionHSC: 2,
    tokens: 1,
};

const defaultTires: TireSetup = {
    frontBar: 1.7, rearBar: 1.9,
    frontWidth: '2.5', rearWidth: '2.4',
    frontTire: '', rearTire: '',
};

const tokenOptions = [
    { label: '0', value: '0' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
];

const bikeTypeOptions = [
    { label: '🚵 Enduro', value: 'enduro' },
    { label: '⛰️ Downhill', value: 'downhill' },
    { label: '🌲 Trail', value: 'trail' },
    { label: '⚡ E-MTB', value: 'emtb' },
    { label: '🏁 XC', value: 'xc' },
];

const tireWidthOptions = [
    { label: '2.3"', value: '2.3' },
    { label: '2.35"', value: '2.35' },
    { label: '2.4"', value: '2.4' },
    { label: '2.5"', value: '2.5' },
    { label: '2.6"', value: '2.6' },
];

export default function DialedInScreen() {
    const [setups, setSetups] = useState<Setup[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetup, setEditingSetup] = useState<Setup | null>(null);

    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [bikeType, setBikeType] = useState('enduro');
    const [notes, setNotes] = useState('');
    const [fork, setFork] = useState<SuspensionValues>({ ...defaultFork });
    const [shock, setShock] = useState<SuspensionValues>({ ...defaultShock });
    const [tires, setTires] = useState<TireSetup>({ ...defaultTires });
    const [activeTab, setActiveTab] = useState<'fork' | 'shock' | 'tires'>('fork');

    useEffect(() => { loadSetups(); }, []);

    const loadSetups = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) setSetups(JSON.parse(data));
        } catch (e) { console.warn('Failed to load setups:', e); }
    };

    const saveSetups = async (updated: Setup[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setSetups(updated);
        } catch (e) { console.warn('Failed to save setups:', e); }
    };

    const openNewSetup = () => {
        setEditingSetup(null);
        setName(''); setLocation(''); setNotes(''); setBikeType('enduro');
        setFork({ ...defaultFork }); setShock({ ...defaultShock });
        setTires({ ...defaultTires }); setActiveTab('fork');
        setModalVisible(true);
    };

    const openEditSetup = (setup: Setup) => {
        setEditingSetup(setup);
        setName(setup.name); setLocation(setup.location);
        setNotes(setup.notes); setBikeType(setup.bikeType || 'enduro');
        setFork({ ...defaultFork, ...setup.fork });
        setShock({ ...defaultShock, ...setup.shock });
        setTires({ ...defaultTires, ...setup.tires });
        setActiveTab('fork');
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        const setupData: Setup = {
            id: editingSetup?.id ?? Date.now().toString(),
            name: name.trim(), location: location.trim(), bikeType,
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

    const updateSusValue = (key: keyof SuspensionValues, val: number) => {
        if (activeSuspension) setActiveSuspension(prev => ({ ...prev, [key]: val }));
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: '⚙️ Dialed-In', headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.text }} />
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <BPButton title="+ Neues Setup" onPress={openNewSetup} color={ACCENT} fullWidth size="lg" />

                {setups.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>⚙️</Text>
                        <Text style={styles.emptyTitle}>Noch keine Setups</Text>
                        <Text style={styles.emptySubtitle}>Erstelle dein erstes Fahrwerks-Setup!</Text>
                    </View>
                ) : (
                    setups.map(setup => (
                        <TouchableOpacity key={setup.id} onPress={() => openEditSetup(setup)} activeOpacity={0.8}>
                            <BPCard accentColor={ACCENT} style={styles.setupCard}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>{setup.name}</Text>
                                        {setup.location ? <Text style={styles.cardLocation}>📍 {setup.location}</Text> : null}
                                    </View>
                                    <TouchableOpacity onPress={() => handleDelete(setup.id)}>
                                        <Text style={styles.deleteBtn}>🗑</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.valuesGrid}>
                                    {/* Fork */}
                                    <View style={styles.valueCol}>
                                        <Text style={styles.valueColTitle}>🔱 Gabel</Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.fork.psi}</Text>
                                            <Text style={styles.valueLabel}> PSI  </Text>
                                            <Text style={styles.valueNum}>{setup.fork.sagPercent ?? '?'}</Text>
                                            <Text style={styles.valueLabel}>% SAG</Text>
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueLabel}>LSR </Text>
                                            <Text style={styles.valueNum}>{setup.fork.reboundLSR ?? setup.fork.reboundClicks ?? '—'}</Text>
                                            <Text style={styles.valueLabel}>  LSC </Text>
                                            <Text style={styles.valueNum}>{setup.fork.compressionLSC ?? setup.fork.compressionClicks ?? '—'}</Text>
                                        </Text>
                                        {(setup.fork.reboundHSR > 0 || setup.fork.compressionHSC > 0) && (
                                            <Text style={styles.valueRow}>
                                                <Text style={styles.valueLabel}>HSR </Text>
                                                <Text style={styles.valueNum}>{setup.fork.reboundHSR}</Text>
                                                <Text style={styles.valueLabel}>  HSC </Text>
                                                <Text style={styles.valueNum}>{setup.fork.compressionHSC}</Text>
                                            </Text>
                                        )}
                                    </View>

                                    {/* Shock */}
                                    <View style={styles.valueCol}>
                                        <Text style={styles.valueColTitle}>🔩 Dämpfer</Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={[styles.valueNum, { color: ACCENT }]}>{setup.shock.psi}</Text>
                                            <Text style={styles.valueLabel}> PSI  </Text>
                                            <Text style={styles.valueNum}>{setup.shock.sagPercent ?? '?'}</Text>
                                            <Text style={styles.valueLabel}>% SAG</Text>
                                        </Text>
                                        <Text style={styles.valueRow}>
                                            <Text style={styles.valueLabel}>LSR </Text>
                                            <Text style={styles.valueNum}>{setup.shock.reboundLSR ?? setup.shock.reboundClicks ?? '—'}</Text>
                                            <Text style={styles.valueLabel}>  LSC </Text>
                                            <Text style={styles.valueNum}>{setup.shock.compressionLSC ?? setup.shock.compressionClicks ?? '—'}</Text>
                                        </Text>
                                        {(setup.shock.reboundHSR > 0 || setup.shock.compressionHSC > 0) && (
                                            <Text style={styles.valueRow}>
                                                <Text style={styles.valueLabel}>HSR </Text>
                                                <Text style={styles.valueNum}>{setup.shock.reboundHSR}</Text>
                                                <Text style={styles.valueLabel}>  HSC </Text>
                                                <Text style={styles.valueNum}>{setup.shock.compressionHSC}</Text>
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* Tire pressures */}
                                {setup.tires && (
                                    <View style={styles.tiresRow}>
                                        <Text style={styles.tireText}>🛞 VR: {setup.tires.frontBar?.toFixed(1) ?? '?'} bar</Text>
                                        <Text style={styles.tireText}>🛞 HR: {setup.tires.rearBar?.toFixed(1) ?? '?'} bar</Text>
                                    </View>
                                )}

                                {setup.notes ? <Text style={styles.cardNotes}>{setup.notes}</Text> : null}
                            </BPCard>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Modal */}
            <BPModal visible={modalVisible} onClose={() => setModalVisible(false)} title={editingSetup ? 'Setup bearbeiten' : 'Neues Setup'}>
                <BPInput label="Setup-Name" placeholder="z.B. Winterberg Enduro" value={name} onChangeText={setName} accentColor={ACCENT} />
                <BPInput label="Location / Trail" placeholder="z.B. Winterberg DH1" value={location} onChangeText={setLocation} accentColor={ACCENT} />
                <BPPicker label="Bike-Typ" options={bikeTypeOptions} value={bikeType} onValueChange={setBikeType} accentColor={ACCENT} />

                {/* Component Tab */}
                <BPPicker
                    label="Komponente"
                    options={[
                        { label: '🔱 Gabel', value: 'fork' },
                        { label: '🔩 Dämpfer', value: 'shock' },
                        { label: '🛞 Reifen', value: 'tires' },
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
                                <BPSlider label="Luftdruck" value={activeSuspension.psi} min={activeTab === 'fork' ? 40 : 80} max={activeTab === 'fork' ? 160 : 400} step={1} unit=" PSI" accentColor={ACCENT} onValueChange={v => updateSusValue('psi', v)} />
                            </View>
                        </View>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="SAG" value={activeSuspension.sagPercent} min={10} max={45} step={1} unit="%" accentColor={ACCENT} onValueChange={v => updateSusValue('sagPercent', v)} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="Federweg" value={activeSuspension.travel} min={80} max={220} step={5} unit=" mm" accentColor={ACCENT} onValueChange={v => updateSusValue('travel', v)} />
                            </View>
                        </View>

                        <Text style={styles.subSectionTitle}>Zugstufe (Rebound)</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="Low-Speed (LSR)" value={activeSuspension.reboundLSR} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundLSR', v)} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="High-Speed (HSR)" value={activeSuspension.reboundHSR} min={0} max={15} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('reboundHSR', v)} />
                            </View>
                        </View>

                        <Text style={styles.subSectionTitle}>Druckstufe (Compression)</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="Low-Speed (LSC)" value={activeSuspension.compressionLSC} min={0} max={25} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionLSC', v)} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="High-Speed (HSC)" value={activeSuspension.compressionHSC} min={0} max={15} step={1} accentColor={ACCENT} onValueChange={v => updateSusValue('compressionHSC', v)} />
                            </View>
                        </View>

                        <BPPicker label="Volume Spacer / Tokens" options={tokenOptions} value={activeSuspension.tokens.toString()} onValueChange={v => updateSusValue('tokens', parseInt(v, 10))} accentColor={ACCENT} />
                    </>
                )}

                {/* Tire Inputs */}
                {activeTab === 'tires' && (
                    <>
                        <Text style={styles.subSectionTitle}>Vorderrad</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="Druck VR" value={tires.frontBar} min={0.8} max={3.0} step={0.05} unit=" bar" accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, frontBar: v }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label="Breite" options={tireWidthOptions} value={tires.frontWidth} onValueChange={v => setTires(p => ({ ...p, frontWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label="Reifen VR" placeholder="z.B. Maxxis Assegai MaxxGrip" value={tires.frontTire} onChangeText={v => setTires(p => ({ ...p, frontTire: v }))} accentColor={ACCENT} />

                        <Text style={styles.subSectionTitle}>Hinterrad</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <BPSlider label="Druck HR" value={tires.rearBar} min={0.8} max={3.0} step={0.05} unit=" bar" accentColor={ACCENT} onValueChange={v => setTires(p => ({ ...p, rearBar: v }))} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <BPPicker label="Breite" options={tireWidthOptions} value={tires.rearWidth} onValueChange={v => setTires(p => ({ ...p, rearWidth: v }))} accentColor={ACCENT} />
                            </View>
                        </View>
                        <BPInput label="Reifen HR" placeholder="z.B. Maxxis Minion DHR II" value={tires.rearTire} onChangeText={v => setTires(p => ({ ...p, rearTire: v }))} accentColor={ACCENT} />
                    </>
                )}

                <BPInput label="Notizen" placeholder="z.B. Perfekt bei Nässe, Heck etwas weich" value={notes} onChangeText={setNotes} multiline numberOfLines={3} accentColor={ACCENT} />

                <View style={styles.modalActions}>
                    <BPButton title="Speichern" onPress={handleSave} color={ACCENT} fullWidth size="lg" disabled={!name.trim()} />
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
    deleteBtn: { fontSize: 18, padding: 4 },
    cardLocation: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
    valuesGrid: { flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm },
    valueCol: { flex: 1, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm },
    valueColTitle: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
    valueRow: { textAlign: 'center', marginVertical: 2 },
    valueLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
    valueNum: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
    tiresRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: theme.spacing.sm, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm },
    tireText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
    cardNotes: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: theme.spacing.sm },
    modalActions: { marginTop: theme.spacing.lg },
    inputRow: { flexDirection: 'row', gap: theme.spacing.sm },
    subSectionTitle: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.md, marginBottom: 4 },
});
