/**
 * Sync Service — Cloud-Sync Layer für BikePro
 *
 * Modes:
 * - Authenticated (Supabase configured + user logged in): Read/write to Supabase, cache in AsyncStorage
 * - Offline: Read/write to AsyncStorage only
 *
 * Features:
 * - syncLoad: Load data from Supabase (fallback AsyncStorage)
 * - syncSave: Save data to Supabase + AsyncStorage
 * - syncDelete: Delete from Supabase + AsyncStorage
 * - syncPreference: Save/load user preferences (favorites, tile order, etc.)
 * - migrateLocalToCloud: One-time migration of local data on first login
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from './supabase';

// ─── Generic Helpers ───

function getAuthUserId(): string | null {
    const supabase = getSupabase();
    if (!supabase) return null;
    // We access the session synchronously from the cached data
    // This works because AuthContext already initializes the session
    try {
        // @ts-ignore — accessing internal cached session
        const session = (supabase.auth as any).currentSession;
        return session?.user?.id ?? null;
    } catch { return null; }
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

// ─── BIKES ───

interface BikeRow {
    id: string;
    name: string;
    type: string;
    model: string;
    year: string;
    size: string;
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
    components: SyncComponent[];
}

export interface SyncComponent {
    id: string;
    type: string;
    brand: string;
    model: string;
    weight: string;
    purchaseDate: string;
    setupValues: any[];
    notes: string;
    // --- Shred Check / Wear Tracking Fields ---
    isWearTracked?: boolean;
    currentKm?: number;
    serviceIntervalKm?: number;
    lastServiceDate?: string;
    installedDate?: string;
}

const BIKES_KEY = '@bikepro_bikes';

export async function syncLoadBikes(): Promise<SyncBike[]> {
    const { available } = await isCloudAvailable();

    if (available) {
        try {
            const supabase = getSupabase()!;
            const { data: bikes, error } = await supabase.from('bikes').select('*').order('created_at');
            if (error) throw error;

            // Load components for all bikes
            const { data: comps, error: compErr } = await supabase.from('components').select('*');
            if (compErr) throw compErr;

            const result: SyncBike[] = (bikes ?? []).map(b => ({
                id: b.id, name: b.name, type: b.type,
                model: b.model, year: b.year, size: b.size ?? 'L',
                components: (comps ?? [])
                    .filter(c => c.bike_id === b.id)
                    .map(c => ({
                        id: c.id, type: c.type, brand: c.brand, model: c.model,
                        weight: c.weight, purchaseDate: c.purchase_date,
                        setupValues: c.setup_values ?? [], notes: c.notes,
                        isWearTracked: c.is_wear_tracked ?? false,
                        currentKm: c.current_km ?? 0,
                        serviceIntervalKm: c.service_interval_km ?? 500,
                        lastServiceDate: c.last_service_date ?? new Date().toISOString().split('T')[0],
                        installedDate: c.installed_date ?? new Date().toISOString().split('T')[0],
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
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

export async function syncSaveBikes(bikes: SyncBike[]): Promise<void> {
    // Always save locally
    await AsyncStorage.setItem(BIKES_KEY, JSON.stringify(bikes));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return;

    try {
        const supabase = getSupabase()!;

        // Upsert all bikes
        const bikeRows = bikes.map(b => ({
            id: b.id, user_id: userId, name: b.name, type: b.type,
            model: b.model, year: b.year, size: b.size,
        }));

        if (bikeRows.length > 0) {
            const { error } = await supabase.from('bikes').upsert(bikeRows, { onConflict: 'id' });
            if (error) console.warn('[sync] Bike upsert error:', error.message);
        }

        // Delete bikes not in the list anymore
        const existingBikeIds = bikes.map(b => b.id);
        await supabase.from('bikes').delete().not('id', 'in', `(${existingBikeIds.join(',')})`);

        // Upsert all components
        const compRows: any[] = [];
        bikes.forEach(b => {
            b.components.forEach(c => {
                compRows.push({
                    id: c.id, user_id: userId, bike_id: b.id, type: c.type,
                    brand: c.brand, model: c.model, weight: c.weight,
                    purchase_date: c.purchaseDate, setup_values: c.setupValues,
                    notes: c.notes,
                    is_wear_tracked: c.isWearTracked ?? false,
                    current_km: c.currentKm ?? 0,
                    service_interval_km: c.serviceIntervalKm ?? 500,
                    last_service_date: c.lastServiceDate,
                    installed_date: c.installedDate,
                });
            });
        });

        if (compRows.length > 0) {
            const { error } = await supabase.from('components').upsert(compRows, { onConflict: 'id' });
            if (error) console.warn('[sync] Component upsert error:', error.message);
        }

        // Delete orphaned components
        const allCompIds = compRows.map(c => c.id);
        if (allCompIds.length > 0) {
            await supabase.from('components').delete().not('id', 'in', `(${allCompIds.join(',')})`);
        } else {
            // If no components, delete all for this user
            await supabase.from('components').delete().neq('id', '__impossible__');
        }
    } catch (e) {
        console.warn('[sync] Cloud save bikes failed:', e);
    }
}

// ─── GENERIC TABLE SYNC (Setups, Rides) ───

export async function syncLoadTable<T extends { id: string }>(
    table: string,
    storageKey: string,
): Promise<T[]> {
    const { available } = await isCloudAvailable();

    if (available) {
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
): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(items));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return;

    try {
        const supabase = getSupabase()!;

        // Upsert all
        const rows = items.map(item => mapLocalToRow(table, item, userId));
        if (rows.length > 0) {
            const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
            if (error) console.warn(`[sync] ${table} upsert error:`, error.message);
        }

        // Delete removed items
        const ids = items.map(i => i.id);
        if (ids.length > 0) {
            await supabase.from(table).delete().not('id', 'in', `(${ids.join(',')})`);
        } else {
            await supabase.from(table).delete().neq('id', '__impossible__');
        }
    } catch (e) {
        console.warn(`[sync] Cloud save ${table} failed:`, e);
    }
}

// ─── USER PREFERENCES ───

export async function syncLoadPreference<T>(key: string, storageKey: string): Promise<T | null> {
    const { available } = await isCloudAvailable();

    if (available) {
        try {
            const supabase = getSupabase()!;
            const { data, error } = await supabase
                .from('user_preferences')
                .select('value')
                .eq('key', key)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

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

export async function syncSavePreference<T>(key: string, storageKey: string, value: T): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));

    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return;

    try {
        const supabase = getSupabase()!;
        const { error } = await supabase.from('user_preferences').upsert(
            { user_id: userId, key, value: value as any },
            { onConflict: 'user_id,key' }
        );
        if (error) console.warn(`[sync] Pref save ${key} error:`, error.message);
    } catch (e) {
        console.warn(`[sync] Cloud save pref ${key} failed:`, e);
    }
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
            id: row.id,
            title: row.title,
            date: row.date,
            park: row.park ?? '',
            duration: row.duration ?? '',
            distance: row.distance ?? '',
            descentM: row.descent_m ?? '',
            maxSpeedKmh: row.max_speed ?? '',
            bikeType: row.bike_type ?? '',
            conditions: row.conditions ?? '',
            terrain: row.terrain ?? '',
            mood: row.mood ?? '',
            notes: row.notes ?? '',
            ...(row.data ?? {}),
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
            title: item.title, date: item.date,
            park: item.park ?? '', duration: item.duration ?? '',
            distance: item.distance ?? '',
            descent_m: item.descentM ?? '',
            max_speed: item.maxSpeedKmh ?? '',
            bike_type: item.bikeType ?? '',
            conditions: item.conditions ?? '',
            terrain: item.terrain ?? '',
            mood: item.mood ?? '',
            notes: item.notes ?? '',
        };
    }
    return { ...item, user_id: userId };
}

// ─── LOCAL DATA MIGRATION ───

const MIGRATION_KEY = '@bikepro_cloud_migrated';

export async function migrateLocalToCloud(): Promise<void> {
    const { available, userId } = await isCloudAvailable();
    if (!available || !userId) return;

    // Check if already migrated
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
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

        const shredData = await AsyncStorage.getItem('@bikepro_components');
        if (shredData) {
            await syncSavePreference('shred_check', '@bikepro_components', JSON.parse(shredData));
        }

        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        console.log('[sync] Migration complete!');
    } catch (e) {
        console.warn('[sync] Migration failed:', e);
    }
}
