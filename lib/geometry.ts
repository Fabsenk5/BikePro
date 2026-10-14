/**
 * Geometry & Fit — contact point math, discipline references and symptom advice.
 *
 * All values in millimetres unless noted. The model is transparent and
 * test-guarded by the scenario matrix in geometry.scenarios.test.ts; whenever
 * formulas or reference bands change, that matrix must stay plausible.
 *
 * Sign conventions (BB-relative):
 * - barX/handX: horizontal distance ahead of the bottom bracket
 * - barY/handY: vertical distance above the bottom bracket
 * - saddleX: negative = saddle nose behind the BB (setback)
 * - saddleToBarDrop: positive = bar centre below the saddle top
 */

export const GRIP_INSET_MM = 40; // half hand width — grips sit inboard of the bar ends

export interface GeometryFrame {
    stack?: number;
    reach?: number;
    headAngle?: number;
    seatAngle?: number;
    chainstay?: number;
    wheelbase?: number;
    bbDrop?: number;
    seatTube?: number;
    /** head tube length (Steuerrohr) — used for the fork/crown sketch */
    headTube?: number;
    size?: string;
    wheelSize?: string;
}

export interface GeometryCockpit {
    barRise?: number;
    backsweep?: number;
    upsweep?: number;
    barWidth?: number;
    stemLength?: number;
    /**
     * Stem angle in degrees, relative to horizontal (0 = level stem,
     * positive = rise, negative = drop) — NOT relative to the steerer tube.
     */
    stemAngle?: number;
    /**
     * Spacer stack below the stem (mm), measured along the steerer tube.
     * The model projects it: vertical += spacers·sin(headAngle),
     * horizontal −= spacers·cos(headAngle) (bar moves rearward).
     */
    spacers?: number;
    /**
     * Crank length (mm). Sketch-only: the front-view leg sketch uses it as a
     * fallback; the contact-point model ignores it.
     */
    crankLength?: number;
    /** dropper post travel (Hub) in mm — overrides the tracker value */
    dropperTravel?: number;
    /** seatpost exposed above the seat tube (collar + pull-out) up to the hub */
    seatpostExposed?: number;
}

export interface GeometryFit {
    /**
     * BB centre → saddle top, measured DIRECTLY along the seat tube (mm) —
     * the easy tape measurement; the model projects it to the vertical.
     */
    saddleHeight?: number;
    /** saddle nose behind the vertical through the BB, positive = setback */
    saddleSetback?: number;
}

export interface GeometryMeasured {
    barX?: number;
    barY?: number;
    seatedReach?: number;
    /** saddle nose → grip centre, measured directly (point to point) */
    saddleToHand?: number;
    saddleToBarDrop?: number;
    bbHeight?: number;
    /**
     * Reserved: sagged bar height with rider on the bike. Parsed and kept,
     * but not consumed by the contact-point model yet.
     */
    riderBarY?: number;
    /**
     * Reserved: sagged saddle height with rider on the bike. Parsed and kept,
     * but not consumed by the contact-point model yet.
     */
    riderSaddleHeight?: number;
}

export interface BikeGeometry {
    frame?: GeometryFrame;
    cockpit?: GeometryCockpit;
    fit?: GeometryFit;
    measured?: GeometryMeasured;
    meta?: { source?: string; notes?: string };
}

// ─── Sanitizing (form/JSONB → stored shape) ───
//
// Absurd values are dropped to undefined (not clamped, not an error):
// - lengths: 0–3000 mm
// - angles: 0–180°
// - fit.saddleHeight (along-tube): 400–1100 mm
// - cockpit.crankLength: 100–220 mm

type NumRange = readonly [number, number];
const LENGTH: NumRange = [0, 3000];
const ANGLE: NumRange = [0, 180];

