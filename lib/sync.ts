/**
 * Sync Service — Cloud-Sync Layer für BikePro
 *
 * Modes:
 * - Authenticated (Supabase configured + user logged in): Read/write to Supabase, cache in AsyncStorage
 * - Offline: Read/write to AsyncStorage only
 *
 * Features:
 * - syncLoad: Load data from Supabase (fallback AsyncStorage)
 * - syncSave: Save data to Supabase + AsyncStorage (returns true when local AND cloud ok / offline mode)
 * - syncUpdateComponent(s): Targeted component patch (local cache + row upsert, single or batch)
 * - syncDelete: Delete from Supabase + AsyncStorage
 * - syncPreference: Save/load user preferences (favorites, tile order, etc.)
 * - syncWikiOverrides: Load/save Setup Guide admin content (wiki_overrides table)
 * - migrateLocalToCloud: One-time migration of local data on first login
 *
 * Setup-value keys: SETUP_KEY_MIGRATION maps legacy German labels
 * (Größe, Druck, Federweg, ...) to semantic keys on load.
 *
 * Dirty flags: When a cloud write fails, the affected entity IDs are stored as a
 * JSON array in `@bikepro_dirty_<storageKey>`. syncLoad* skips the cloud overwrite
 * while the set is non-empty (local data wins). A successful save removes its IDs;
 * full saves (syncSaveBikes/syncSaveTable) clear the whole set. A legacy boolean
 * flag ('true') is read conservatively as ['*'] (unknown entities, still dirty).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from './supabase';

// ─── Generic Helpers ───

/**
 * Collision-safe ID generator (time base36 + random suffix)
 */
export function newId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Check if cloud sync is available (Supabase configured + user authenticated)
 */
async function isCloudAvailable(): Promise<{ available: boolean; userId: string | null }> {
    if (!isSupabaseConfigured) return { available: false, userId: null };
    const supabase = getSupabase();
    if (!supabase) return { available: false, userId: null };

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            return { available: true, userId: session.user.id };
        }
    } catch (e) {
        console.warn('[sync] Failed to get session:', e);
    }
    return { available: false, userId: null };
}

// ─── Dirty Flags (unsynced local changes, per entity ID) ───

const dirtyKey = (storageKey: string) => `@bikepro_dirty_${storageKey}`;

/**
 * Read the dirty ID set. Legacy boolean flags ('true') migrate conservatively
 * to ['*'] — we don't know which entities failed, so the key stays dirty until
 * a full save (syncSaveBikes/syncSaveTable) clears it.
 */
async function readDirtySet(storageKey: string): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(dirtyKey(storageKey));
        if (!raw) return new Set();
        if (raw === 'true') return new Set(['*']);
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : ['*']);
    } catch {
        return new Set();
    }
}

async function writeDirtySet(storageKey: string, ids: Set<string>): Promise<void> {
    try {
        if (ids.size === 0) {
            await AsyncStorage.removeItem(dirtyKey(storageKey));
        } else {
            await AsyncStorage.setItem(dirtyKey(storageKey), JSON.stringify([...ids]));
        }
    } catch (e) {
        console.warn('[sync] Failed to update dirty flags:', e);
    }
}

/** Add entity IDs to the dirty set (cloud write failed for them). */
async function markDirty(storageKey: string, ids: string[]): Promise<void> {
    const set = await readDirtySet(storageKey);
    ids.forEach(id => set.add(id));
    await writeDirtySet(storageKey, set);
}

/**
 * Remove entity IDs after a successful cloud write.
 * Without `ids` (full save covering every entity) the whole set is cleared.
 * A legacy '*' marker is only cleared by full saves — the failed entities are unknown.
 */
async function clearDirty(storageKey: string, ids?: string[]): Promise<void> {
    if (!ids) {
        try {
            await AsyncStorage.removeItem(dirtyKey(storageKey));
        } catch (e) {
            console.warn('[sync] Failed to clear dirty flag:', e);
        }
        return;
    }
    const set = await readDirtySet(storageKey);
    if (set.has('*')) return;
    ids.forEach(id => set.delete(id));
    await writeDirtySet(storageKey, set);
}

async function isDirty(storageKey: string): Promise<boolean> {
    return (await readDirtySet(storageKey)).size > 0;
}

// ─── BIKES ───

interface BikeRow {
    id: string;
    name: string;
    type: string;
    model: string;
    year: string;
    size: string;
    weight: number | null;
}

