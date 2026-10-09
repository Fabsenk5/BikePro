/**
 * F3: Park-Picker Pro — Bikepark-Aggregator
 *
 * Shows curated DACH park data with trail breakdown (blue/red/black + km),
 * live weather via OpenWeatherMap (lib/weather.ts), and a direct Google Maps
 * link when a park is selected.
 */
import { BPCard, BPChip, BPPicker, screenContentStyle } from '@/components/ui';
import { bikeparks, Bikepark } from '@/constants/bikeparks';
import { featureColors, theme } from '@/constants/Colors';
import { syncLoadPreference, syncLoadTable, syncSavePreference } from '@/lib/sync';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import { fetchWeatherForParks, hasWeatherKey, ParkWeather, weatherInfo } from '@/lib/weather';
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

function mapsUrl(park: Bikepark): string {
    return `https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lon}`;
}

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
    const { t } = useTranslation();
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

    const [refreshing, setRefreshing] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [rides, setRides] = useState<any[]>([]);
    const [weatherByPark, setWeatherByPark] = useState<Record<string, ParkWeather>>({});

    const refreshOnForeground = useCallback(() => {
        syncLoadPreference<string[]>('park_favorites', FAVORITES_KEY).then(data => {
            if (data) setFavorites(data);
        });
        syncLoadTable<any>('rides', '@bikepro_rides').then(data => setRides(data ?? []));
        if (hasWeatherKey) {
            fetchWeatherForParks(bikeparks, false).then(setWeatherByPark);
        }
    }, []);

    useEffect(refreshOnForeground, [refreshOnForeground]);

    // Pull newer cloud data when the app/tab becomes visible again
    useRefreshOnForeground(refreshOnForeground);

    // parkId → ride count (ride-log integration: "dort gewesen")
    const rideCountByPark = useMemo(() => {
        const map: Record<string, number> = {};
        rides.forEach(r => {
            if (r?.parkId) map[r.parkId] = (map[r.parkId] ?? 0) + 1;
        });
        return map;
    }, [rides]);

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

    const getGoScore = (park: Bikepark) => {
        let score = 0;
        const weather = weatherByPark[park.id];
        if (weather) {
            const info = weatherInfo(weather.code);
            score += info.score;
            if (weather.temp > 15 && weather.temp < 25) score += 2; // Optimal temp
        }
        if (park.black >= 3) score += 2; // Gravity bonus
        else if (park.black >= 1) score += 1;
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
            const [favs, weather] = await Promise.all([
                syncLoadPreference<string[]>('park_favorites', FAVORITES_KEY),
                hasWeatherKey ? fetchWeatherForParks(bikeparks, true) : Promise.resolve({}),
            ]);
            if (favs) setFavorites(favs);
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
                        ? t('park_picker.weather_hint')
                        : t('park_picker.no_weather_hint')}
                </Text>

                {/* Park cards */}
                {sorted.map((park) => {
                    const goScore = getGoScore(park);
                    const go = getGoLabel(goScore, t);
                    const weather = weatherByPark[park.id];
                    const wInfo = weather ? weatherInfo(weather.code) : null;

                    return (
                        <BPCard
                            key={park.id}
                            style={styles.parkCard}
                            onPress={() => Linking.openURL(mapsUrl(park)).catch(() => {})}
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

                            {/* Weather */}
                            <View style={styles.infoRow}>
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
                            </View>

                            {/* Trail breakdown */}
                            <View style={styles.trailsRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.trailsText}>
                                        {t('park_picker.trails_count', { count: park.trails })}
                                    </Text>
                                    <Text style={styles.trailsText}>
                                        📏 {t('park_picker.trails_km', { km: park.kmBlue + park.kmRed + park.kmBlack })}
                                    </Text>
                                    <Text style={styles.trailsText}>
                                        🚡 {t('park_picker.lifts_total', { count: park.lifts })}
                                    </Text>
                                    {rideCountByPark[park.id] > 0 && (
                                        <BPChip
                                            small
                                            label={t('park_picker.rides_badge', { count: rideCountByPark[park.id] })}
                                            color={ACCENT}
                                        />
                                    )}
                                </View>
                            </View>

                            {/* Difficulty breakdown */}
                            <View style={styles.diffRow}>
                                <View style={styles.diffBlock}>
                                    <Text style={[styles.diffCount, { color: '#4FC3F7' }]}>{park.blue}</Text>
                                    <Text style={styles.diffLabel}>🔵 {t('park_picker.diff_blue')}</Text>
                                    <Text style={styles.diffKm}>{park.kmBlue} km</Text>
                                </View>
                                <View style={styles.diffBlock}>
                                    <Text style={[styles.diffCount, { color: '#EF5350' }]}>{park.red}</Text>
                                    <Text style={styles.diffLabel}>🟥 {t('park_picker.diff_red')}</Text>
                                    <Text style={styles.diffKm}>{park.kmRed} km</Text>
                                </View>
                                <View style={styles.diffBlock}>
                                    <Text style={[styles.diffCount, { color: '#616161' }]}>{park.black}</Text>
                                    <Text style={styles.diffLabel}>⬛ {t('park_picker.diff_black')}</Text>
                                    <Text style={styles.diffKm}>{park.kmBlack} km</Text>
                                </View>
                            </View>

                            {/* Links */}
                            <View style={styles.linksRow}>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation?.(); Linking.openURL(mapsUrl(park)).catch(() => {}); }}
                                    style={styles.linkBtn}
                                >
                                    <Text style={styles.linkText}>🗺️ {t('park_picker.maps_link')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation?.(); Linking.openURL(park.website).catch(() => {}); }}
                                    style={styles.linkBtn}
                                >
                                    <Text style={styles.linkText}>{t('park_picker.website_link')}</Text>
                                </TouchableOpacity>
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
    diffRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    diffBlock: {
        flex: 1,
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.sm,
        alignItems: 'center',
    },
    diffCount: {
        fontSize: 22,
        fontWeight: '900',
    },
    diffLabel: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    diffKm: {
        color: theme.colors.textMuted,
        fontSize: 11,
        marginTop: 2,
    },
    linksRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: theme.spacing.lg,
        marginTop: theme.spacing.sm,
    },
    linkBtn: {
        paddingVertical: 2,
    },
    linkText: {
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
