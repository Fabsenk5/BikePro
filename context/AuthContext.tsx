/**
 * Auth Context — Manages user authentication state
 * Uses Supabase Auth when configured, falls back to offline mode.
 */
import { ADMIN_EMAIL, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { migrateLocalToCloud } from '@/lib/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAdmin: boolean;
    isActive: boolean;
    isLoading: boolean;
    isConfigured: boolean;
    /** True while the session comes from a password-recovery link (show reset form). */
    isPasswordRecovery: boolean;
    /** True once the activation check for the current user has finished (success or gave up). */
    activationChecked: boolean;
    /** Set when the activation check failed after all retries. */
    activationError: string | null;
    /** Re-run the activation check for the current user. */
    retryActivation: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    isAdmin: false,
    isActive: false,
    isLoading: true,
    isConfigured: false,
    isPasswordRecovery: false,
    activationChecked: false,
    activationError: null,
    retryActivation: async () => { },
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

const OFFLINE_USER_KEY = '@bikepro_offline_user';
const BIKEPRO_PREFIX = '@bikepro_';
// Fallback list if AsyncStorage.getAllKeys() is unavailable/fails
const BIKEPRO_KEYS_FALLBACK = [
    '@bikepro_bikes',
    '@bikepro_setups',
    '@bikepro_rides',
    '@bikepro_rider_profile',
    '@bikepro_park_favorites',
    '@bikepro_tile_order',
    '@bikepro_favorites',
    '@bikepro_checklists',
    '@bikepro_category_order',
    '@bikepro_article_order',
    '@bikepro_language',
    OFFLINE_USER_KEY,
];

const ACTIVATION_TIMEOUT_MS = 5000;
const ACTIVATION_MAX_ATTEMPTS = 3;
const ACTIVATION_RETRY_DELAY_MS = 3000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [activationChecked, setActivationChecked] = useState(false);
    const [activationError, setActivationError] = useState<string | null>(null);
    // Deduplicates concurrent activation checks for the same user
    // (getSession and onAuthStateChange both fire on startup)
    const activationInFlight = useRef<{ userId: string; promise: Promise<void> } | null>(null);

    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const checkActivationStatus = (userId: string): Promise<void> => {
        const supabase = getSupabase();
        if (!supabase) {
            setActivationChecked(true);
            return Promise.resolve();
        }
        // Reuse an already running check for the same user
        if (activationInFlight.current?.userId === userId) {
            return activationInFlight.current.promise;
        }
        setActivationChecked(false);

        const promise = (async () => {
            for (let attempt = 1; attempt <= ACTIVATION_MAX_ATTEMPTS; attempt++) {
                try {
                    // Timeout to prevent infinite loading on network issues
                    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ACTIVATION_TIMEOUT_MS));
                    const query = supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle();
                    const result = await Promise.race([query, timeout]);
                    if (result && 'data' in result) {
                        setIsActive(!!result.data?.is_active);
                        setActivationError(null);
                        setActivationChecked(true);
                        return;
                    }
                    console.warn(`[auth] checkActivationStatus timed out (attempt ${attempt}/${ACTIVATION_MAX_ATTEMPTS})`);
                } catch (e) {
                    console.warn(`[auth] checkActivationStatus failed (attempt ${attempt}/${ACTIVATION_MAX_ATTEMPTS}):`, e);
                }
                if (attempt < ACTIVATION_MAX_ATTEMPTS) {
                    await new Promise((r) => setTimeout(r, ACTIVATION_RETRY_DELAY_MS));
                }
            }
            // All retries exhausted — keep isActive=false but surface an error state instead of a silent dead end
            console.warn('[auth] checkActivationStatus gave up, defaulting to inactive');
            setIsActive(false);
            setActivationError('activation_check_failed');
            setActivationChecked(true);
        })();

        activationInFlight.current = { userId, promise };
        return promise.finally(() => {
            if (activationInFlight.current?.promise === promise) {
                activationInFlight.current = null;
            }
        });
    };

    const retryActivation = async () => {
        if (!user) return;
        setActivationError(null);
        await checkActivationStatus(user.id);
    };

    useEffect(() => {
        const supabase = getSupabase();

        if (isSupabaseConfigured && supabase) {
            // Supabase mode — listen for auth changes
            // Timeout after 8s to prevent infinite loading on network issues
            const sessionTimeout = setTimeout(() => {
                console.warn('[auth] getSession timed out, setting isLoading=false');
                setIsLoading(false);
            }, 8000);

            supabase.auth.getSession().then(({ data: { session } }) => {
                clearTimeout(sessionTimeout);
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    checkActivationStatus(session.user.id).then(() => {
                        setIsLoading(false);
                        migrateLocalToCloud().catch((e) => console.warn('[sync] migrateLocalToCloud failed:', e));
                    });
                } else {
                    setIsLoading(false);
                }
            }).catch((e) => {
                clearTimeout(sessionTimeout);
                console.warn('[auth] getSession failed:', e);
                setIsLoading(false);
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    setIsPasswordRecovery(true);
                } else if (event === 'SIGNED_OUT') {
                    setIsPasswordRecovery(false);
                }
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    checkActivationStatus(session.user.id);
                } else {
                    setIsActive(false);
                    setActivationChecked(false);
                    setActivationError(null);
                }
            });

            return () => subscription.unsubscribe();
        } else {
            // Offline mode — load from AsyncStorage
            loadOfflineUser().then(() => setIsLoading(false));
        }
    }, []);

    const loadOfflineUser = async () => {
        try {
            const data = await AsyncStorage.getItem(OFFLINE_USER_KEY);
            if (data) {
                const offlineUser = JSON.parse(data);
                setUser(offlineUser);
            }
        } catch (e) {
            console.warn('Failed to load offline user:', e);
        }
    };

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        const supabase = getSupabase();
        if (isSupabaseConfigured && supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return { error: error.message };
            setUser(data.user);
            setSession(data.session);
            if (data.user) {
                await checkActivationStatus(data.user.id);
            }
            migrateLocalToCloud().catch((e) => console.warn('[sync] migrateLocalToCloud failed:', e));
            return { error: null };
        } else {
            // Offline mode: simple email/password stored locally
            const offlineUser = {
                id: 'offline-' + Date.now(),
                email,
                app_metadata: {},
                user_metadata: { display_name: email.split('@')[0] },
                aud: 'authenticated',
                created_at: new Date().toISOString(),
            } as unknown as User;
            await AsyncStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(offlineUser));
            setUser(offlineUser);
            return { error: null };
        }
    };

    const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
        const supabase = getSupabase();
        if (isSupabaseConfigured && supabase) {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) return { error: error.message };
            if (data.user && !data.session) {
                return { error: null }; // Email confirmation required
            }
            setUser(data.user);
            setSession(data.session);
            if (data.user) {
                await checkActivationStatus(data.user.id);
            }
            migrateLocalToCloud().catch((e) => console.warn('[sync] migrateLocalToCloud failed:', e));
            return { error: null };
        } else {
            return signIn(email, password);
        }
    };

    const clearLocalData = async () => {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const bikeproKeys = keys.filter((k) => k.startsWith(BIKEPRO_PREFIX));
            await Promise.all(bikeproKeys.map((k) => AsyncStorage.removeItem(k)));
        } catch (e) {
            console.warn('[auth] getAllKeys failed, falling back to known keys:', e);
            try {
                await Promise.all(BIKEPRO_KEYS_FALLBACK.map((k) => AsyncStorage.removeItem(k)));
            } catch (e2) {
                console.warn('[auth] Failed to clear local data:', e2);
            }
        }
    };

    const signOut = async () => {
        const supabase = getSupabase();
        if (isSupabaseConfigured && supabase) {
            await supabase.auth.signOut();
        }
        // Remove all @bikepro_* caches so a different account on this device
        // never sees data of the previous user
        await clearLocalData();
        setUser(null);
        setSession(null);
        setIsActive(false);
        setIsPasswordRecovery(false);
        setActivationChecked(false);
        setActivationError(null);
    };

    return (
        <AuthContext.Provider value={{
            user, session, isAdmin, isActive, isLoading,
            isConfigured: isSupabaseConfigured,
            isPasswordRecovery,
            activationChecked, activationError, retryActivation,
            signIn, signUp, signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