interface ComponentRow {
    id: string;
    bike_id: string;
    type: string;
    brand: string;
    model: string;
    weight: string;
    purchase_date: string;
    setup_values: any;
    notes: string;
}

export interface SyncBike {
    id: string;
    name: string;
    type: string;
    model: string;
    year: string;
    size: string;
    weight?: number;
    components: SyncComponent[];
}

export interface WearItem {
    id: string;
    label: string;
    currentKm: number;
    serviceIntervalKm: number;
    lastServiceDate: string;
    installedDate: string;
    serviceHistory?: { date: string; note: string; type: string }[];
}

export interface SetupValue {
    key: string;
    value: string;
    unit?: string;
}

export interface SyncComponent {
    id: string;
    type: string;
    brand: string;
    model: string;
    name?: string;
    weight: string;
    purchaseDate: string;
    setupValues: SetupValue[];
    notes: string;
    price?: string;
    // --- Shred Check / Wear Tracking Fields ---
    isWearTracked?: boolean;
    currentKm?: number;
    serviceIntervalKm?: number;
    lastServiceDate?: string;
    installedDate?: string;
    wearItems?: WearItem[];
    maxClicks?: string;
    reboundMode?: string;
    compressionMode?: string;
}

const BIKES_KEY = '@bikepro_bikes';

/**
 * Legacy German setup-value labels → semantic keys.
 * Applied on load so stored data (local cache + cloud rows) keeps working.
 * Unknown/custom keys are passed through unchanged.
 */
export const SETUP_KEY_MIGRATION: Record<string, string> = {
    'Größe': 'size',
    'Breite': 'width',
    'Reifentyp': 'tire_type',
    'Karkasse': 'casing',
    'Montage': 'mount',
    'Druck': 'pressure',
    'Federweg': 'travel',
    'Hub': 'stroke',
    'Federhärte': 'spring_rate',
};

function migrateSetupValues(values: SetupValue[]): SetupValue[] {
    if (!Array.isArray(values)) return [];
    return values.map(v =>
        v && typeof v.key === 'string' && SETUP_KEY_MIGRATION[v.key]
            ? { ...v, key: SETUP_KEY_MIGRATION[v.key] }
            : v
    );
}

export async function syncLoadBikes(): Promise<SyncBike[]> {
    const { available } = await isCloudAvailable();
    const dirty = await isDirty(BIKES_KEY);

    // Skip cloud overwrite while local changes are unsynced
    if (available && !dirty) {
        try {
            const supabase = getSupabase()!;
            const { data: bikes, error } = await supabase.from('bikes').select('*').order('created_at');
            if (error) throw error;

            // Load components for all bikes
            const { data: comps, error: compErr } = await supabase.from('components').select('*');
            if (compErr) throw compErr;

            const result: SyncBike[] = (bikes ?? []).map(b => ({
                id: b.id, name: b.name, type: b.type,
                model: b.model, year: b.year, size: b.size ?? '',
                weight: b.weight ?? undefined,
                components: (comps ?? [])
                    .filter(c => c.bike_id === b.id)
                    .map(c => ({
                        id: c.id, type: c.type, brand: c.brand, model: c.model,
                        weight: c.weight, purchaseDate: c.purchase_date,
                        setupValues: migrateSetupValues(c.setup_values ?? []), notes: c.notes,
                        isWearTracked: c.is_wear_tracked ?? false,
                        currentKm: c.current_km ?? 0,
                        serviceIntervalKm: c.service_interval_km ?? 500,
                        lastServiceDate: c.last_service_date ?? new Date().toISOString().split('T')[0],
                        installedDate: c.installed_date ?? new Date().toISOString().split('T')[0],
                        wearItems: c.wear_items ?? [],
                        maxClicks: c.max_clicks ?? undefined,
                        reboundMode: c.rebound_mode ?? undefined,
                        compressionMode: c.compression_mode ?? undefined,
                        price: c.price,
                    })),
            }));

            // Cache locally
            await AsyncStorage.setItem(BIKES_KEY, JSON.stringify(result));
            return result;
        } catch (e) {
            console.warn('[sync] Cloud load bikes failed, using local:', e);
        }
    }

    // Fallback: local
    try {
        const data = await AsyncStorage.getItem(BIKES_KEY);
        const bikes: SyncBike[] = data ? JSON.parse(data) : [];
        // Migrate legacy German setup keys → semantic keys (same as cloud path)
        return bikes.map(b => ({
            ...b,
            components: (b.components ?? []).map(c => ({
                ...c,
                setupValues: migrateSetupValues(c.setupValues),
            })),
        }));
    } catch { return []; }
}

