import { describe, expect, it } from 'vitest';
import {
    BODY_KEYPOINT_IDS,
    computeMeasuresWithHeight,
    computeMeasuresWithReference,
    implausibleMeasures,
    mapMeasuresToProfile,
    mmToCmString,
    quadAreaNorm,
    solveHomography,
    type BodyPoints,
    type NormPoint,
} from './bodyScan';

/** Synthetik: Referenz füllt das halbe Bild, Person daneben — alles achsparallel. */
const corners: NormPoint[] = [
    { x: 0.05, y: 0.1 },
    { x: 0.26, y: 0.1 },
    { x: 0.26, y: 0.4 },
    { x: 0.05, y: 0.4 },
];

/** A4-Portrait (210×297): Bei achsparallelem Quad ist 1 px-Breite = 1000 mm. */
const points: BodyPoints = {
    // Person zwischen x=0.5 und x=0.71: Schulterbreite = 0.21 norm = 210 mm * ... (s. Test)
    crown: { x: 0.6, y: 0.05 },
    shoulderL: { x: 0.5, y: 0.2 },
    shoulderR: { x: 0.7, y: 0.2 },
    elbowR: { x: 0.72, y: 0.35 },
    wristR: { x: 0.7, y: 0.48 },
    handR: { x: 0.7, y: 0.53 },
    hipL: { x: 0.55, y: 0.55 },
    hipR: { x: 0.65, y: 0.55 },
    kneeR: { x: 0.65, y: 0.7 },
    ankleR: { x: 0.65, y: 0.9 },
    crotch: { x: 0.6, y: 0.55 },
};

describe('solveHomography', () => {
    it('mappt die Ecken exakt auf das Referenz-Rechteck', () => {
        const h = solveHomography(corners, 210, 297);
        expect(h).not.toBeNull();
        // Einheitsquadrat als Identitäts-Check
        const unit: NormPoint[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
        ];
        const hi = solveHomography(unit, 210, 297)!;
        expect(hi[0]).toBeCloseTo(210, 6);
        expect(hi[4]).toBeCloseTo(297, 6);
        expect(hi[2]).toBeCloseTo(0, 6);
        expect(hi[5]).toBeCloseTo(0, 6);
    });

    it('gibt null bei entarteter Eingabe zurück', () => {
        expect(solveHomography(corners.slice(0, 3), 210, 297)).toBeNull();
        // kollineare Punkte (alle auf einer Linie) → singulär
        const line: NormPoint[] = [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.1 },
            { x: 0.3, y: 0.1 },
            { x: 0.4, y: 0.1 },
        ];
        expect(solveHomography(line, 210, 297)).toBeNull();
    });
});

describe('quadAreaNorm', () => {
    it('misst den Flächenanteil (0.21 * 0.3 = 0.063)', () => {
        expect(quadAreaNorm(corners)).toBeCloseTo(0.063, 6);
    });
});

describe('computeMeasuresWithReference', () => {
    it('rechnet achsparallele Strecken in mm um (A4: 1000 mm pro norm. Einheit)', () => {
        const res = computeMeasuresWithReference(points, corners, 'a4-portrait');
        expect(res).not.toBeNull();
        // norm. Breite 0.21 → 0.21 * 1000 = 210 mm? Quad-Breite 0.21 ≙ 210 mm.
        expect(res!.measures.shoulderWidthMm).toBe(200);
        expect(res!.perspectiveCorrected).toBe(true);
        expect(res!.confidences.shoulderWidthMm).toBe('high');
    });

    it('Arm-Summe stimmt: Ober + Unter + Hand = Gesamt', () => {
        const res = computeMeasuresWithReference(points, corners, 'a4-portrait')!;
        const m = res.measures;
        expect(m.armLengthMm).toBe((m.upperArmMm ?? 0) + (m.forearmMm ?? 0) + 50);
    });

    it('fehlende Punkte ergeben null + unknown-Konfidenz', () => {
        const sparse: BodyPoints = { crown: points.crown, ankleR: points.ankleR };
        const res = computeMeasuresWithReference(sparse, corners, 'a4-portrait')!;
        expect(res.measures.heightMm).not.toBeNull();
        expect(res.measures.shoulderWidthMm).toBeNull();
        expect(res.confidences.shoulderWidthMm).toBe('unknown');
    });

    it('kleine Referenz senkt die Konfidenz', () => {
        const tiny: NormPoint[] = [
            { x: 0.05, y: 0.1 },
            { x: 0.07, y: 0.1 },
            { x: 0.07, y: 0.12 },
            { x: 0.05, y: 0.12 },
        ];
        const res = computeMeasuresWithReference(points, tiny, 'a4-portrait')!;
        expect(res.confidences.heightMm).toBe('low');
    });
});

describe('computeMeasuresWithHeight', () => {
    it('skaliert über die Körpergröße (keine Perspektivkorrektur)', () => {
        // crown→ankle: dx=0.05, dy=0.85 bei aspect 1 → ~0.8515 Einheiten ≙ 1800 mm
        const res = computeMeasuresWithHeight(points, 1800, 1);
        expect(res).not.toBeNull();
        expect(res!.perspectiveCorrected).toBe(false);
        expect(res!.measures.heightMm).toBe(1800);
        expect(res!.confidences.heightMm).toBe('medium');
        // Schulter 0.2 Einheiten → 0.2 / 0.8515 * 1800 ≈ 423 mm
        expect(res!.measures.shoulderWidthMm).toBe(423);
    });

    it('gibt null bei fehlenden Pflichtpunkten zurück', () => {
        expect(computeMeasuresWithHeight({}, 1800, 1)).toBeNull();
        expect(computeMeasuresWithHeight(points, 0, 1)).toBeNull();
    });
});

describe('implausibleMeasures + mapMeasuresToProfile', () => {
    it('markiert absurde Werte', () => {
        const bad = implausibleMeasures({
            heightMm: 3000,
            shoulderWidthMm: 460,
            inseamMm: 860,
            torsoMm: 600,
            armLengthMm: 620,
            upperArmMm: 300,
            forearmMm: 260,
            thighMm: 450,
            shankMm: 450,
        });
        expect(bad.map(w => w.key)).toEqual(['heightMm']);
    });

    it('mappt nur plausible Werte ins Profil (cm-Strings)', () => {
        expect(mmToCmString(465)).toBe('46.5');
        const mapped = mapMeasuresToProfile({
            heightMm: 1820,
            shoulderWidthMm: 460,
            inseamMm: 860,
            torsoMm: 600,
            armLengthMm: 620,
            upperArmMm: 300,
            forearmMm: 260,
            thighMm: 450,
            shankMm: 450,
        });
        expect(mapped).toEqual({
            height: '182',
            inseam: '86',
            armLength: '62',
            torsoLength: '60',
            shoulderWidth: '46',
        });
        // absurd → ausgelassen, Rest bleibt
        const partial = mapMeasuresToProfile({
            heightMm: 3000,
            shoulderWidthMm: null,
            inseamMm: 860,
            torsoMm: null,
            armLengthMm: null,
            upperArmMm: null,
            forearmMm: null,
            thighMm: null,
            shankMm: null,
        });
        expect(partial).toEqual({ inseam: '86' });
    });

    it('alle Keypoint-IDs sind eindeutig', () => {
        expect(new Set(BODY_KEYPOINT_IDS).size).toBe(BODY_KEYPOINT_IDS.length);
    });
});
