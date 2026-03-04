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
import { syncLoadTable, syncSaveTable } from '@/lib/sync';
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

function getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
}

export default function RideLogScreen() {
    const { t } = useTranslation();
    const [rides, setRides] = useState<Ride[]>([]);

    const conditionOptions = [
        { label: t('ridelog.cond_dry'), value: 'dry' },
        { label: t('ridelog.cond_partly_cloudy'), value: 'partly_cloudy' },
        { label: t('ridelog.cond_damp'), value: 'damp' },
        { label: t('ridelog.cond_wet'), value: 'wet' },
        { label: t('ridelog.cond_heavy_rain'), value: 'heavy_rain' },
        { label: t('ridelog.cond_muddy'), value: 'muddy' },
        { label: t('ridelog.cond_snow'), value: 'snow' },
        { label: t('ridelog.cond_hot'), value: 'hot' },
        { label: t('ridelog.cond_fog'), value: 'fog' },
    ];

    const moodOptions = [
        { label: t('ridelog.mood_fire'), value: 'fire' },
        { label: t('ridelog.mood_good'), value: 'good' },
        { label: t('ridelog.mood_ok'), value: 'ok' },
        { label: t('ridelog.mood_tough'), value: 'tough' },
        { label: t('ridelog.mood_injury'), value: 'injury' },
        { label: t('ridelog.mood_crash'), value: 'crash' },
        { label: t('ridelog.mood_sick'), value: 'sick' },
    ];

    const terrainTypeOptions = [
        { label: t('ridelog.terr_bikepark'), value: 'bikepark' },
        { label: t('ridelog.terr_trail'), value: 'trail' },
        { label: t('ridelog.terr_enduro'), value: 'enduro' },
        { label: t('ridelog.terr_downhill'), value: 'downhill' },
        { label: t('ridelog.terr_flow'), value: 'flow' },
        { label: t('ridelog.terr_dirt'), value: 'dirt' },
        { label: t('ridelog.terr_tour'), value: 'tour' },
        { label: t('ridelog.terr_urban'), value: 'urban' },
    ];

    const difficultyOptions = [
        { label: t('ridelog.diff_easy'), value: 'easy' },
        { label: t('ridelog.diff_medium'), value: 'medium' },
        { label: t('ridelog.diff_hard'), value: 'hard' },
        { label: t('ridelog.diff_extreme'), value: 'extreme' },
    ];

    const bikeTypeRideOptions = [
        { label: t('ridelog.bike_enduro'), value: 'enduro' },
        { label: t('ridelog.bike_downhill'), value: 'downhill' },
        { label: t('ridelog.bike_trail'), value: 'trail' },
        { label: t('ridelog.bike_emtb'), value: 'emtb' },
        { label: t('ridelog.bike_xc'), value: 'xc' },
        { label: t('ridelog.bike_dirt'), value: 'dirt' },
    ];

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
        syncLoadTable<Ride>('rides', STORAGE_KEY).then(setRides);
    }, []);

    const persist = async (updated: Ride[]) => {
        await syncSaveTable('rides', STORAGE_KEY, updated);
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

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString();
    };

    const confirmDelete = (rideId: string) => {
        Alert.alert(t('ridelog.delete_prompt_title'), t('ridelog.delete_prompt_msg'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => persist(rides.filter((r) => r.id !== rideId)),
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
                    title: t('ridelog.title'),
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
                        <Text style={styles.statLabel}>{t('ridelog.stats_rides')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalKm.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>{t('ridelog.stats_km')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalElevation}</Text>
                        <Text style={styles.statLabel}>{t('ridelog.stats_hm_up')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalDescent}</Text>
                        <Text style={styles.statLabel}>{t('ridelog.stats_hm_down')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{Math.round(totalTime / 60)}h</Text>
                        <Text style={styles.statLabel}>{t('ridelog.stats_time')}</Text>
                    </View>
                </View>

                {/* Add button */}
                <BPButton
                    title={t('ridelog.add_ride')}
                    onPress={openNew}
                    color={ACCENT}
                    fullWidth
                    size="lg"
                />

                {/* Rides list */}
                {rides.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📖</Text>
                        <Text style={styles.emptyTitle}>{t('ridelog.no_rides')}</Text>
                        <Text style={styles.emptySubtitle}>{t('ridelog.log_first')}</Text>
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
                                    onPress={() => confirmDelete(ride.id)}
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
                title={editingRide ? t('ridelog.edit_ride') : t('ridelog.new_ride')}
            >
                <BPInput
                    label={t('ridelog.date')}
                    placeholder="YYYY-MM-DD"
                    value={date}
                    onChangeText={setDate}
                    accentColor={ACCENT}
                />
                <BPInput
                    label={t('ridelog.location')}
                    placeholder={t('ridelog.location_placeholder')}
                    value={location}
                    onChangeText={setLocation}
                    accentColor={ACCENT}
                />
                <BPInput
                    label={t('ridelog.trail')}
                    placeholder={t('ridelog.trail_placeholder')}
                    value={trail}
                    onChangeText={setTrail}
                    accentColor={ACCENT}
                />

                <View style={styles.inputRow}>
                    <BPInput label={t('ridelog.distance')} placeholder="0" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" suffix="km" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('ridelog.duration')} placeholder="0" value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" suffix="min" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>
                <View style={styles.inputRow}>
                    <BPInput label={t('ridelog.elevation_up')} placeholder="0" value={elevationM} onChangeText={setElevationM} keyboardType="numeric" suffix="hm" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('ridelog.elevation_down')} placeholder="0" value={descentM} onChangeText={setDescentM} keyboardType="numeric" suffix="hm" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                    <BPInput label={t('ridelog.max_speed')} placeholder="0" value={maxSpeedKmh} onChangeText={setMaxSpeedKmh} keyboardType="numeric" suffix="km/h" accentColor={ACCENT} containerStyle={{ flex: 1 }} />
                </View>

                <BPPicker label={t('ridelog.terrain')} options={terrainTypeOptions} value={terrain} onValueChange={setTerrain} accentColor={ACCENT} />
                <BPPicker label={t('ridelog.difficulty')} options={difficultyOptions} value={difficulty} onValueChange={setDifficulty} accentColor={ACCENT} />
                <BPPicker label={t('ridelog.bike')} options={bikeTypeRideOptions} value={rideBikeType} onValueChange={setRideBikeType} accentColor={ACCENT} />
                <BPPicker label={t('ridelog.condition')} options={conditionOptions} value={condition} onValueChange={setCondition} accentColor={ACCENT} />
                <BPPicker label={t('ridelog.mood')} options={moodOptions} value={mood} onValueChange={setMood} accentColor={ACCENT} />

                <BPInput
                    label={t('ridelog.notes')}
                    placeholder={t('ridelog.notes_placeholder')}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    accentColor={ACCENT}
                />

                <View style={styles.modalActions}>
                    <BPButton
                        title={t('common.save')}
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
