/**
 * F7: Ride-Log — Dein persönliches Fahrtenbuch
 * Agent Manifest: f7_ride_log.md
 *
 * Eingabe: Datum, Ort, Strecke, Länge, Notizen, Setup-Referenz
 * Verknüpfungen: Dialed-In Setups, Shred-Check km-Zuweisung
 * Storage: AsyncStorage (Supabase later)
 */
import { BPButton, BPCard, BPInput, BPModal, BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { loadFromStorage, saveToStorage } from '@/lib/supabase';
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

const ACCENT = '#B388FF'; // Ride-Log accent
const STORAGE_KEY = '@bikepro_rides';

// --- Types ---
interface Ride {
    id: string;
    date: string;
    location: string;
    trail: string;
    distanceKm: number;
    durationMin: number;
    elevationM: number;
    descentM: number;
    maxSpeedKmh: number;
    terrain: string;
    difficulty: string;
    bikeType: string;
    condition: string;
    mood: string;
    notes: string;
    createdAt: string;
}

const conditionOptions = [
    { label: '☀️ Trocken', value: 'dry' },
    { label: '⛅ Teilweise bewölkt', value: 'partly_cloudy' },
    { label: '🌦️ Leicht feucht', value: 'damp' },
    { label: '🌧️ Nass', value: 'wet' },
    { label: '⛈️ Starkregen', value: 'heavy_rain' },
    { label: '💧 Matsch', value: 'muddy' },
    { label: '❄️ Schnee / Eis', value: 'snow' },
    { label: '🥵 Heiß (>30°C)', value: 'hot' },
    { label: '🌫️ Nebel', value: 'fog' },
];

const moodOptions = [
    { label: '🔥 Mega!', value: 'fire' },
    { label: '😎 Gut', value: 'good' },
    { label: '😐 OK', value: 'ok' },
    { label: '😤 Anstrengend', value: 'tough' },
    { label: '🤕 Verletzung', value: 'injury' },
    { label: '💀 Crash', value: 'crash' },
    { label: '🤒 Krank', value: 'sick' },
];

const terrainTypeOptions = [
    { label: '🏗️ Bikepark', value: 'bikepark' },
    { label: '🌲 Trail / Singletrail', value: 'trail' },
    { label: '⛰️ Enduro', value: 'enduro' },
    { label: '🏔️ Downhill', value: 'downhill' },
    { label: '🌿 Flowtrail', value: 'flow' },
    { label: '🦘 Dirt / Pumptrack', value: 'dirt' },
    { label: '🚵 Tour / XC', value: 'tour' },
    { label: '🏙️ Urban / Street', value: 'urban' },
];

const difficultyOptions = [
    { label: '🟢 Leicht (S0–S1)', value: 'easy' },
    { label: '🔵 Mittel (S1–S2)', value: 'medium' },
    { label: '🔴 Schwer (S2–S3)', value: 'hard' },
    { label: '⚫ Extrem (S3+)', value: 'extreme' },
];

const bikeTypeRideOptions = [
    { label: '🚵 Enduro', value: 'enduro' },
    { label: '⛰️ Downhill', value: 'downhill' },
    { label: '🌲 Trail', value: 'trail' },
    { label: '⚡ E-MTB', value: 'emtb' },
    { label: '🏁 XC', value: 'xc' },
    { label: '🦘 Dirt / Slopestyle', value: 'dirt' },
];

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
}