const FRAME_RANGES: Record<keyof Omit<GeometryFrame, 'size' | 'wheelSize'>, NumRange> = {
    stack: LENGTH,
    reach: LENGTH,
    headAngle: ANGLE,
    seatAngle: ANGLE,
    chainstay: LENGTH,
    wheelbase: LENGTH,
    bbDrop: LENGTH,
    seatTube: LENGTH,
    headTube: LENGTH,
};
const COCKPIT_RANGES: Record<keyof GeometryCockpit, NumRange> = {
    barRise: LENGTH,
    backsweep: ANGLE,
    upsweep: ANGLE,
    barWidth: LENGTH,
    stemLength: LENGTH,
    stemAngle: ANGLE,
    spacers: LENGTH,
    crankLength: [100, 220],
    dropperTravel: LENGTH,
    seatpostExposed: LENGTH,
};
const FIT_RANGES: Record<keyof GeometryFit, NumRange> = {
    saddleHeight: [400, 1100],
    saddleSetback: LENGTH,
};
const MEASURED_RANGES: Record<keyof GeometryMeasured, NumRange> = {
    barX: LENGTH,
    barY: LENGTH,
    seatedReach: LENGTH,
    saddleToHand: LENGTH,
    saddleToBarDrop: LENGTH,
    bbHeight: LENGTH,
    riderBarY: LENGTH,
    riderSaddleHeight: LENGTH,
};

const FRAME_NUMBERS = Object.keys(FRAME_RANGES) as (keyof typeof FRAME_RANGES)[];
const COCKPIT_NUMBERS = Object.keys(COCKPIT_RANGES) as (keyof typeof COCKPIT_RANGES)[];
const FIT_NUMBERS = Object.keys(FIT_RANGES) as (keyof typeof FIT_RANGES)[];
const MEASURED_NUMBERS = Object.keys(MEASURED_RANGES) as (keyof typeof MEASURED_RANGES)[];

const toNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

const toString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const s = value.trim();
    return s ? s : undefined;
};

/** Parse a number and drop it when outside its plausible range. */
const toRangedNumber = (value: unknown, range: NumRange): number | undefined => {
    const n = toNumber(value);
    if (n === undefined) return undefined;
    const [min, max] = range;
    return n >= min && n <= max ? n : undefined;
};

export function sanitizeGeometry(raw: unknown): BikeGeometry | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const input = raw as Record<string, any>;
    const out: BikeGeometry = {};

    const frameInput = input.frame ?? {};
    const frame: GeometryFrame = {};
    for (const key of FRAME_NUMBERS) {
        const value = toRangedNumber(frameInput[key], FRAME_RANGES[key]);
        if (value !== undefined) (frame as any)[key] = value;
    }
    const size = toString(frameInput.size);
    const wheelSize = toString(frameInput.wheelSize);
    if (size) frame.size = size;
    if (wheelSize) frame.wheelSize = wheelSize;
    if (Object.keys(frame).length > 0) out.frame = frame;

    const cockpitInput = input.cockpit ?? {};
    const cockpit: GeometryCockpit = {};
    for (const key of COCKPIT_NUMBERS) {
        const value = toRangedNumber(cockpitInput[key], COCKPIT_RANGES[key]);
        if (value !== undefined) (cockpit as any)[key] = value;
    }
    if (Object.keys(cockpit).length > 0) out.cockpit = cockpit;

    const fitInput = input.fit ?? {};
    const fit: GeometryFit = {};
    for (const key of FIT_NUMBERS) {
        const value = toRangedNumber(fitInput[key], FIT_RANGES[key]);
        if (value !== undefined) (fit as any)[key] = value;
    }
    if (Object.keys(fit).length > 0) out.fit = fit;

    const measuredInput = input.measured ?? {};
    const measured: GeometryMeasured = {};
    for (const key of MEASURED_NUMBERS) {
        const value = toRangedNumber(measuredInput[key], MEASURED_RANGES[key]);
        if (value !== undefined) (measured as any)[key] = value;
    }
    if (Object.keys(measured).length > 0) out.measured = measured;

    const source = toString(input.meta?.source);
    const notes = toString(input.meta?.notes);
    if (source || notes) out.meta = { ...(source ? { source } : {}), ...(notes ? { notes } : {}) };

    return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Contact geometry ───

export interface ContactGeometry {
    barX: number | null;
    barY: number | null;
    handX: number | null;
    handY: number | null;
    rad: number | null;
    saddleX: number | null;
    saddleY: number | null;
    saddleToBarDrop: number | null;
    seatedReach: number | null;
    saddleToHand: number | null;
}

