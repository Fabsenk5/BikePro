/**
 * Tire pressure calculator (heuristic, DACH trail/enduro/DH focus).
 *
 * Returns front/rear pressure in bar plus i18n keys for the info notes.
 * The model starts from system weight and adjusts for tire width, wheel size,
 * mounting, tire type, casing, riding style, terrain and weather.
 *
 * Calibration anchors (85 kg rider, 2.5" DH casing, tubeless, mullet):
 * - bikepark/jump lines, aggressive: ~1.70/2.00 bar
 * - street/tricks, aggressive:        ~1.75/2.05 bar
 * - technical roots+rocks, damp:      ~1.45/1.65 bar (never below ~1.4 bar
 *   with a heavy system — burping/casing risk)
 * Support-oriented terrain adds pressure; technical/weather deductions are
 * capped in magnitude so they cannot stack into unsafe lows.
 */

export interface TirePressureParams {
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
}

export interface TirePressureResult {
    front: number;
    rear: number;
    /** i18n keys for the info notes (translated by the screen) */
    notes: string[];
}

const WIDTH_FACTOR: Record<string, number> = {
    '2.0': 0.15, '2.2': 0.08, '2.3': 0.04, '2.35': 0.02,
    '2.4': 0, '2.5': -0.03, '2.6': -0.08, '2.8': -0.15,
};

const SETUP_ADJ: Record<string, number> = {
    tubeless: 0, tube_butyl: 0.15, tube_latex: 0.1, insert: -0.1,
};

const TYPE_ADJ: Record<string, number> = {
    xc: 0.05, trail: 0.03, enduro: 0, dh: 0, mud: -0.05,
};

// Stable casings allow a touch less pressure for grip, but the effect is small —
// they must not cancel out the support needed for hard, fast riding.
const CASING_ADJ: Record<string, number> = {
    light: 0.08, standard: 0, reinforced: -0.02, dh: -0.02, doubledown: -0.03,
};

const STYLE_ADJ: Record<string, number> = {
    chill: -0.08, normal: 0, aggressive: 0.1, race: 0.2,
};

// Support-oriented terrain (jumps, berms, landings) needs MORE pressure,
// technical natural terrain a little less for mechanical grip.
const TERRAIN_ADJ: Record<string, { f: number; r: number }> = {
    hardpack: { f: 0.03, r: 0.03 },
    roots: { f: -0.02, r: -0.02 },
    roots_rocks: { f: -0.04, r: -0.03 },
    mud: { f: -0.08, r: -0.08 },
    alpine: { f: 0.05, r: 0.05 },
    bikepark: { f: 0.1, r: 0.2 },
    flow: { f: 0.05, r: 0.1 },
    // Street/trick sessions: hard surface, high side loads, missed landings —
    // the highest support for pop, stable landings and casing protection.
    street: { f: 0.15, r: 0.25 },
    rocky: { f: -0.05, r: -0.05 },
    loose: { f: -0.03, r: -0.03 },
};

const WEATHER_ADJ: Record<string, number> = {
    dry: 0, damp: -0.03, wet: -0.07, cold: 0.05, hot: -0.03,
};

/** Rear carries more load than the front. */
const REAR_OFFSET = 0.24;

const clamp = (value: number) => Math.max(0.8, Math.min(3.5, Math.round(value * 20) / 20));

export function calculateTirePressure(params: TirePressureParams): TirePressureResult {
    const totalWeight = params.riderWeight + params.bikeWeight;
    const notes: string[] = [];

    let baseFront = 1.15 + (totalWeight - 60) * 0.009;
    let baseRear = baseFront + REAR_OFFSET;

    const wAdj = WIDTH_FACTOR[params.tireWidth] ?? 0;
    baseFront += wAdj;
    baseRear += wAdj;

    if (params.wheelSize === '29') {
        baseFront += 0.03; baseRear += 0.03;
    } else if (params.wheelSize === '26') {
        baseFront -= 0.03; baseRear -= 0.03;
    } else if (params.wheelSize === 'mullet') {
        baseFront += 0.03; baseRear -= 0.02;
        notes.push('pressure_bot.note_mullet');
    }

    const setupAdj = SETUP_ADJ[params.setup] ?? 0;
    baseFront += setupAdj;
    baseRear += setupAdj;
    if (params.setup === 'insert') {
        notes.push('pressure_bot.note_insert');
    }

    const typeAdj = TYPE_ADJ[params.tireType] ?? 0;
    baseFront += typeAdj;
    baseRear += typeAdj;

    const casingAdj = CASING_ADJ[params.casing] ?? 0;
    baseFront += casingAdj;
    baseRear += casingAdj;
    if (params.casing === 'dh' || params.casing === 'doubledown') {
        notes.push('pressure_bot.note_casing_dh');
    }

    const styleAdj = STYLE_ADJ[params.ridingStyle] ?? 0;
    baseFront += styleAdj;
    baseRear += styleAdj;

    const tAdj = TERRAIN_ADJ[params.terrain] ?? { f: 0, r: 0 };
    baseFront += tAdj.f;
    baseRear += tAdj.r;

    const weatherAdj = WEATHER_ADJ[params.weather] ?? 0;
    baseFront += weatherAdj;
    baseRear += weatherAdj;

    if (params.weather === 'wet') {
        notes.push('pressure_bot.note_wet');
    }
    if (params.weather === 'cold') {
        notes.push('pressure_bot.note_cold');
    }
    if (params.terrain === 'bikepark' || params.terrain === 'flow') {
        notes.push('pressure_bot.note_support');
    }
    if (params.terrain === 'street') {
        notes.push('pressure_bot.note_street');
    }

    return { front: clamp(baseFront), rear: clamp(baseRear), notes };
}
