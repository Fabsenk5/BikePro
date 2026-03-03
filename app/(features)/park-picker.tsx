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
import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
];

const regionFilter = [
    { label: '🌍 Alle', value: 'all' },
    { label: '🇩🇪 Deutschland', value: 'DE' },
    { label: '🇦🇹 Österreich', value: 'AT' },
    { label: '🇨🇭 Schweiz', value: 'CH' },
    { label: '🇫🇷 Frankreich', value: 'FR' },
    { label: '🇮🇹 Italien', value: 'IT' },
];

const countryMap: Record<string, string> = {
    '🇩🇪': 'DE',
    '🇦🇹': 'AT',
    '🇨🇭': 'CH',
    '🇫🇷': 'FR',
    '🇮🇹': 'IT',
};

function getStatusInfo(status: Bikepark['liftStatus']) {
    switch (status) {
        case 'open':
            return { color: '#4CAF50', label: 'OFFEN', emoji: '🟢' };
        case 'partial':
            return { color: '#FFC107', label: 'TEILWEISE', emoji: '🟡' };
        case 'closed':
            return { color: '#F44336', label: 'GESCHLOSSEN', emoji: '🔴' };
        case 'season_end':
            return { color: '#9E9E9E', label: 'SAISONENDE', emoji: '⚫' };
    }
}

function getGoScore(park: Bikepark): number {
    // Simple Go/No-Go scoring (0-100)
    let score = 50;

    // Weather bonus
    if (park.weather.rain === 0) score += 20;
    else if (park.weather.rain < 3) score += 5;
    else score -= 20;

    if (park.weather.temp >= 10 && park.weather.temp <= 25) score += 15;
    else if (park.weather.temp >= 5) score += 5;
    else score -= 10;

    if (park.weather.wind < 15) score += 10;
    else if (park.weather.wind > 25) score -= 15;

    // Lift status
    if (park.liftStatus === 'open') score += 20;
    else if (park.liftStatus === 'partial') score += 5;
    else score -= 30;

    return Math.max(0, Math.min(100, score));
}

function getGoLabel(score: number): { label: string; color: string } {
    if (score >= 80) return { label: '🟢 LET\'S GO!', color: '#4CAF50' };
    if (score >= 60) return { label: '🟡 MACHBAR', color: '#FFC107' };
    if (score >= 40) return { label: '🟠 RISKY', color: '#FF9800' };
    return { label: '🔴 NO-GO', color: '#F44336' };
}

export default function ParkPickerScreen() {
    const [region, setRegion] = useState('all');
    const [refreshing, setRefreshing] = useState(false);

    const filtered =
        region === 'all'
            ? bikeparks
            : bikeparks.filter((p) => countryMap[p.country] === region);

    // Sort by Go-Score desc
    const sorted = [...filtered].sort((a, b) => getGoScore(b) - getGoScore(a));

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // TODO: Fetch live weather data from OpenWeatherMap API
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '🏔️ Park-Picker Pro',
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
                    label="Region"
                    options={regionFilter}
                    value={region}
                    onValueChange={setRegion}
                    accentColor={ACCENT}
                />

                <Text style={styles.hint}>
                    📡 Wetterdaten werden demnächst live geladen (OpenWeatherMap API)
                </Text>

                {/* Park cards */}
                {sorted.map((park) => {
                    const status = getStatusInfo(park.liftStatus);
                    const goScore = getGoScore(park);
                    const go = getGoLabel(goScore);

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
                                            {park.openLifts}/{park.lifts} Lifte
                                        </Text>
                                    </View>
                                </View>

                                {/* Trails info */}
                                <View style={styles.trailsRow}>
                                    <Text style={styles.trailsText}>🚵 {park.trails} Strecken</Text>
                                    <Text style={styles.websiteLink}>Website →</Text>
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
});
