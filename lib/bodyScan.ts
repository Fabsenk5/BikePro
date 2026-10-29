/**
 * F13: Body Scan — reine Mess-Mathematik (kein UI, keine Deps).
 *
 * Alle Längen in Millimeter, alle Bildkoordinaten normalisiert (0..1).
 * Zwei Skalierungswege:
 * 1. Referenzobjekt (A4 / Kreditkarte, 4 Ecken) → Homographie entzerrt die
 *    Perspektive, danach sind euklidische Distanzen in der Referenzebene mm.
 * 2. Körpergröße als Fallback → reine Skalierung ohne Perspektivkorrektur
 *    (Konfidenz grundsätzlich niedriger).
 */

export interface NormPoint {
    x: number;
    y: number;
}

export type ReferenceType = 'a4-portrait' | 'a4-landscape' | 'card' | 'height';

/** Echte Kantenlängen der Referenzobjekte in mm. */
export const REFERENCE_DIMS_MM: Record<Exclude<ReferenceType, 'height'>, { w: number; h: number }> = {
    'a4-portrait': { w: 210, h: 297 },
    'a4-landscape': { w: 297, h: 210 },
    card: { w: 85.6, h: 53.98 },
};

export type BodyKeypointId =
    | 'crown'
    | 'shoulderL'
    | 'shoulderR'
    | 'elbowR'
    | 'wristR'
    | 'handR'
    | 'hipL'
    | 'hipR'
    | 'kneeR'
    | 'ankleR'
    | 'crotch';

export const BODY_KEYPOINT_IDS: BodyKeypointId[] = [
    'crown',
    'shoulderL',
    'shoulderR',
    'elbowR',
    'wristR',
    'handR',
    'hipL',
    'hipR',
    'kneeR',
    'ankleR',
    'crotch',
];

export type BodyPoints = Partial<Record<BodyKeypointId, NormPoint>>;

export interface BodyMeasures {
    heightMm: number | null;
    shoulderWidthMm: number | null;
    inseamMm: number | null;
    torsoMm: number | null;
    armLengthMm: number | null;
    upperArmMm: number | null;
    forearmMm: number | null;
    thighMm: number | null;
    shankMm: number | null;
}

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export type MeasureKey = keyof BodyMeasures;

export type MeasureConfidences = Record<MeasureKey, Confidence>;

// ─── Homographie (4-Punkt-Perspektivkorrektur) ───

/** 3x3-Matrix, row-major, h[8] = 1 (normiert). */
export type Homography = number[];

/**
 * Löst die Homographie Bild→mm aus 4 Ecken (Reihenfolge: TL, TR, BR, BL)
 * auf das Rechteck (0,0)-(w,h) in mm. Gibt null bei entarteter Eingabe.
 */
export function solveHomography(corners: NormPoint[], wMm: number, hMm: number): Homography | null {
    if (corners.length !== 4 || wMm <= 0 || hMm <= 0) return null;
    for (const c of corners) {
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
    }
    const dst = [
        { x: 0, y: 0 },
        { x: wMm, y: 0 },
        { x: wMm, y: hMm },
        { x: 0, y: hMm },
    ];
    // 8x8-System A·h = b (h33 = 1 fixiert)
    const a: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 4; i++) {
        const { x, y } = corners[i];
        const { x: X, y: Y } = dst[i];
        a.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
        b.push(X);
        a.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
        b.push(Y);
    }
    const h = solveLinear(a, b);
    if (!h) return null;
    return [...h, 1];
}

/** Gauß-Elimination mit Pivotisierung für n×n-Systeme. Null bei Singularität. */
function solveLinear(a: number[][], b: number[]): number[] | null {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
        }
        if (Math.abs(m[pivot][col]) < 1e-12) return null;
        if (pivot !== col) {
            const tmp = m[pivot];
            m[pivot] = m[col];
            m[col] = tmp;
        }
        const div = m[col][col];
        for (let c = col; c <= n; c++) m[col][c] /= div;
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = m[r][col];
            if (factor !== 0) {
                for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
            }
        }
    }
    return m.map(row => row[n]);
}

