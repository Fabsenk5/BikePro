/**
 * Auth Context — Manages user authentication state
 * Uses Supabase Auth when configured, falls back to offline mode.
 */
import { ADMIN_EMAIL, getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAdmin: boolean;
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
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    useEffect(() => {
        const supabase = getSupabase();

        if (isSupabaseConfigured && supabase) {
            // Supabase mode — listen for auth changes
            supabase.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
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
    };

    return (
        <AuthContext.Provider value={{
            user, session, isAdmin, isLoading,
            isConfigured: isSupabaseConfigured,
            signIn, signUp, signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
