/**
 * F6: Pressure-Bot — Reifendruck-Rechner (Enhanced V2)
 * Agent Manifest: f6_pressure_bot.md
 *
 * Inputs: Fahrergewicht, Fahrradgewicht, Laufradgröße, Reifenbreite,
 *         Tubeless/Schlauch, Reifentyp, Casing, Fahrstil, Untergrund, Wetterlage
 * Logik: Erweiterte Matrix basierend auf Hersteller-Empfehlungen + Praxis-Werte
 */
import { BPCard, BPPicker, BPSlider } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const ACCENT = '#FFD600';

// --- Terrain options (erweitert) ---
const terrainOptions = [
    { label: '🪨 Hardpack', value: 'hardpack' },
    { label: '🌲 Wurzeln', value: 'roots' },
    { label: '🪵 Wurzeln+Steine', value: 'roots_rocks' },
    { label: '💧 Matsch', value: 'mud' },
    { label: '🏔️ Alpin / Schotter', value: 'alpine' },
    { label: '🏗️ Bikepark', value: 'bikepark' },
    { label: '🌿 Flowtrails', value: 'flow' },
    { label: '🪨 Felsig / Technisch', value: 'rocky' },
    { label: '🏖️ Sand / Locker', value: 'loose' },
];

// --- Weather options ---
const weatherOptions = [
    { label: '☀️ Trocken', value: 'dry' },
    { label: '🌦️ Leicht feucht', value: 'damp' },
    { label: '🌧️ Nass', value: 'wet' },
    { label: '❄️ Kalt (<5°C)', value: 'cold' },
    { label: '🥵 Heiß (>30°C)', value: 'hot' },
];

// --- Wheel sizes ---
const wheelOptions = [
    { label: '26\"', value: '26' },
    { label: '27.5\"', value: '27.5' },
    { label: '29\"', value: '29' },
    { label: 'Mullet (29/27.5)', value: 'mullet' },
];

// --- Setup type ---
const setupOptions = [
    { label: 'Tubeless', value: 'tubeless' },
    { label: 'Schlauch (Butyl)', value: 'tube_butyl' },
    { label: 'Schlauch (Latex)', value: 'tube_latex' },
    { label: 'Tubeless + Insert', value: 'insert' },
];

// --- Tire width (erweitert) ---
const tireWidthOptions = [
    { label: '2.0\"', value: '2.0' },
    { label: '2.2\"', value: '2.2' },
    { label: '2.3\"', value: '2.3' },
    { label: '2.35\"', value: '2.35' },
    { label: '2.4\"', value: '2.4' },
    { label: '2.5\"', value: '2.5' },
    { label: '2.6\"', value: '2.6' },
    { label: '2.8\" (Plus)', value: '2.8' },
];

// --- Reifentyp ---
const tireTypeOptions = [
    { label: '🏁 XC / Race', value: 'xc' },
    { label: '🌲 Trail', value: 'trail' },
    { label: '⛰️ Enduro', value: 'enduro' },
    { label: '🏔️ DH / Gravity', value: 'dh' },
    { label: '💧 Matsch / Spike', value: 'mud' },
];

// --- Casing ---
const casingOptions = [
    { label: 'Light / Race', value: 'light' },
    { label: 'Standard / EXO', value: 'standard' },
    { label: 'Verstärkt / EXO+', value: 'reinforced' },
    { label: 'DH / DD / SuperGravity', value: 'dh' },
    { label: 'Double Down / DualPly', value: 'doubledown' },
];

// --- Fahrstil ---
const ridingStyleOptions = [
    { label: '🐢 Gemütlich (Touren)', value: 'chill' },
    { label: '🏃 Normal', value: 'normal' },
    { label: '💪 Aggressiv', value: 'aggressive' },
    { label: '🔥 Sehr aggressiv (Race)', value: 'race' },
];