const deg = (value: number) => (value * Math.PI) / 180;

export function computeContactGeometry(geo: BikeGeometry): ContactGeometry {
    const frame = geo.frame ?? {};
    const cockpit = geo.cockpit ?? {};
    const fit = geo.fit ?? {};
    const measured = geo.measured ?? {};

    // stemAngle is relative to horizontal (0 = level, positive = rise).
    const stemLength = cockpit.stemLength ?? null;
    const stemAngle = cockpit.stemAngle ?? 0;
    const spacers = cockpit.spacers ?? 0;

    // Spacer tower runs along the steerer tube: it lifts the bar by
    // spacers·sin(headAngle) and pulls it rearward by spacers·cos(headAngle).
    // Without a head angle the tower cannot be projected — fall back to the
    // legacy vertical stack so bare frame data keeps working.
    const headAngle = frame.headAngle ?? null;
    const spacerLift = headAngle != null ? spacers * Math.sin(deg(headAngle)) : spacers;
    const spacerPullback = headAngle != null ? spacers * Math.cos(deg(headAngle)) : 0;

    let barX: number | null = measured.barX ?? null;
    if (barX === null && frame.reach != null && stemLength != null) {
        barX = frame.reach + stemLength * Math.cos(deg(stemAngle)) - spacerPullback;
    }
    let barY: number | null = measured.barY ?? null;
    if (barY === null && frame.stack != null) {
        barY = frame.stack
            + spacerLift
            + (stemLength != null ? stemLength * Math.sin(deg(stemAngle)) : 0)
            + (cockpit.barRise ?? 0);
    }

    // Without a bar width the grip position is unknown — no center fallback,
    // so RAD stays unknown instead of silently measuring to the bar centre.
    const hasWidth = cockpit.barWidth != null;
    const sweepSpan = hasWidth ? Math.max(0, cockpit.barWidth! / 2 - GRIP_INSET_MM) : 0;
    const handX = barX != null && hasWidth ? barX - sweepSpan * Math.sin(deg(cockpit.backsweep ?? 0)) : null;
    const handY = barY != null && hasWidth ? barY + sweepSpan * Math.sin(deg(cockpit.upsweep ?? 0)) : null;

    // Saddle height is stored along the seat tube (tape along the tube, LeMond
    // 0.883 convention) → project to the BB-vertical with ×sin(seatAngle).
    // Default 75° keeps bare frames computable.
    const seatAngle = frame.seatAngle ?? 75;
    const saddleY = fit.saddleHeight != null ? fit.saddleHeight * Math.sin(deg(seatAngle)) : null;
    const saddleX = fit.saddleSetback != null ? -fit.saddleSetback : null;

    const computedDrop = saddleY != null && barY != null ? saddleY - barY : null;
    const saddleToBarDrop = measured.saddleToBarDrop ?? computedDrop;

    const computedSeatedReach = handX != null && saddleX != null ? handX - saddleX : null;
    const seatedReach = measured.seatedReach ?? computedSeatedReach;

    const computedSaddleToHand = handX != null && handY != null && saddleX != null && saddleY != null
        ? Math.hypot(handX - saddleX, handY - saddleY)
        : null;
    const saddleToHand = measured.saddleToHand ?? computedSaddleToHand;

    return {
        barX,
        barY,
        handX,
        handY,
        rad: handX != null && handY != null ? Math.hypot(handX, handY) : null,
        saddleX,
        saddleY,
        saddleToBarDrop,
        seatedReach,
        saddleToHand,
    };
}

/**
 * Remove measured values that match the computed model (within tolerance) so
 * the model keeps tracking frame/cockpit changes. Only real tape deviations
 * persist as overrides.
 *
 * NOTE for callers: `auto` must be computed from the RAW user-entered model
 * (no assumed/default-filled display values). Comparing tape measurements
 * against an assumed-filled model would erase real deviations — or keep
 * assumed values as fake overrides. The caller owns that distinction; this
 * function only compares numbers. (Caller change is handled outside this
 * module.)
 */