export async function syncSaveBikes(bikes: SyncBike[]): Promise<boolean> {
    // Always save locally
    await AsyncStorage.setItem(BIKES_KEY, JSON.stringify(bikes));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return true; // offline mode = ok

    let cloudOk = true;
    try {
        const supabase = getSupabase()!;

        // Upsert all bikes (no destructive deletes — deletions are handled explicitly)
        const bikeRows = bikes.map(b => ({
            id: b.id, user_id: userId, name: b.name, type: b.type,
            model: b.model, year: b.year, size: b.size, weight: b.weight ?? null,
        }));

        if (bikeRows.length > 0) {
            const { error } = await supabase.from('bikes').upsert(bikeRows, { onConflict: 'id' });
            if (error) {
                console.warn('[sync] Bike upsert error:', error.message);
                cloudOk = false;
            }
        }

        // Upsert all components (no destructive deletes)
        const compRows: any[] = [];
        bikes.forEach(b => {
            b.components.forEach(c => {
                compRows.push(componentToRow(b.id, c, userId));
            });
        });

        if (compRows.length > 0) {
            const { error } = await supabase.from('components').upsert(compRows, { onConflict: 'id' });
            if (error) {
                console.warn('[sync] Component upsert error:', error.message);
                cloudOk = false;
            }
        }
    } catch (e) {
        console.warn('[sync] Cloud save bikes failed:', e);
        cloudOk = false;
    }

    if (cloudOk) {
        await clearDirty(BIKES_KEY); // full save covers every entity
    } else {
        await markDirty(BIKES_KEY, bikes.flatMap(b => [b.id, ...b.components.map(c => c.id)]));
    }
    return cloudOk;
}

/**
 * Map a local component to a DB row.
 * Flat wear columns are derived from wearItems[0] — wearItems stays the single source of truth.
 */
function componentToRow(bikeId: string, c: SyncComponent, userId: string): any {
    const first = c.wearItems?.[0];
    return {
        id: c.id, user_id: userId, bike_id: bikeId, type: c.type,
        brand: c.brand, model: c.model, weight: c.weight,
        purchase_date: c.purchaseDate, setup_values: c.setupValues,
        notes: c.notes,
        is_wear_tracked: c.isWearTracked ?? false,
        current_km: first?.currentKm ?? c.currentKm ?? 0,
        service_interval_km: first?.serviceIntervalKm ?? c.serviceIntervalKm ?? 500,
        last_service_date: first?.lastServiceDate ?? c.lastServiceDate,
        installed_date: first?.installedDate ?? c.installedDate,
        wear_items: c.wearItems ?? [],
        max_clicks: c.maxClicks,
        rebound_mode: c.reboundMode,
        compression_mode: c.compressionMode,
        price: c.price,
    };
}

/** Keep flat wear fields consistent with wearItems (single source of truth). */
function normalizeComponent(component: SyncComponent): SyncComponent {
    const first = component.wearItems?.[0];
    return {
        ...component,
        currentKm: first?.currentKm ?? component.currentKm,
        serviceIntervalKm: first?.serviceIntervalKm ?? component.serviceIntervalKm,
        lastServiceDate: first?.lastServiceDate ?? component.lastServiceDate,
        installedDate: first?.installedDate ?? component.installedDate,
    };
}

/**
 * Targeted update of a single component: patches the local bikes cache and
 * upserts ONLY this component's row in the cloud (no full-tree resave).
 * Returns true when local write succeeded AND cloud write succeeded (or offline mode).
 */
export async function syncUpdateComponent(bikeId: string, component: SyncComponent): Promise<boolean> {
    return syncUpdateComponents(bikeId, [component]);
}

/**
 * Batch variant of syncUpdateComponent: reads/patches/writes the local bikes
 * cache exactly once and upserts all rows in a single cloud request — parallel
 * single updates would race on the cache (read-modify-write, last write wins).
 * Returns false (without cloud upsert) when bikeId is not in the local cache.
 */
