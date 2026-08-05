/**
 * F3: Park-Picker Pro — Bikepark-Aggregator
 *
 * Live data:
 * - Weather: OpenWeatherMap (lib/weather.ts, EXPO_PUBLIC_OPENWEATHER_KEY)
 * - Lift status: scraped daily by GitHub Actions into the park_status table
 *   (fresh rows override the static fallback in constants/bikeparks.ts)
 */
import { BPCard, BPChip, BPPicker, screenContentStyle } from '@/components/ui';
import { bikeparks, Bikepark, LiftStatus } from '@/constants/bikeparks';
import { featureColors, theme } from '@/constants/Colors';
import { syncLoadParkStatus, syncLoadPreference, syncLoadTable, syncSavePreference } from '@/lib/sync';
import { fetchParkWeather, fetchWeatherForParks, hasWeatherKey, ParkWeather, weatherInfo } from '@/lib/weather';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = featureColors['park-picker'];
const FAVORITES_KEY = '@bikepro_park_favorites';
// Scraped rows older than this are ignored (fallback to static data)
const STATUS_FRESH_MS = 26 * 60 * 60 * 1000;

function getGoLabel(score: number, t: any): { label: string; color: string } {
    if (score >= 8) return { label: t('park_picker.go_lets_go'), color: theme.colors.accentLime };
    if (score >= 6) return { label: t('park_picker.go_doable'), color: theme.colors.accentYellow };
    if (score >= 4) return { label: t('park_picker.go_risky'), color: theme.colors.accentOrange };
    return { label: t('park_picker.go_no_go'), color: theme.colors.accentRed };
}

const countryMap: Record<string, string> = {
    '🇦🇹': 'AT', '🇩🇪': 'DE', '🇨🇭': 'CH', '🇮🇹': 'IT', '🇫🇷': 'FR', '🇨🇦': 'CA', '🇬🇧': 'GB', '🇨🇿': 'CZ'
};