export default function RideLogScreen() {
    const [rides, setRides] = useState<Ride[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRide, setEditingRide] = useState<Ride | null>(null);

    // Form state
    const [date, setDate] = useState(getTodayISO());
    const [location, setLocation] = useState('');
    const [trail, setTrail] = useState('');
    const [distanceKm, setDistanceKm] = useState('');
    const [durationMin, setDurationMin] = useState('');
    const [elevationM, setElevationM] = useState('');
    const [descentM, setDescentM] = useState('');
    const [maxSpeedKmh, setMaxSpeedKmh] = useState('');
    const [terrain, setTerrain] = useState('bikepark');
    const [difficulty, setDifficulty] = useState('medium');
    const [rideBikeType, setRideBikeType] = useState('enduro');
    const [condition, setCondition] = useState('dry');
    const [mood, setMood] = useState('fire');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadFromStorage<Ride>(STORAGE_KEY).then(setRides);
    }, []);

    const persist = async (updated: Ride[]) => {
        await saveToStorage(STORAGE_KEY, updated);
        setRides(updated);
    };

    const resetForm = () => {
        setDate(getTodayISO());
        setLocation('');
        setTrail('');
        setDistanceKm(''); setDurationMin(''); setElevationM('');
        setDescentM(''); setMaxSpeedKmh('');
        setTerrain('bikepark'); setDifficulty('medium');
        setRideBikeType('enduro');
        setCondition('dry'); setMood('fire'); setNotes('');
        setEditingRide(null);
    };

    const openNew = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEdit = (ride: Ride) => {
        setEditingRide(ride);
        setDate(ride.date);
        setLocation(ride.location);
        setTrail(ride.trail);
        setDistanceKm(ride.distanceKm.toString());
        setDurationMin(ride.durationMin.toString());
        setElevationM(ride.elevationM.toString());
        setDescentM((ride.descentM ?? 0).toString());
        setMaxSpeedKmh((ride.maxSpeedKmh ?? 0).toString());
        setTerrain(ride.terrain ?? 'bikepark');
        setDifficulty(ride.difficulty ?? 'medium');
        setRideBikeType(ride.bikeType ?? 'enduro');
        setCondition(ride.condition); setMood(ride.mood);
        setNotes(ride.notes);
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!location.trim()) return;

        const rideData: Ride = {
            id: editingRide?.id ?? Date.now().toString(),
            date,
            location: location.trim(),
            trail: trail.trim(),
            distanceKm: parseFloat(distanceKm) || 0,
            durationMin: parseInt(durationMin, 10) || 0,
            elevationM: parseInt(elevationM, 10) || 0,
            descentM: parseInt(descentM, 10) || 0,
            maxSpeedKmh: parseFloat(maxSpeedKmh) || 0,
            terrain, difficulty, bikeType: rideBikeType,
            condition, mood,
            notes: notes.trim(),
            createdAt: editingRide?.createdAt ?? new Date().toISOString(),
        };

        let updated: Ride[];
        if (editingRide) {
            updated = rides.map((r) => (r.id === editingRide.id ? rideData : r));
        } else {
            updated = [rideData, ...rides];
        }

        persist(updated);
        setModalVisible(false);
        resetForm();
    };

    const handleDelete = (id: string) => {
        Alert.alert('Ride löschen?', 'Das kann nicht rückgängig gemacht werden.', [
            { text: 'Abbrechen', style: 'cancel' },
            {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => persist(rides.filter((r) => r.id !== id)),
            },
        ]);
    };

    // Stats summary
    const totalRides = rides.length;
    const totalKm = rides.reduce((sum, r) => sum + r.distanceKm, 0);
    const totalElevation = rides.reduce((sum, r) => sum + r.elevationM, 0);
    const totalDescent = rides.reduce((sum, r) => sum + (r.descentM ?? 0), 0);
    const totalTime = rides.reduce((sum, r) => sum + r.durationMin, 0);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '📖 Ride-Log',
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats bar */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalRides}</Text>
                        <Text style={styles.statLabel}>RIDES</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalKm.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>KM</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalElevation}</Text>
                        <Text style={styles.statLabel}>HM ↑</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalDescent}</Text>
                        <Text style={styles.statLabel}>HM ↓</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{Math.round(totalTime / 60)}h</Text>
                        <Text style={styles.statLabel}>ZEIT</Text>
                    </View>
                </View>

                {/* Add button */}
                <BPButton
                    title="+ Neuen Ride loggen"
                    onPress={openNew}
                    color={ACCENT}
                    fullWidth
                    size="lg"
                />

                {/* Rides list */}
                {rides.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📖</Text>
                        <Text style={styles.emptyTitle}>Noch keine Rides</Text>
                        <Text style={styles.emptySubtitle}>Logge deinen ersten Trail-Tag!</Text>
                    </View>
                ) : (
                    rides.map((ride) => (
                        <TouchableOpacity
                            key={ride.id}
                            onPress={() => openEdit(ride)}
                            activeOpacity={0.8}
                        >
                            <BPCard accentColor={ACCENT} style={styles.rideCard}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>{ride.location}</Text>
                                        {ride.trail ? (
                                            <Text style={styles.cardTrail}>{ride.trail}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.cardDateBadge}>
                                        <Text style={styles.cardDate}>{formatDate(ride.date)}</Text>
                                    </View>
                                </View>

                                <View style={styles.metricsRow}>
                                    {ride.distanceKm > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{ride.distanceKm}</Text>
                                            <Text style={styles.metricLabel}>km</Text>
                                        </View>
                                    )}
                                    {ride.durationMin > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{ride.durationMin}</Text>
                                            <Text style={styles.metricLabel}>min</Text>
                                        </View>
                                    )}
                                    {ride.elevationM > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{ride.elevationM}</Text>
                                            <Text style={styles.metricLabel}>hm</Text>
                                        </View>
                                    )}
                                    <View style={styles.metric}>
                                        <Text style={styles.metricValue}>
                                            {conditionOptions.find((c) => c.value === ride.condition)?.label.split(' ')[0]}
                                        </Text>
                                    </View>
                                    <View style={styles.metric}>
                                        <Text style={styles.metricValue}>
                                            {moodOptions.find((m) => m.value === ride.mood)?.label.split(' ')[0]}
                                        </Text>
                                    </View>
                                </View>

                                {ride.notes ? (
                                    <Text style={styles.cardNotes}>{ride.notes}</Text>
                                ) : null}

                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDelete(ride.id)}
                                >
                                    <Text style={styles.deleteBtnText}>🗑</Text>
                                </TouchableOpacity>
                            </BPCard>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Create/Edit Modal */}
            <BPModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={editingRide ? 'Ride bearbeiten' : 'Neuer Ride'}
            >
                <BPInput
                    label="Datum"
                    placeholder="YYYY-MM-DD"
                    value={date}
                    onChangeText={setDate}
                    accentColor={ACCENT}
                />
                <BPInput
                    label="Ort / Bikepark"
                    placeholder="z.B. Winterberg"
                    value={location}
                    onChangeText={setLocation}
                    accentColor={ACCENT}
                />
                <BPInput
                    label="Trail / Strecke"
                    placeholder="z.B. DH1, Freeride"
                    value={trail}
                    onChangeText={setTrail}
                    accentColor={ACCENT}
                />

                <View style={styles.inputRow}>
                    <BPInput label="Distanz" placeholder="0" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label="Dauer" placeholder="0" value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" suffix="min" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
                <View style={styles.inputRow}>
                    <BPInput label="Höhenmeter ↑" placeholder="0" value={elevationM} onChangeText={setElevationM} keyboardType="numeric" suffix="hm" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label="Abfahrt ↓" placeholder="0" value={descentM} onChangeText={setDescentM} keyboardType="numeric" suffix="hm" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label="Max Speed" placeholder="0" value={maxSpeedKmh} onChangeText={setMaxSpeedKmh} keyboardType="numeric" suffix="km/h" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>

                <BPPicker label="Terrain" options={terrainTypeOptions} value={terrain} onValueChange={setTerrain} accentColor={ACCENT} />
                <BPPicker label="Schwierigkeit" options={difficultyOptions} value={difficulty} onValueChange={setDifficulty} accentColor={ACCENT} />
                <BPPicker label="Bike" options={bikeTypeRideOptions} value={rideBikeType} onValueChange={setRideBikeType} accentColor={ACCENT} />
                <BPPicker label="Bedingungen" options={conditionOptions} value={condition} onValueChange={setCondition} accentColor={ACCENT} />
                <BPPicker label="Stimmung" options={moodOptions} value={mood} onValueChange={setMood} accentColor={ACCENT} />

                <BPInput
                    label="Notizen"
                    placeholder="z.B. Neue Drops probiert, Line A war mega..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    accentColor={ACCENT}
                />

                <View style={styles.modalActions}>
                    <BPButton
                        title="Speichern"
                        onPress={handleSave}
                        color={ACCENT}
                        fullWidth
                        size="lg"
                        disabled={!location.trim()}
                    />
                </View>
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
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: theme.spacing.lg,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '900',
    },
    statLabel: {
        color: theme.colors.textMuted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: 2,
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
    rideCard: {
        marginTop: theme.spacing.md,
        padding: theme.spacing.md,
        position: 'relative',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardTitle: {
        color: theme.colors.text,
        fontSize: 17,
        fontWeight: '700',
    },
    cardTrail: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        marginTop: 2,
    },
    cardDateBadge: {
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    cardDate: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    metricsRow: {
        flexDirection: 'row',
        marginTop: theme.spacing.sm,
        gap: theme.spacing.md,
        flexWrap: 'wrap',
    },
    metric: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    metricValue: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    metricLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
    },
    cardNotes: {
        color: theme.colors.textMuted,
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: theme.spacing.sm,
    },
    deleteBtn: {
        position: 'absolute',
        bottom: theme.spacing.sm,
        right: theme.spacing.sm,
    },
    deleteBtnText: {
        fontSize: 16,
    },
    inputRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    modalActions: {
        marginTop: theme.spacing.lg,
    },
});
