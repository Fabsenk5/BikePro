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
    size?: string;
    wheelSize?: string;
}

export interface GeometryCockpit {
    barRise?: number;
    backsweep?: number;
    upsweep?: number;
    barWidth?: number;
    stemLength?: number;
    stemAngle?: number;
    spacers?: number;
    crankLength?: number;
}

export interface GeometryFit {
    /** vertical BB centre → saddle top */
    saddleHeight?: number;
    /** saddle nose behind the BB, positive = setback */
    saddleSetback?: number;
}

export interface GeometryMeasured {
    barX?: number;
    barY?: number;
    seatedReach?: number;
    saddleToBarDrop?: number;
    bbHeight?: number;
    /** optional: measured with rider on the bike (sagged) */
    riderBarY?: number;
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

const FRAME_NUMBERS: (keyof GeometryFrame)[] = [
    'stack', 'reach', 'headAngle', 'seatAngle', 'chainstay', 'wheelbase', 'bbDrop', 'seatTube',
];
const COCKPIT_NUMBERS: (keyof GeometryCockpit)[] = [
    'barRise', 'backsweep', 'upsweep', 'barWidth', 'stemLength', 'stemAngle', 'spacers', 'crankLength',
];
const FIT_NUMBERS: (keyof GeometryFit)[] = ['saddleHeight', 'saddleSetback'];
const MEASURED_NUMBERS: (keyof GeometryMeasured)[] = [
    'barX', 'barY', 'seatedReach', 'saddleToBarDrop', 'bbHeight', 'riderBarY', 'riderSaddleHeight',
];

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

export function sanitizeGeometry(raw: unknown): BikeGeometry | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const input = raw as Record<string, any>;
    const out: BikeGeometry = {};

    const frameInput = input.frame ?? {};
    const frame: GeometryFrame = {};
    for (const key of FRAME_NUMBERS) {
        const value = toNumber(frameInput[key]);
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
        const value = toNumber(cockpitInput[key]);
        if (value !== undefined) (cockpit as any)[key] = value;
    }
    if (Object.keys(cockpit).length > 0) out.cockpit = cockpit;

    const fitInput = input.fit ?? {};
    const fit: GeometryFit = {};
    for (const key of FIT_NUMBERS) {
        const value = toNumber(fitInput[key]);
        if (value !== undefined) (fit as any)[key] = value;
    }
    if (Object.keys(fit).length > 0) out.fit = fit;

