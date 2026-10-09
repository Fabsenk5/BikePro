/**
 * Suspension defaults shared by the Pressure Bot and the sag calculator widget.
 */

/** Default rear travel / shock stroke (mm) per bike type when the tracker has no values. */
export function travelStrokeDefaults(bikeType?: string): { travel: number; stroke: number } {
    switch (bikeType) {
        case 'downhill': return { travel: 200, stroke: 75 };
        case 'enduro':
        case 'emtb':
        case 'e-mtb': return { travel: 170, stroke: 65 };
        case 'trail': return { travel: 140, stroke: 57.5 };
        case 'xc': return { travel: 115, stroke: 45 };
        default: return { travel: 160, stroke: 60 };
    }
}

// ─── Target sag (shared by the Setup Guide widget) ───

export type SagCharacter = 'firm' | 'balanced' | 'comfortable';

export interface SagRange {
    min: number;
    max: number;
}

/** Target sag in % per character — canonical BikePro table (hart/mitte/weich). */
export const SAG_TARGETS: Record<SagCharacter, { fork: SagRange; shock: SagRange }> = {
    firm: { fork: { min: 15, max: 15 }, shock: { min: 25, max: 25 } },
    balanced: { fork: { min: 17.5, max: 17.5 }, shock: { min: 27.5, max: 27.5 } },
    comfortable: { fork: { min: 20, max: 20 }, shock: { min: 30, max: 30 } },
};

/** Convert a sag-% range into millimetres for the given travel/stroke. */
export function sagRangeMm(percentRange: SagRange, suspensionMm: number): SagRange {
    const toMm = (p: number) => Math.round(suspensionMm * p) / 100;
    return { min: toMm(percentRange.min), max: toMm(percentRange.max) };
}
