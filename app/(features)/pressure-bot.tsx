/**
 * F6: Pressure-Bot — Reifendruck-Rechner (Enhanced V2)
 * Agent Manifest: f6_pressure_bot.md
 *
 * Inputs: Fahrergewicht, Fahrradgewicht, Laufradgröße, Reifenbreite,
 *         Tubeless/Schlauch, Reifentyp, Casing, Fahrstil, Untergrund, Wetterlage
 * Logik: Erweiterte Matrix basierend auf Hersteller-Empfehlungen + Praxis-Werte
 */
import { BPButton, BPCard, BPInput, BPPicker, BPSegmentedControl, BPSlider, screenContentStyle } from '@/components/ui';
import { featureColors, theme } from '@/constants/Colors';
import { ClickChannel, resolveMaxClicks } from '@/lib/clickLimits';
import { formatRange, midpoint, resolveSpecValues, SpecRow } from '@/lib/specTable';
import { showAlert } from '@/lib/dialog';
import { travelStrokeDefaults } from '@/lib/suspensionDefaults';
import { calculateTirePressure } from '@/lib/tirePressure';
import { SyncBike, newId, syncLoadBikes, syncLoadPreference, syncLoadPrimaryBikeId, syncLoadProfile, syncSaveBikes } from '@/lib/sync';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const ACCENT = featureColors['pressure-bot'];

// Semantic setup-value keys with legacy German-label fallback (lib/sync.ts migrates old labels on load).
const getSetupValue = (values: any[] | undefined, key: string, legacyKey: string): string | undefined => {
    if (!Array.isArray(values)) return undefined;
    return values.find((s: any) => s.key === key)?.value ?? values.find((s: any) => s.key === legacyKey)?.value;
};