export default function ParkPickerScreen() {
    const { t, i18n } = useTranslation();
    const [region, setRegion] = useState('all');

    const regionFilter = [
        { label: t('park_picker.region_all'), value: 'all' },
        { label: t('park_picker.region_de'), value: 'DE' },
        { label: t('park_picker.region_at'), value: 'AT' },
        { label: t('park_picker.region_ch'), value: 'CH' },
        { label: t('park_picker.region_fr'), value: 'FR' },
        { label: t('park_picker.region_it'), value: 'IT' },
        { label: t('park_picker.region_cz'), value: 'CZ' },
    ];

    function getStatusInfo(status: LiftStatus) {
        switch (status) {
            case 'open':
                return { color: theme.colors.accentLime, label: t('park_picker.status_open'), emoji: '🟢' };
            case 'partial':
                return { color: theme.colors.accentYellow, label: t('park_picker.status_partial'), emoji: '🟡' };
            case 'closed':
                return { color: theme.colors.accentRed, label: t('park_picker.status_closed'), emoji: '🔴' };
            case 'season_end':
                return { color: theme.colors.textMuted, label: t('park_picker.status_season_end'), emoji: '⚫' };
            case 'unknown':
                return { color: theme.colors.textMuted, label: t('park_picker.status_unknown'), emoji: '⚪' };
        }
    }

    const [refreshing, setRefreshing] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [rides, setRides] = useState<any[]>([]);
    const [statusByPark, setStatusByPark] = useState<Record<string, { status: LiftStatus; checkedAt: string }>>({});
    const [weatherByPark, setWeatherByPark] = useState<Record<string, ParkWeather>>({});

    const loadStatus = useCallback(async () => {
        const rows = await syncLoadParkStatus();
        const now = Date.now();
        const fresh: Record<string, { status: LiftStatus; checkedAt: string }> = {};
        for (const [parkId, row] of Object.entries(rows)) {
            const checked = new Date(row.checkedAt).getTime();
            if (isNaN(checked) || now - checked > STATUS_FRESH_MS) continue;
            fresh[parkId] = { status: row.status, checkedAt: row.checkedAt };
        }
        setStatusByPark(fresh);
    }, []);

    const loadWeather = useCallback(async (force: boolean) => {
        if (!hasWeatherKey) return;
        const map = await fetchWeatherForParks(bikeparks, force);
        setWeatherByPark(map);
    }, []);

    useEffect(() => {
        syncLoadPreference<string[]>('park_favorites', FAVORITES_KEY).then(data => {
            if (data) setFavorites(data);
        });
        syncLoadTable<any>('rides', '@bikepro_rides').then(data => setRides(data ?? []));
        loadStatus();
        loadWeather(false);
    }, [loadStatus, loadWeather]);

    // parkId → ride count (ride-log integration: "dort gewesen")
    const rideCountByPark = useMemo(() => {
        const map: Record<string, number> = {};
        rides.forEach(r => {
            if (r?.parkId) map[r.parkId] = (map[r.parkId] ?? 0) + 1;
        });
        return map;
    }, [rides]);

    // Latest scrape timestamp across all parks (for the "updated at" hint)
    const latestCheck = useMemo(() => {
        let latest = 0;
        for (const row of Object.values(statusByPark)) {
            const ts = new Date(row.checkedAt).getTime();
            if (!isNaN(ts) && ts > latest) latest = ts;
        }
        return latest > 0 ? latest : null;
    }, [statusByPark]);

    const toggleFavorite = async (parkId: string) => {
        const updated = favorites.includes(parkId)
            ? favorites.filter(id => id !== parkId)
            : [...favorites, parkId];
        setFavorites(updated);
        await syncSavePreference('park_favorites', FAVORITES_KEY, updated);
    };

    const filtered = region === 'favorites'
        ? bikeparks.filter(p => favorites.includes(p.id))
        : region === 'all'
            ? bikeparks
            : bikeparks.filter((p) => countryMap[p.country] === region);

    // Effective lift status: fresh scraped row wins, static value is fallback
    const effectiveStatus = (park: Bikepark): LiftStatus =>
        statusByPark[park.id]?.status ?? park.liftStatus;

    const getGoScore = (park: Bikepark) => {
        let score = 0;
        const status = effectiveStatus(park);
        if (status === 'open') score += 5;
        if (status === 'partial') score += 2;
        const weather = weatherByPark[park.id];
        if (weather) {
            const info = weatherInfo(weather.code);
            score += info.score;
            if (weather.temp > 15 && weather.temp < 25) score += 2; // Optimal temp
        }
        return score;
    };

    const sorted = [...filtered].sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return getGoScore(b) - getGoScore(a);
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const [favs, status, weather] = await Promise.all([
                syncLoadPreference<string[]>('park_favorites', FAVORITES_KEY),
                syncLoadParkStatus(),
                hasWeatherKey ? fetchWeatherForParks(bikeparks, true) : Promise.resolve({}),
            ]);
            if (favs) setFavorites(favs);
            const now = Date.now();
            const fresh: Record<string, { status: LiftStatus; checkedAt: string }> = {};
            for (const [parkId, row] of Object.entries(status)) {
                const checked = new Date(row.checkedAt).getTime();
                if (!isNaN(checked) && now - checked <= STATUS_FRESH_MS) {
                    fresh[parkId] = { status: row.status, checkedAt: row.checkedAt };
                }
            }
            setStatusByPark(fresh);
            if (hasWeatherKey) setWeatherByPark(weather);
        } finally {
            setRefreshing(false);
        }
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('park_picker.title'),
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Region filter */}
                <BPPicker
                    label={t('park_picker.region_label')}
                    options={[
                        { label: t('park_picker.favorites_label', { count: favorites.length }), value: 'favorites' },
                        ...regionFilter,
                    ]}
                    value={region}
                    onValueChange={setRegion}
                    accentColor={ACCENT}
                />

                <Text style={styles.hint}>
                    {hasWeatherKey
                        ? (latestCheck
                            ? t('park_picker.live_hint', { date: new Date(latestCheck).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) })
                            : t('park_picker.live_hint_no_status'))
                        : t('park_picker.no_weather_hint')}
                </Text>

                {/* Park cards */}
                {sorted.map((park) => {
                    const statusInfo = getStatusInfo(effectiveStatus(park));
                    const goScore = getGoScore(park);
                    const go = getGoLabel(goScore, t);
                    const weather = weatherByPark[park.id];
                    const wInfo = weather ? weatherInfo(weather.code) : null;

                    return (
                        <BPCard
                            key={park.id}
                            style={styles.parkCard}
                            onPress={() => Linking.openURL(park.website).catch(() => {})}
                        >
                            {/* Header */}
                            <View style={styles.parkHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.parkName}>
                                        {park.country} {park.name}
                                    </Text>
                                    <Text style={styles.parkRegion}>{park.region}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation?.(); toggleFavorite(park.id); }}
                                    style={styles.favBtn}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.favIcon}>
                                        {favorites.includes(park.id) ? '❤️' : '🤍'}
                                    </Text>
                                </TouchableOpacity>
                                <BPChip label={go.label} color={go.color} small />
                            </View>

                            {/* Weather & Status row */}
                            <View style={styles.infoRow}>
                                {/* Weather */}
                                <View style={styles.weatherBlock}>
                                    {weather && wInfo ? (
                                        <>
                                            <Text style={styles.weatherIcon}>{wInfo.icon}</Text>
                                            <View>
                                                <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
                                                <Text style={styles.weatherDesc}>{t(`park_picker.cond_${wInfo.key}`)}</Text>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.weatherIcon}>🌡️</Text>
                                            <View>
                                                <Text style={styles.weatherTemp}>—</Text>
                                                <Text style={styles.weatherDesc}>{t('park_picker.weather_na')}</Text>
                                            </View>
                                        </>
                                    )}
                                </View>

                                {/* Wind & Rain */}
                                <View style={styles.weatherDetails}>
                                    {weather ? (
                                        <>
                                            <Text style={styles.detailText}>💨 {weather.wind} km/h</Text>
                                            <Text style={styles.detailText}>💧 {weather.rain} mm</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.detailText}>💨 —</Text>
                                            <Text style={styles.detailText}>💧 —</Text>
                                        </>
                                    )}
                                </View>

                                {/* Lift status */}
                                <View style={styles.liftBlock}>
                                    <Text style={[styles.liftStatus, { color: statusInfo.color }]}>
                                        {statusInfo.emoji} {statusInfo.label}
                                    </Text>
                                    <Text style={styles.liftCount}>
                                        {t('park_picker.lifts_count', { open: park.openLifts, total: park.lifts })}
                                    </Text>
                                </View>
                            </View>

                            {/* Trails info */}
                            <View style={styles.trailsRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.trailsText}>{t('park_picker.trails_count', { count: park.trails })}</Text>
                                    {rideCountByPark[park.id] > 0 && (
                                        <BPChip
                                            small
                                            label={t('park_picker.rides_badge', { count: rideCountByPark[park.id] })}
                                            color={ACCENT}
                                        />
                                    )}
                                </View>
                                <Text style={styles.websiteLink}>{t('park_picker.website_link')}</Text>
                            </View>
                        </BPCard>
                    );
                })}
            </ScrollView>
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
    hint: {
        color: theme.colors.textMuted,
        fontSize: 11,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
        fontStyle: 'italic',
    },
    parkCard: {
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
    },
    parkHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm,
    },
    parkName: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    parkRegion: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        gap: theme.spacing.sm,
    },
    weatherBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    weatherIcon: {
        fontSize: 28,
    },
    weatherTemp: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    weatherDesc: {
        color: theme.colors.textMuted,
        fontSize: 10,
    },
    weatherDetails: {
        alignItems: 'center',
        gap: 2,
    },
    detailText: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '500',
    },
    liftBlock: {
        alignItems: 'flex-end',
        flex: 1,
    },
    liftStatus: {
        fontSize: 11,
        fontWeight: '800',
    },
    liftCount: {
        color: theme.colors.textMuted,
        fontSize: 10,
        marginTop: 2,
    },
    trailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
    },
    trailsText: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    websiteLink: {
        color: ACCENT,
        fontSize: 12,
        fontWeight: '700',
    },
    favBtn: {
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    favIcon: {
        fontSize: 20,
    },
});