export async function syncUpdateComponents(bikeId: string, components: SyncComponent[]): Promise<boolean> {
    if (components.length === 0) return true;
    const normalized = components.map(normalizeComponent);
    const ids = normalized.map(c => c.id);

    // Patch local cache (update in place, or append when new)
    try {
        const data = await AsyncStorage.getItem(BIKES_KEY);
        const bikes: SyncBike[] = data ? JSON.parse(data) : [];
        if (!bikes.some(b => b.id === bikeId)) {
            console.warn(`[sync] syncUpdateComponents: bike ${bikeId} not in local cache, skipping cloud upsert`);
            return false;
        }
        const updated = bikes.map(b => {
            if (b.id !== bikeId) return b;
            let comps = b.components;
            for (const n of normalized) {
                comps = comps.some(c => c.id === n.id)
                    ? comps.map(c => (c.id === n.id ? n : c))
                    : [...comps, n];
            }
            return { ...b, components: comps };
        });
        await AsyncStorage.setItem(BIKES_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn('[sync] Local component update failed:', e);
        return false;
    }

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return true; // offline mode = ok

    try {
        const supabase = getSupabase()!;
        const rows = normalized.map(c => componentToRow(bikeId, c, userId));
        const { error } = await supabase
            .from('components')
            .upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        await clearDirty(BIKES_KEY, ids);
        return true;
    } catch (e) {
        console.warn('[sync] Cloud component update failed:', e);
        await markDirty(BIKES_KEY, ids);
        return false;
    }
}

// ─── EXPLICIT DELETE FUNCTIONS (only called from UI delete actions) ───

export async function syncDeleteBike(bikeId: string): Promise<void> {
    const { available } = await isCloudAvailable();
    if (!available) return;

    try {
        const supabase = getSupabase()!;
        // Components cascade-delete via FK constraint
        const { error } = await supabase.from('bikes').delete().eq('id', bikeId);
        if (error) {
            console.warn('[sync] Delete bike error:', error.message);
        } else {
            await clearDirty(BIKES_KEY, [bikeId]);
        }
    } catch (e) {
        console.warn('[sync] Cloud delete bike failed:', e);
    }
}

export async function syncDeleteComponent(componentId: string): Promise<void> {
    const { available } = await isCloudAvailable();
    if (!available) return;

    try {
        const supabase = getSupabase()!;
        const { error } = await supabase.from('components').delete().eq('id', componentId);
        if (error) {
            console.warn('[sync] Delete component error:', error.message);
        } else {
            await clearDirty(BIKES_KEY, [componentId]);
        }
    } catch (e) {
        console.warn('[sync] Cloud delete component failed:', e);
    }
}

// ─── GENERIC TABLE SYNC (Setups, Rides) ───

export async function syncLoadTable<T extends { id: string }>(
    table: string,
    storageKey: string,
): Promise<T[]> {
    const { available } = await isCloudAvailable();
    const dirty = await isDirty(storageKey);

    // Skip cloud overwrite while local changes are unsynced
    if (available && !dirty) {
        try {
            const supabase = getSupabase()!;
            const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
            if (error) throw error;

            // Map DB columns to camelCase for setups
            const result = (data ?? []).map(row => mapRowToLocal(table, row) as T);

            // Cache locally
            await AsyncStorage.setItem(storageKey, JSON.stringify(result));
            return result;
        } catch (e) {
            console.warn(`[sync] Cloud load ${table} failed, using local:`, e);
        }
    }

    try {
        const d = await AsyncStorage.getItem(storageKey);
        return d ? JSON.parse(d) : [];
    } catch { return []; }
}

export async function syncSaveTable<T extends { id: string }>(
    table: string,
    storageKey: string,
    items: T[],
): Promise<boolean> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(items));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return true; // offline mode = ok

    try {
        const supabase = getSupabase()!;

        // Upsert all (no destructive deletes — deletions are handled explicitly)
        const rows = items.map(item => mapLocalToRow(table, item, userId));
        if (rows.length > 0) {
            const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
            if (error) {
                console.warn(`[sync] ${table} upsert error:`, error.message);
                await markDirty(storageKey, items.map(i => i.id));
                return false;
            }
        }
        await clearDirty(storageKey); // full save covers every entity
        return true;
    } catch (e) {
        console.warn(`[sync] Cloud save ${table} failed:`, e);
        await markDirty(storageKey, items.map(i => i.id));
        return false;
    }
}

export async function syncDeleteFromTable(table: string, storageKey: string, itemId: string): Promise<boolean> {
    // Update local storage
    try {
        const data = await AsyncStorage.getItem(storageKey);
        if (data) {
            const items = JSON.parse(data).filter((i: any) => i.id !== itemId);
            await AsyncStorage.setItem(storageKey, JSON.stringify(items));
        }
    } catch (e) {
        console.warn(`[sync] Local delete ${table} failed:`, e);
    }

    const { available } = await isCloudAvailable();
    if (!available) return true;

    try {
        const supabase = getSupabase()!;
        const { error } = await supabase.from(table).delete().eq('id', itemId);
        if (error) throw error;
        await clearDirty(storageKey, [itemId]);
        return true;
    } catch (e) {
        console.warn(`[sync] Cloud delete ${table} failed:`, e);
        return false;
    }
}