// --- Verbesserte Druckberechnung ---
function calculatePressure(params: {
    riderWeight: number;
    bikeWeight: number;
    wheelSize: string;
    tireWidth: string;
    setup: string;
    terrain: string;
    weather: string;
    tireType: string;
    casing: string;
    ridingStyle: string;
}): { front: number; rear: number; notes: string[] } {
    const totalWeight = params.riderWeight + params.bikeWeight;
    const notes: string[] = [];

    // Base pressure (bar) — logarithmische Kurve wie Hersteller
    let baseFront = 1.1 + (totalWeight - 60) * 0.0085;
    let baseRear = baseFront + 0.18; // Heck 55/45 Gewichtsverteilung

    // Reifenbreite (größte Auswirkung)
    const widthFactor: Record<string, number> = {
        '2.0': 0.15,
        '2.2': 0.08,
        '2.3': 0.04,
        '2.35': 0.02,
        '2.4': 0,
        '2.5': -0.05,
        '2.6': -0.1,
        '2.8': -0.2,
    };
    const wAdj = widthFactor[params.tireWidth] ?? 0;
    baseFront += wAdj;
    baseRear += wAdj;

    // Laufradgröße
    if (params.wheelSize === '29') {
        baseFront += 0.03;
        baseRear += 0.03;
    } else if (params.wheelSize === '26') {
        baseFront -= 0.03;
        baseRear -= 0.03;
    } else if (params.wheelSize === 'mullet') {
        baseFront += 0.03; // 29er vorne
        baseRear -= 0.02; // 27.5 hinten = etwas weniger
        notes.push('Mullet: Vorne etwas mehr, hinten etwas weniger Druck');
    }

    // Setup (Tube/Tubeless/Insert)
    const setupAdj: Record<string, number> = {
        tubeless: 0,
        tube_butyl: 0.15,
        tube_latex: 0.1,
        insert: -0.1,
    };
    baseFront += setupAdj[params.setup] ?? 0;
    baseRear += setupAdj[params.setup] ?? 0;
    if (params.setup === 'insert') {
        notes.push('Mit Insert kannst du ~0.1 bar weniger fahren');
    }

    // Reifentyp
    const typeAdj: Record<string, number> = {
        xc: 0.1,
        trail: 0.03,
        enduro: 0,
        dh: -0.05,
        mud: -0.08,
    };
    baseFront += typeAdj[params.tireType] ?? 0;
    baseRear += typeAdj[params.tireType] ?? 0;

    // Casing
    const casingAdj: Record<string, number> = {
        light: 0.08,
        standard: 0,
        reinforced: -0.03,
        dh: -0.08,
        doubledown: -0.1,
    };
    baseFront += casingAdj[params.casing] ?? 0;
    baseRear += casingAdj[params.casing] ?? 0;
    if (params.casing === 'dh' || params.casing === 'doubledown') {
        notes.push('Stabile Karkasse erlaubt niedrigeren Druck');
    }

    // Fahrstil
    const styleAdj: Record<string, number> = {
        chill: -0.08,
        normal: 0,
        aggressive: 0.05,
        race: 0.1,
    };
    baseFront += styleAdj[params.ridingStyle] ?? 0;
    baseRear += styleAdj[params.ridingStyle] ?? 0;

    // Terrain
    const terrainAdj: Record<string, { f: number; r: number }> = {
        hardpack: { f: 0.1, r: 0.1 },
        roots: { f: -0.05, r: -0.03 },
        roots_rocks: { f: -0.08, r: -0.05 },
        mud: { f: -0.1, r: -0.08 },
        alpine: { f: 0.05, r: 0.05 },
        bikepark: { f: 0, r: 0.02 },
        flow: { f: 0.05, r: 0.05 },
        rocky: { f: -0.1, r: -0.08 },
        loose: { f: -0.05, r: -0.03 },
    };
    const tAdj = terrainAdj[params.terrain] ?? { f: 0, r: 0 };
    baseFront += tAdj.f;
    baseRear += tAdj.r;

    // Wetter
    const weatherAdj: Record<string, number> = {
        dry: 0,
        damp: -0.05,
        wet: -0.1,
        cold: 0.05,
        hot: -0.03,
    };
    baseFront += weatherAdj[params.weather] ?? 0;
    baseRear += weatherAdj[params.weather] ?? 0;

    if (params.weather === 'wet') {
        notes.push('Bei Nässe: Weniger Druck = mehr Grip!');
    }
    if (params.weather === 'cold') {
        notes.push('Kälte: Druck sinkt ca. 0.05 bar pro 10°C → etwas mehr einfüllen');
    }

    // Clamp
    const front = Math.max(0.8, Math.min(3.5, Math.round(baseFront * 20) / 20));
    const rear = Math.max(0.8, Math.min(3.5, Math.round(baseRear * 20) / 20));

    return { front, rear, notes };
}

