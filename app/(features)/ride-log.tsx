/**
 * F7: Ride-Log — Dein persönliches Fahrtenbuch
 * Agent Manifest: f7_ride_log.md
 *
 * Eingabe: Datum, Ort, Strecke, Länge, Notizen, Setup-Referenz
 * Verknüpfungen: Dialed-In Setups, Shred-Check km-Zuweisung
 * Storage: AsyncStorage (Supabase later)
 */
import { BPButton, BPCard, BPEmptyState, BPInput, BPModal, BPPicker, BPSearchInput, BPToggle, screenContentStyle } from '@/components/ui';
import { bikeparks } from '@/constants/bikeparks';
import { featureColors, theme } from '@/constants/Colors';
import { confirmDialog, showAlert } from '@/lib/dialog';
import { SyncBike, SyncComponent, newId, syncDeleteFromTable, syncLoadBikes, syncLoadTable, syncSaveTable, syncUpdateComponents } from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = featureColors['ride-log'];
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
    bikeId?: string;
    parkId?: string;
    setupId?: string;
    setupFeel?: string;
    setupRating?: number;
    wearTrackedKm?: number;
    condition: string;
    mood: string;
    notes: string;
    createdAt: string;
}

function getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
}

/** Strict YYYY-MM-DD check that also rejects impossible dates (e.g. 2024-02-30). */
function isValidISODate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Parse a user-entered number, accepting comma as decimal separator. */
function parseDecimal(value: string): number {
    return parseFloat(value.replace(',', '.')) || 0;
}

