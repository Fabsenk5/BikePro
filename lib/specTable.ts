/**
 * Manufacturer recommendation tables, stored per fork/shock component
 * (`components.spec_table`) and maintained in the Component Tracker.
 *
 * Every value is optional. Click values may be single values or ranges exactly
 * as printed in the manual ("8" or "5-6") — the raw string is preserved, the
 * numeric helpers below parse it for lookup/apply without losing information.
 */

export interface SpecRow {
    id: string;
    weightMin?: number;
    weightMax?: number;
    /** "80" or "78-82" */
    psi?: string;
    /** clicks from closed: "10" or "5-6" */
    lsc?: string;
    hsc?: string;
    lsr?: string;
    hsr?: string;
}

export interface NumericRange {
    min: number;
    max: number;
}

export interface ResolvedSpecRow {
    row: SpecRow;
    /** true when the weight only matched the nearest range, not an exact one */
    fallback: boolean;
}

const rowId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Parse "8", "5-6", "5 – 6" or numbers into a numeric range. */
export function parseNumericRange(value: unknown): NumericRange | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? { min: value, max: value } : null;
    }
    const s = String(value).trim();
    if (!s) return null;
    const rangeMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
    if (rangeMatch) {
        const a = parseFloat(rangeMatch[1].replace(',', '.'));
        const b = parseFloat(rangeMatch[2].replace(',', '.'));
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const single = parseFloat(s.replace(',', '.'));
    if (!Number.isFinite(single)) return null;
    return { min: single, max: single };
}

/** Display helper: "5–6" or "80". Returns the raw value when unparseable. */
export function formatRange(value?: string): string {
    const r = parseNumericRange(value);
    if (!r) return value ?? '';
    return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

/** Midpoint for "apply" actions (ranges → rounded middle), or null. */
export function midpoint(value?: string): number | null {
    const r = parseNumericRange(value);
    if (!r) return null;
    return Math.round((r.min + r.max) / 2);
}

/** Keep rows with at least one value; trim strings, parse weights. */
export function sanitizeSpecTable(raw: unknown): SpecRow[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const num = (v: unknown): number | undefined => {
        if (v === null || v === undefined || v === '') return undefined;
        const n = parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
    };
    const str = (v: unknown): string | undefined => {
        if (typeof v === 'number') return String(v);
        if (typeof v !== 'string') return undefined;
        const s = v.trim();
        return s ? s : undefined;
    };

    const rows: SpecRow[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const r = entry as Record<string, unknown>;
        const row: SpecRow = { id: str(r.id) ?? rowId() };
        const weightMin = num(r.weightMin);
        const weightMax = num(r.weightMax);
        if (weightMin !== undefined) row.weightMin = weightMin;
        if (weightMax !== undefined) row.weightMax = weightMax;
        for (const key of ['psi', 'lsc', 'hsc', 'lsr', 'hsr'] as const) {
            const value = str(r[key]);
            if (value) row[key] = value;
        }
        const hasContent = row.weightMin !== undefined || row.weightMax !== undefined
            || !!row.psi || !!row.lsc || !!row.hsc || !!row.lsr || !!row.hsr;
        if (hasContent) rows.push(row);
    }
    return rows.length > 0 ? rows : undefined;
}

/**
 * Match a weight to the best row:
 * 1) explicit range containing the weight (narrowest wins)
 * 2) row without weight bounds (applies to all weights)
 * 3) nearest range (fallback flag)
 * Returns null for an empty table or an unbound weight.
 */
export function resolveSpecRow(
    rows: SpecRow[] | undefined,
    weightKg: number | null | undefined,
): ResolvedSpecRow | null {
    if (!rows || rows.length === 0) return null;
    const hasWeight = weightKg !== null && weightKg !== undefined;

    const withBounds = rows.filter(r => r.weightMin !== undefined || r.weightMax !== undefined);
    if (hasWeight) {
        const matches = withBounds.filter(r =>
            (weightKg as number) >= (r.weightMin ?? -Infinity)
            && (weightKg as number) <= (r.weightMax ?? Infinity));
        if (matches.length > 0) {
            const width = (r: SpecRow) => (r.weightMax ?? Infinity) - (r.weightMin ?? -Infinity);
            matches.sort((a, b) => width(a) - width(b));
            return { row: matches[0], fallback: false };
        }
    }

    const universal = rows.find(r => r.weightMin === undefined && r.weightMax === undefined);
    if (universal) return { row: universal, fallback: false };

    if (!hasWeight || withBounds.length === 0) return null;

    let best: SpecRow | null = null;
    let bestDistance = Infinity;
    for (const r of withBounds) {
        const min = r.weightMin ?? -Infinity;
        const max = r.weightMax ?? Infinity;
        const distance = (weightKg as number) < min
            ? min - (weightKg as number)
            : (weightKg as number) > max
                ? (weightKg as number) - max
                : 0;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = r;
        }
    }
    return best ? { row: best, fallback: bestDistance > 0 } : null;
}

/** Human-readable summary for tooltips/cards: "80 psi · LSR 10 · HSR 6". */
export function formatSpecSummary(row: SpecRow): string {
    const parts: string[] = [];
    if (row.psi) parts.push(`${formatRange(row.psi)} psi`);
    if (row.lsr) parts.push(`LSR ${formatRange(row.lsr)}`);
    if (row.hsr) parts.push(`HSR ${formatRange(row.hsr)}`);
    if (row.lsc) parts.push(`LSC ${formatRange(row.lsc)}`);
    if (row.hsc) parts.push(`HSC ${formatRange(row.hsc)}`);
    return parts.join(' · ');
}
