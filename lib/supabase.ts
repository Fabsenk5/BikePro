/**
 * Supabase Client & Storage Helpers
 *
 * SETUP: Erstelle ein Supabase-Projekt unter https://supabase.com
 * und setze die Environment-Variablen:
 *   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
 *
 * Lokal: Erstelle eine .env Datei im Projekt-Root
 * Vercel: Setze die Vars unter Project Settings → Environment Variables
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if credentials are available
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage as any,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false, // Expo does not support URL-based auth
        },
    })
    : null;

export const isSupabaseConfigured = !!supabase;

// Admin email — gets admin privileges
export const ADMIN_EMAIL = 'fabiank5@hotmail.com';

/**
 * Generic AsyncStorage helper for CRUD operations.
 * Used by all features until Supabase migration.
 */
export async function loadFromStorage<T>(key: string): Promise<T[]> {
    try {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.warn(`Failed to load ${key}:`, e);
        return [];
    }
}

export async function saveToStorage<T>(key: string, data: T[]): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`Failed to save ${key}:`, e);
    }
}