export default function RideLogScreen() {
    const { t, i18n } = useTranslation();
    const [rides, setRides] = useState<Ride[]>([]);
    const [bikes, setBikes] = useState<SyncBike[]>([]);
    const [setups, setSetups] = useState<any[]>([]);

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

    const setupRatingOptions = [
        { label: t('ridelog.setup_rating_none'), value: '0' },
        { label: '⭐', value: '1' },
        { label: '⭐⭐', value: '2' },
        { label: '⭐⭐⭐', value: '3' },
        { label: '⭐⭐⭐⭐', value: '4' },
        { label: '⭐⭐⭐⭐⭐', value: '5' },
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
    // Integrations
    const [rideBikeId, setRideBikeId] = useState('');
    const [rideParkId, setRideParkId] = useState('');
    const [rideSetupId, setRideSetupId] = useState('');
    const [rideSetupFeel, setRideSetupFeel] = useState('');
    const [rideSetupRating, setRideSetupRating] = useState(0);
    const [trackWear, setTrackWear] = useState(true);

    const [condition, setCondition] = useState('dry');
    const [mood, setMood] = useState('fire');
    const [notes, setNotes] = useState('');
    const [dateError, setDateError] = useState('');

    // ─── Search & Filters ───
    const [search, setSearch] = useState('');
    const [filterBikeId, setFilterBikeId] = useState('');
    const [filterTerrain, setFilterTerrain] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('');

    // Month options derived from rides (YYYY-MM, newest first)
    const periodOptions = useMemo(() => {
        const months = new Set<string>();
        rides.forEach(r => {
            const m = typeof r.date === 'string' ? r.date.slice(0, 7) : '';
            if (m) months.add(m);
        });
        return [...months].sort().reverse().map(m => {
            const [y, mo] = m.split('-').map(Number);
            const label = new Date(y, mo - 1, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
            return { label, value: m };
        });
    }, [rides, i18n.language]);

    const filteredRides = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rides.filter(r => {
            if (filterPeriod && !r.date?.startsWith(filterPeriod)) return false;
            if (filterBikeId && r.bikeId !== filterBikeId) return false;
            if (filterTerrain && r.terrain !== filterTerrain) return false;
            if (q) {
                const hay = `${r.location} ${r.trail ?? ''} ${r.notes ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [rides, search, filterBikeId, filterTerrain, filterPeriod]);

    // Monthly km chart (last 6 months with rides)
    const chartData = useMemo(() => {
        const byMonth: Record<string, number> = {};
        rides.forEach(r => {
            const m = typeof r.date === 'string' ? r.date.slice(0, 7) : '';
            const km = Number(r.distanceKm) || 0;
            if (m && km > 0) byMonth[m] = (byMonth[m] ?? 0) + km;
        });
        return Object.entries(byMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6)
            .map(([month, km]) => {
                const [y, mo] = month.split('-').map(Number);
                const label = new Date(y, mo - 1, 1).toLocaleDateString(i18n.language, { month: 'short' });
                return { month, label, km };
            });
    }, [rides, i18n.language]);

    const maxChartKm = chartData.reduce((m, c) => Math.max(m, c.km), 0);
    const hasFilters = search.trim() !== '' || filterBikeId !== '' || filterTerrain !== '' || filterPeriod !== '';

    const reload = useCallback(() => {
        syncLoadTable<Ride>('rides', STORAGE_KEY).then(setRides);
        syncLoadBikes().then(setBikes);
        syncLoadTable('suspension_setups', '@bikepro_setups').then(setSetups);
    }, []);

    useEffect(reload, [reload]);

    // Pull newer cloud data when the app/tab becomes visible again
    useRefreshOnForeground(reload);

    const persist = async (updated: Ride[]): Promise<boolean> => {
        const ok = await syncSaveTable('rides', STORAGE_KEY, updated);
        setRides(updated);
        return ok;
    };

    const resetForm = () => {
        setDate(getTodayISO());
        setLocation('');
        setTrail('');
        setDistanceKm(''); setDurationMin(''); setElevationM('');
        setDescentM(''); setMaxSpeedKmh('');
        setTerrain('bikepark'); setDifficulty('medium');
        setRideBikeType('enduro');
        setRideBikeId(''); setRideParkId(''); setRideSetupId(''); setRideSetupFeel(''); setRideSetupRating(0); setTrackWear(true);
        setCondition('dry'); setMood('fire'); setNotes('');
        setDateError('');
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
        setRideBikeId(ride.bikeId ?? '');
        setRideParkId(ride.parkId ?? '');
        setRideSetupId(ride.setupId ?? '');
        setRideSetupFeel(ride.setupFeel ?? '');
        setRideSetupRating(ride.setupRating ?? 0);
        setTrackWear((ride.wearTrackedKm ?? 0) > 0); // keep prior choice; save reconciles the km delta
        setCondition(ride.condition); setMood(ride.mood);
        setNotes(ride.notes);
        setModalVisible(true);
    };

    /**
     * Wear tracking (Shred-Check integration): applies a km delta to all
     * wear-tracked components of a bike. Returns the updated bikes list.
     */
    const applyWear = async (currentBikes: SyncBike[], bikeId: string, deltaKm: number): Promise<{ bikes: SyncBike[]; ok: boolean }> => {
        const bike = currentBikes.find((b) => b.id === bikeId);
        if (!bike || deltaKm === 0) return { bikes: currentBikes, ok: true };
        const changed: SyncComponent[] = [];
        const updatedComps = bike.components.map((c) => {
            if (c.isWearTracked !== true || !c.wearItems || c.wearItems.length === 0) return c;
            const updatedComp = {
                ...c,
                wearItems: c.wearItems.map((w) => ({
                    ...w,
                    currentKm: Math.max(0, w.currentKm + deltaKm),
                })),
            };
            changed.push(updatedComp);
            return updatedComp;
        });
        if (changed.length === 0) return { bikes: currentBikes, ok: true };
        // Batch write: one local cache patch + one cloud upsert for all affected rows
        const ok = await syncUpdateComponents(bikeId, changed);
        const updated = currentBikes.map((b) => (b.id === bikeId ? { ...b, components: updatedComps } : b));
        return { bikes: updated, ok };
    };

    /**
     * Persist a ride (create or edit) including wear reconciliation:
     * on edit, reverse the previous charge first, then apply the new one.
     */
    const commitRide = async (rideData: Ride, editing: Ride | null) => {
        let updated: Ride[];
        if (editing) {
            updated = rides.map((r) => (r.id === editing.id ? rideData : r));
        } else {
            updated = [rideData, ...rides];
        }

        let workingBikes = bikes;
        let wearOk = true;
        if (editing) {
            const oldKm = editing.wearTrackedKm ?? 0;
            if (oldKm > 0 && editing.bikeId) {
                const res = await applyWear(workingBikes, editing.bikeId, -oldKm);
                workingBikes = res.bikes;
                wearOk = res.ok && wearOk;
            }
        }
        const newTrackedKm = rideData.wearTrackedKm ?? 0;
        if (newTrackedKm > 0 && rideData.bikeId) {
            const res = await applyWear(workingBikes, rideData.bikeId, newTrackedKm);
            workingBikes = res.bikes;
            wearOk = res.ok && wearOk;
        }
        if (workingBikes !== bikes) setBikes(workingBikes);
        if (!wearOk) {
            showAlert(t('common.sync_pending_title'), t('common.sync_pending_msg'));
        }

        const ok = await persist(updated);
        if (ok) {
            showAlert(t('ridelog.save_success_title'), t('ridelog.save_success_msg'));
        } else {
            showAlert(t('ridelog.save_error_title'), t('ridelog.save_error_msg'));
        }
    };

    const handleSave = async () => {
        if (!location.trim()) return;

        if (!isValidISODate(date)) {
            setDateError(t('ridelog.error_date'));
            return;
        }
        setDateError('');

        const parsedDistance = parseDecimal(distanceKm);
        const newTrackedKm = trackWear && rideBikeId && parsedDistance > 0 ? parsedDistance : 0;

        const rideData: Ride = {
            id: editingRide?.id ?? newId(),
            date,
            location: location.trim(),
            trail: trail.trim(),
            distanceKm: parsedDistance,
            durationMin: parseInt(durationMin, 10) || 0,
            elevationM: parseInt(elevationM, 10) || 0,
            descentM: parseInt(descentM, 10) || 0,
            maxSpeedKmh: parseDecimal(maxSpeedKmh),
            terrain, difficulty, bikeType: rideBikeType,
            bikeId: rideBikeId, parkId: rideParkId, setupId: rideSetupId, setupFeel: rideSetupFeel.trim(),
            setupRating: rideSetupRating,
            wearTrackedKm: newTrackedKm,
            condition, mood,
            notes: notes.trim(),
            createdAt: editingRide?.createdAt ?? new Date().toISOString(),
        };

        await commitRide(rideData, editingRide);
        setModalVisible(false);
        resetForm();
    };

    // ─── Quick-Log ───
    const [quickModalVisible, setQuickModalVisible] = useState(false);
    const [quickDate, setQuickDate] = useState(getTodayISO());
    const [quickLocation, setQuickLocation] = useState('');
    const [quickDistance, setQuickDistance] = useState('');
    const [quickBikeId, setQuickBikeId] = useState('');
    const [quickTrackWear, setQuickTrackWear] = useState(true);
    const [quickDateError, setQuickDateError] = useState('');
    const [quickKmError, setQuickKmError] = useState('');

    const openQuickLog = () => {
        setQuickDate(getTodayISO());
        setQuickLocation('');
        setQuickDistance('');
        setQuickBikeId(bikes[0]?.id ?? '');
        setQuickTrackWear(true);
        setQuickDateError('');
        setQuickKmError('');
        setQuickModalVisible(true);
    };

    // Hand quick-log values over to the full form
    const openFullFromQuick = () => {
        resetForm();
        setDate(quickDate || getTodayISO());
        setLocation(quickLocation);
        setDistanceKm(quickDistance);
        setRideBikeId(quickBikeId);
        setTrackWear(quickTrackWear);
        setQuickModalVisible(false);
        setModalVisible(true);
    };

    const handleQuickSave = async () => {
        if (!quickLocation.trim()) return;
        if (!isValidISODate(quickDate)) {
            setQuickDateError(t('ridelog.error_date'));
            return;
        }
        setQuickDateError('');
        const km = parseDecimal(quickDistance);
        if (isNaN(km) || km <= 0) {
            setQuickKmError(t('ridelog.quick_km_required'));
            return;
        }
        setQuickKmError('');

        const rideData: Ride = {
            id: newId(),
            date: quickDate,
            location: quickLocation.trim(),
            trail: '',
            distanceKm: km,
            durationMin: 0,
            elevationM: 0,
            descentM: 0,
            maxSpeedKmh: 0,
            terrain: 'trail',
            difficulty: 'medium',
            bikeType: 'enduro',
            bikeId: quickBikeId,
            setupId: '',
            setupFeel: '',
            setupRating: 0,
            wearTrackedKm: quickTrackWear && quickBikeId && km > 0 ? km : 0,
            condition: 'dry',
            mood: 'good',
            notes: '',
            createdAt: new Date().toISOString(),
        };

        await commitRide(rideData, null);
        setQuickModalVisible(false);
        setQuickLocation('');
        setQuickDistance('');
        setQuickKmError('');
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString; // fallback for legacy bad data
        return d.toLocaleDateString(i18n.language);
    };

    const confirmDelete = async (rideId: string) => {
        const confirmed = await confirmDialog(t('ridelog.delete_prompt_title'), t('ridelog.delete_prompt_msg'), t('common.cancel'));
        if (!confirmed) return;
        // syncDeleteFromTable already removes the row locally (AsyncStorage) + in the cloud
        const ok = await syncDeleteFromTable('rides', '@bikepro_rides', rideId);
        setRides(rides.filter((r) => r.id !== rideId));
        if (!ok) {
            showAlert(t('ridelog.save_error_title'), t('ridelog.delete_error_msg'));
        }
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
                }}
            />
            <StatusBar barStyle="light-content" />

            <FlatList
                data={filteredRides}
                keyExtractor={(ride) => ride.id}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <>
                        {/* Stats bar */}
                <BPCard style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalRides}</Text>
                        <Text style={styles.statLabel}>{t('ridelog.stats_rides')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: ACCENT }]}>{totalKm.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text>
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
                </BPCard>

                {/* Monthly km chart */}
                {chartData.length > 0 && (
                    <BPCard style={styles.chartCard}>
                        <Text style={styles.chartTitle}>{t('ridelog.chart_title')}</Text>
                        <View style={styles.chartRow}>
                            {chartData.map(c => (
                                <View key={c.month} style={styles.chartCol}>
                                    <Text style={styles.chartValue}>
                                        {c.km >= 1000 ? `${(c.km / 1000).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}k` : Math.round(c.km)}
                                    </Text>
                                    <View style={[styles.chartBar, { height: Math.max(6, Math.round((c.km / maxChartKm) * 90)) }]} />
                                    <Text style={styles.chartLabel}>{c.label}</Text>
                                </View>
                            ))}
                        </View>
                    </BPCard>
                )}

                {/* Search & Filters */}
                <BPCard style={styles.filterCard}>
                    <BPSearchInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('common.search')}
                        accentColor={ACCENT}
                        containerStyle={{ marginBottom: theme.spacing.sm }}
                    />
                    <View style={styles.filterRow}>
                        <BPPicker
                            label={t('ridelog.bike')}
                            options={[{ label: t('ridelog.filter_all'), value: '' }, ...bikes.map(b => ({ label: b.name, value: b.id }))]}
                            value={filterBikeId}
                            onValueChange={setFilterBikeId}
                            accentColor={ACCENT}
                            containerStyle={{ flex: 1 }}
                        />
                        <BPPicker
                            label={t('ridelog.terrain')}
                            options={[{ label: t('ridelog.filter_all'), value: '' }, ...terrainTypeOptions]}
                            value={filterTerrain}
                            onValueChange={setFilterTerrain}
                            accentColor={ACCENT}
                            containerStyle={{ flex: 1 }}
                        />
                    </View>
                    <BPPicker
                        label={t('ridelog.filter_period')}
                        options={[{ label: t('ridelog.filter_all'), value: '' }, ...periodOptions]}
                        value={filterPeriod}
                        onValueChange={setFilterPeriod}
                        accentColor={ACCENT}
                    />
                    {hasFilters && (
                        <Text style={styles.filterCount}>
                            {t('ridelog.filtered_count', { count: filteredRides.length, total: rides.length })}
                        </Text>
                    )}
                </BPCard>

                {/* Add buttons */}
                <View style={styles.addRow}>
                    <BPButton
                        title={t('ridelog.add_ride')}
                        onPress={openNew}
                        color={ACCENT}
                        size="md"
                        style={{ flex: 2 }}
                    />
                    <BPButton
                        title={t('ridelog.quick_btn')}
                        onPress={openQuickLog}
                        color={theme.colors.accentLime}
                        variant="outline"
                        size="md"
                        style={{ flex: 1 }}
                    />
                </View>

                    </>
                }
                ListEmptyComponent={
                    rides.length === 0 ? (
                        <BPEmptyState icon="📖" title={t('ridelog.no_rides')} subtitle={t('ridelog.log_first')} />
                    ) : (
                        <BPEmptyState icon="🔍" title={t('ridelog.no_matches')} subtitle={t('ridelog.no_matches_hint')} />
                    )
                }
                renderItem={({ item: ride }) => (
                        <BPCard
                            onPress={() => openEdit(ride)}
                            accentColor={ACCENT}
                            style={styles.rideCard}
                        >
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
                                            <Text style={styles.metricValue}>{ride.distanceKm.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text>
                                            <Text style={styles.metricLabel}>km</Text>
                                        </View>
                                    )}
                                    {ride.durationMin > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{ride.durationMin}</Text>
                                            <Text style={styles.metricLabel}>min</Text>
                                        </View>
                                    )}
                                    {ride.distanceKm > 0 && ride.durationMin > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{(ride.distanceKm / (ride.durationMin / 60)).toFixed(1)}</Text>
                                            <Text style={styles.metricLabel}>km/h</Text>
                                        </View>
                                    )}
                                    {ride.elevationM > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{ride.elevationM}</Text>
                                            <Text style={styles.metricLabel}>hm</Text>
                                        </View>
                                    )}
                                    {ride.distanceKm > 0 && ride.elevationM > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{Math.round(ride.elevationM / ride.distanceKm)}</Text>
                                            <Text style={styles.metricLabel}>m/km</Text>
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
                                    {ride.setupRating && ride.setupRating > 0 && (
                                        <View style={styles.metric}>
                                            <Text style={styles.metricValue}>{'⭐'.repeat(ride.setupRating)}</Text>
                                        </View>
                                    )}
                                </View>

                                {ride.notes ? (
                                    <Text style={styles.cardNotes}>{ride.notes}</Text>
                                ) : null}

                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={(e) => { e.stopPropagation?.(); confirmDelete(ride.id); }}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('a11y.remove')}
                                >
                                    <Text style={styles.deleteBtnText}>🗑</Text>
                                </TouchableOpacity>
                        </BPCard>
                )}
            />

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
                    error={dateError}
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

                <BPPicker
                    label={t('ridelog.park')}
                    options={[
                        { label: t('ridelog.park_none'), value: '' },
                        ...bikeparks.map(p => ({ label: `${p.country} ${p.name}`, value: p.id })),
                    ]}
                    value={rideParkId}
                    onValueChange={(v) => {
                        setRideParkId(v);
                        if (v && !location.trim()) {
                            const park = bikeparks.find(p => p.id === v);
                            if (park) setLocation(park.name);
                        }
                    }}
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

                {/* Bike & Setup Integration */}
                <BPPicker
                    label={t('ridelog.ride_bike')}
                    options={[{ label: t('ridelog.ride_bike_none'), value: '' }, ...bikes.map(b => ({ label: b.name, value: b.id }))]}
                    value={rideBikeId}
                    onValueChange={setRideBikeId}
                    accentColor={ACCENT}
                />

                {rideBikeId ? (
                    <BPToggle
                        label={t('ridelog.track_wear')}
                        value={trackWear}
                        onValueChange={setTrackWear}
                        accentColor={ACCENT}
                    />
                ) : null}

                <BPPicker
                    label={t('ridelog.ride_setup')}
                    options={[{ label: t('ridelog.ride_setup_none'), value: '' }, ...setups.filter(s => rideBikeId ? s.bikeId === rideBikeId : true).map(s => ({ label: s.name, value: s.id }))]}
                    value={rideSetupId}
                    onValueChange={setRideSetupId}
                    accentColor={ACCENT}
                />

                {rideSetupId ? (
                    <>
                        <BPInput
                            label={t('ridelog.setup_feel')}
                            placeholder={t('ridelog.setup_feel_placeholder')}
                            value={rideSetupFeel}
                            onChangeText={setRideSetupFeel}
                            accentColor={ACCENT}
                        />
                        <BPPicker
                            label={t('ridelog.setup_rating')}
                            options={setupRatingOptions}
                            value={rideSetupRating.toString()}
                            onValueChange={(v) => setRideSetupRating(parseInt(v, 10))}
                            accentColor={ACCENT}
                        />
                    </>
                ) : null}

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

            {/* Quick-Log Modal */}
            <BPModal
                visible={quickModalVisible}
                onClose={() => setQuickModalVisible(false)}
                title={t('ridelog.quick_title')}
            >
                <BPInput
                    label={t('ridelog.date')}
                    placeholder="YYYY-MM-DD"
                    value={quickDate}
                    onChangeText={setQuickDate}
                    accentColor={ACCENT}
                    error={quickDateError}
                />
                <BPInput
                    label={t('ridelog.location')}
                    placeholder={t('ridelog.location_placeholder')}
                    value={quickLocation}
                    onChangeText={setQuickLocation}
                    accentColor={ACCENT}
                />
                <BPInput
                    label={t('ridelog.distance')}
                    placeholder="0"
                    value={quickDistance}
                    onChangeText={setQuickDistance}
                    keyboardType="numeric"
                    suffix="km"
                    accentColor={ACCENT}
                    error={quickKmError}
                />

                {bikes.length > 0 && (
                    <>
                        <BPPicker
                            label={t('ridelog.ride_bike')}
                            options={[{ label: t('ridelog.ride_bike_none'), value: '' }, ...bikes.map(b => ({ label: b.name, value: b.id }))]}
                            value={quickBikeId}
                            onValueChange={setQuickBikeId}
                            accentColor={ACCENT}
                        />
                        {quickBikeId ? (
                            <BPToggle
                                label={t('ridelog.track_wear')}
                                value={quickTrackWear}
                                onValueChange={setQuickTrackWear}
                                accentColor={ACCENT}
                            />
                        ) : null}
                    </>
                )}

                <View style={styles.modalActions}>
                    <BPButton
                        title={t('common.save')}
                        onPress={handleQuickSave}
                        color={ACCENT}
                        fullWidth
                        size="lg"
                        disabled={!quickLocation.trim()}
                    />
                    <BPButton
                        title={t('ridelog.quick_more')}
                        onPress={openFullFromQuick}
                        variant="secondary"
                        color={theme.colors.textSecondary}
                        fullWidth
                        style={{ marginTop: theme.spacing.sm }}
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
        ...screenContentStyle,
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: theme.spacing.lg,
    },
    addRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
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
    chartCard: {
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
    },
    chartTitle: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: theme.spacing.md,
    },
    chartRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        height: 130,
    },
    chartCol: {
        alignItems: 'center',
        flex: 1,
    },
    chartValue: {
        color: theme.colors.textSecondary,
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 4,
    },
    chartBar: {
        width: '60%',
        minWidth: 8,
        maxWidth: 28,
        borderRadius: theme.radius.sm,
        backgroundColor: ACCENT + 'CC',
    },
    chartLabel: {
        color: theme.colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    filterCard: {
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
    },
    filterRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    filterCount: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        marginTop: theme.spacing.sm,
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
