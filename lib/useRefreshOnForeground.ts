/**
 * Refresh-on-foreground hook.
 *
 * Fires the given callback when the app/web tab becomes visible again
 * (web: document visibilitychange, native: AppState 'active'), throttled by
 * minIntervalMs. Cloud loads use dirty/pending flags internally, so a refresh
 * never overwrites unsynced local changes.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

export function useRefreshOnForeground(refresh: () => void, minIntervalMs = 30_000): void {
    const lastRefresh = useRef(Date.now());
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    useEffect(() => {
        const maybeRefresh = () => {
            const now = Date.now();
            if (now - lastRefresh.current < minIntervalMs) return;
            lastRefresh.current = now;
            refreshRef.current();
        };

        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return;
            const onVisibilityChange = () => {
                if (document.visibilityState === 'visible') maybeRefresh();
            };
            document.addEventListener('visibilitychange', onVisibilityChange);
            return () => document.removeEventListener('visibilitychange', onVisibilityChange);
        }

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') maybeRefresh();
        });
        return () => subscription.remove();
    }, [minIntervalMs]);
}
