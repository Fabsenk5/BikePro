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
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const ACCENT = '#FFD600';

export default function PressureBotScreen() {
    const { t } = useTranslation();

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

    const terrainOptions = [
        { label: t('pressure_bot.terrain_hardpack'), value: 'hardpack' },
        { label: t('pressure_bot.terrain_roots'), value: 'roots' },
        { label: t('pressure_bot.terrain_roots_rocks'), value: 'roots_rocks' },
        { label: t('pressure_bot.terrain_mud'), value: 'mud' },
        { label: t('pressure_bot.terrain_alpine'), value: 'alpine' },
        { label: t('pressure_bot.terrain_bikepark'), value: 'bikepark' },
        { label: t('pressure_bot.terrain_flow'), value: 'flow' },
        { label: t('pressure_bot.terrain_rocky'), value: 'rocky' },
        { label: t('pressure_bot.terrain_loose'), value: 'loose' },
    ];

    const weatherOptions = [
        { label: t('pressure_bot.weather_dry'), value: 'dry' },
        { label: t('pressure_bot.weather_damp'), value: 'damp' },
        { label: t('pressure_bot.weather_wet'), value: 'wet' },
        { label: t('pressure_bot.weather_cold'), value: 'cold' },
        { label: t('pressure_bot.weather_hot'), value: 'hot' },
    ];

    const wheelOptions = [
        { label: '26"', value: '26' },
        { label: '27.5"', value: '27.5' },
        { label: '29"', value: '29' },
        { label: 'Mullet (29/27.5)', value: 'mullet' },
    ];

    const setupOptions = [
        { label: t('pressure_bot.setup_tubeless'), value: 'tubeless' },
        { label: t('pressure_bot.setup_tube_butyl'), value: 'tube_butyl' },
        { label: t('pressure_bot.setup_tube_latex'), value: 'tube_latex' },
        { label: t('pressure_bot.setup_insert'), value: 'insert' },
    ];

    const tireWidthOptions = [
        { label: '2.0"', value: '2.0' },
        { label: '2.2"', value: '2.2' },
        { label: '2.3"', value: '2.3' },
        { label: '2.35"', value: '2.35' },
        { label: '2.4"', value: '2.4' },
        { label: '2.5"', value: '2.5' },
        { label: '2.6"', value: '2.6' },
        { label: '2.8" (Plus)', value: '2.8' },
    ];

    const tireTypeOptions = [
        { label: t('pressure_bot.type_xc'), value: 'xc' },
        { label: t('pressure_bot.type_trail'), value: 'trail' },
        { label: t('pressure_bot.type_enduro'), value: 'enduro' },
        { label: t('pressure_bot.type_dh'), value: 'dh' },
        { label: t('pressure_bot.type_mud'), value: 'mud' },
    ];

    const casingOptions = [
        { label: t('pressure_bot.casing_light'), value: 'light' },
        { label: t('pressure_bot.casing_standard'), value: 'standard' },
        { label: t('pressure_bot.casing_reinforced'), value: 'reinforced' },
        { label: t('pressure_bot.casing_dh'), value: 'dh' },
        { label: t('pressure_bot.casing_doubledown'), value: 'doubledown' },
    ];

    const ridingStyleOptions = [
        { label: t('pressure_bot.style_chill'), value: 'chill' },
        { label: t('pressure_bot.style_normal'), value: 'normal' },
        { label: t('pressure_bot.style_aggressive'), value: 'aggressive' },
        { label: t('pressure_bot.style_race'), value: 'race' },
    ];

    const calculatePressure = (params: {
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
    }): { front: number; rear: number; notes: string[] } => {
        const totalWeight = params.riderWeight + params.bikeWeight;
        const notes: string[] = [];

        let baseFront = 1.1 + (totalWeight - 60) * 0.0085;
        let baseRear = baseFront + 0.18;

        const widthFactor: Record<string, number> = {
            '2.0': 0.15, '2.2': 0.08, '2.3': 0.04, '2.35': 0.02,
            '2.4': 0, '2.5': -0.05, '2.6': -0.1, '2.8': -0.2,
        };
        const wAdj = widthFactor[params.tireWidth] ?? 0;
        baseFront += wAdj;
        baseRear += wAdj;

        if (params.wheelSize === '29') {
            baseFront += 0.03; baseRear += 0.03;
        } else if (params.wheelSize === '26') {
            baseFront -= 0.03; baseRear -= 0.03;
        } else if (params.wheelSize === 'mullet') {
            baseFront += 0.03; baseRear -= 0.02;
            notes.push(t('pressure_bot.note_mullet'));
        }

        const setupAdj: Record<string, number> = {
            tubeless: 0, tube_butyl: 0.15, tube_latex: 0.1, insert: -0.1,
        };
        baseFront += setupAdj[params.setup] ?? 0;
        baseRear += setupAdj[params.setup] ?? 0;
        if (params.setup === 'insert') {
            notes.push(t('pressure_bot.note_insert'));
        }

        const typeAdj: Record<string, number> = {
            xc: 0.1, trail: 0.03, enduro: 0, dh: -0.05, mud: -0.08,
        };
        baseFront += typeAdj[params.tireType] ?? 0;
        baseRear += typeAdj[params.tireType] ?? 0;

        const casingAdj: Record<string, number> = {
            light: 0.08, standard: 0, reinforced: -0.03, dh: -0.08, doubledown: -0.1,
        };
        baseFront += casingAdj[params.casing] ?? 0;
        baseRear += casingAdj[params.casing] ?? 0;
        if (params.casing === 'dh' || params.casing === 'doubledown') {
            notes.push(t('pressure_bot.note_casing_dh'));
        }

        const styleAdj: Record<string, number> = {
            chill: -0.08, normal: 0, aggressive: 0.05, race: 0.1,
        };
        baseFront += styleAdj[params.ridingStyle] ?? 0;
        baseRear += styleAdj[params.ridingStyle] ?? 0;

        const terrainAdj: Record<string, { f: number; r: number }> = {
            hardpack: { f: 0.1, r: 0.1 }, roots: { f: -0.05, r: -0.03 },
            roots_rocks: { f: -0.08, r: -0.05 }, mud: { f: -0.1, r: -0.08 },
            alpine: { f: 0.05, r: 0.05 }, bikepark: { f: 0, r: 0.02 },
            flow: { f: 0.05, r: 0.05 }, rocky: { f: -0.1, r: -0.08 },
            loose: { f: -0.05, r: -0.03 },
        };
        const tAdj = terrainAdj[params.terrain] ?? { f: 0, r: 0 };
        baseFront += tAdj.f;
        baseRear += tAdj.r;

        const weatherAdj: Record<string, number> = {
            dry: 0, damp: -0.05, wet: -0.1, cold: 0.05, hot: -0.03,
        };
        baseFront += weatherAdj[params.weather] ?? 0;
        baseRear += weatherAdj[params.weather] ?? 0;

        if (params.weather === 'wet') {
            notes.push(t('pressure_bot.note_wet'));
        }
        if (params.weather === 'cold') {
            notes.push(t('pressure_bot.note_cold'));
        }

        const front = Math.max(0.8, Math.min(3.5, Math.round(baseFront * 20) / 20));
        const rear = Math.max(0.8, Math.min(3.5, Math.round(baseRear * 20) / 20));

        return { front, rear, notes };
    };

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
                    title: t('pressure_bot.title'),
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
                    <Text style={styles.resultTitle}>{t('pressure_bot.recommended_title')}</Text>
                    <View style={styles.resultRow}>
                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>{t('pressure_bot.front')}</Text>
                            <Text style={[styles.resultValue, { color: ACCENT }]}>
                                {result.front.toFixed(2)}
                            </Text>
                            <Text style={styles.resultUnit}>bar</Text>
                            <Text style={styles.resultPSI}>{frontPSI} PSI</Text>
                        </View>
                        <View style={styles.resultDivider} />
                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>{t('pressure_bot.rear')}</Text>
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
                    <Text style={styles.sectionTitle}>{t('pressure_bot.weight_section')}</Text>
                    <BPSlider label={t('pressure_bot.rider_weight_label')} value={riderWeight} min={40} max={140} step={1} unit=" kg" accentColor={ACCENT} onValueChange={setRiderWeight} />
                    <BPSlider label={t('pressure_bot.bike_weight_label')} value={bikeWeight} min={8} max={30} step={0.5} unit=" kg" accentColor={ACCENT} onValueChange={setBikeWeight} />
                </BPCard>

                {/* Reifen */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('pressure_bot.tire_section')}</Text>
                    <BPPicker label={t('pressure_bot.wheel_size_label')} options={wheelOptions} value={wheelSize} onValueChange={setWheelSize} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.tire_width_label')} options={tireWidthOptions} value={tireWidth} onValueChange={setTireWidth} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.tire_type_label')} options={tireTypeOptions} value={tireType} onValueChange={setTireType} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.casing_label')} options={casingOptions} value={casing} onValueChange={setCasing} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.setup_label')} options={setupOptions} value={setup} onValueChange={setSetup} accentColor={ACCENT} />
                </BPCard>

                {/* Bedingungen */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('pressure_bot.conditions_section')}</Text>
                    <BPPicker label={t('pressure_bot.terrain_label')} options={terrainOptions} value={terrain} onValueChange={setTerrain} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.weather_label')} options={weatherOptions} value={weather} onValueChange={setWeather} accentColor={ACCENT} />
                    <BPPicker label={t('pressure_bot.riding_style_label')} options={ridingStyleOptions} value={ridingStyle} onValueChange={setRidingStyle} accentColor={ACCENT} />
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