export function applyHomography(h: Homography, p: NormPoint): { x: number; y: number } {
    const denom = h[6] * p.x + h[7] * p.y + h[8];
    return {
        x: (h[0] * p.x + h[1] * p.y + h[2]) / denom,
        y: (h[3] * p.x + h[4] * p.y + h[5]) / denom,
    };
}

const distMmPlane = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Normierte Bildkoordinaten → seitenverhältnis-korrigierte Ebene.
 * (x ist 0..1 über die Breite, y 0..1 über die Höhe — ohne Korrektur würden
 * Distanzen bei nicht-quadratischen Bildern verzerrt.)
 */
function toAspectPlane(p: NormPoint, aspect: number): { x: number; y: number } {
    return { x: p.x * aspect, y: p.y };
}

const distNorm = (a: NormPoint, b: NormPoint, aspect: number): number => {
    const pa = toAspectPlane(a, aspect);
    const pb = toAspectPlane(b, aspect);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y);
};

const mid = (a: NormPoint, b: NormPoint): NormPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Flächenanteil des Referenz-Quads am Bild (0..1) — Basis für Konfidenz. */
export function quadAreaNorm(corners: NormPoint[]): number {
    if (corners.length !== 4) return 0;
    let sum = 0;
    for (let i = 0; i < 4; i++) {
        const p = corners[i];
        const q = corners[(i + 1) % 4];
        sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum / 2);
}

// ─── Maßberechnung ───

interface RawSegments {
    height: number | null;
    shoulder: number | null;
    inseam: number | null;
    torso: number | null;
    upperArm: number | null;
    forearm: number | null;
    hand: number | null;
    thigh: number | null;
    shank: number | null;
}

function segmentsFromMmPlane(pts: Record<BodyKeypointId, { x: number; y: number } | null>): RawSegments {
    const d = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) =>
        a && b ? distMmPlane(a, b) : null;
    const shoulderMid =
        pts.shoulderL && pts.shoulderR
            ? { x: (pts.shoulderL.x + pts.shoulderR.x) / 2, y: (pts.shoulderL.y + pts.shoulderR.y) / 2 }
            : null;
    const ankleMid =
        pts.ankleR != null
            ? pts.ankleR // Frontfoto: ein Knöchel reicht als Bodenreferenz
            : null;
    return {
        height: d(pts.crown, ankleMid),
        shoulder: d(pts.shoulderL, pts.shoulderR),
        inseam: d(pts.crotch, ankleMid),
        torso: d(shoulderMid, pts.crotch),
        upperArm: d(pts.shoulderR, pts.elbowR),
        forearm: d(pts.elbowR, pts.wristR),
        hand: d(pts.wristR, pts.handR),
        thigh: d(pts.hipR, pts.kneeR),
        shank: d(pts.kneeR, pts.ankleR),
    };
}

function segmentsFromNorm(points: BodyPoints, mmPerUnit: number, aspect: number): RawSegments {
    const get = (id: BodyKeypointId): NormPoint | null => points[id] ?? null;
    const d = (a: BodyKeypointId, b: BodyKeypointId): number | null => {
        const pa = get(a);
        const pb = get(b);
        return pa && pb ? distNorm(pa, pb, aspect) * mmPerUnit : null;
    };
    const shoulderMid = (() => {
        const l = get('shoulderL');
        const r = get('shoulderR');
        return l && r ? mid(l, r) : null;
    })();
    const dMid = (a: NormPoint | null, bId: BodyKeypointId): number | null => {
        const pb = get(bId);
        if (!a || !pb) return null;
        const pa = toAspectPlane(a, aspect);
        const q = toAspectPlane(pb, aspect);
        return Math.hypot(pa.x - q.x, pa.y - q.y) * mmPerUnit;
    };
    return {
        height: d('crown', 'ankleR'),
        shoulder: d('shoulderL', 'shoulderR'),
        inseam: d('crotch', 'ankleR'),
        torso: dMid(shoulderMid, 'crotch'),
        upperArm: d('shoulderR', 'elbowR'),
        forearm: d('elbowR', 'wristR'),
        hand: d('wristR', 'handR'),
        thigh: d('hipR', 'kneeR'),
        shank: d('kneeR', 'ankleR'),
    };
}