    const measuredInput = input.measured ?? {};
    const measured: GeometryMeasured = {};
    for (const key of MEASURED_NUMBERS) {
        const value = toNumber(measuredInput[key]);
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

    const stemLength = cockpit.stemLength ?? null;
    const stemAngle = cockpit.stemAngle ?? 0;

    let barX: number | null = measured.barX ?? null;
    if (barX === null && frame.reach != null && stemLength != null) {
        barX = frame.reach + stemLength * Math.cos(deg(stemAngle));
    }
    let barY: number | null = measured.barY ?? null;
    if (barY === null && frame.stack != null) {
        barY = frame.stack
            + (cockpit.spacers ?? 0)
            + (stemLength != null ? stemLength * Math.sin(deg(stemAngle)) : 0)
            + (cockpit.barRise ?? 0);
    }

    const sweepSpan = cockpit.barWidth != null ? Math.max(0, cockpit.barWidth / 2 - GRIP_INSET_MM) : 0;
    const handX = barX != null ? barX - sweepSpan * Math.sin(deg(cockpit.backsweep ?? 0)) : null;
    const handY = barY != null ? barY + sweepSpan * Math.sin(deg(cockpit.upsweep ?? 0)) : null;

    const saddleY = fit.saddleHeight ?? null;
    const saddleX = fit.saddleSetback != null ? -fit.saddleSetback : null;

    const computedDrop = saddleY != null && barY != null ? saddleY - barY : null;
    const saddleToBarDrop = measured.saddleToBarDrop ?? computedDrop;

    const computedSeatedReach = handX != null && saddleX != null ? handX - saddleX : null;
    const seatedReach = measured.seatedReach ?? computedSeatedReach;

    const saddleToHand = handX != null && handY != null && saddleX != null && saddleY != null
        ? Math.hypot(handX - saddleX, handY - saddleY)
        : null;

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

// ─── Discipline references (heuristic bands, test-guarded) ───

export type Discipline = 'tour' | 'trail' | 'enduro' | 'dh';

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
        saddleToBarDrop: { min: 20, max: 90 },
        stemLength: { min: 35, max: 50 },
        barRise: { min: 25, max: 40 },
        barWidth: { min: 780, max: 810 },
        radRatio: { min: 1.0, max: 1.1 },
    },
    dh: {
        saddleToBarDrop: { min: 20, max: 80 },
        stemLength: { min: 30, max: 45 },
        barRise: { min: 25, max: 50 },
        barWidth: { min: 780, max: 820 },
        radRatio: { min: 0.98, max: 1.08 },
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

/** LeMond-style saddle height target (vertical BB → saddle top). */
export function saddleHeightTarget(inseam: number): number {
    return Math.round(0.883 * inseam);
}

const bandStatus = (value: number | null | undefined, band: ReferenceBand): CheckStatus => {
    if (value == null) return 'unknown';
    if (value < band.min) return 'low';
    if (value > band.max) return 'high';
    return 'ok';
};

export function evaluateFit(
    geo: BikeGeometry,
    derived: ContactGeometry,
    reference: DisciplineReference,
    rider: RiderBody,
): FitCheck[] {
    const cockpit = geo.cockpit ?? {};
    const checks: FitCheck[] = [];

    const radRatio = derived.rad != null && rider.inseam ? derived.rad / rider.inseam : null;
    checks.push({ id: 'radRatio', status: bandStatus(radRatio, reference.radRatio), value: radRatio, band: reference.radRatio });

    checks.push({
        id: 'saddleToBarDrop',
        status: bandStatus(derived.saddleToBarDrop, reference.saddleToBarDrop),
        value: derived.saddleToBarDrop,
        band: reference.saddleToBarDrop,
    });
    checks.push({ id: 'stemLength', status: bandStatus(cockpit.stemLength, reference.stemLength), value: cockpit.stemLength ?? null, band: reference.stemLength });
    checks.push({ id: 'barRise', status: bandStatus(cockpit.barRise, reference.barRise), value: cockpit.barRise ?? null, band: reference.barRise });
    checks.push({ id: 'barWidth', status: bandStatus(cockpit.barWidth, reference.barWidth), value: cockpit.barWidth ?? null, band: reference.barWidth });

    const saddleTarget = rider.inseam ? saddleHeightTarget(rider.inseam) : null;
    const saddleValue = geo.fit?.saddleHeight ?? null;
    let saddleStatus: CheckStatus = 'unknown';
    if (saddleValue != null && saddleTarget != null) {
        if (saddleValue < saddleTarget - 10) saddleStatus = 'low';
        else if (saddleValue > saddleTarget + 10) saddleStatus = 'high';
        else saddleStatus = 'ok';
    }
    checks.push({
        id: 'saddleHeight',
        status: saddleStatus,
        value: saddleValue,
        band: saddleTarget != null ? { min: saddleTarget - 10, max: saddleTarget + 10 } : undefined,
    });

    return checks;
}

// ─── Symptom advice ───

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
    /** i18n key under geometry.advice.* */
    key: string;
    params?: Record<string, string | number>;
}

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
            case 'too_long':
                result[symptom] = [
                    { key: 'geometry.advice.shorter_stem', params: { mm: '10–20' } },
                    { key: 'geometry.advice.more_backsweep' },
                    { key: 'geometry.advice.saddle_forward', params: { mm: '5–10' } },
                ];
                break;
            case 'too_short':
                result[symptom] = [
                    { key: 'geometry.advice.longer_stem', params: { mm: '10–20' } },
                    { key: 'geometry.advice.saddle_back', params: { mm: '5–10' } },
                ];
                break;
            case 'hand_pressure':
                result[symptom] = [
                    { key: 'geometry.advice.more_spacers', params: { mm: '10–20' } },
                    { key: 'geometry.advice.higher_rise_bar', params: { mm: '20–30' } },
                    { key: 'geometry.advice.shorter_stem', params: { mm: '10' } },
                ];
                break;
            case 'bar_too_high':
                result[symptom] = [
                    { key: 'geometry.advice.fewer_spacers', params: { mm: '10–20' } },
                    { key: 'geometry.advice.lower_rise_bar', params: { mm: '10–20' } },
                ];
                break;
            case 'no_pop':
                result[symptom] = [
                    { key: 'geometry.advice.shorter_stem', params: { mm: '10–20' } },
                    { key: 'geometry.advice.higher_bar', params: { mm: '10–20' } },
                    ...(rad != null ? [{ key: 'geometry.advice.check_rad', params: { rad } }] : []),
                ];
                break;
            case 'knee_front':
                result[symptom] = [
                    ...(target != null ? [{ key: 'geometry.advice.raise_saddle', params: { target } }] : []),
                    { key: 'geometry.advice.saddle_steps', params: { mm: '5' } },
                ];
                break;
            case 'neck_back':
                result[symptom] = [
                    { key: 'geometry.advice.higher_bar', params: { mm: '20–30' } },
                    { key: 'geometry.advice.shorter_stem', params: { mm: '10–20' } },
                ];
                break;
            case 'unsafe_descending':
                result[symptom] = [
                    { key: 'geometry.advice.higher_bar', params: { mm: '10–20' } },
                    { key: 'geometry.advice.wider_bar' },
                    { key: 'geometry.advice.shorter_stem', params: { mm: '10' } },
                ];
                break;
        }
    }
    return result;
}
