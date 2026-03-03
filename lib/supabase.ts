/**
 * Supabase Client Setup
 * Coordinator Agent: Zentrale DB-Verbindung für alle Features.
 * 
 * TODO: Ersetze die Platzhalter mit echten Supabase-Credentials.
 * Erstelle ein Supabase-Projekt unter https://supabase.com
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Placeholder — replace with real values from your Supabase project
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Supabase client will be initialized when credentials are provided
// For now, all features use AsyncStorage as local-first storage
export { SUPABASE_ANON_KEY, SUPABASE_URL };

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