export default function PressureBotScreen() {
    const [riderWeight, setRiderWeight] = useState(80);
    const [bikeWeight, setBikeWeight] = useState(15);
    const [wheelSize, setWheelSize] = useState('29');
    const [tireWidth, setTireWidth] = useState('2.5');
    const [setup, setSetup] = useState('tubeless');
    const [terrain, setTerrain] = useState('bikepark');
    const [weather, setWeather] = useState('dry');
    const [tireType, setTireType] = useState('enduro');
    const [casing, setCasing] = useState('standard');
    const [ridingStyle, setRidingStyle] = useState('normal');

    const result = useMemo(
        () =>
            calculatePressure({
                riderWeight, bikeWeight, wheelSize, tireWidth,
                setup, terrain, weather, tireType, casing, ridingStyle,
            }),
        [riderWeight, bikeWeight, wheelSize, tireWidth, setup, terrain, weather, tireType, casing, ridingStyle]
    );

    const frontPSI = Math.round(result.front * 14.5038);
    const rearPSI = Math.round(result.rear * 14.5038);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '💨 Pressure-Bot',
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Result card */}
                <BPCard accentColor={ACCENT} style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Empfohlener Reifendruck</Text>
                    <View style={styles.resultRow}>
                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>VORNE</Text>
                            <Text style={[styles.resultValue, { color: ACCENT }]}>
                                {result.front.toFixed(2)}
                            </Text>
                            <Text style={styles.resultUnit}>bar</Text>
                            <Text style={styles.resultPSI}>{frontPSI} PSI</Text>
                        </View>
                        <View style={styles.resultDivider} />
                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>HINTEN</Text>
                            <Text style={[styles.resultValue, { color: ACCENT }]}>
                                {result.rear.toFixed(2)}
                            </Text>
                            <Text style={styles.resultUnit}>bar</Text>
                            <Text style={styles.resultPSI}>{rearPSI} PSI</Text>
                        </View>
                    </View>
                    {result.notes.length > 0 && (
                        <View style={styles.notesBox}>
                            {result.notes.map((note, i) => (
                                <Text key={i} style={styles.noteText}>💡 {note}</Text>
                            ))}
                        </View>
                    )}
                </BPCard>

                {/* Gewicht */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>⚖️ Gewicht</Text>
                    <BPSlider label="Fahrergewicht (inkl. Ausrüstung)" value={riderWeight} min={40} max={140} step={1} unit=" kg" accentColor={ACCENT} onValueChange={setRiderWeight} />
                    <BPSlider label="Fahrradgewicht" value={bikeWeight} min={8} max={30} step={0.5} unit=" kg" accentColor={ACCENT} onValueChange={setBikeWeight} />
                </BPCard>

                {/* Reifen */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>🔘 Reifen-Setup</Text>
                    <BPPicker label="Laufradgröße" options={wheelOptions} value={wheelSize} onValueChange={setWheelSize} accentColor={ACCENT} />
                    <BPPicker label="Reifenbreite" options={tireWidthOptions} value={tireWidth} onValueChange={setTireWidth} accentColor={ACCENT} />
                    <BPPicker label="Reifentyp" options={tireTypeOptions} value={tireType} onValueChange={setTireType} accentColor={ACCENT} />
                    <BPPicker label="Karkasse / Casing" options={casingOptions} value={casing} onValueChange={setCasing} accentColor={ACCENT} />
                    <BPPicker label="Montage" options={setupOptions} value={setup} onValueChange={setSetup} accentColor={ACCENT} />
                </BPCard>

                {/* Bedingungen */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>🌍 Bedingungen</Text>
                    <BPPicker label="Untergrund" options={terrainOptions} value={terrain} onValueChange={setTerrain} accentColor={ACCENT} />
                    <BPPicker label="Wetter" options={weatherOptions} value={weather} onValueChange={setWeather} accentColor={ACCENT} />
                    <BPPicker label="Fahrstil" options={ridingStyleOptions} value={ridingStyle} onValueChange={setRidingStyle} accentColor={ACCENT} />
                </BPCard>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    resultCard: { marginBottom: theme.spacing.lg, padding: theme.spacing.lg },
    resultTitle: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center', marginBottom: theme.spacing.md },
    resultRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    resultItem: { alignItems: 'center', flex: 1 },
    resultLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
    resultValue: { fontSize: 38, fontWeight: '900' },
    resultUnit: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: -2 },
    resultPSI: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 4 },
    resultDivider: { width: 1, height: 60, backgroundColor: theme.colors.border },
    notesBox: { marginTop: theme.spacing.md, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm },
    noteText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 2 },
    sectionCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
    sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: theme.spacing.md },
});