export default function PressureBotScreen() {
    const { t, i18n } = useTranslation();
    const [units, setUnits] = useState<{ pressure: 'bar' | 'psi'; weight: 'kg' | 'lb' }>({
        pressure: 'bar',
        weight: 'kg',
    });

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

    const [shockType, setShockType] = useState('air');
    const [rearTravel, setRearTravel] = useState('160');
    const [shockStroke, setShockStroke] = useState('60');

    const router = useRouter();
    const [trackerBikes, setTrackerBikes] = useState<SyncBike[]>([]);
    const [selectedBikeId, setSelectedBikeId] = useState<string>('');
    const [savingToBike, setSavingToBike] = useState(false);
    const [activeTab, setActiveTab] = useState<'tires' | 'suspension'>('tires');

    useEffect(() => {
        syncLoadBikes().then(data => setTrackerBikes(data ?? []));
        syncLoadProfile().then(p => {
            if (p.weight) {
                const w = parseFloat(p.weight);
                // Profile weight is stored in kg (internal unit)
                if (!isNaN(w) && w > 20) setRiderWeight(w);
            }
        });
        syncLoadPreference<{ pressure?: 'bar' | 'psi'; weight?: 'kg' | 'lb' }>('units', '@bikepro_units').then(u => {
            if (u) setUnits(prev => ({ pressure: u.pressure ?? prev.pressure, weight: u.weight ?? prev.weight }));
        });
    }, []);

    const handleBikeChange = (bikeId: string) => {
        setSelectedBikeId(bikeId);
        if (!bikeId) return;

        const bike = trackerBikes.find(b => b.id === bikeId);
        if (!bike) return;

        // Try to find front wheel to auto-fill tire size/width
        const frontWheel = bike.components.find((c: any) => c.type === 'wheel_front');
        if (frontWheel && frontWheel.setupValues) {
            const sizeVal = getSetupValue(frontWheel.setupValues, 'size', 'Größe');
            const sizeStr = sizeVal?.replace('"', ''); // "29"
            if (sizeStr === '29' || sizeStr === '27.5' || sizeStr === '26') {
                setWheelSize(sizeStr);
            }

            const widthVal = getSetupValue(frontWheel.setupValues, 'width', 'Breite');
            if (widthVal) {
                const widthStr = widthVal.replace('"', '').trim();
                // Valid widths like "2.4" or "2.5"
                if (parseFloat(widthStr) >= 2.0 && parseFloat(widthStr) <= 3.0) {
                    setTireWidth(widthStr);
                }
            }

            const typeStr = getSetupValue(frontWheel.setupValues, 'tire_type', 'Reifentyp')?.toLowerCase() || '';
            if (typeStr.includes('xc') || typeStr.includes('cross')) setTireType('xc');
            else if (typeStr.includes('trail')) setTireType('trail');
            else if (typeStr.includes('enduro')) setTireType('enduro');
            else if (typeStr.includes('dh') || typeStr.includes('downhill')) setTireType('dh');
            else if (typeStr.includes('mud') || typeStr.includes('matsch')) setTireType('mud');

            const casingStr = getSetupValue(frontWheel.setupValues, 'casing', 'Karkasse')?.toLowerCase() || '';
            if (casingStr.includes('light') || casingStr.includes('super race') || casingStr.includes('super ground') || casingStr.includes('leicht')) setCasing('light');
            else if (casingStr.includes('standard') || casingStr.includes('exo') || casingStr.includes('super trail')) setCasing('standard');
            else if (casingStr.includes('reinforced') || casingStr.includes('exo+') || casingStr.includes('super gravity')) setCasing('reinforced');
            else if (casingStr.includes('doubledown') || casingStr.includes('dd')) setCasing('doubledown');
            else if (casingStr.includes('dh') || casingStr.includes('downhill') || casingStr.includes('super downhill')) setCasing('dh');

            const setupStr = getSetupValue(frontWheel.setupValues, 'mount', 'Montage')?.toLowerCase() || '';
            if (setupStr.includes('tubeless') || setupStr.includes('tlr')) setSetup('tubeless');
            else if (setupStr.includes('butyl') || setupStr.includes('schlauch') || setupStr === 'tube') setSetup('tube_butyl');
            else if (setupStr.includes('latex')) setSetup('tube_latex');
            else if (setupStr.includes('insert') || setupStr.includes('cushcore') || setupStr.includes('noodle')) setSetup('insert');
        }

        const shock = bike.components.find((c: any) => c.type === 'shock');
        let hasTravelStroke = false;
        if (shock) {
            if (shock.model?.toLowerCase().includes('coil') || shock.name?.toLowerCase().includes('coil')) {
                setShockType('coil');
            } else {
                setShockType('air');
            }
            const travelVal = getSetupValue(shock.setupValues, 'travel', 'Federweg');
            if (travelVal) {
                setRearTravel(travelVal.replace(/[^0-9.]/g, ''));
                hasTravelStroke = true;
            }
            const strokeVal = getSetupValue(shock.setupValues, 'stroke', 'Hub');
            if (strokeVal) {
                setShockStroke(strokeVal.replace(/[^0-9.]/g, ''));
                hasTravelStroke = true;
            }
        }
        if (!hasTravelStroke) {
            const d = travelStrokeDefaults(bike.type);
            setRearTravel(String(d.travel));
            setShockStroke(String(d.stroke));
        }
    };

    // Preselect the bike once the list is loaded: deep link wins, then the
    // primary bike from the home screen, then the first bike.
    const routeParams = useLocalSearchParams<{ bikeId?: string }>();
    const handledBikeParam = useRef(false);
    useEffect(() => {
        if (handledBikeParam.current || trackerBikes.length === 0) return;
        const paramBikeId = typeof routeParams.bikeId === 'string' ? routeParams.bikeId : '';
        const applyDefault = async () => {
            let target = paramBikeId && trackerBikes.some(b => b.id === paramBikeId) ? paramBikeId : '';
            if (!target) {
                const primaryId = await syncLoadPrimaryBikeId();
                target = trackerBikes.find(b => b.id === primaryId)?.id ?? trackerBikes[0].id;
            }
            if (target) {
                handledBikeParam.current = true;
                handleBikeChange(target);
            }
        };
        applyDefault();
    }, [routeParams.bikeId, trackerBikes]);


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
        { label: t('pressure_bot.terrain_street'), value: 'street' },
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

    // Auto-fill bike weight if bike selected
    useEffect(() => {
        if (!selectedBikeId) return;
        const bike = trackerBikes.find(b => b.id === selectedBikeId);
        if (bike) {
            if (bike.weight) {
                setBikeWeight(bike.weight);
            } else {
                // Fallback: Calculate total weight of components
                const totalWeightGram = bike.components.reduce((sum, c) => sum + (parseInt(c.weight) || 0), 0);
                if (totalWeightGram > 0) {
                    // Convert to kg for the slider
                    setBikeWeight(parseFloat((totalWeightGram / 1000).toFixed(1)));
                } else {
                    setBikeWeight(15); // Fallback standard weight
                }
            }
        }
    }, [selectedBikeId, trackerBikes]);

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

    const result = useMemo(() => {
        const r = calculateTirePressure({
            riderWeight, bikeWeight, wheelSize, tireWidth,
            setup, terrain, weather, tireType, casing, ridingStyle,
        });
        return { front: r.front, rear: r.rear, notes: r.notes.map(key => t(key)) };
    }, [riderWeight, bikeWeight, wheelSize, tireWidth, setup, terrain, weather, tireType, casing, ridingStyle, t]);

    const suspResult = useMemo(() => {
        const selectedBike = trackerBikes.find(b => b.id === selectedBikeId);
        const isEbike = bikeWeight > 18 || selectedBike?.type === 'emtb' || selectedBike?.type === 'e-mtb';

        let fPsi = Math.round(riderWeight * 1.05 + (terrain === 'bikepark' ? 5 : 0) + (tireType === 'dh' ? 5 : 0));
        let sPsi = Math.round(riderWeight * 2.3 + (terrain === 'bikepark' ? 10 : 0) + (tireType === 'dh' ? 10 : 0));
        if (isEbike) { fPsi += 3; sPsi += 8; } // E-Bike compensation

        if (shockType === 'coil') {
            const defs = travelStrokeDefaults(selectedBike?.type);
            const travelMm = parseFloat(rearTravel) || defs.travel;
            const strokeMm = parseFloat(shockStroke) || defs.stroke;
            // Spring rate from rear-axle load (57% weight bias), leverage ratio and 30% sag target
            const rearWeightLb = (riderWeight + bikeWeight) * 2.20462 * 0.57;
            const leverage = travelMm / strokeMm;
            const sagIn = (strokeMm / 25.4) * 0.30;
            const springRate = (rearWeightLb * leverage) / sagIn;
            sPsi = Math.max(150, Math.round(springRate / 25) * 25);
        }

        // Click recommendations
        // Heavier rider = higher pressure = more rebound damping (less clicks from open)
        const reboundOpenPct = Math.max(10, Math.min(100, 100 - ((riderWeight - 40) / 80 * 100)));
        // Aggressive riding style needs more compression damping
        const compOpenPct = ridingStyle === 'race' ? 30 : ridingStyle === 'aggressive' ? 50 : 80;

        const fork = selectedBike?.components.find((c: any) => c.type === 'fork');
        const shock = selectedBike?.components.find((c: any) => c.type === 'shock');

        // Manufacturer recommendations for the rider's weight (optional per component)
        const forkSpec = fork ? resolveSpecValues(fork.specTable, riderWeight) : null;
        const shockSpec = shock ? resolveSpecValues(shock.specTable, riderWeight) : null;

        let forkPsiSource: 'spec' | 'formula' = 'formula';
        let forkPsiSpecText: string | null = null;
        const forkSpecPsi = forkSpec ? midpoint(forkSpec.row.psi) : null;
        if (forkSpecPsi !== null) {
            fPsi = forkSpecPsi;
            forkPsiSource = 'spec';
            forkPsiSpecText = formatRange(forkSpec?.row.psi);
        }

        let shockPsiSource: 'spec' | 'formula' = 'formula';
        let shockPsiSpecText: string | null = null;
        const shockSpecPsi = shockType === 'coil' ? null : (shockSpec ? midpoint(shockSpec.row.psi) : null);
        if (shockSpecPsi !== null) {
            sPsi = shockSpecPsi;
            shockPsiSource = 'spec';
            shockPsiSpecText = formatRange(shockSpec?.row.psi);
        }

        type ClickSuggestion = { value: number; max: number; specText: string | null };

        const pickSpecClicks = (row: SpecRow | undefined, channel: ClickChannel): string | null => {
            if (!row) return null;
            switch (channel) {
                case 'rebound': return row.lsr ?? row.hsr ?? null;
                case 'reboundLsr': return row.lsr ?? null;
                case 'reboundHsr': return row.hsr ?? null;
                case 'compression': return row.lsc ?? row.hsc ?? null;
                case 'compressionLsc': return row.lsc ?? null;
                case 'compressionHsc': return row.hsc ?? null;
            }
        };

        // Manufacturer value first; otherwise "open %" logic capped by the channel max
        const clickFor = (comp: any, specRow: SpecRow | undefined, channel: ClickChannel, openPct: number): ClickSuggestion => {
            const specText = pickSpecClicks(specRow, channel);
            const specValue = specText ? midpoint(specText) : null;
            const max = resolveMaxClicks(comp, channel);
            if (specValue !== null) {
                // Inconsistent manual data (spec above the max) → clamp and fall back to the normal display
                const clamped = Math.min(specValue, max);
                return { value: clamped, max, specText: clamped === specValue ? specText : null };
            }
            return { value: Math.max(1, Math.round(max * (openPct / 100))), max, specText: null };
        };
        const fmtClicks = (r: ClickSuggestion | null, pct: number) => {
            if (!r) return `${Math.round(pct)}%`;
            if (r.specText) return `${formatRange(r.specText)} 🏭`;
            return `${r.value} (${r.max} max)`;
        };
        const rawClicks = (r: ClickSuggestion | null, pct: number) =>
            r ? r.value : Math.round(pct);

        const forkRebound = fork ? clickFor(fork, forkSpec?.row, 'rebound', reboundOpenPct) : null;
        const forkLsr = fork ? clickFor(fork, forkSpec?.row, 'reboundLsr', reboundOpenPct) : null;
        const forkHsr = fork ? clickFor(fork, forkSpec?.row, 'reboundHsr', reboundOpenPct) : null;
        const forkComp = fork ? clickFor(fork, forkSpec?.row, 'compression', compOpenPct) : null;
        const forkCompLsc = fork ? clickFor(fork, forkSpec?.row, 'compressionLsc', compOpenPct) : null;
        const forkCompHsc = fork ? clickFor(fork, forkSpec?.row, 'compressionHsc', compOpenPct) : null;

        const shockRebound = shock ? clickFor(shock, shockSpec?.row, 'rebound', reboundOpenPct) : null;
        const shockLsr = shock ? clickFor(shock, shockSpec?.row, 'reboundLsr', reboundOpenPct) : null;
        const shockHsr = shock ? clickFor(shock, shockSpec?.row, 'reboundHsr', reboundOpenPct) : null;
        const shockComp = shock ? clickFor(shock, shockSpec?.row, 'compression', compOpenPct) : null;
        const shockCompLsc = shock ? clickFor(shock, shockSpec?.row, 'compressionLsc', compOpenPct) : null;
        const shockCompHsc = shock ? clickFor(shock, shockSpec?.row, 'compressionHsc', compOpenPct) : null;

        return { 
            forkPsi: fPsi, shockPsi: sPsi,
            forkPsiSource, forkPsiSpecText, shockPsiSource, shockPsiSpecText,
            forkClicks: fmtClicks(forkRebound, reboundOpenPct),
            forkLsrClicks: fmtClicks(forkLsr, reboundOpenPct),
            forkHsrClicks: fmtClicks(forkHsr, reboundOpenPct),
            forkCompClicks: fmtClicks(forkComp, compOpenPct),
            forkCompLscClicks: fmtClicks(forkCompLsc, compOpenPct),
            forkCompHscClicks: fmtClicks(forkCompHsc, compOpenPct),
            shockClicks: fmtClicks(shockRebound, reboundOpenPct),
            shockLsrClicks: fmtClicks(shockLsr, reboundOpenPct),
            shockHsrClicks: fmtClicks(shockHsr, reboundOpenPct),
            shockCompClicks: fmtClicks(shockComp, compOpenPct),
            shockCompLscClicks: fmtClicks(shockCompLsc, compOpenPct),
            shockCompHscClicks: fmtClicks(shockCompHsc, compOpenPct),
            rawForkClicks: rawClicks(forkRebound, reboundOpenPct),
            rawForkLsrClicks: rawClicks(forkLsr, reboundOpenPct),
            rawForkHsrClicks: rawClicks(forkHsr, reboundOpenPct),
            rawForkCompClicks: rawClicks(forkComp, compOpenPct),
            rawForkCompLscClicks: rawClicks(forkCompLsc, compOpenPct),
            rawForkCompHscClicks: rawClicks(forkCompHsc, compOpenPct),
            rawShockClicks: rawClicks(shockRebound, reboundOpenPct),
            rawShockLsrClicks: rawClicks(shockLsr, reboundOpenPct),
            rawShockHsrClicks: rawClicks(shockHsr, reboundOpenPct),
            rawShockCompClicks: rawClicks(shockComp, compOpenPct),
            rawShockCompLscClicks: rawClicks(shockCompLsc, compOpenPct),
            rawShockCompHscClicks: rawClicks(shockCompHsc, compOpenPct),
            forkReboundMode: fork?.reboundMode,
            forkCompMode: fork?.compressionMode,
            shockReboundMode: shock?.reboundMode,
            shockCompMode: shock?.compressionMode
        };
    }, [riderWeight, bikeWeight, terrain, tireType, ridingStyle, selectedBikeId, trackerBikes, shockType, rearTravel, shockStroke]);

    const frontPSI = Math.round(result.front * 14.5038);
    const rearPSI = Math.round(result.rear * 14.5038);

    const handleSaveToBike = async () => {
        if (!selectedBikeId) return;
        setSavingToBike(true);

        const updatedBikes = trackerBikes.map(b => {
            if (b.id !== selectedBikeId) return b;
            const updatedComps = b.components.map(c => {
                if (activeTab === 'tires') {
                    // Tires are always stored in bar (app standard); suspension stays PSI.
                    const fbStr = `${result.front.toFixed(2)} bar`;
                    const rbStr = `${result.rear.toFixed(2)} bar`;
                    if (c.type === 'wheel_front') {
                        const newSetup = Array.isArray(c.setupValues) ? [...c.setupValues] : [];
                        const dIdx = newSetup.findIndex((s: any) => s.key === 'pressure' || s.key === 'Druck');
                        if (dIdx >= 0) newSetup[dIdx] = { ...newSetup[dIdx], key: 'pressure', value: fbStr };
                        else newSetup.push({ key: 'pressure', value: fbStr });
                        return { ...c, setupValues: newSetup };
                    }
                    if (c.type === 'wheel_rear') {
                        const newSetup = Array.isArray(c.setupValues) ? [...c.setupValues] : [];
                        const dIdx = newSetup.findIndex((s: any) => s.key === 'pressure' || s.key === 'Druck');
                        if (dIdx >= 0) newSetup[dIdx] = { ...newSetup[dIdx], key: 'pressure', value: rbStr };
                        else newSetup.push({ key: 'pressure', value: rbStr });
                        return { ...c, setupValues: newSetup };
                    }
                } else if (activeTab === 'suspension') {
                    // Format pressures/spring rate in the user's preferred units
                    // (suspResult values are PSI / lbs-in internally)
                    const fmtPsi = (psi: number) => `${psi} PSI`;
                    if (c.type === 'fork') {
                        const newSetup = Array.isArray(c.setupValues) ? [...c.setupValues] : [];
                        const dIdx = newSetup.findIndex((s: any) => s.key === 'pressure' || s.key === 'Druck');
                        const vStr = fmtPsi(suspResult.forkPsi);
                        if (dIdx >= 0) newSetup[dIdx] = { ...newSetup[dIdx], key: 'pressure', value: vStr };
                        else newSetup.push({ key: 'pressure', value: vStr });
                        return { ...c, setupValues: newSetup };
                    }
                    if (c.type === 'shock') {
                        const newSetup = Array.isArray(c.setupValues) ? [...c.setupValues] : [];
                        const keyName = shockType === 'coil' ? 'spring_rate' : 'pressure';
                        const dIdx = newSetup.findIndex((s: any) => s.key === keyName || s.key === 'Druck' || s.key === 'Federhärte');
                        const vStr = shockType === 'coil'
                            ? (units.weight === 'kg' ? `${Math.round(suspResult.shockPsi / 2.20462)} kg` : `${suspResult.shockPsi} lbs`)
                            : fmtPsi(suspResult.shockPsi);
                        if (dIdx >= 0) newSetup[dIdx] = { ...newSetup[dIdx], key: keyName, value: vStr };
                        else newSetup.push({ key: keyName, value: vStr });

                        if (shockType === 'coil') {
                            const tIdx = newSetup.findIndex((s: any) => s.key === 'travel' || s.key === 'Federweg');
                            if (tIdx < 0 && rearTravel) newSetup.push({ key: 'travel', value: `${rearTravel} mm` });
                            const stIdx = newSetup.findIndex((s: any) => s.key === 'stroke' || s.key === 'Hub');
                            if (stIdx < 0 && shockStroke) newSetup.push({ key: 'stroke', value: `${shockStroke} mm` });
                        }

                        return { ...c, setupValues: newSetup };
                    }
                }
                return c;
            });
            return { ...b, components: updatedComps };
        });

        const ok = await syncSaveBikes(updatedBikes);
        if (ok) {
            setTrackerBikes(updatedBikes);
        } else {
            showAlert(t('pressure_bot.save_error_title'), t('pressure_bot.save_error'));
        }
        setSavingToBike(false);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('pressure_bot.title'),
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Mode Switch */}
                <BPSegmentedControl
                    options={[
                        { label: `🛞 ${t('pressure_bot.tab_tires', { defaultValue: 'Reifen' })}`, value: 'tires' },
                        { label: `🔱 ${t('pressure_bot.tab_suspension', { defaultValue: 'Fahrwerk' })}`, value: 'suspension' },
                    ]}
                    value={activeTab}
                    onChange={(v) => setActiveTab(v as 'tires' | 'suspension')}
                    accentColor={ACCENT}
                />

                {/* Result card Tires */}
                {activeTab === 'tires' && (
                    <BPCard accentColor={ACCENT} style={styles.resultCard}>
                        <Text style={styles.resultTitle}>{t('pressure_bot.recommended_title')}</Text>
                        <View style={styles.resultRow}>
                            <View style={styles.resultItem}>
                                <Text style={styles.resultLabel}>{t('pressure_bot.front')}</Text>
                                <Text style={[styles.resultValue, { color: ACCENT }]}>
                                    {result.front.toLocaleString(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text style={styles.resultUnit}>bar</Text>
                                <Text style={styles.resultPSI}>{frontPSI} PSI</Text>
                            </View>
                            <View style={styles.resultDivider} />
                            <View style={styles.resultItem}>
                                <Text style={styles.resultLabel}>{t('pressure_bot.rear')}</Text>
                                <Text style={[styles.resultValue, { color: ACCENT }]}>
                                    {result.rear.toLocaleString(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
                            <BPButton
                                title={t('pressure_bot.save_dialed_in')}
                                onPress={() => {
                                    const fb = result.front.toFixed(2);
                                    const rb = result.rear.toFixed(2);
                                    const ts = newId();
                                    router.push(`/(features)/dialed-in?bikeId=${selectedBikeId}&frontBar=${fb}&rearBar=${rb}&ts=${ts}`);
                                }}
                                variant="outline"
                                color={ACCENT}
                                fullWidth
                            />
                            {selectedBikeId ? (
                                <BPButton
                                    title={savingToBike ? t('pressure_bot.saving') : t('pressure_bot.save_tracker')}
                                    onPress={handleSaveToBike}
                                    variant="outline"
                                    color={theme.colors.accentCyan}
                                    fullWidth
                                    disabled={savingToBike}
                                />
                            ) : null}
                        </View>
                    </BPCard>
                )}

                {/* Result card Suspension */}
                {activeTab === 'suspension' && (
                    <BPCard accentColor={ACCENT} style={styles.resultCard}>
                        <Text style={styles.resultTitle}>{t('pressure_bot.suspension_title', { defaultValue: 'Start-Setup Fahrwerk' })}</Text>
                        <View style={styles.resultRow}>
                            <View style={styles.resultItem}>
                                <Text style={styles.resultLabel}>{t('pressure_bot.fork_label', { defaultValue: 'Gabel (Fork)' })}</Text>
                                <Text style={[styles.resultValue, { color: ACCENT }]}>{suspResult.forkPsi}</Text>
                                <Text style={styles.resultUnit}>PSI</Text>
                                {suspResult.forkPsiSource === 'spec' && (
                                    <Text style={styles.resultPSI}>🏭 {suspResult.forkPsiSpecText} {t('pressure_bot.spec_label')}</Text>
                                )}
                                {suspResult.forkReboundMode === 'none' ? null : suspResult.forkReboundMode === 'hsls' ? (
                                    <>
                                        <Text style={[styles.resultPSI, { marginTop: 8 }]}>Rebound LSR: {suspResult.forkLsrClicks}</Text>
                                        <Text style={styles.resultPSI}>Rebound HSR: {suspResult.forkHsrClicks}</Text>
                                    </>
                                ) : (
                                    <Text style={[styles.resultPSI, { marginTop: 8 }]}>Rebound: {suspResult.forkClicks}</Text>
                                )}
                                {suspResult.forkCompMode === 'none' ? null : suspResult.forkCompMode === 'hsls' ? (
                                    <>
                                        <Text style={styles.resultPSI}>Compress LSC: {suspResult.forkCompLscClicks}</Text>
                                        <Text style={styles.resultPSI}>Compress HSC: {suspResult.forkCompHscClicks}</Text>
                                    </>
                                ) : suspResult.forkCompMode === 'lever' ? (
                                    <Text style={styles.resultPSI}>Compress: {suspResult.forkCompClicks} (Open)</Text>
                                ) : (
                                    <Text style={styles.resultPSI}>Compress: {suspResult.forkCompClicks}</Text>
                                )}
                            </View>
                            <View style={styles.resultDivider} />
                            <View style={styles.resultItem}>
                                <Text style={styles.resultLabel}>{t('pressure_bot.shock_label', { defaultValue: 'Dämpfer (Shock)' })}</Text>
                                <Text style={[styles.resultValue, { color: ACCENT }]}>{suspResult.shockPsi}</Text>
                                <Text style={styles.resultUnit}>{shockType === 'coil' ? 'lbs' : 'PSI'}</Text>
                                {suspResult.shockPsiSource === 'spec' && (
                                    <Text style={styles.resultPSI}>🏭 {suspResult.shockPsiSpecText} {t('pressure_bot.spec_label')}</Text>
                                )}
                                {suspResult.shockReboundMode === 'none' ? null : suspResult.shockReboundMode === 'hsls' ? (
                                    <>
                                        <Text style={[styles.resultPSI, { marginTop: 8 }]}>Rebound LSR: {suspResult.shockLsrClicks}</Text>
                                        <Text style={styles.resultPSI}>Rebound HSR: {suspResult.shockHsrClicks}</Text>
                                    </>
                                ) : (
                                    <Text style={[styles.resultPSI, { marginTop: 8 }]}>Rebound: {suspResult.shockClicks}</Text>
                                )}
                                {suspResult.shockCompMode === 'none' ? null : suspResult.shockCompMode === 'hsls' ? (
                                    <>
                                        <Text style={styles.resultPSI}>Compress LSC: {suspResult.shockCompLscClicks}</Text>
                                        <Text style={styles.resultPSI}>Compress HSC: {suspResult.shockCompHscClicks}</Text>
                                    </>
                                ) : suspResult.shockCompMode === 'lever' ? (
                                    <Text style={styles.resultPSI}>Compress: {suspResult.shockCompClicks} (Open)</Text>
                                ) : (
                                    <Text style={styles.resultPSI}>Compress: {suspResult.shockCompClicks}</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.notesBox}>
                            <Text style={styles.noteText}>{t('pressure_bot.suspension_note')}</Text>
                            <Text style={[styles.noteText, { marginTop: 4, color: theme.colors.accent }]}>⚠️ {t('pressure_bot.click_note')}</Text>
                        </View>

                        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
                            <BPButton
                                title={t('pressure_bot.save_dialed_in')}
                                onPress={() => {
                                    const ts = newId();
                                    // Coil shocks hand over spring rate (lb/in) instead of air pressure
                                    const shockParams = shockType === 'coil'
                                        ? `shockMode=coil&springRate=${suspResult.shockPsi}`
                                        : `shockPsi=${suspResult.shockPsi}`;
                                    router.push(`/(features)/dialed-in?bikeId=${selectedBikeId}&ts=${ts}&forkPsi=${suspResult.forkPsi}&forkClicks=${suspResult.rawForkClicks}&forkLsrClicks=${suspResult.rawForkLsrClicks}&forkHsrClicks=${suspResult.rawForkHsrClicks}&forkCompClicks=${suspResult.rawForkCompClicks}&forkCompLscClicks=${suspResult.rawForkCompLscClicks}&forkCompHscClicks=${suspResult.rawForkCompHscClicks}&${shockParams}&shockClicks=${suspResult.rawShockClicks}&shockLsrClicks=${suspResult.rawShockLsrClicks}&shockHsrClicks=${suspResult.rawShockHsrClicks}&shockCompClicks=${suspResult.rawShockCompClicks}&shockCompLscClicks=${suspResult.rawShockCompLscClicks}&shockCompHscClicks=${suspResult.rawShockCompHscClicks}`);
                                }}
                                variant="outline"
                                color={ACCENT}
                                fullWidth
                            />
                        </View>
                    </BPCard>
                )}

                {/* Gewicht & Bike (Shared) */}
                <BPCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('pressure_bot.weight_section')}</Text>
                    {trackerBikes.length > 0 && (
                        <BPPicker
                            label={t('pressure_bot.select_bike')}
                            options={[
                                { label: t('pressure_bot.no_bike'), value: '' },
                                ...trackerBikes.map(b => ({ label: `${b.name} (${b.model})`, value: b.id }))
                            ]}
                            value={selectedBikeId}
                            onValueChange={handleBikeChange}
                            accentColor={ACCENT}
                        />
                    )}
                    <BPSlider
                        label={t('pressure_bot.rider_weight_label')}
                        value={units.weight === 'lb' ? Math.round(riderWeight * 2.20462) : riderWeight}
                        min={units.weight === 'lb' ? 88 : 40}
                        max={units.weight === 'lb' ? 309 : 140}
                        step={1}
                        unit={units.weight === 'lb' ? ' lb' : ' kg'}
                        accentColor={ACCENT}
                        onValueChange={v => setRiderWeight(units.weight === 'lb' ? Math.round(v / 2.20462) : v)}
                    />
                    <BPSlider label={t('pressure_bot.bike_weight_label') + (selectedBikeId ? ' (Auto)' : '')} value={bikeWeight} min={8} max={30} step={0.5} unit=" kg" accentColor={ACCENT} onValueChange={setBikeWeight} disabled={!!selectedBikeId} />
                </BPCard>

                {/* Reifen */}
                {activeTab === 'tires' && (
                    <BPCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{t('pressure_bot.tire_section')}</Text>
                        <BPPicker label={t('pressure_bot.wheel_size_label')} options={wheelOptions} value={wheelSize} onValueChange={setWheelSize} accentColor={ACCENT} />
                        <BPPicker label={t('pressure_bot.tire_width_label')} options={tireWidthOptions} value={tireWidth} onValueChange={setTireWidth} accentColor={ACCENT} />
                        <BPPicker label={t('pressure_bot.tire_type_label')} options={tireTypeOptions} value={tireType} onValueChange={setTireType} accentColor={ACCENT} />
                        <BPPicker label={t('pressure_bot.casing_label')} options={casingOptions} value={casing} onValueChange={setCasing} accentColor={ACCENT} />
                        <BPPicker label={t('pressure_bot.setup_label')} options={setupOptions} value={setup} onValueChange={setSetup} accentColor={ACCENT} />
                    </BPCard>
                )}

                {/* Fahrwerk */}
                {activeTab === 'suspension' && (
                    <BPCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{t('pressure_bot.susp_type_section')}</Text>
                        <BPPicker label={t('pressure_bot.shock_type_label')} options={[{label: t('pressure_bot.type_air'), value:'air'}, {label: t('pressure_bot.type_coil'), value:'coil'}]} value={shockType} onValueChange={setShockType} accentColor={ACCENT} />
                        {shockType === 'coil' && (
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <BPInput label={t('pressure_bot.travel_mm')} value={rearTravel} onChangeText={setRearTravel} keyboardType="numeric" containerStyle={{flex:1}} accentColor={ACCENT} />
                                <BPInput label={t('pressure_bot.stroke_mm')} value={shockStroke} onChangeText={setShockStroke} keyboardType="numeric" containerStyle={{flex:1}} accentColor={ACCENT} />
                            </View>
                        )}
                    </BPCard>
                )}

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
    scrollContent: { ...screenContentStyle, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
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
