import { describe, expect, it } from 'vitest';
import {
    BikeGeometry,
    computeContactGeometry,
    Discipline,
    evaluateFit,
    DISCIPLINE_REFERENCES,
    recommendForSymptoms,
    RiderBody,
} from './geometry';

/**
 * Geometry scenario matrix — plausibility guard for the fit model.
 *
 * Realistic bikes with rider body data; each scenario declares the expected
 * fit-check statuses against its discipline reference. Extend the matrix when
 * formulas or bands change instead of loosening expectations.
 */
interface Scenario {
    name: string;
    geo: BikeGeometry;
    rider: RiderBody;
    discipline: Discipline;
    expected: Partial<Record<string, 'ok' | 'low' | 'high' | 'unknown'>>;
}

const SCENARIOS: Scenario[] = [
    {
        name: 'XC/Tour · 175 cm · 81 cm inseam',
        geo: {
            frame: { reach: 450, stack: 600 },
            cockpit: { stemLength: 70, stemAngle: 0, spacers: 20, barRise: 15, barWidth: 760, backsweep: 8, upsweep: 5 },
            fit: { saddleHeight: 715, saddleSetback: 55 },
        },
        rider: { height: 1750, inseam: 810 },
        discipline: 'tour',
        // an XC race setup is too low for touring — the tool should say so
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'high', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Trail · 178 cm · 83 cm inseam',
        geo: {
            frame: { reach: 460, stack: 625 },
            cockpit: { stemLength: 50, stemAngle: 0, spacers: 20, barRise: 25, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 733, saddleSetback: 60 },
        },
        rider: { height: 1780, inseam: 830 },
        discipline: 'trail',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Enduro · 180 cm · 84 cm inseam',
        geo: {
            frame: { reach: 480, stack: 630 },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 60 },
        },
        rider: { height: 1800, inseam: 840 },
        discipline: 'enduro',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'DH/Freeride · 180 cm · 84 cm inseam',
        geo: {
            frame: { reach: 460, stack: 620 },
            cockpit: { stemLength: 35, stemAngle: 0, spacers: 10, barRise: 35, barWidth: 800, backsweep: 8, upsweep: 5 },
            fit: { saddleHeight: 741, saddleSetback: 50 },
        },
        rider: { height: 1800, inseam: 840 },
        discipline: 'dh',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'Mullet Enduro · 168 cm · 78 cm inseam',
        geo: {
            frame: { reach: 470, stack: 625 },
            cockpit: { stemLength: 40, stemAngle: 0, spacers: 20, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 695, saddleSetback: 55 },
        },
        rider: { height: 1680, inseam: 780 },
        discipline: 'enduro',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
    {
        name: 'E-Bike Trail · 182 cm · 86 cm inseam',
        geo: {
            frame: { reach: 480, stack: 640 },
            cockpit: { stemLength: 45, stemAngle: 0, spacers: 25, barRise: 30, barWidth: 800, backsweep: 9, upsweep: 5 },
            fit: { saddleHeight: 759, saddleSetback: 60 },
        },
        rider: { height: 1820, inseam: 860 },
        discipline: 'trail',
        expected: { radRatio: 'ok', saddleHeight: 'ok', saddleToBarDrop: 'ok', stemLength: 'ok', barRise: 'ok', barWidth: 'ok' },
    },
];

describe('geometry scenario matrix (plausibility guard)', () => {
    for (const s of SCENARIOS) {
        it(`${s.name} — fit checks as expected`, () => {
            const derived = computeContactGeometry(s.geo);
            const checks = evaluateFit(s.geo, derived, DISCIPLINE_REFERENCES[s.discipline], s.rider);
            for (const [id, expected] of Object.entries(s.expected)) {
                const check = checks.find(c => c.id === id);
                expect(check, `${s.name}: missing check ${id}`).toBeDefined();
                expect(check!.status, `${s.name}: ${id}`).toBe(expected);
            }
        });
    }

    it('keeps derived values in sane ranges and relationships', () => {
        for (const s of SCENARIOS) {
            const d = computeContactGeometry(s.geo);
            expect(d.barX, s.name).not.toBeNull();
            expect(d.barY, s.name).not.toBeNull();
            expect(d.rad!, s.name).toBeGreaterThan(700);
            expect(d.rad!, s.name).toBeLessThan(1000);
            expect(d.handX!, s.name).toBeLessThan(d.barX!); // backsweep pulls hands back
            expect(d.handY!, s.name).toBeGreaterThan(d.barY!); // upsweep raises hands
            expect(d.seatedReach!, s.name).toBeGreaterThan(350);
            expect(d.seatedReach!, s.name).toBeLessThan(700);
        }
    });

    it('larger frame size increases reach and RAD', () => {
        const cockpit = { stemLength: 40, stemAngle: 0, spacers: 15, barRise: 30, barWidth: 780, backsweep: 9, upsweep: 5 };
        const fit = { saddleHeight: 741, saddleSetback: 60 };
        const medium = computeContactGeometry({ frame: { reach: 470, stack: 615 }, cockpit, fit });
        const large = computeContactGeometry({ frame: { reach: 490, stack: 630 }, cockpit, fit });
        expect(large.seatedReach! - medium.seatedReach!).toBeCloseTo(20, 6);
        expect(large.rad!).toBeGreaterThan(medium.rad!);
    });

    it('produces concrete advice for the requested symptoms', () => {
        const enduro = SCENARIOS[2];
        const derived = computeContactGeometry(enduro.geo);
        const advice = recommendForSymptoms(
            ['too_long', 'unsafe_descending'],
            enduro.geo,
            derived,
            enduro.rider,
        );
        expect(advice.too_long[0].key).toBe('geometry.advice.shorter_stem');
        expect(advice.unsafe_descending.map(a => a.key)).toContain('geometry.advice.higher_bar');
    });
});
