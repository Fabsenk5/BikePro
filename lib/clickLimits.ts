/**
 * Per-channel click limits for fork/shock components.
 *
 * Components store channel-specific maxima in `clickLimits` (JSONB). The legacy
 * single `maxClicks` value still acts as fallback, then the model-based default
 * (Fox/Zeb/Öhlins detection), then a generic default. All consumers (Component
 * Tracker, Dialed-In, Pressure Bot) resolve through `resolveMaxClicks` so the
 * limits stay consistent end-to-end.
 */

export type ClickChannel =
    | 'rebound'
    | 'reboundHsr'
    | 'reboundLsr'
    | 'compression'
    | 'compressionHsc'
    | 'compressionLsc';

export const CLICK_CHANNELS: ClickChannel[] = [
    'rebound',
    'reboundHsr',
    'reboundLsr',
    'compression',
    'compressionHsc',
    'compressionLsc',
];

export interface ClickLimits {
    rebound?: number;
    reboundHsr?: number;
    reboundLsr?: number;
    compression?: number;
    compressionHsc?: number;
    compressionLsc?: number;
}

export const DEFAULT_MAX_CLICKS = 25;

/** Parse a stored value to a positive integer, or null when empty/invalid. */
export function parseClicks(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = parseInt(String(value).trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Keep only valid, positive channels (raw JSONB or form input → stored object). */
export function sanitizeClickLimits(raw: unknown): ClickLimits | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: ClickLimits = {};
    for (const channel of CLICK_CHANNELS) {
        const parsed = parseClicks((raw as Record<string, unknown>)[channel]);
        if (parsed !== null) out[channel] = parsed;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Channels that are relevant for the selected adjustment modes.
 * Unknown/undefined modes behave like the original default (simple clicks).
 */
export function channelsForModes(
    reboundMode?: string | null,
    compressionMode?: string | null,
): ClickChannel[] {
    const channels: ClickChannel[] = [];

    if (reboundMode === 'hsls') channels.push('reboundHsr', 'reboundLsr');
    else if (reboundMode !== 'none') channels.push('rebound');

    if (compressionMode === 'hsls') channels.push('compressionHsc', 'compressionLsc');
    else if (compressionMode !== 'none' && compressionMode !== 'lever') channels.push('compression');

    return channels;
}

/** Model-based fallback heuristic (kept from the former pressure-bot detection). */
export function getModelDefaultClicks(model?: string): number | null {
    if (!model) return null;
    const m = model.toLowerCase();
    if (m.includes('fox 38') || m.includes('fox 36') || m.includes('grip2') || m.includes('float x2')) return 14;
    if (m.includes('zeb') || m.includes('lyrik') || m.includes('super deluxe')) return 18;
    if (m.includes('ohlins') || m.includes('öhlins') || m.includes('ttx')) return 15;
    return null;
}

export interface ClickLimitSource {
    maxClicks?: string;
    clickLimits?: ClickLimits;
    model?: string;
    name?: string;
}

/**
 * Effective max clicks for one channel.
 * Priority: channel value → legacy maxClicks → model default → generic fallback.
 */
export function resolveMaxClicks(
    source: ClickLimitSource | undefined,
    channel: ClickChannel,
    fallback: number = DEFAULT_MAX_CLICKS,
): number {
    if (!source) return fallback;
    const specific = parseClicks(source.clickLimits?.[channel]);
    if (specific !== null) return specific;
    const legacy = parseClicks(source.maxClicks);
    if (legacy !== null) return legacy;
    const modelDefault = getModelDefaultClicks(source.model || source.name);
    if (modelDefault !== null) return modelDefault;
    return fallback;
}
