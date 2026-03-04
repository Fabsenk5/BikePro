/**
 * F3: Park-Picker Pro — Bikepark-Aggregator
 * Agent Manifest: f3_park_picker.md
 *
 * Aggregator: Wetter, Liftstatus, Ampelsystem (Go/No-Go)
 * Phase 1: Curated park data + OpenWeatherMap ready
 * Phase 2: Live Wetter-API + Web-Scraping für Liftstatus
 */
import { BPCard, BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { syncLoadPreference, syncSavePreference } from '@/lib/sync';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

const ACCENT = '#A8E10C'; // Park-Picker accent
const FAVORITES_KEY = '@bikepro_park_favorites';

// --- Bikepark data ---
interface Bikepark {
    id: string;
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    website: string;
    trails: number;
    lifts: number;
    // Simulated live data (will be fetched from APIs later)
    weather: {
        temp: number;
        condition: string;
        icon: string;
        wind: number;
        rain: number;
    };
    liftStatus: 'open' | 'partial' | 'closed' | 'season_end';
    openLifts: number;
}

// Curated bikepark database (DE/AT/CH focus)
const bikeparks: Bikepark[] = [
    {
        id: 'winterberg',
        name: 'Bikepark Winterberg',
        region: 'Sauerland',
        country: '🇩🇪',
        lat: 51.1946,
        lon: 8.5338,
        website: 'https://www.bikepark-winterberg.de',
        trails: 12,
        lifts: 3,
        weather: { temp: 8, condition: 'Bewölkt', icon: '☁️', wind: 15, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    {
        id: 'leogang',
        name: 'Bikepark Leogang',
        region: 'Salzburg',
        country: '🇦🇹',
        lat: 47.4315,
        lon: 12.7631,
        website: 'https://www.bikepark-leogang.com',
        trails: 10,
        lifts: 2,
        weather: { temp: 12, condition: 'Sonnig', icon: '☀️', wind: 8, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'geisskopf',
        name: 'Bikepark Geisskopf',
        region: 'Bayerischer Wald',
        country: '🇩🇪',
        lat: 48.9583,
        lon: 13.2833,
        website: 'https://www.bikepark-geisskopf.de',
        trails: 8,
        lifts: 1,
        weather: { temp: 10, condition: 'Leichter Regen', icon: '🌧️', wind: 20, rain: 3 },
        liftStatus: 'partial',
        openLifts: 1,
    },
    {
        id: 'schladming',
        name: 'Bikepark Planai Schladming',
        region: 'Steiermark',
        country: '🇦🇹',
        lat: 47.3939,
        lon: 13.6872,
        website: 'https://www.planai.at/bike',
        trails: 9,
        lifts: 2,
        weather: { temp: 14, condition: 'Sonnig', icon: '☀️', wind: 5, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'lenzerheide',
        name: 'Bike Kingdom Lenzerheide',
        region: 'Graubünden',
        country: '🇨🇭',
        lat: 46.7252,
        lon: 9.5577,
        website: 'https://www.bikekingdom.ch',
        trails: 15,
        lifts: 4,
        weather: { temp: 11, condition: 'Teilweise bewölkt', icon: '⛅', wind: 10, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    {
        id: 'saalbach',
        name: 'Bikepark Saalbach',
        region: 'Salzburg',
        country: '🇦🇹',
        lat: 47.3917,
        lon: 12.6369,
        website: 'https://www.saalbach.com/bike',
        trails: 11,
        lifts: 3,
        weather: { temp: 13, condition: 'Sonnig', icon: '☀️', wind: 6, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    {
        id: 'braunlage',
        name: 'Bikepark Braunlage',
        region: 'Harz',
        country: '🇩🇪',
        lat: 51.7283,
        lon: 10.6089,
        website: 'https://www.bikepark-braunlage.de',
        trails: 6,
        lifts: 1,
        weather: { temp: 6, condition: 'Regen', icon: '🌧️', wind: 25, rain: 8 },
        liftStatus: 'closed',
        openLifts: 0,
    },
    {
        id: 'lac-blanc',
        name: 'Bikepark Lac Blanc',
        region: 'Elsass / Vogesen',
        country: '🇫🇷',
        lat: 48.1261,
        lon: 7.0917,
        website: 'https://www.lac-blanc.com/vtt',
        trails: 14,
        lifts: 2,
        weather: { temp: 9, condition: 'Bewölkt', icon: '☁️', wind: 12, rain: 1 },
        liftStatus: 'partial',
        openLifts: 1,
    },
    {
        id: 'willingen',
        name: 'Bikepark Willingen',
        region: 'Sauerland',
        country: '🇩🇪',
        lat: 51.2900,
        lon: 8.6100,
        website: 'https://www.bikepark-willingen.de',
        trails: 7,
        lifts: 2,
        weather: { temp: 7, condition: 'Bewölkt', icon: '☁️', wind: 18, rain: 2 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'osternohe',
        name: 'Bikepark Osternohe',
        region: 'Franken',
        country: '🇩🇪',
        lat: 49.5300,
        lon: 11.4300,
        website: 'https://www.bikepark-osternohe.de',
        trails: 6,
        lifts: 1,
        weather: { temp: 11, condition: 'Teilweise bewölkt', icon: '⛅', wind: 8, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'beerfelden',
        name: 'Bikepark Beerfelden',
        region: 'Odenwald',
        country: '🇩🇪',
        lat: 49.5700,
        lon: 8.9700,
        website: 'https://www.bikepark-beerfelden.de',
        trails: 5,
        lifts: 1,
        weather: { temp: 13, condition: 'Sonnig', icon: '☀️', wind: 6, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'bad-wildbad',
        name: 'Bikepark Bad Wildbad',
        region: 'Schwarzwald',
        country: '🇩🇪',
        lat: 48.7500,
        lon: 8.5500,
        website: 'https://www.bikepark-bad-wildbad.de',
        trails: 8,
        lifts: 1,
        weather: { temp: 15, condition: 'Sonnig', icon: '☀️', wind: 5, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'wagrain',
        name: 'Bikepark Wagrain',
        region: 'Salzburg',
        country: '🇦🇹',
        lat: 47.3333,
        lon: 13.3000,
        website: 'https://www.wagrain-kleinarl.at/bike',
        trails: 6,
        lifts: 2,
        weather: { temp: 12, condition: 'Sonnig', icon: '☀️', wind: 7, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'davos',
        name: 'Bikepark Davos Klosters',
        region: 'Graubünden',
        country: '🇨🇭',
        lat: 46.8027,
        lon: 9.8361,
        website: 'https://www.davos.ch/bike',
        trails: 10,
        lifts: 3,
        weather: { temp: 9, condition: 'Teilweise bewölkt', icon: '⛅', wind: 12, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'les-gets',
        name: 'Bikepark Les Gets',
        region: 'Haute-Savoie',
        country: '🇫🇷',
        lat: 46.1589,
        lon: 6.6700,
        website: 'https://www.lesgets.com/vtt',
        trails: 20,
        lifts: 5,
        weather: { temp: 16, condition: 'Sonnig', icon: '☀️', wind: 4, rain: 0 },
        liftStatus: 'open',
        openLifts: 5,
    },
    {
        id: 'mottolino',
        name: 'Mottolino Bikepark',
        region: 'Lombardei',
        country: '🇮🇹',
        lat: 46.4667,
        lon: 10.3500,
        website: 'https://www.mottolino.com/bike',
        trails: 12,
        lifts: 3,
        weather: { temp: 14, condition: 'Sonnig', icon: '☀️', wind: 6, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    // --- Harz ---
    {
        id: 'schulenberg',
        name: 'Bikepark Schulenberg',
        region: 'Harz',
        country: '🇩🇪',
        lat: 51.8494,
        lon: 10.4247,
        website: 'https://www.bikepark-schulenberg.de',
        trails: 5,
        lifts: 1,
        weather: { temp: 7, condition: 'Bewölkt', icon: '☁️', wind: 14, rain: 1 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'hahnenklee',
        name: 'Bikepark Hahnenklee',
        region: 'Harz',
        country: '🇩🇪',
        lat: 51.8531,
        lon: 10.3356,
        website: 'https://www.bikepark-hahnenklee.de',
        trails: 6,
        lifts: 1,
        weather: { temp: 7, condition: 'Leichter Regen', icon: '🌧️', wind: 16, rain: 2 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'msb-x-trail',
        name: 'MSB-X-Trail St. Andreasberg',
        region: 'Harz',
        country: '🇩🇪',
        lat: 51.7083,
        lon: 10.5139,
        website: 'https://www.msb-x-trail.de',
        trails: 4,
        lifts: 1,
        weather: { temp: 6, condition: 'Bewölkt', icon: '☁️', wind: 18, rain: 1 },
        liftStatus: 'open',
        openLifts: 1,
    },
    // --- Winterberg → Kassel ---
    {
        id: 'warstein',
        name: 'Bikepark Warstein',
        region: 'Sauerland',
        country: '🇩🇪',
        lat: 51.4444,
        lon: 8.3500,
        website: 'https://www.bikepark-warstein.de',
        trails: 5,
        lifts: 1,
        weather: { temp: 9, condition: 'Teilweise bewölkt', icon: '⛅', wind: 10, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'hellental',
        name: 'Bikepark Hellental',
        region: 'Solling (bei Kassel)',
        country: '🇩🇪',
        lat: 51.7750,
        lon: 9.6000,
        website: 'https://www.bikepark-hellental.de',
        trails: 3,
        lifts: 1,
        weather: { temp: 8, condition: 'Bewölkt', icon: '☁️', wind: 12, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    // --- München → Österreich ---
    {
        id: 'garmisch',
        name: 'Bikepark Garmisch-Partenkirchen',
        region: 'Oberbayern',
        country: '🇩🇪',
        lat: 47.4917,
        lon: 11.0958,
        website: 'https://www.gapa-tourismus.de/bike',
        trails: 7,
        lifts: 2,
        weather: { temp: 14, condition: 'Sonnig', icon: '☀️', wind: 5, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'oberammergau',
        name: 'Bikepark Oberammergau',
        region: 'Oberbayern',
        country: '🇩🇪',
        lat: 47.5967,
        lon: 11.0681,
        website: 'https://www.bikepark-oberammergau.de',
        trails: 5,
        lifts: 1,
        weather: { temp: 13, condition: 'Sonnig', icon: '☀️', wind: 6, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'innsbruck-mutters',
        name: 'Bikepark Innsbruck (Mutters/Götzens)',
        region: 'Tirol',
        country: '🇦🇹',
        lat: 47.2333,
        lon: 11.3833,
        website: 'https://www.bikepark-innsbruck.com',
        trails: 9,
        lifts: 2,
        weather: { temp: 15, condition: 'Sonnig', icon: '☀️', wind: 7, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'serfaus-fiss-ladis',
        name: 'Bikepark Serfaus-Fiss-Ladis',
        region: 'Tirol',
        country: '🇦🇹',
        lat: 47.0417,
        lon: 10.6000,
        website: 'https://www.serfaus-fiss-ladis.at/bike',
        trails: 8,
        lifts: 3,
        weather: { temp: 14, condition: 'Sonnig', icon: '☀️', wind: 5, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    {
        id: 'ischgl',
        name: 'Bikepark Ischgl / Silvretta',
        region: 'Tirol',
        country: '🇦🇹',
        lat: 46.9700,
        lon: 10.2900,
        website: 'https://www.ischgl.com/bike',
        trails: 6,
        lifts: 2,
        weather: { temp: 12, condition: 'Teilweise bewölkt', icon: '⛅', wind: 8, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'soelden',
        name: 'Bikerepublik Sölden',
        region: 'Tirol / Ötztal',
        country: '🇦🇹',
        lat: 46.9697,
        lon: 10.8764,
        website: 'https://www.soelden.com/bike',
        trails: 10,
        lifts: 3,
        weather: { temp: 11, condition: 'Sonnig', icon: '☀️', wind: 9, rain: 0 },
        liftStatus: 'open',
        openLifts: 3,
    },
    {
        id: 'kirchberg',
        name: 'Bikepark Leogang-Kirchberg (Spielberghaus)',
        region: 'Tirol',
        country: '🇦🇹',
        lat: 47.4500,
        lon: 12.3167,
        website: 'https://www.kitzbueheler-alpen.com/bike',
        trails: 7,
        lifts: 2,
        weather: { temp: 13, condition: 'Sonnig', icon: '☀️', wind: 6, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'mayrhofen',
        name: 'Bike Arena Mayrhofen',
        region: 'Zillertal',
        country: '🇦🇹',
        lat: 47.1667,
        lon: 11.8667,
        website: 'https://www.mayrhofen.at/bike',
        trails: 8,
        lifts: 2,
        weather: { temp: 14, condition: 'Sonnig', icon: '☀️', wind: 5, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    // --- Tschechien (nahe DE/AT) ---
    {
        id: 'klinovec',
        name: 'Bikepark Klínovec (Keilberg)',
        region: 'Erzgebirge',
        country: '🇨🇿',
        lat: 50.3953,
        lon: 12.9681,
        website: 'https://www.klinovec.cz/bike',
        trails: 8,
        lifts: 2,
        weather: { temp: 8, condition: 'Bewölkt', icon: '☁️', wind: 15, rain: 0 },
        liftStatus: 'open',
        openLifts: 2,
    },
    {
        id: 'spicak',
        name: 'Bikepark Špičák',
        region: 'Böhmerwald',
        country: '🇨🇿',
        lat: 49.1667,
        lon: 13.3000,
        website: 'https://www.spicak.cz/bike',
        trails: 6,
        lifts: 1,
        weather: { temp: 9, condition: 'Teilweise bewölkt', icon: '⛅', wind: 10, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'rokytnice',
        name: 'Bikepark Rokytnice nad Jizerou',
        region: 'Riesengebirge',
        country: '🇨🇿',
        lat: 50.7250,
        lon: 15.4472,
        website: 'https://www.rokytnice.com/bike',
        trails: 7,
        lifts: 2,
        weather: { temp: 7, condition: 'Bewölkt', icon: '☁️', wind: 12, rain: 1 },
        liftStatus: 'open',
        openLifts: 1,
    },
    {
        id: 'lipno',
        name: 'Bikepark Lipno',
        region: 'Böhmerwald (Moldaustausee)',
        country: '🇨🇿',
        lat: 48.6333,
        lon: 14.2333,
        website: 'https://www.lipno.info/bike',
        trails: 5,
        lifts: 1,
        weather: { temp: 10, condition: 'Sonnig', icon: '☀️', wind: 8, rain: 0 },
        liftStatus: 'open',
        openLifts: 1,
    },
];

function getGoLabel(score: number, t: any): { label: string; color: string } {
    if (score >= 80) return { label: t('park_picker.go_lets_go'), color: '#4CAF50' };
    if (score >= 60) return { label: t('park_picker.go_doable'), color: '#FFC107' };
    if (score >= 40) return { label: t('park_picker.go_risky'), color: '#FF9800' };
    return { label: t('park_picker.go_no_go'), color: '#F44336' };
}

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

    function getStatusInfo(status: Bikepark['liftStatus']) {
        switch (status) {
            case 'open':
                return { color: '#4CAF50', label: t('park_picker.status_open'), emoji: '🟢' };
            case 'partial':
                return { color: '#FFC107', label: t('park_picker.status_partial'), emoji: '🟡' };
            case 'closed':
                return { color: '#F44336', label: t('park_picker.status_closed'), emoji: '🔴' };
            case 'season_end':
                return { color: '#9E9E9E', label: t('park_picker.status_season_end'), emoji: '⚫' };
        }
    }
    const [refreshing, setRefreshing] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        syncLoadPreference<string[]>('park_favorites', FAVORITES_KEY).then(data => {
            if (data) setFavorites(data);
        });
    }, []);

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

    const countryMap: Record<string, string> = {
        '🇦🇹': 'at', '🇩🇪': 'de', '🇨🇭': 'ch', '🇮🇹': 'it', '🇫🇷': 'fr', '🇨🇦': 'ca', '🇬🇧': 'gb'
    };

    const getGoScore = (park: Bikepark) => {
        let score = 0;
        if (park.liftStatus === 'open') score += 5;
        if (park.liftStatus === 'partial') score += 2;
        if (park.weather.condition === '☀️') score += 3;
        if (park.weather.condition === '⛅') score += 2;
        if (park.weather.condition === '🌧️') score -= 2;
        if (park.weather.temp > 15 && park.weather.temp < 25) score += 2; // Optimal temp
        return score;
    };

    const sorted = [...filtered].sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return getGoScore(b) - getGoScore(a);
    });

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('park_picker.title'),
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
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
                    {t('park_picker.weather_hint')}
                </Text>

                {/* Park cards */}
                {sorted.map((park) => {
                    const status = getStatusInfo(park.liftStatus);
                    const goScore = getGoScore(park);
                    const go = getGoLabel(goScore, t);

                    return (
                        <TouchableOpacity
                            key={park.id}
                            onPress={() => Linking.openURL(park.website)}
                            activeOpacity={0.85}
                        >
                            <BPCard style={styles.parkCard}>
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
                                    <View style={[styles.goBadge, { backgroundColor: go.color + '20', borderColor: go.color }]}>
                                        <Text style={[styles.goText, { color: go.color }]}>{go.label}</Text>
                                    </View>
                                </View>

                                {/* Weather & Status row */}
                                <View style={styles.infoRow}>
                                    {/* Weather */}
                                    <View style={styles.weatherBlock}>
                                        <Text style={styles.weatherIcon}>{park.weather.icon}</Text>
                                        <View>
                                            <Text style={styles.weatherTemp}>{park.weather.temp}°C</Text>
                                            <Text style={styles.weatherDesc}>{park.weather.condition}</Text>
                                        </View>
                                    </View>

                                    {/* Wind & Rain */}
                                    <View style={styles.weatherDetails}>
                                        <Text style={styles.detailText}>💨 {park.weather.wind} km/h</Text>
                                        <Text style={styles.detailText}>💧 {park.weather.rain} mm</Text>
                                    </View>

                                    {/* Lift status */}
                                    <View style={styles.liftBlock}>
                                        <Text style={[styles.liftStatus, { color: status.color }]}>
                                            {status.emoji} {status.label}
                                        </Text>
                                        <Text style={styles.liftCount}>
                                            {t('park_picker.lifts_count', { open: park.openLifts, total: park.lifts })}
                                        </Text>
                                    </View>
                                </View>

                                {/* Trails info */}
                                <View style={styles.trailsRow}>
                                    <Text style={styles.trailsText}>{t('park_picker.trails_count', { count: park.trails })}</Text>
                                    <Text style={styles.websiteLink}>{t('park_picker.website_link')}</Text>
                                </View>
                            </BPCard>
                        </TouchableOpacity>
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
    goBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: theme.radius.full,
        borderWidth: 1,
    },
    goText: {
        fontSize: 11,
        fontWeight: '800',
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
