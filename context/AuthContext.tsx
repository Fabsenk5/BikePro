/**
 * Auth Context — Manages user authentication state
 * Uses Supabase Auth when configured, falls back to offline mode.
 */
import { ADMIN_EMAIL, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { migrateLocalToCloud } from '@/lib/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAdmin: boolean;
    isActive: boolean;
    isLoading: boolean;
    isConfigured: boolean;
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
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

const OFFLINE_USER_KEY = '@bikepro_offline_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const checkActivationStatus = async (userId: string) => {
        const supabase = getSupabase();
        if (!supabase) return;
        try {
            // Timeout after 5s to prevent infinite loading on network issues
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
            const query = supabase.from('profiles').select('is_active').eq('id', userId).single();
            const result = await Promise.race([query, timeout]);
            if (result && 'data' in result) {
                setIsActive(!!result.data?.is_active);
            } else {
                console.warn('[auth] checkActivationStatus timed out, defaulting to inactive');
                setIsActive(false);
            }
        } catch (e) {
            console.warn('[auth] checkActivationStatus failed:', e);
            setIsActive(false);
        }
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
                        migrateLocalToCloud();
                    });
                } else {
                    setIsLoading(false);
                }
            }).catch((e) => {
                clearTimeout(sessionTimeout);
                console.warn('[auth] getSession failed:', e);
                setIsLoading(false);
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    checkActivationStatus(session.user.id);
                } else {
                    setIsActive(false);
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
            migrateLocalToCloud();
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
            return { error: null };
        } else {
            return signIn(email, password);
        }
    };

    const signOut = async () => {
        const supabase = getSupabase();
        if (isSupabaseConfigured && supabase) {
            await supabase.auth.signOut();
        }
        await AsyncStorage.removeItem(OFFLINE_USER_KEY);
        setUser(null);
        setSession(null);
        setIsActive(false);
    };

    return (
        <AuthContext.Provider value={{
            user, session, isAdmin, isActive, isLoading,
            isConfigured: isSupabaseConfigured,
            signIn, signUp, signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