// ─── USER PREFERENCES ───

export async function syncLoadPreference<T>(key: string, storageKey: string): Promise<T | null> {
    const { available } = await isCloudAvailable();
    const dirty = await isDirty(storageKey);

    // Skip cloud overwrite while local changes are unsynced
    if (available && !dirty) {
        try {
            const supabase = getSupabase()!;
            const { data, error } = await supabase
                .from('user_preferences')
                .select('value')
                .eq('key', key)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                await AsyncStorage.setItem(storageKey, JSON.stringify(data.value));
                return data.value as T;
            }
        } catch (e) {
            console.warn(`[sync] Cloud load pref ${key} failed:`, e);
        }
    }

    try {
        const d = await AsyncStorage.getItem(storageKey);
        return d ? JSON.parse(d) : null;
    } catch { return null; }
}

export async function syncSavePreference<T>(key: string, storageKey: string, value: T): Promise<boolean> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return true; // offline mode = ok

    try {
        const supabase = getSupabase()!;
        const { error } = await supabase.from('user_preferences').upsert(
            { user_id: userId, key, value: value as any },
            { onConflict: 'user_id,key' }
        );
        if (error) {
            console.warn(`[sync] Pref save ${key} error:`, error.message);
            await markDirty(storageKey, [key]);
            return false;
        }
        await clearDirty(storageKey, [key]);
        return true;
    } catch (e) {
        console.warn(`[sync] Cloud save pref ${key} failed:`, e);
        await markDirty(storageKey, [key]);
        return false;
    }
}

// ─── WIKI OVERRIDES (Setup Guide admin content) ───

export interface WikiOverride {
    title?: string;
    summary?: string;
    content?: string;
    values?: string;
    tip?: string;
}

/**
 * Load admin content overrides for a locale (wiki_overrides table, RLS: public read).
 * Cloud-only — returns an empty map when Supabase is not configured.
 */
export async function syncLoadWikiOverrides(locale: string): Promise<Record<string, WikiOverride>> {
    const supabase = getSupabase();
    if (!supabase) return {};

    try {
        const { data, error } = await supabase
            .from('wiki_overrides')
            .select('*')
            .eq('locale', locale);
        if (error) throw error;

        const map: Record<string, WikiOverride> = {};
        for (const row of data ?? []) {
            map[row.article_id] = {
                title: row.title || undefined,
                summary: row.summary || undefined,
                content: row.content || undefined,
                values: row.values_text || undefined,
                tip: row.tip || undefined,
            };
        }
        return map;
    } catch (e) {
        console.warn('[sync] Load wiki overrides failed:', e);
        return {};
    }
}

/**
 * Upsert a single wiki override (admin only, enforced by RLS).
 * Returns true on success.
 */
export async function syncSaveWikiOverride(
    articleId: string,
    locale: string,
    override: WikiOverride,
): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('wiki_overrides')
            .upsert({
                article_id: articleId,
                locale,
                title: override.title || null,
                summary: override.summary || null,
                content: override.content || null,
                values_text: override.values || null,
                tip: override.tip || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'article_id,locale' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[sync] Save wiki override failed:', e);
        return false;
    }
}

// ─── RIDER PROFILE ───

export interface SyncProfile {
    weight?: string;
    height?: string;
    inseam?: string;
}

const PROFILE_KEY = '@bikepro_rider_profile';

export async function syncLoadProfile(): Promise<SyncProfile> {
    const data = await syncLoadPreference<SyncProfile>('rider_profile', PROFILE_KEY);
    return data ?? {};
}

export async function syncSaveProfile(profile: SyncProfile): Promise<boolean> {
    return syncSavePreference<SyncProfile>('rider_profile', PROFILE_KEY, profile);
}

// ─── ROW MAPPING ───

