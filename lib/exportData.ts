/**
 * Data export helpers — CSV download (web-first) with native Share fallback.
 * Semicolon-separated + UTF-8 BOM so Excel (DE locale) opens files correctly.
 */
import { Share } from 'react-native';
import { SyncBike } from './sync';

export function csvEscape(value: unknown): string {
    let s = value === null || value === undefined ? '' : String(value);
    // Neutralize spreadsheet formula injection (OWASP): prefix values that
    // Excel/Sheets would evaluate as formulas.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: (string | number | undefined | null)[][]): string {
    return '\uFEFF' + rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
    if (typeof document !== 'undefined') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }
    // Native fallback: share sheet with the CSV content
    Share.share({ title: filename, message: content }).catch(() => {});
}

const RIDES_HEADER = ['id', 'date', 'location', 'trail', 'distance_km', 'duration_min', 'elevation_m', 'descent_m', 'max_speed_kmh', 'terrain', 'difficulty', 'bike_type', 'bike_id', 'park_id', 'setup_id', 'setup_feel', 'setup_rating', 'condition', 'mood', 'notes', 'created_at'];

export function exportRidesCsv(rides: any[]): string {
    const rows = rides.map(r => [
        r.id, r.date, r.location, r.trail ?? '', r.distanceKm ?? 0, r.durationMin ?? 0,
        r.elevationM ?? 0, r.descentM ?? 0, r.maxSpeedKmh ?? 0, r.terrain ?? '', r.difficulty ?? '',
        r.bikeType ?? '', r.bikeId ?? '', r.parkId ?? '', r.setupId ?? '', r.setupFeel ?? '',
        r.setupRating ?? 0, r.condition ?? '', r.mood ?? '', r.notes ?? '', r.createdAt ?? '',
    ]);
    return buildCsv([RIDES_HEADER, ...rows]);
}

const COMPONENTS_HEADER = ['bike', 'bike_id', 'type', 'brand', 'model', 'weight_g', 'price', 'purchase_date', 'notes', 'setup_values', 'wear_items', 'click_limits', 'spec_table', 'spec_source'];

export function exportComponentsCsv(bikes: SyncBike[]): string {
    const rows = bikes.flatMap(b =>
        b.components.map(c => [
            b.name, b.id, c.type, c.brand ?? '', c.model ?? '', c.weight ?? '',
            c.price ?? '', c.purchaseDate ?? '', c.notes ?? '',
            (c.setupValues ?? []).map(s => `${s.key}: ${s.value}${s.unit ?? ''}`).join(' | '),
            (c.wearItems ?? []).map(w => `${w.label} ${w.currentKm}/${w.serviceIntervalKm}km`).join(' | '),
            c.clickLimits ? JSON.stringify(c.clickLimits) : '',
            c.specTable ? JSON.stringify(c.specTable) : '',
            c.specSource ?? '',
        ])
    );
    return buildCsv([COMPONENTS_HEADER, ...rows]);
}

const SETUPS_HEADER = ['id', 'name', 'location', 'bike_id', 'bike_name', 'fork', 'shock', 'tires', 'tags', 'notes', 'created_at'];

export function exportSetupsCsv(setups: any[]): string {
    const rows = setups.map(s => [
        s.id, s.name ?? '', s.location ?? '', s.bikeId ?? '', s.bikeName ?? '',
        JSON.stringify(s.fork ?? {}), JSON.stringify(s.shock ?? {}), JSON.stringify(s.tires ?? {}),
        (s.tags ?? []).join(','), s.notes ?? '', s.createdAt ?? '',
    ]);
    return buildCsv([SETUPS_HEADER, ...rows]);
}