function toMeasures(seg: RawSegments): BodyMeasures {
    const arm =
        seg.upperArm != null && seg.forearm != null
            ? seg.upperArm + seg.forearm + (seg.hand ?? 0)
            : null;
    return {
        heightMm: seg.height != null ? Math.round(seg.height) : null,
        shoulderWidthMm: seg.shoulder != null ? Math.round(seg.shoulder) : null,
        inseamMm: seg.inseam != null ? Math.round(seg.inseam) : null,
        torsoMm: seg.torso != null ? Math.round(seg.torso) : null,
        armLengthMm: arm != null ? Math.round(arm) : null,
        upperArmMm: seg.upperArm != null ? Math.round(seg.upperArm) : null,
        forearmMm: seg.forearm != null ? Math.round(seg.forearm) : null,
        thighMm: seg.thigh != null ? Math.round(seg.thigh) : null,
        shankMm: seg.shank != null ? Math.round(seg.shank) : null,
    };
}

function confidencesFor(base: Confidence): MeasureConfidences {
    return {
        heightMm: base,
        shoulderWidthMm: base,
        inseamMm: base,
        torsoMm: base,
        armLengthMm: base,
        upperArmMm: base,
        forearmMm: base,
        thighMm: base,
        shankMm: base,
    };
}

const downgrade = (c: Confidence): Confidence =>
    c === 'high' ? 'medium' : c === 'medium' ? 'low' : c;

export interface ScanResult {
    measures: BodyMeasures;
    confidences: MeasureConfidences;
    /** true = perspektivkorrigiert (Referenz), false = reine Skalierung (Größe) */
    perspectiveCorrected: boolean;
}

/**
 * Pfad 1 (empfohlen): Referenz-Quad → Homographie → mm.
 * corners-Reihenfolge: TL, TR, BR, BL.
 */
export function computeMeasuresWithReference(
    points: BodyPoints,
    corners: NormPoint[],
    reference: Exclude<ReferenceType, 'height'>,
): ScanResult | null {
    const dims = REFERENCE_DIMS_MM[reference];
    const h = solveHomography(corners, dims.w, dims.h);
    if (!h) return null;
    const plane: Record<BodyKeypointId, { x: number; y: number } | null> = {} as Record<
        BodyKeypointId,
        { x: number; y: number } | null
    >;
    for (const id of BODY_KEYPOINT_IDS) {
        const p = points[id];
        plane[id] = p ? applyHomography(h, p) : null;
    }
    const seg = segmentsFromMmPlane(plane);
    const area = quadAreaNorm(corners);
    // Faustregel: Referenz sollte ≥ ~0,3 % der Bildfläche einnehmen, sonst
    // wird die Skala zu empfindlich gegenüber Tipp-Fehlern.
    const base: Confidence = area >= 0.01 ? 'high' : area >= 0.003 ? 'medium' : 'low';
    const confidences = confidencesFor(base);
    // Hand-Segment ist anatomisch variabel → eine Stufe schwächer.
    confidences.armLengthMm = points.handR ? downgrade(base) : downgrade(downgrade(base));
    for (const [key, value] of Object.entries(toMeasures(seg)) as [MeasureKey, number | null][]) {
        if (value == null) confidences[key] = 'unknown';
    }
    return { measures: toMeasures(seg), confidences, perspectiveCorrected: true };
}