function mapRowToLocal(table: string, row: any): any {
    if (table === 'suspension_setups') {
        return {
            id: row.id,
            name: row.name,
            location: row.location,
            bikeId: row.bike_id ?? '',
            bikeName: row.bike_name ?? '',
            fork: row.fork ?? {},
            shock: row.shock ?? {},
            tires: row.tires ?? {},
            notes: row.notes ?? '',
            createdAt: row.created_at,
        };
    }
    if (table === 'rides') {
        return {
            // Remaining fields (trail, difficulty, elevationM, bikeId, setupId, setupFeel, wearTrackedKm) live in data JSONB.
            // Spread first so mapped fields below always win over data overflow.
            ...(row.data ?? {}),
            id: row.id,
            date: row.date,
            location: row.title ?? '',
            distanceKm: Number(row.distance) || 0,
            durationMin: Number(row.duration) || 0,
            descentM: Number(row.descent_m) || 0,
            maxSpeedKmh: Number(row.max_speed) || 0,
            bikeType: row.bike_type ?? '',
            condition: row.conditions ?? '',
            terrain: row.terrain ?? '',
            mood: row.mood ?? '',
            notes: row.notes ?? '',
            createdAt: row.created_at,
        };
    }
    return row;
}

function mapLocalToRow(table: string, item: any, userId: string): any {
    if (table === 'suspension_setups') {
        return {
            id: item.id, user_id: userId,
            name: item.name, location: item.location,
            bike_id: item.bikeId ?? '', bike_name: item.bikeName ?? '',
            fork: item.fork, shock: item.shock, tires: item.tires,
            notes: item.notes,
        };
    }
    if (table === 'rides') {
        return {
            id: item.id, user_id: userId,
            title: item.location ?? '', date: item.date,
            park: '',
            duration: String(item.durationMin ?? ''),
            distance: String(item.distanceKm ?? ''),
            descent_m: String(item.descentM ?? ''),
            max_speed: String(item.maxSpeedKmh ?? ''),
            bike_type: item.bikeType ?? '',
            conditions: item.condition ?? '',
            terrain: item.terrain ?? '',
            mood: item.mood ?? '',
            notes: item.notes ?? '',
            // Fields without a dedicated column go into the data JSONB column
            data: {
                trail: item.trail ?? '',
                difficulty: item.difficulty ?? '',
                elevationM: item.elevationM ?? 0,
                bikeId: item.bikeId ?? '',
                setupId: item.setupId ?? '',
                setupFeel: item.setupFeel ?? '',
                wearTrackedKm: item.wearTrackedKm ?? 0,
            },
        };
    }
    return { ...item, user_id: userId };
}

// ─── LOCAL DATA MIGRATION ───

const MIGRATION_KEY = '@bikepro_cloud_migrated';

// Guard against parallel migration runs (e.g. double login events)
let migrationInFlight: Promise<void> | null = null;

export function migrateLocalToCloud(): Promise<void> {
    if (migrationInFlight) return migrationInFlight;
    migrationInFlight = runMigration()
        .catch(e => console.warn('[sync] Migration failed:', e))
        .finally(() => { migrationInFlight = null; });
    return migrationInFlight;
}

async function runMigration(): Promise<void> {
    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return;

    // Migration flag is tracked per user
    const migrationKey = `${MIGRATION_KEY}_${userId}`;

    // Check if already migrated
    const migrated = await AsyncStorage.getItem(migrationKey);
    if (migrated === 'true') return;

    console.log('[sync] Migrating local data to cloud...');

    try {
        // Migrate bikes
        const bikesData = await AsyncStorage.getItem(BIKES_KEY);
        if (bikesData) {
            const bikes: SyncBike[] = JSON.parse(bikesData);
            if (bikes.length > 0) await syncSaveBikes(bikes);
        }

        // Migrate setups
        const setupsData = await AsyncStorage.getItem('@bikepro_setups');
        if (setupsData) {
            const setups = JSON.parse(setupsData);
            if (setups.length > 0) {
                await syncSaveTable('suspension_setups', '@bikepro_setups', setups);
            }
        }

        // Migrate rides
        const ridesData = await AsyncStorage.getItem('@bikepro_rides');
        if (ridesData) {
            const rides = JSON.parse(ridesData);
            if (rides.length > 0) {
                await syncSaveTable('rides', '@bikepro_rides', rides);
            }
        }

        // Migrate preferences
        const favData = await AsyncStorage.getItem('@bikepro_park_favorites');
        if (favData) {
            await syncSavePreference('park_favorites', '@bikepro_park_favorites', JSON.parse(favData));
        }

        const tileData = await AsyncStorage.getItem('@bikepro_tile_order');
        if (tileData) {
            await syncSavePreference('tile_order', '@bikepro_tile_order', JSON.parse(tileData));
        }

        await AsyncStorage.setItem(migrationKey, 'true');
        console.log('[sync] Migration complete!');
    } catch (e) {
        console.warn('[sync] Migration failed:', e);
    }
}
