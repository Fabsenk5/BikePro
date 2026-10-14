import { describe, expect, it } from 'vitest';
import {
    computeContactGeometry,
    evaluateFit,
    DISCIPLINE_REFERENCES,
    recommendForSymptoms,
} from './geometry';
import { GEOMETRY_SCENARIOS } from './testScenarios';

/**
 * Geometry scenario matrix — plausibility guard for the fit model.
 * Scenario data lives in lib/testScenarios.ts (shared with the sketch tests).
 */
describe('geometry scenario matrix (plausibility guard)', () => {
    for (const s of GEOMETRY_SCENARIOS) {
        it(`${s.name} — fit checks as expected`, () => {
            const derived = computeContactGeometry(s.geo);
            const checks = evaluateFit(s.geo, derived, DISCIPLINE_REFERENCES[s.discipline], s.rider, new Set(s.assumed ?? []));
            for (const [id, expected] of Object.entries(s.expected)) {
                const check = checks.find(c => c.id === id);
                expect(check, `${s.name}: missing check ${id}`).toBeDefined();
                expect(check!.status, `${s.name}: ${id}`).toBe(expected);
            }
        });
    }

    it('keeps derived values in sane ranges and relationships', () => {
        for (const s of GEOMETRY_SCENARIOS) {
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
        const enduro = GEOMETRY_SCENARIOS[2];
        const derived = computeContactGeometry(enduro.geo);
        const advice = recommendForSymptoms(
            ['too_long', 'unsafe_descending'],
            enduro.geo,
            derived,
            enduro.rider,
        );
        expect(advice.too_long[0].key).toBe('geometry.advice_shorter_stem');
        expect(advice.unsafe_descending.map(a => a.key)).toContain('geometry.advice_higher_bar');
    });
});
