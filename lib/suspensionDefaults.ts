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