/**
 * Pfad 2 (Fallback): bekannte Körpergröße skaliert alle Strecken.
 * Keine Perspektivkorrektur — Konfidenz grundsätzlich niedriger.
 */
export function computeMeasuresWithHeight(
    points: BodyPoints,
    heightMm: number,
    aspect: number,
): ScanResult | null {
    const crown = points.crown;
    const ankle = points.ankleR;
    if (!crown || !ankle || !(heightMm > 0) || !(aspect > 0)) return null;
    const pxHeight = distNorm(crown, ankle, aspect);
    if (pxHeight <= 1e-9) return null;
    const seg = segmentsFromNorm(points, heightMm / pxHeight, aspect);
    const confidences = confidencesFor('low');
    confidences.heightMm = 'medium'; // per Definition die Eingabe selbst
    for (const [key, value] of Object.entries(toMeasures(seg)) as [MeasureKey, number | null][]) {
        if (value == null) confidences[key] = 'unknown';
    }
    // Größe ist Eingabe, nicht Messung
    const measures = toMeasures(seg);
    measures.heightMm = Math.round(heightMm);
    return { measures, confidences, perspectiveCorrected: false };
}

// ─── Plausibilität ───

export interface MeasureWarning {
    key: MeasureKey;
    valueMm: number;
}

/** Grobe anatomische Bänder (mm) — fängt Tipp-Fehler ab, kein hartes Urteil. */
const PLAUSIBLE: Record<MeasureKey, [number, number]> = {
    heightMm: [1400, 2100],
    shoulderWidthMm: [350, 550],
    inseamMm: [650, 1100],
    torsoMm: [450, 750],
    armLengthMm: [550, 900],
    upperArmMm: [250, 420],
    forearmMm: [220, 380],
    thighMm: [350, 600],
    shankMm: [350, 600],
};

export function implausibleMeasures(measures: BodyMeasures): MeasureWarning[] {
    const out: MeasureWarning[] = [];
    for (const [key, band] of Object.entries(PLAUSIBLE) as [MeasureKey, [number, number]][]) {
        const v = measures[key];
        if (v != null && (v < band[0] || v > band[1])) out.push({ key, valueMm: v });
    }
    return out;
}

/** mm → cm-String fürs Profil (eine Nachkommastelle, z. B. "46.5"). */
export function mmToCmString(mm: number): string {
    return String(Math.round((mm / 10) * 10) / 10);
}

/**
 * Beste Werte → SyncProfile-Felder (cm-Strings). Nur plausible Werte werden
 * übernommen; der Rest bleibt undefined (Aufrufer behält alte Profilwerte).
 */
export function mapMeasuresToProfile(measures: BodyMeasures): {
    height?: string;
    inseam?: string;
    armLength?: string;
    torsoLength?: string;
    shoulderWidth?: string;
} {
    const bad = new Set(implausibleMeasures(measures).map(w => w.key));
    const pick = (key: MeasureKey): string | undefined => {
        const v = measures[key];
        if (v == null || bad.has(key)) return undefined;
        return mmToCmString(v);
    };
    const out: Record<string, string | undefined> = {
        height: pick('heightMm'),
        inseam: pick('inseamMm'),
        armLength: pick('armLengthMm'),
        torsoLength: pick('torsoMm'),
        shoulderWidth: pick('shoulderWidthMm'),
    };
    for (const k of Object.keys(out)) {
        if (out[k] === undefined) delete out[k];
    }
    return out;
}

// ─── Verlauf ───

export interface BodyScanRecord {
    id: string;
    dateISO: string;
    referenceType: ReferenceType;
    perspectiveCorrected: boolean;
    measures: BodyMeasures;
    /** Fotos bleiben grundsätzlich lokal — Records enthalten nie Bilddaten. */
    hasPhoto: false;
}

export const BODY_SCANS_KEY = '@bikepro_body_scans';
export const BODY_SCANS_PREF_KEY = 'body_scans';
export const BODY_SCANS_MAX = 10;
