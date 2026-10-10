import { describe, expect, it } from 'vitest';
import { calculateTirePressure, TirePressureParams } from './tirePressure';

/**
 * Scenario matrix — plausibility guard for the tire pressure model.
 *
 * Ten realistic rider/bike/terrain combinations with expected pressure ranges.
 * Whenever the model is adjusted, these scenarios must stay plausible; extend
 * the matrix instead of loosening ranges. Values in bar.
 */
interface Scenario {
    name: string;
    params: TirePressureParams;
    front: [number, number];
    rear: [number, number];
}

const SCENARIOS: Scenario[] = [
    {
        name: 'XC Race · 65 kg · 29" · 2.2 · light · hardpack',
        params: { riderWeight: 65, bikeWeight: 11, wheelSize: '29', tireWidth: '2.2', setup: 'tubeless', terrain: 'hardpack', weather: 'dry', tireType: 'xc', casing: 'light', ridingStyle: 'normal' },
        front: [1.45, 1.65], rear: [1.65, 1.85],
    },
    {
        name: 'Trail · 78 kg · 29" · 2.4 · flow',
        params: { riderWeight: 78, bikeWeight: 14, wheelSize: '29', tireWidth: '2.4', setup: 'tubeless', terrain: 'flow', weather: 'dry', tireType: 'trail', casing: 'standard', ridingStyle: 'normal' },
        front: [1.45, 1.6], rear: [1.7, 1.9],
    },
    {
        name: 'Enduro technisch · 85 kg · 29" · 2.4 · roots+rocks · damp',
        params: { riderWeight: 85, bikeWeight: 15, wheelSize: '29', tireWidth: '2.4', setup: 'tubeless', terrain: 'roots_rocks', weather: 'damp', tireType: 'enduro', casing: 'reinforced', ridingStyle: 'aggressive' },
        front: [1.45, 1.65], rear: [1.7, 1.9],
    },
    {
        name: 'Bikepark DH · 85 kg · mullet · 2.5 · DH casing · aggressiv',
        params: { riderWeight: 85, bikeWeight: 16.5, wheelSize: 'mullet', tireWidth: '2.5', setup: 'tubeless', terrain: 'bikepark', weather: 'dry', tireType: 'dh', casing: 'dh', ridingStyle: 'aggressive' },
        front: [1.6, 1.8], rear: [1.85, 2.1],
    },
    {
        name: 'Street/Tricks · 85 kg · mullet · 2.5 · DH casing · aggressiv',
        params: { riderWeight: 85, bikeWeight: 16.5, wheelSize: 'mullet', tireWidth: '2.5', setup: 'tubeless', terrain: 'street', weather: 'dry', tireType: 'dh', casing: 'dh', ridingStyle: 'aggressive' },
        front: [1.65, 1.85], rear: [1.9, 2.15],
    },
    {
        name: 'Mud/Wet Enduro · 80 kg · 27.5" · 2.5 · DH casing · normal',
        params: { riderWeight: 80, bikeWeight: 15, wheelSize: '27.5', tireWidth: '2.5', setup: 'tubeless', terrain: 'mud', weather: 'wet', tireType: 'enduro', casing: 'dh', ridingStyle: 'normal' },
        front: [1.25, 1.4], rear: [1.5, 1.65],
    },
    {
        name: 'E-Bike Trail · 90 kg + 24 kg · 29" · 2.6 · flow',
        params: { riderWeight: 90, bikeWeight: 24, wheelSize: '29', tireWidth: '2.6', setup: 'tubeless', terrain: 'flow', weather: 'dry', tireType: 'trail', casing: 'reinforced', ridingStyle: 'normal' },
        front: [1.55, 1.75], rear: [1.8, 2.05],
    },
    {
        name: 'Leichtes Trail-Setup · 60 kg · 27.5" · 2.4 · chill',
        params: { riderWeight: 60, bikeWeight: 13, wheelSize: '27.5', tireWidth: '2.4', setup: 'tubeless', terrain: 'hardpack', weather: 'dry', tireType: 'trail', casing: 'standard', ridingStyle: 'chill' },
        front: [1.15, 1.35], rear: [1.4, 1.6],
    },
    {
        name: 'DH Race · 75 kg · 29" · 2.5 · rocky · race',
        params: { riderWeight: 75, bikeWeight: 17, wheelSize: '29', tireWidth: '2.5', setup: 'tubeless', terrain: 'rocky', weather: 'dry', tireType: 'dh', casing: 'dh', ridingStyle: 'race' },
        front: [1.45, 1.7], rear: [1.7, 1.95],
    },
    {
        name: 'Bikepark Einsteiger · 70 kg · 27.5" · 2.4 · Schlauch (Butyl)',
        params: { riderWeight: 70, bikeWeight: 16, wheelSize: '27.5', tireWidth: '2.4', setup: 'tube_butyl', terrain: 'hardpack', weather: 'dry', tireType: 'enduro', casing: 'standard', ridingStyle: 'normal' },
        front: [1.6, 1.8], rear: [1.85, 2.1],
    },
];

describe('tire pressure scenario matrix (plausibility guard)', () => {
    for (const s of SCENARIOS) {
        it(`${s.name} → ${s.front[0]}–${s.front[1]} / ${s.rear[0]}–${s.rear[1]} bar`, () => {
            const r = calculateTirePressure(s.params);
            expect(r.front, `${s.name}: front`).toBeGreaterThanOrEqual(s.front[0]);
            expect(r.front, `${s.name}: front`).toBeLessThanOrEqual(s.front[1]);
            expect(r.rear, `${s.name}: rear`).toBeGreaterThanOrEqual(s.rear[0]);
            expect(r.rear, `${s.name}: rear`).toBeLessThanOrEqual(s.rear[1]);
        });
    }

    it('keeps global invariants across all scenarios', () => {
        for (const s of SCENARIOS) {
            const r = calculateTirePressure(s.params);
            expect(r.rear, s.name).toBeGreaterThan(r.front);
            expect(Math.abs(r.front * 20 - Math.round(r.front * 20)), s.name).toBeLessThan(1e-9);
            expect(Math.abs(r.rear * 20 - Math.round(r.rear * 20)), s.name).toBeLessThan(1e-9);
            expect(r.front).toBeGreaterThanOrEqual(0.8);
            expect(r.rear).toBeLessThanOrEqual(3.5);
            for (const note of r.notes) {
                expect(note.startsWith('pressure_bot.'), `${s.name}: ${note}`).toBe(true);
            }
        }
    });

    it('never drops below the safety floor for heavy systems on technical terrain', () => {
        // 101 kg system without insert: below ~1.4 bar front risks burping and rim strikes
        for (const s of SCENARIOS) {
            const total = s.params.riderWeight + s.params.bikeWeight;
            const technical = ['roots', 'roots_rocks', 'rocky'].includes(s.params.terrain);
            if (total >= 95 && technical && s.params.setup !== 'insert') {
                const r = calculateTirePressure(s.params);
                expect(r.front, s.name).toBeGreaterThanOrEqual(1.4);
                expect(r.rear, s.name).toBeGreaterThanOrEqual(1.6);
            }
        }
    });
});
