import { describe, expect, it } from 'vitest';
import { calculateTirePressure, TirePressureParams } from './tirePressure';

/** The reported case: 85 kg rider, 16.5 kg bike, mullet, 2.5" DH casing, tubeless, dry, aggressive */
const dhBase: TirePressureParams = {
    riderWeight: 85,
    bikeWeight: 16.5,
    wheelSize: 'mullet',
    tireWidth: '2.5',
    setup: 'tubeless',
    terrain: 'bikepark',
    weather: 'dry',
    tireType: 'dh',
    casing: 'dh',
    ridingStyle: 'aggressive',
};

describe('calculateTirePressure', () => {
    it('recommends supportive pressures for bikepark/jump lines (DH setup)', () => {
        const r = calculateTirePressure(dhBase);
        expect(r.front).toBeGreaterThanOrEqual(1.6);
        expect(r.front).toBeLessThanOrEqual(1.75);
        expect(r.rear).toBeGreaterThanOrEqual(1.85);
        expect(r.rear).toBeLessThanOrEqual(2.05);
        expect(r.notes).toContain('pressure_bot.note_support');
    });

    it('keeps technical natural terrain softer but still supportive', () => {
        const r = calculateTirePressure({ ...dhBase, terrain: 'roots_rocks' });
        expect(r.front).toBeGreaterThanOrEqual(1.4);
        expect(r.front).toBeLessThanOrEqual(1.55);
        expect(r.rear).toBeGreaterThanOrEqual(1.6);
        expect(r.rear).toBeLessThanOrEqual(1.75);
        expect(r.notes).not.toContain('pressure_bot.note_support');
    });

    it('flow trails get support too (between technical and bikepark)', () => {
        const technical = calculateTirePressure({ ...dhBase, terrain: 'roots_rocks' });
        const flow = calculateTirePressure({ ...dhBase, terrain: 'flow' });
        const park = calculateTirePressure({ ...dhBase, terrain: 'bikepark' });
        expect(flow.rear).toBeGreaterThan(technical.rear);
        expect(park.rear).toBeGreaterThanOrEqual(flow.rear);
    });

    it('street/trick sessions get the highest support', () => {
        const r = calculateTirePressure({ ...dhBase, terrain: 'street' });
        expect(r.front).toBeGreaterThanOrEqual(1.65);
        expect(r.front).toBeLessThanOrEqual(1.85);
        expect(r.rear).toBeGreaterThanOrEqual(1.9);
        expect(r.rear).toBeLessThanOrEqual(2.15);
        expect(r.notes).toContain('pressure_bot.note_street');
        const park = calculateTirePressure(dhBase);
        expect(r.rear).toBeGreaterThan(park.rear);
    });

    it('scales with weight and riding style', () => {
        const light = calculateTirePressure({ ...dhBase, riderWeight: 65, ridingStyle: 'chill', terrain: 'roots' });
        const heavy = calculateTirePressure({ ...dhBase, riderWeight: 95, ridingStyle: 'race' });
        expect(heavy.front).toBeGreaterThan(light.front);
        expect(heavy.rear).toBeGreaterThan(light.rear);
    });

    it('keeps the rear above the front and clamps to sane limits', () => {
        const r = calculateTirePressure(dhBase);
        expect(r.rear).toBeGreaterThan(r.front);
        const extreme = calculateTirePressure({ ...dhBase, riderWeight: 140, bikeWeight: 30, ridingStyle: 'race' });
        expect(extreme.front).toBeLessThanOrEqual(3.5);
        expect(extreme.rear).toBeLessThanOrEqual(3.5);
        const feather = calculateTirePressure({ ...dhBase, riderWeight: 40, bikeWeight: 8, ridingStyle: 'chill', terrain: 'mud', weather: 'wet' });
        expect(feather.front).toBeGreaterThanOrEqual(0.8);
    });
});
