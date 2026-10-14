/**
 * Shared test scenarios — single source of truth for the plausibility matrices
 * (geometry fit checks, bike sketch validation). Test data only; not used by
 * the app runtime.
 */
import { AssumedKey, BikeGeometry, Discipline, RiderBody } from './geometry';

export interface GeometryScenario {
    name: string;
    geo: BikeGeometry;
    rider: RiderBody;
    discipline: Discipline;
    expected: Partial<Record<string, 'ok' | 'low' | 'high' | 'unknown'>>;
    /** inputs the caller flags as assumed (default-filled, not measured) */
    assumed?: AssumedKey[];
}

export const GEOMETRY_SCENARIOS: GeometryScenario[] = [
    {
        name: 'XC/Tour · 175 cm · 81 cm inseam',
        geo: {
            frame: { reach: 450, stack: 600, chainstay: 435, wheelbase: 1130, bbDrop: 65, headAngle: 68, seatAngle: 74, seatTube: 440, wheelSize: '29' },
            cockpit: { stemLength: 70, stemAngle: 0, spacers: 20, barRise: 15, barWidth: 760, backsweep: 8, upsweep: 5 },
            fit: { saddleHeight: 715, saddleSetback: 55 },
        },
        rider: { height: 1750, inseam: 810, shoulderWidth: 440 },
        discipline: 'tour',
        // an XC race setup is too low for touring — the tool should say so
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'high', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Trail · 178 cm · 83 cm inseam',
        geo: {
            frame: { reach: 460, stack: 625, chainstay: 440, wheelbase: 1190, bbDrop: 35, headAngle: 66, seatAngle: 76, seatTube: 445, wheelSize: '29' },
            cockpit: { stemLength: 50, stemAngle: 0, spacers: 20, barRise: 25, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 733, saddleSetback: 60 },
        },
        rider: { height: 1780, inseam: 830, shoulderWidth: 455 },
        discipline: 'trail',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Enduro · 180 cm · 84 cm inseam',
        geo: {
            frame: { reach: 480, stack: 630, chainstay: 442, wheelbase: 1230, bbDrop: 30, headAngle: 64.5, seatAngle: 77, seatTube: 450, wheelSize: '29' },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 60 },
        },
        rider: { height: 1800, inseam: 840, shoulderWidth: 460 },
        discipline: 'enduro',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'DH/Freeride · 180 cm · 84 cm inseam',
        geo: {
            // reach 465 keeps RAD mid-band now that the spacer tower pulls
            // the bar rearward along the steerer (spacers·cos(headAngle))
            frame: { reach: 465, stack: 620, chainstay: 445, wheelbase: 1250, bbDrop: 10, headAngle: 63, seatAngle: 75, seatTube: 430, wheelSize: '29' },
            cockpit: { stemLength: 35, stemAngle: 0, spacers: 10, barRise: 35, barWidth: 800, backsweep: 8, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 50 },
        },
        rider: { height: 1800, inseam: 840, shoulderWidth: 470 },
        discipline: 'dh',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Mullet Enduro · 168 cm · 78 cm inseam',
        geo: {
            frame: { reach: 470, stack: 625, chainstay: 438, wheelbase: 1225, bbDrop: 23, headAngle: 64, seatAngle: 77.5, seatTube: 425, wheelSize: 'mullet' },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 20, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 695, saddleSetback: 55 },
        },
        rider: { height: 1680, inseam: 780, shoulderWidth: 430 },
        discipline: 'enduro',
        // bar sits near saddle height (high stack + rise) — inside the
        // enduro band since its min is 0
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'E-Bike Trail · 182 cm · 86 cm inseam',
        geo: {
            frame: { reach: 480, stack: 640, chainstay: 450, wheelbase: 1245, bbDrop: 32, headAngle: 65.5, seatAngle: 76.5, seatTube: 460, wheelSize: '29' },
            cockpit: { stemLength: 45, stemAngle: 0, spacers: 25, barRise: 30, barWidth: 800, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 759, saddleSetback: 60 },
        },
        rider: { height: 1820, inseam: 860, shoulderWidth: 465 },
        discipline: 'trail',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Enduro · 186 cm · 88 cm inseam (tall rider, stock size)',
        geo: {
            frame: { reach: 480, stack: 630, chainstay: 442, wheelbase: 1230, bbDrop: 30, headAngle: 64.5, seatAngle: 77, seatTube: 450, wheelSize: '29' },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 60 },
        },
        rider: { height: 1860, inseam: 880, shoulderWidth: 470 },
        discipline: 'enduro',
        // stock size is too small for the inseam: RAD below band, saddle
        // below the LeMond target — cockpit itself is in band
        expected: { radRatio: 'low', saddleHeight: 'low', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Enduro · 60-mm-Vorbau (high stem)',
        geo: {
            frame: { reach: 480, stack: 630, chainstay: 442, wheelbase: 1230, bbDrop: 30, headAngle: 64.5, seatAngle: 77, seatTube: 450, wheelSize: '29' },
            cockpit: { stemLength: 60, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 60 },
        },
        rider: { height: 1800, inseam: 840, shoulderWidth: 460 },
        discipline: 'enduro',
        // only the stem is over the enduro band (35–50); drop is unchanged
        // (0° stem) and RAD stays in band
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'high', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Enduro · ohne Inseam (unknown-Pfad)',
        geo: {
            frame: { reach: 480, stack: 630, chainstay: 442, wheelbase: 1230, bbDrop: 30, headAngle: 64.5, seatAngle: 77, seatTube: 450, wheelSize: '29' },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 60 },
        },
        rider: { height: 1800 },
        discipline: 'enduro',
        assumed: ['rider.inseam'],
        // without inseam the ratio and the saddle target are unknown; the
        // taped build itself still scores
        expected: { radRatio: 'unknown', saddleHeight: 'unknown', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'XC/Tour · Tape-Override barY +15 mm',
        geo: {
            frame: { reach: 450, stack: 600, chainstay: 435, wheelbase: 1130, bbDrop: 65, headAngle: 68, seatAngle: 74, seatTube: 440, wheelSize: '29' },
            cockpit: { stemLength: 70, stemAngle: 0, spacers: 20, barRise: 15, barWidth: 760, backsweep: 8, upsweep: 5 },
            fit: { saddleHeight: 715, saddleSetback: 55 },
            // taped 15 mm above the model (riser bar / high clamp): the tape
            // wins, so the drop falls back into the tour band
            measured: { barY: 649 },
        },
        rider: { height: 1750, inseam: 810, shoulderWidth: 440 },
        discipline: 'tour',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
];