export function stripComputedMeasured(
    measured: GeometryMeasured | undefined,
    auto: {
        barX?: number | null;
        barY?: number | null;
        seatedReach?: number | null;
        saddleToHand?: number | null;
        saddleToBarDrop?: number | null;
        bbHeight?: number | null;
    },
    tolerance = 1,
): GeometryMeasured | undefined {
    if (!measured) return undefined;
    const out: GeometryMeasured = { ...measured };
    const same = (value: number | undefined, reference: number | null | undefined) =>
        value != null && reference != null && Math.abs(value - reference) <= tolerance;
    if (same(out.barX, auto.barX)) delete out.barX;
    if (same(out.barY, auto.barY)) delete out.barY;
    if (same(out.seatedReach, auto.seatedReach)) delete out.seatedReach;
    if (same(out.saddleToHand, auto.saddleToHand)) delete out.saddleToHand;
    if (same(out.saddleToBarDrop, auto.saddleToBarDrop)) delete out.saddleToBarDrop;
    if (same(out.bbHeight, auto.bbHeight)) delete out.bbHeight;
    return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Discipline references (heuristic bands, test-guarded) ───

export type Discipline = 'tour' | 'trail' | 'enduro' | 'dh' | 'bikepark';

export interface ReferenceBand {
    min: number;
    max: number;
}

export interface DisciplineReference {
    /** saddle top → bar centre, positive = bar below saddle */
    saddleToBarDrop: ReferenceBand;
    stemLength: ReferenceBand;
    barRise: ReferenceBand;
    barWidth: ReferenceBand;
    /** RAD / inseam ratio */
    radRatio: ReferenceBand;
}

export const DISCIPLINE_REFERENCES: Record<Discipline, DisciplineReference> = {
    tour: {
        saddleToBarDrop: { min: 0, max: 40 },
        stemLength: { min: 50, max: 90 },
        barRise: { min: 10, max: 30 },
        barWidth: { min: 740, max: 780 },
        radRatio: { min: 0.95, max: 1.05 },
    },
    trail: {
        saddleToBarDrop: { min: 10, max: 70 },
        stemLength: { min: 40, max: 60 },
        barRise: { min: 20, max: 35 },
        barWidth: { min: 760, max: 800 },
        radRatio: { min: 0.98, max: 1.08 },
    },
    enduro: {
        // modern enduro cockpits run near saddle height — the drop band
        // starts at 0 so level bar/saddle setups still score 'ok'
        saddleToBarDrop: { min: 0, max: 90 },
        stemLength: { min: 35, max: 50 },
        barRise: { min: 25, max: 40 },
        barWidth: { min: 780, max: 810 },
        radRatio: { min: 1.0, max: 1.1 },
    },
    dh: {
        saddleToBarDrop: { min: 20, max: 80 },
        stemLength: { min: 30, max: 45 },
        barRise: { min: 25, max: 50 },
        // real bars top out around 805 mm and the trend goes narrower
        // (shoulder-dependent) — 760–805 is the sensible DH window
        barWidth: { min: 760, max: 805 },
        radRatio: { min: 0.98, max: 1.08 },
    },
    bikepark: {
        // Jump/flow-oriented: compact RAD for agility on flow and jump lines
        // (vs. the longer DH race setup for steep, fast tracks)
        saddleToBarDrop: { min: 20, max: 80 },
        stemLength: { min: 30, max: 45 },
        barRise: { min: 30, max: 50 },
        barWidth: { min: 760, max: 800 },
        radRatio: { min: 0.95, max: 1.05 },
    },
};

export type CheckStatus = 'ok' | 'low' | 'high' | 'unknown';

export interface FitCheck {
    id: 'radRatio' | 'saddleToBarDrop' | 'stemLength' | 'barRise' | 'barWidth' | 'saddleHeight';
    status: CheckStatus;
    value: number | null;
    band?: ReferenceBand;
}

export interface RiderBody {
    height?: number | null;
    inseam?: number | null;
    armLength?: number | null;
    torsoLength?: number | null;
    /** shoulder width in mm (for the front-view bar-width comparison) */
    shoulderWidth?: number | null;
}

/**
 * LeMond-style saddle height target (0.883 × inseam), measured ALONG the seat
 * tube (BB centre → saddle top) — the same along-tube convention as the
 * saddle-height field, so target and value compare directly. The contact
 * model projects both to the vertical internally (×sin(seatAngle)).
 */
export function saddleHeightTarget(inseam: number): number {
    return Math.round(0.883 * inseam);
}

/** Nose-to-rail-clamp distance of a typical saddle (mm). */
const SADDLE_NOSE_OFFSET = 110;

/**
 * Assumed saddle setback (nose behind the BB) when the rider has not measured
 * it.
 *
 * @param saddleHeight along-tube value (field convention: BB → saddle top
 * along the seat tube, e.g. the LeMond target or the seatpost estimate) — NOT
 * the vertical height. The horizontal distance to the saddle top is its cosine
 * projection minus a typical saddle nose offset, clamped to a realistic band.
 */
export function assumedSaddleSetback(saddleHeight: number, seatAngle: number): number {
    const alongTube = saddleHeight * Math.cos((seatAngle * Math.PI) / 180);
    return Math.round(Math.max(20, Math.min(120, alongTube - SADDLE_NOSE_OFFSET)));
}

/**
 * Common cockpit standards per discipline — assumptions for missing tracker
 * values (gray placeholders + apply option in the cockpit tab). Rider-fit
 * dims (bar width, stem length) use typical build values per category.
 */
export interface CockpitDefaults {
    barRise: number;
    backsweep: number;
    upsweep: number;
    barWidth: number;
    stemLength: number;
    stemAngle: number;
    crankLength: number;
}

export function cockpitDefaults(bikeType?: string): CockpitDefaults {    switch (bikeType) {
        case 'xc':
            return { barRise: 15, backsweep: 9, upsweep: 5, barWidth: 740, stemLength: 70, stemAngle: 0, crankLength: 175 };
        case 'downhill':
            return { barRise: 35, backsweep: 8, upsweep: 5, barWidth: 800, stemLength: 35, stemAngle: 0, crankLength: 165 };
        case 'dirt':
            return { barRise: 40, backsweep: 8, upsweep: 5, barWidth: 780, stemLength: 40, stemAngle: 0, crankLength: 165 };
        case 'emtb':
        case 'e-mtb':
            return { barRise: 30, backsweep: 9, upsweep: 5, barWidth: 780, stemLength: 45, stemAngle: 0, crankLength: 165 };
        case 'trail':
            return { barRise: 25, backsweep: 9, upsweep: 5, barWidth: 770, stemLength: 50, stemAngle: 0, crankLength: 170 };
        case 'enduro':
        default:
            return { barRise: 30, backsweep: 9, upsweep: 5, barWidth: 780, stemLength: 40, stemAngle: 0, crankLength: 170 };
    }
}

/** Saddle clamp + saddle shell above the stanchion top (typical, mm). */
const SADDLE_STACK = 40;

/**
 * Saddle height derived from the seatpost hardware: seat tube + exposed post
 * (collar/pull-out) + dropper hub + saddle stack, measured along the seat tube
 * — same convention as the saddle-height field. Used as an assumption when the
 * rider has not measured it yet.
 */
export function seatpostSaddleHeight(
    seatTube: number | null | undefined,
    exposed: number | null | undefined,
    hub: number | null | undefined,
    // Kept for API compatibility; the hardware sum is along-tube by
    // construction, so no angle projection is needed here.
    _seatAngle: number,
): number | null {
    if (seatTube == null || exposed == null || hub == null) return null;
    return Math.round(seatTube + exposed + hub + SADDLE_STACK);
}

const bandStatus = (value: number | null | undefined, band: ReferenceBand): CheckStatus => {
    if (value == null) return 'unknown';
    if (value < band.min) return 'low';
    if (value > band.max) return 'high';
    return 'ok';
};

/**
 * Keys the caller may flag as assumed (default-filled, not measured/entered).
 * The caller builds this set from the same fill logic as the display model;
 * any fit check whose inputs contain an assumed key reports 'unknown'.
 */
export type AssumedKey =
    | 'cockpit.stemLength'
    | 'cockpit.barRise'
    | 'cockpit.barWidth'
    | 'cockpit.stemAngle'
    | 'cockpit.spacers'
    | 'fit.saddleHeight'
    | 'fit.saddleSetback'
    | 'rider.inseam';

export function evaluateFit(
    geo: BikeGeometry,
    derived: ContactGeometry,
    reference: DisciplineReference,
    rider: RiderBody,
    assumed?: Set<string>,
): FitCheck[] {
    const cockpit = geo.cockpit ?? {};
    const checks: FitCheck[] = [];
    const isAssumed = (...keys: AssumedKey[]) => keys.some(k => assumed?.has(k));
    // Unknown when assumed: the value is a placeholder, not a measurement.
    // Value + band are still reported so the UI can show the placeholder.
    const guarded = (id: FitCheck['id'], value: number | null, band: ReferenceBand | undefined, keys: AssumedKey[]): FitCheck => ({
        id,
        status: isAssumed(...keys) ? 'unknown' : band ? bandStatus(value, band) : 'unknown',
        value,
        ...(band ? { band } : {}),
    });

    const radRatio = derived.rad != null && rider.inseam ? derived.rad / rider.inseam : null;
    // RAD runs through the hand position: bar width, stem, spacers and rise
    // all feed it, plus the inseam denominator.
    checks.push(guarded('radRatio', radRatio, reference.radRatio,
        ['rider.inseam', 'cockpit.barWidth', 'cockpit.stemLength', 'cockpit.stemAngle', 'cockpit.spacers', 'cockpit.barRise']));

    // Drop runs through saddle height (along-tube) and the bar-height path.
    checks.push(guarded('saddleToBarDrop', derived.saddleToBarDrop, reference.saddleToBarDrop,
        ['fit.saddleHeight', 'cockpit.spacers', 'cockpit.stemAngle', 'cockpit.stemLength', 'cockpit.barRise']));
    checks.push(guarded('stemLength', cockpit.stemLength ?? null, reference.stemLength, ['cockpit.stemLength']));
    checks.push(guarded('barRise', cockpit.barRise ?? null, reference.barRise, ['cockpit.barRise']));
    checks.push(guarded('barWidth', cockpit.barWidth ?? null, reference.barWidth, ['cockpit.barWidth']));

    const saddleTarget = rider.inseam ? saddleHeightTarget(rider.inseam) : null;
    const saddleValue = geo.fit?.saddleHeight ?? null;
    let saddleStatus: CheckStatus = 'unknown';
    if (saddleValue != null && saddleTarget != null) {
        if (saddleValue < saddleTarget - 10) saddleStatus = 'low';
        else if (saddleValue > saddleTarget + 10) saddleStatus = 'high';
        else saddleStatus = 'ok';
    }
    if (isAssumed('fit.saddleHeight', 'rider.inseam')) saddleStatus = 'unknown';
    checks.push({
        id: 'saddleHeight',
        status: saddleStatus,
        value: saddleValue,
        band: saddleTarget != null ? { min: saddleTarget - 10, max: saddleTarget + 10 } : undefined,
    });

    // NOTE: 'fit.saddleSetback' is accepted but flips no check — no band
    // check consumes setback today (seatedReach/saddleToHand are reported,
    // not judged). Kept in the key union for forward compatibility.

    return checks;
}

// ─── Symptom advice ───
//
// The symptom engine only guards: advice that makes no sense for the current
// build is withheld (empty list) instead of inventing alternatives.

export type SymptomId =
    | 'too_long'
    | 'too_short'
    | 'hand_pressure'
    | 'bar_too_high'
    | 'no_pop'
    | 'knee_front'
    | 'neck_back'
    | 'unsafe_descending';

export const SYMPTOMS: SymptomId[] = [
    'too_long', 'too_short', 'hand_pressure', 'bar_too_high',
    'no_pop', 'knee_front', 'neck_back', 'unsafe_descending',
];

export interface Advice {
    /** i18n key under geometry.advice_* */
    key: string;
    params?: Record<string, string | number>;
}

/**
 * Highest bar-rise ceiling across all discipline bands. recommendForSymptoms
 * has no discipline context, so "rise over band" means: above every band —
 * unambiguously high regardless of discipline.
 */
const MAX_RISE_CEILING = Math.max(...Object.values(DISCIPLINE_REFERENCES).map(r => r.barRise.max));

export function recommendForSymptoms(
    symptoms: SymptomId[],
    geo: BikeGeometry,
    derived: ContactGeometry,
    rider: RiderBody,
): Record<SymptomId, Advice[]> {
    const result = {} as Record<SymptomId, Advice[]>;
    const target = rider.inseam ? saddleHeightTarget(rider.inseam) : null;
    const rad = derived.rad != null ? Math.round(derived.rad) : null;

    for (const symptom of symptoms) {
        switch (symptom) {
            case 'too_long': {
                // Guard: with a stubby stem (≤ 35 mm) there is nothing left
                // to sensibly shorten — withhold instead of advising.
                const stem = geo.cockpit?.stemLength;
                result[symptom] = stem == null || stem > 35
                    ? [
                        { key: 'geometry.advice_shorter_stem', params: { mm: '10–20' } },
                        { key: 'geometry.advice_more_backsweep' },
                        { key: 'geometry.advice_saddle_forward', params: { mm: '5–10' } },
                    ]
                    : [];
                break;
            }
            case 'too_short':
                result[symptom] = [
                    { key: 'geometry.advice_longer_stem', params: { mm: '10–20' } },
                    { key: 'geometry.advice_saddle_back', params: { mm: '5–10' } },
                    // Conflict: a longer stem fights descending safety — the
                    // unsafe_descending advice below is kept as-is (safety
                    // wins) and the conflict is noted here. Fits the Advice
                    // type (key-only entry); the locale string is owned by
                    // the UI layer.
                    ...(symptoms.includes('unsafe_descending')
                        ? [{ key: 'geometry.advice_conflict_short_unsafe' }]
                        : []),
                ];
                break;
            case 'hand_pressure':
                result[symptom] = [
                    { key: 'geometry.advice_more_spacers', params: { mm: '10–20' } },
                    { key: 'geometry.advice_higher_rise_bar', params: { mm: '20–30' } },
                    { key: 'geometry.advice_shorter_stem', params: { mm: '10' } },
                ];
                break;
            case 'bar_too_high': {
                // Guard: lowering advice is only actionable when spacers can
                // come out or the rise is over every discipline band.
                const spacers = geo.cockpit?.spacers ?? 0;
                const rise = geo.cockpit?.barRise;
                const lowerable = spacers > 0 || (rise != null && rise > MAX_RISE_CEILING);
                result[symptom] = lowerable
                    ? [
                        { key: 'geometry.advice_fewer_spacers', params: { mm: '10–20' } },
                        { key: 'geometry.advice_lower_rise_bar', params: { mm: '10–20' } },
                    ]
                    : [];
                break;
            }
            case 'no_pop':
                result[symptom] = [
                    { key: 'geometry.advice_shorter_stem', params: { mm: '10–20' } },
                    { key: 'geometry.advice_higher_bar', params: { mm: '10–20' } },
                    ...(rad != null ? [{ key: 'geometry.advice_check_rad', params: { rad } }] : []),
                ];
                break;
            case 'knee_front':
                result[symptom] = [
                    ...(target != null ? [{ key: 'geometry.advice_raise_saddle', params: { target } }] : []),
                    { key: 'geometry.advice_saddle_steps', params: { mm: '5' } },
                ];
                break;
            case 'neck_back':
                result[symptom] = [
                    { key: 'geometry.advice_higher_bar', params: { mm: '20–30' } },
                    { key: 'geometry.advice_shorter_stem', params: { mm: '10–20' } },
                ];
                break;
            case 'unsafe_descending':
                result[symptom] = [
                    { key: 'geometry.advice_higher_bar', params: { mm: '10–20' } },
                    { key: 'geometry.advice_wider_bar' },
                    { key: 'geometry.advice_shorter_stem', params: { mm: '10' } },
                ];
                break;
        }
    }
    return result;
}
